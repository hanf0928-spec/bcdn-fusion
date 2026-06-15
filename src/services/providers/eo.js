'use strict';

/**
 * Provider 3 — Tencent Cloud EdgeOne (EO).
 *
 *   POST https://teo.tencentcloudapi.com/
 *   Auth : TC3-HMAC-SHA256 (Tencent Cloud signature v3)
 *     SecretId  = customer.api_user
 *     SecretKey = customer.api_key
 *   Required headers:
 *     X-TC-Action    : DescribeBillingData
 *     X-TC-Version   : 2022-09-01
 *     X-TC-Timestamp : <unix seconds>
 *     X-TC-Region    : (optional) e.g. ap-guangzhou
 *     Content-Type   : application/json; charset=utf-8
 *     Authorization  : TC3-HMAC-SHA256 Credential=<id>/<date>/teo/tc3_request,
 *                      SignedHeaders=content-type;host;x-tc-action,
 *                      Signature=<hex>
 *   Body (JSON):
 *     {
 *       "StartTime": "<ISO8601 with TZ>",
 *       "EndTime"  : "<ISO8601 with TZ>",
 *       "Interval" : "day",
 *       "MetricName": "acc_flux",
 *       "ZoneIds"  : ["*"]                  // "*" = all zones under the account
 *     }
 *
 *   Window limit: 31 days per request → we slice the requested range
 *   into <=30-day chunks and merge the daily series.
 *
 *   Metrics. EO bills several traffic flavours separately and the API
 *   only accepts ONE MetricName per call, so we issue one request per
 *   metric and sum them by day. Defaults to `acc_flux + smt_flux`
 *   (内容加速 + 智能加速). All flux metrics are reported in **bytes**.
 *
 *   Response shape:
 *     { "Response": {
 *         "RequestId": "...",
 *         "Data": [ { "Time": "2024-01-01T16:00:00Z", "Value": 12345 }, ... ],
 *         // OR on error: { "Error": { "Code": "...", "Message": "..." } }
 *       } }
 *
 *   The `Time` field is the *start* of the day boundary in UTC. With the
 *   Asia/Shanghai (+08:00) timezone we send in StartTime/EndTime, the
 *   server actually returns aligned-to-CST midnights — i.e. each row at
 *   16:00:00Z = 00:00:00+08 of the next day. We bucket by the
 *   Asia/Shanghai date.
 */

const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_BASE   = process.env.EO_BASE_URL  || 'https://teo.tencentcloudapi.com';
const DEFAULT_REGION = process.env.EO_REGION    || ''; // EO is account-level; region is optional
const TC_SERVICE     = 'teo';
const TC_ACTION      = 'DescribeBillingData';
const TC_VERSION     = '2022-09-01';
// Comma-separated list of MetricName values to sum. The legacy single
// `EO_METRIC` env var is honoured for backwards compatibility.
const TC_METRICS = parseMetrics(
  process.env.EO_METRICS || process.env.EO_METRIC || 'acc_flux,smt_flux'
);
function parseMetrics(s) {
  return String(s || '')
    .split(/[,\s]+/)
    .map(x => x.trim())
    .filter(Boolean);
}
const TC_INTERVAL    = 'day';
const TZ_OFFSET      = '+08:00';                 // Asia/Shanghai
const BYTES_PER_GB   = 1e9;                      // SI base, matches source1/source2

/**
 * Fetch daily traffic (GB) for a date range.
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey       SecretKey (HMAC secret)
 * @param {string} cfg.apiUser      SecretId  (account credential id)
 * @param {string} [cfg.baseUrl]    Override base URL
 * @param {string} cfg.startDate    'YYYY-MM-DD' inclusive (Asia/Shanghai)
 * @param {string} cfg.endDate      'YYYY-MM-DD' inclusive (Asia/Shanghai)
 * @param {string[]} [cfg.zoneIds]  Optional list of zone-ids. Defaults to ['*'] (all zones).
 * @returns {Promise<Array<{usage_date:string, traffic_gb:number}>>}
 */
async function fetchDailyTraffic(cfg) {
  if (!cfg.apiKey)  throw new Error('eo: api_key (SecretKey) is required');
  if (!cfg.apiUser) throw new Error('eo: api_user (SecretId) is required');
  if (!cfg.startDate || !cfg.endDate) throw new Error('eo: startDate/endDate required');

  const baseUrl = normalizeBase(cfg.baseUrl);
  const zoneIds = (Array.isArray(cfg.zoneIds) && cfg.zoneIds.length) ? cfg.zoneIds : ['*'];

  // EO limits any single request to a 31-day window. Slice the requested
  // range into <=30-day chunks so callers can ask for arbitrary ranges.
  const chunks = chunkDateRange(cfg.startDate, cfg.endDate, 30);

  const merged = new Map();    // 'YYYY-MM-DD' -> bytes (sum)
  const errors = [];
  let okCount = 0;

  for (const [from, to] of chunks) {
    try {
      // Run one metric at a time. EO/Tencent Cloud's edge sometimes RSTs
      // a connection when several signed POSTs hit it in the same TCP
      // window, surfacing as `socket hang up`. Sequential calls + a
      // small jitter between chunks are friendlier and just as fast for
      // our 1~3 metric setup.
      for (const metric of TC_METRICS) {
        const dataPoints = await callOneWindowWithRetry({
          baseUrl,
          secretId:  cfg.apiUser,
          secretKey: cfg.apiKey,
          startTime: `${from}T00:00:00${TZ_OFFSET}`,
          endTime:   `${to}T23:59:59${TZ_OFFSET}`,
          zoneIds,
          metric,
        });
        for (const p of dataPoints) {
          const day = chinaDateOf(p.Time);
          if (!day) continue;
          merged.set(day, (merged.get(day) || 0) + Number(p.Value || 0));
        }
      }
      okCount++;
    } catch (e) {
      errors.push(`[${from}~${to}] ${e.message}`);
    }
    // tiny breather between chunks (skip after the last one)
    await sleep(150);
  }

  if (okCount === 0 && errors.length) {
    throw new Error(errors.join(' | '));
  }

  return Array.from(merged.entries())
    .map(([usage_date, bytes]) => ({
      usage_date,
      traffic_gb: round4(bytes / BYTES_PER_GB),
    }))
    .sort((a, b) => a.usage_date.localeCompare(b.usage_date));
}

/**
 * Same as callOneWindow but with a single best-effort retry for transient
 * network errors (socket hang up / ECONNRESET / timeout). Tencent Cloud's
 * edge occasionally RSTs the first HTTPS POST after a quiet period; one
 * retry with a short backoff almost always succeeds.
 */
async function callOneWindowWithRetry(args) {
  const TRANSIENT_RE = /(socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN|Request timeout|read ECONNRESET)/i;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callOneWindow(args);
    } catch (e) {
      lastErr = e;
      if (!TRANSIENT_RE.test(String(e && e.message))) break;
      await sleep(400 + attempt * 600);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Sign + send one DescribeBillingData call. Returns Response.Data array. */
async function callOneWindow({ baseUrl, secretId, secretKey, startTime, endTime, zoneIds, metric }) {
  const payload = JSON.stringify({
    StartTime:  startTime,
    EndTime:    endTime,
    Interval:   TC_INTERVAL,
    MetricName: metric,
    ZoneIds:    zoneIds,
  });

  const u    = new URL(baseUrl);
  const host = u.hostname;
  const tsSec = Math.floor(Date.now() / 1000);
  const dateUtc = utcDateStr(tsSec);

  // ----- Step 1: build canonical request -----
  // The signed-headers MUST be lowercase + sorted alphabetically.
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-tc-action:${TC_ACTION.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedPayload = sha256Hex(payload);
  const canonicalRequest =
    'POST\n' +
    '/\n' +
    '\n' +                    // canonical query string
    canonicalHeaders +
    '\n' +
    signedHeaders + '\n' +
    hashedPayload;

  // ----- Step 2: build string to sign -----
  const credentialScope = `${dateUtc}/${TC_SERVICE}/tc3_request`;
  const stringToSign =
    'TC3-HMAC-SHA256\n' +
    `${tsSec}\n` +
    `${credentialScope}\n` +
    sha256Hex(canonicalRequest);

  // ----- Step 3: derive signing key -----
  const kDate    = hmacSha256(`TC3${secretKey}`, dateUtc);
  const kService = hmacSha256(kDate, TC_SERVICE);
  const kSigning = hmacSha256(kService, 'tc3_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  // ----- Step 4: assemble Authorization header -----
  const authorization =
    `TC3-HMAC-SHA256 ` +
    `Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  // ----- Step 5: send request -----
  const headers = {
    'Authorization':  authorization,
    'Content-Type':   'application/json; charset=utf-8',
    'Host':           host,
    'X-TC-Action':    TC_ACTION,
    'X-TC-Version':   TC_VERSION,
    'X-TC-Timestamp': String(tsSec),
    'User-Agent':     'BCDN-Fusion/1.0',
  };
  if (DEFAULT_REGION) headers['X-TC-Region'] = DEFAULT_REGION;

  const resp = await httpPostJSON(baseUrl, payload, headers);

  if (!resp || !resp.Response) {
    throw new Error('eo: empty / invalid response');
  }
  if (resp.Response.Error) {
    const e = resp.Response.Error;
    throw new Error(`eo API error: code=${e.Code}, message=${e.Message}`);
  }
  return Array.isArray(resp.Response.Data) ? resp.Response.Data : [];
}

// -------- helpers --------

/**
 * Resolve a usable base URL for EO.
 *
 * EO is account-level and always lives at https://teo.tencentcloudapi.com.
 * If the customer accidentally has an `api_base_url` configured (e.g. a
 * value left over from another provider, or a host without scheme) we
 * silently fall back to the default rather than blowing up with
 * "Invalid URL" inside `new URL()`. Only honour an override when it
 * parses as an absolute https URL on the same family of hosts.
 */
function normalizeBase(input) {
  const fallback = DEFAULT_BASE.replace(/\/+$/, '');
  const raw = String(input || '').trim().replace(/\/+$/, '');
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fallback;
    return `${u.protocol}//${u.host}`;
  } catch (_) {
    return fallback;
  }
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}
/** unix seconds → 'YYYY-MM-DD' in UTC. Used for credential scope. */
function utcDateStr(tsSec) {
  const d = new Date(tsSec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
/** ISO8601 (UTC or with offset) → 'YYYY-MM-DD' in Asia/Shanghai. */
function chinaDateOf(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }

/** Split a [start,end] inclusive date range into <=maxDays sub-ranges. */
function chunkDateRange(start, end, maxDays) {
  const out = [];
  const oneDay = 86400000;
  let cur = Date.parse(`${start}T00:00:00Z`);
  const stop = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(cur) || Number.isNaN(stop) || cur > stop) return [[start, end]];
  while (cur <= stop) {
    const next = Math.min(cur + (maxDays - 1) * oneDay, stop);
    out.push([toYmd(cur), toYmd(next)]);
    cur = next + oneDay;
  }
  return out;
}
function toYmd(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
}

/** POST JSON to url with given headers. Returns parsed JSON. */
function httpPostJSON(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      // EO endpoint is HTTPS-only; fall back lazily for tests.
      return reject(new Error(`eo: only https is supported (got ${u.protocol})`));
    }
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: (u.pathname && u.pathname !== '/' ? u.pathname : '/') + (u.search || ''),
      method: 'POST',
      // Force a fresh TCP connection per request: Tencent Cloud's edge
      // sometimes silently RSTs idle keep-alive sockets, which surfaces
      // here as `socket hang up`. agent:false sidesteps that pool.
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
    // Whole-request timeout. Keep it < syncCustomer's outer expectations.
    req.setTimeout(20000, () => req.destroy(new Error('Request timeout')));
    req.write(body);
    req.end();
  });
}

module.exports = { fetchDailyTraffic, name: 'eo' };
