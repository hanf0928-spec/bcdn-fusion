'use strict';

/**
 * Tencent Cloud Tag service — resolve a (TagKey, TagValue) pair into the
 * matching EO zone-id list, so the caller can feed those zone-ids into
 * `DescribeBillingData.ZoneIds`.
 *
 *   POST https://tag.tencentcloudapi.com/
 *   Auth : TC3-HMAC-SHA256 (same signing scheme as EO)
 *     SecretId  = customer.api_user
 *     SecretKey = customer.api_key
 *   Headers:
 *     X-TC-Action    : DescribeResourcesByTags
 *     X-TC-Version   : 2018-08-13
 *     X-TC-Timestamp : <unix seconds>
 *     Content-Type   : application/json; charset=utf-8
 *     Authorization  : TC3-HMAC-SHA256 ...
 *   Body (JSON):
 *     {
 *       "TagFilters": [{ "TagKey": "<k>", "TagValue": ["<v>"] }],
 *       "ServiceType": "teo",
 *       "ResourcePrefix": "zone",
 *       "Offset": 0,
 *       "Limit": 100
 *     }
 *   Response:
 *     { "Response": {
 *         "TotalCount": <int>,
 *         "Offset": <int>, "Limit": <int>,
 *         "Rows": [
 *           { "ResourceId": "zone-xxx", "ServiceType": "teo",
 *             "ResourcePrefix": "zone",
 *             "TagKeyValues": [{ "TagKey": "...", "TagValue": "..." }],
 *             ... },
 *           ...
 *         ]
 *       } }
 *
 * We page the request with Offset/Limit=100 until the full TotalCount is
 * drained, dedupe, and return the ordered zone-id list.
 */

const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_BASE = process.env.EO_TAG_BASE_URL || 'https://tag.tencentcloudapi.com';
const TC_SERVICE   = 'tag';
const TC_ACTION    = 'DescribeResourcesByTags';
const TC_VERSION   = '2018-08-13';
const PAGE_SIZE    = 100;

/**
 * Resolve a tag (key=value) pair into the matching EO zone-id list.
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey    SecretKey
 * @param {string} cfg.apiUser   SecretId
 * @param {string} cfg.tagKey    Tag key (required, non-empty)
 * @param {string} cfg.tagValue  Tag value (required, non-empty)
 * @param {string} [cfg.baseUrl] Override tag endpoint
 * @returns {Promise<string[]>}  Unique zone-id list, order-preserving.
 */
async function resolveZoneIdsByTag(cfg) {
  if (!cfg.apiKey)   throw new Error('eoTag: api_key (SecretKey) is required');
  if (!cfg.apiUser)  throw new Error('eoTag: api_user (SecretId) is required');
  if (!cfg.tagKey   || !String(cfg.tagKey).trim())   throw new Error('eoTag: tagKey is required');
  if (!cfg.tagValue || !String(cfg.tagValue).trim()) throw new Error('eoTag: tagValue is required');

  const baseUrl = normalizeBase(cfg.baseUrl);
  const seen    = new Set();
  const zoneIds = [];

  let offset = 0;
  // Safety upper bound: 10,000 zones is well above any realistic account.
  // Keeps a malformed TotalCount from pinning us in an infinite loop.
  const HARD_CAP = 10000;

  // Loop until we have drained TotalCount (reported on first page) or hit
  // an empty page.
  while (true) {
    const resp = await callOneWindowWithRetry({
      baseUrl,
      secretId:  cfg.apiUser,
      secretKey: cfg.apiKey,
      tagKey:    String(cfg.tagKey).trim(),
      tagValue:  String(cfg.tagValue).trim(),
      offset,
      limit:     PAGE_SIZE,
    });
    const rows  = Array.isArray(resp.Rows) ? resp.Rows : [];
    const total = Number(resp.TotalCount || 0);

    for (const row of rows) {
      // tag service returns bare resource-id as `ResourceId` for EO zones
      // (confirmed via API Explorer); fall back to Resource.ResourceId
      // when the service wraps the record (safety for future revisions).
      const zid = row && (row.ResourceId || (row.Resource && row.Resource.ResourceId));
      if (!zid) continue;
      const s = String(zid);
      if (seen.has(s)) continue;
      seen.add(s);
      zoneIds.push(s);
      if (zoneIds.length >= HARD_CAP) break;
    }

    if (zoneIds.length >= HARD_CAP) break;
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (total > 0 && offset >= total) break;
    // tiny breather between pages
    await sleep(100);
  }

  return zoneIds;
}

/** Low-level: sign + send a single page request. Returns Response payload. */
async function callOneWindow({ baseUrl, secretId, secretKey, tagKey, tagValue, offset, limit }) {
  const payload = JSON.stringify({
    TagFilters:     [{ TagKey: tagKey, TagValue: [tagValue] }],
    ServiceType:    'teo',
    ResourcePrefix: 'zone',
    Offset:         offset,
    Limit:          limit,
  });

  const u    = new URL(baseUrl);
  const host = u.hostname;
  const tsSec   = Math.floor(Date.now() / 1000);
  const dateUtc = utcDateStr(tsSec);

  // ----- Step 1: canonical request (lowercased signed headers, sorted) -----
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-tc-action:${TC_ACTION.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedPayload = sha256Hex(payload);
  const canonicalRequest =
    'POST\n' +
    '/\n' +
    '\n' +
    canonicalHeaders +
    '\n' +
    signedHeaders + '\n' +
    hashedPayload;

  // ----- Step 2: string to sign -----
  const credentialScope = `${dateUtc}/${TC_SERVICE}/tc3_request`;
  const stringToSign =
    'TC3-HMAC-SHA256\n' +
    `${tsSec}\n` +
    `${credentialScope}\n` +
    sha256Hex(canonicalRequest);

  // ----- Step 3: signing key -----
  const kDate    = hmacSha256(`TC3${secretKey}`, dateUtc);
  const kService = hmacSha256(kDate, TC_SERVICE);
  const kSigning = hmacSha256(kService, 'tc3_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  // ----- Step 4: Authorization header -----
  const authorization =
    `TC3-HMAC-SHA256 ` +
    `Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const headers = {
    'Authorization':  authorization,
    'Content-Type':   'application/json; charset=utf-8',
    'Host':           host,
    'X-TC-Action':    TC_ACTION,
    'X-TC-Version':   TC_VERSION,
    'X-TC-Timestamp': String(tsSec),
    'User-Agent':     'BCDN-Fusion/1.0',
  };

  const resp = await httpPostJSON(baseUrl, payload, headers);
  if (!resp || !resp.Response) throw new Error('eoTag: empty / invalid response');
  if (resp.Response.Error) {
    const e = resp.Response.Error;
    throw new Error(`eoTag API error: code=${e.Code}, message=${e.Message}`);
  }
  return resp.Response;
}

/** Same as callOneWindow with one transient-error retry. */
async function callOneWindowWithRetry(args) {
  const TRANSIENT_RE = /(socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN|Request timeout|read ECONNRESET)/i;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await callOneWindow(args); }
    catch (e) {
      lastErr = e;
      if (!TRANSIENT_RE.test(String(e && e.message))) break;
      await sleep(400 + attempt * 600);
    }
  }
  throw lastErr;
}

// -------- helpers --------

function normalizeBase(input) {
  const fallback = DEFAULT_BASE.replace(/\/+$/, '');
  const raw = String(input || '').trim().replace(/\/+$/, '');
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fallback;
    return `${u.protocol}//${u.host}`;
  } catch (_) { return fallback; }
}

function sha256Hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function hmacSha256(key, data) { return crypto.createHmac('sha256', key).update(data, 'utf8').digest(); }
function utcDateStr(tsSec) {
  const d = new Date(tsSec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpPostJSON(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return reject(new Error(`eoTag: only https is supported (got ${u.protocol})`));
    }
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: (u.pathname && u.pathname !== '/' ? u.pathname : '/') + (u.search || ''),
      method: 'POST',
      agent: false,
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body),
        'Connection':     'close',
      },
    }, (res) => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 300)}`));
        }
        try { resolve(JSON.parse(buf)); }
        catch (_) { reject(new Error(`Invalid JSON from upstream: ${buf.slice(0, 300)}`)); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('Request timeout')));
    req.write(body);
    req.end();
  });
}

module.exports = { resolveZoneIdsByTag };
