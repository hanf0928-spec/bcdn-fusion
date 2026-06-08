'use strict';

/**
 * Provider 2 — CDNetworks "查询账号下所有域名的流量汇总" endpoint.
 *
 *   GET https://api.cdnetworks.com/api/report/traffic
 *   Auth: HTTP Basic
 *     username = customer.api_user
 *     password = base64( HMAC-SHA1( <Date header>, <apiKey> ) )
 *   Required headers:
 *     Date         : RFC 1123, en_US,  UTC, e.g. "Thu, 05 Jun 2025 02:30:00 GMT"
 *     X-Time-Zone  : e.g. "GMT+08:00"
 *     Accept       : application/json
 *   Required query:
 *     datefrom     yyyy-MM-ddTHH:mm:ss±HH:mm
 *     dateto       yyyy-MM-ddTHH:mm:ss±HH:mm   (must > datefrom; capped at now)
 *     granularity  fiveminutes | hourly | daily   (default daily)
 *
 *   Response (granularity=daily):
 *     { "totalTraffic": "62.18",
 *       "dataSeries": [ {"timestamp": "2019-07-23", "traffic": "31.47"}, ... ] }
 *   Traffic unit is MB.
 *
 *   Constraints (per spec):
 *     · datefrom..dateto window <= 31 days
 *     · only the last 2 years of data
 *     · 5–15min data delay
 *
 * Notes:
 *   This module signs the request with Node's built-in `crypto` (no extra deps).
 */

const https = require('https');
const http  = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_BASE = process.env.SOURCE2_BASE_URL || 'https://api.cdnetworks.com';
const DEFAULT_PATH = process.env.SOURCE2_PATH     || '/api/report/traffic';
const TIME_ZONE    = process.env.SOURCE2_TIMEZONE || 'GMT+08:00';
// SI / decimal base: 1 GB = 1000 MB. Keeps server-side units aligned
// with the UI's 1 TB = 1000 GB convention used across the product.
const MB_PER_GB    = 1000;

/**
 * Fetch daily traffic (GB) for a date range.
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey       HMAC secret
 * @param {string} cfg.apiUser      Basic-auth username (the account name)
 * @param {string} [cfg.baseUrl]    Override base URL
 * @param {string} cfg.startDate    'YYYY-MM-DD' inclusive (interpreted in TIME_ZONE)
 * @param {string} cfg.endDate      'YYYY-MM-DD' inclusive
 * @returns {Promise<Array<{usage_date:string, traffic_gb:number}>>}
 */
async function fetchDailyTraffic(cfg) {
  if (!cfg.apiKey)  throw new Error('source2: api_key is required');
  if (!cfg.apiUser) throw new Error('source2: api_user (CDNetworks username) is required');
  if (!cfg.startDate || !cfg.endDate) throw new Error('source2: startDate/endDate required');

  const baseUrl = (cfg.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  const tzOffset = parseTzOffset(TIME_ZONE);

  // CDNetworks limits any single request to a 31-day window. Slice the
  // requested range into <=30-day chunks so callers can ask for arbitrary
  // ranges without hitting "DateSpanError".
  const chunks = chunkDateRange(cfg.startDate, cfg.endDate, 30);

  const merged = new Map(); // usage_date -> traffic_mb (sum across chunks)
  const errors = [];
  let okCount = 0;
  for (const [from, to] of chunks) {
    try {
      const series = await callOneWindow({
        baseUrl,
        apiKey:   cfg.apiKey,
        apiUser:  cfg.apiUser,
        datefrom: `${from}T00:00:00${tzOffset}`,
        dateto:   `${to}T23:59:59${tzOffset}`,
      });
      for (const row of series) {
        const day = String(row.timestamp || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        const mb = Number(row.traffic || 0);
        merged.set(day, (merged.get(day) || 0) + mb);
      }
      okCount++;
    } catch (e) {
      errors.push(`[${from}~${to}] ${e.message}`);
    }
  }

  // If every chunk failed, surface the error. If some succeeded we still
  // return what we have (and the caller can inspect sync_logs for details).
  if (okCount === 0 && errors.length) {
    throw new Error(errors.join(' | '));
  }

  return Array.from(merged.entries())
    .map(([usage_date, mb]) => ({ usage_date, traffic_gb: round4(mb / MB_PER_GB) }))
    .sort((a, b) => a.usage_date.localeCompare(b.usage_date));
}

/** Call one CDNetworks /api/report/traffic window. Returns dataSeries array. */
async function callOneWindow({ baseUrl, apiKey, apiUser, datefrom, dateto }) {
  const qs = new URLSearchParams();
  qs.set('datefrom',    datefrom);
  qs.set('dateto',      dateto);
  qs.set('granularity', 'daily');

  // Date header in en_US RFC1123 (UTC). Node's toUTCString() matches.
  const dateHeader = new Date().toUTCString();
  const sig = crypto.createHmac('sha1', apiKey).update(dateHeader).digest('base64');
  const basic = Buffer.from(`${apiUser}:${sig}`).toString('base64');

  const url = `${baseUrl}${DEFAULT_PATH}?${qs.toString()}`;
  const resp = await httpGetJSON(url, {
    Authorization: `Basic ${basic}`,
    Date:          dateHeader,
    'X-Time-Zone': TIME_ZONE,
    Accept:        'application/json',
    'User-Agent':  'BCDN-Fusion/1.0',
  });

  if (!resp || typeof resp !== 'object') throw new Error('source2: empty / invalid response');
  if (resp.code && String(resp.code) !== '0' && resp.code !== 200) {
    throw new Error(`source2 API error: code=${resp.code}, message=${resp.message || JSON.stringify(resp).slice(0,200)}`);
  }
  return Array.isArray(resp.dataSeries) ? resp.dataSeries : [];
}

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
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// -------- helpers --------

/** "GMT+08:00" -> "+08:00";  "+08:00" -> "+08:00";  fallback "+00:00". */
function parseTzOffset(tz) {
  const m = String(tz || '').match(/([+\-])(\d{2}):?(\d{2})/);
  if (!m) return '+00:00';
  return `${m[1]}${m[2]}:${m[3]}`;
}

function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }

function httpGetJSON(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      method: 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (_) { reject(new Error(`Invalid JSON from upstream: ${body.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Request timeout')));
    req.end();
  });
}

module.exports = { fetchDailyTraffic, name: 'source2' };
