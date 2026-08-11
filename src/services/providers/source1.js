'use strict';

/**
 * Provider 1 — built-in CDN (docs: data/md/CDN2.md).
 *
 *   GET <base>/api/v1.0/domain/domain-statistics
 *   Header: Authorization: <ApiKey>
 *   Query :
 *     startTime  (unix MILLISECONDS, must be the *start* of a day in Asia/Shanghai)
 *     endTime    (unix MILLISECONDS, must be the *end*   of a day in Asia/Shanghai,
 *                 i.e. next day's 00:00:00 +08)
 *     interval   (300 | 3600 | 14400)  -- in seconds
 *     domainNames (optional, repeated)
 *
 *   IMPORTANT: despite docs saying "timestamp", upstream actually expects
 *   millisecond timestamps. Verified empirically: a `seconds` value gets
 *   silently snapped to the upstream's default window and returns flux=[].
 *
 * Response:
 *   { code, msg, data: { totalFlux, maxBw, bw[], flux[], startTime, endTime, interval } }
 *
 * Unit of `flux[]`:
 *   The doc does not state it explicitly. Most domestic CDNs return
 *   bytes for "flux", but some return MB. We make it configurable via
 *   `SOURCE1_FLUX_UNIT` ( "byte" | "mb" | "kb" | "gb"; default "byte"),
 *   and the frontend customer page shows raw GB so it's easy to verify.
 *
 * We bucket the returned `flux[]` array (each cell = `interval` seconds)
 * back into daily totals in Asia/Shanghai and return an array of
 *   { usage_date: 'YYYY-MM-DD', traffic_gb: number }.
 */

const http = require('./http');

const DEFAULT_BASE = process.env.SOURCE1_BASE_URL || 'http://cdn-hw.com';
const FLUX_UNIT    = (process.env.SOURCE1_FLUX_UNIT || 'byte').toLowerCase();

const UNIT_TO_GB = {
  // SI / decimal base (1 GB = 1e9 bytes), aligned with CDN billing
  // convention and the UI which displays 1 TB = 1000 GB.
  byte: 1 / 1e9,
  kb:   1 / 1e6,
  mb:   1 / 1e3,
  gb:   1,
};

/**
 * Fetch daily traffic (GB) for a date range.
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey       Authorization key (sent as-is)
 * @param {string} [cfg.baseUrl]    Override base URL (e.g. 'http://cdn-hw.com')
 * @param {string} cfg.startDate    'YYYY-MM-DD' inclusive (Asia/Shanghai)
 * @param {string} cfg.endDate      'YYYY-MM-DD' inclusive (Asia/Shanghai)
 * @param {string[]} [cfg.domainNames]
 * @returns {Promise<Array<{usage_date:string, traffic_gb:number}>>}
 */
async function fetchDailyTraffic(cfg) {
  if (!cfg.apiKey) throw new Error('source1: api_key is required');
  if (!cfg.startDate || !cfg.endDate) throw new Error('source1: startDate/endDate required');

  const baseUrl = normalizeBase(cfg.baseUrl || DEFAULT_BASE);

  // 1-hour buckets per docs (interval is in SECONDS).
  const interval = 3600;

  // Upstream rule: with hourly granularity the window must be <= 7 days.
  // Slice the requested date range into <=7-day chunks.
  const chunks = chunkDateRange(cfg.startDate, cfg.endDate, 7);

  const factor = UNIT_TO_GB[FLUX_UNIT] != null ? UNIT_TO_GB[FLUX_UNIT] : UNIT_TO_GB.byte;
  const daily  = new Map();          // 'YYYY-MM-DD' -> raw flux sum
  const errors = [];
  let okCount  = 0;

  for (const [from, to] of chunks) {
    try {
      const series = await callOneWindowWithRetry({
        baseUrl, apiKey: cfg.apiKey,
        startMs:  chinaDayStart(from),
        endMs:    chinaDayEnd(to),       // exclusive boundary (next day 00:00 +08)
        interval,
        domainNames: cfg.domainNames,
      });
      // series = [{ tsMs, flux }, ...]
      for (const { tsMs, flux } of series) {
        const date = chinaDateOf(tsMs);
        daily.set(date, (daily.get(date) || 0) + Number(flux || 0));
      }
      okCount++;
    } catch (e) {
      errors.push(`[${from}~${to}] ${e.message}`);
    }
    // tiny breather between chunks: spreads load and avoids tripping
    // upstream gateway rate-limits.
    await sleep(150);
  }

  if (okCount === 0 && errors.length) {
    throw new Error(errors.join(' | '));
  }

  return Array.from(daily.entries())
    .map(([usage_date, raw]) => ({
      usage_date,
      traffic_gb: round4(raw * factor),
    }))
    .sort((a, b) => a.usage_date.localeCompare(b.usage_date));
}

/**
 * Same as callOneWindow but with one best-effort retry for transient
 * network errors. Upstream's nginx occasionally RSTs the first request
 * after a quiet period (curl reports it as "Empty reply from server";
 * Node reports "socket hang up"). One retry with a small backoff
 * sidesteps it without masking real outages.
 */
async function callOneWindowWithRetry(args) {
  const TRANSIENT_RE = /(socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN|Empty reply|Request timeout|read ECONNRESET|EPIPE)/i;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callOneWindow(args);
    } catch (e) {
      lastErr = e;
      if (!TRANSIENT_RE.test(String(e && e.message))) break;
      await sleep(500 + attempt * 800);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Call domain-statistics for a single window. Returns [{ tsMs, flux }, ...]. */
async function callOneWindow({ baseUrl, apiKey, startMs, endMs, interval, domainNames }) {
  const qs = new URLSearchParams();
  qs.set('startTime', String(startMs));
  qs.set('endTime',   String(endMs));
  qs.set('interval',  String(interval));
  if (domainNames && domainNames.length) {
    for (const d of domainNames) qs.append('domainNames', d);
  }

  const url = `${baseUrl}/api/v1.0/domain/domain-statistics?${qs.toString()}`;
  const resp = await http.getJSON(url, {
    headers: { Authorization: apiKey },
    timeoutMs: 30000,
  });

  if (!resp || (resp.code !== 0 && resp.code !== 200 && resp.code !== '0' && resp.code !== '200')) {
    const msg = resp ? `code=${resp.code}, msg=${resp.msg}` : 'empty response';
    throw new Error(`source1 API error: ${msg}`);
  }

  const data = resp.data || {};
  const flux = Array.isArray(data.flux) ? data.flux : [];
  const t0Ms    = Number(data.startTime || startMs);
  const stepMs  = Number(data.interval  || interval) * 1000;

  const out = [];
  for (let i = 0; i < flux.length; i++) {
    out.push({ tsMs: t0Ms + i * stepMs, flux: flux[i] });
  }
  return out;
}

// -------- helpers --------

/**
 * Strip trailing slash and any accidentally-included `/api/v1.0` suffix
 * so callers can pass either 'http://cdn-hw.com' or
 * 'http://cdn-hw.com/api/v1.0' and it just works.
 */
function normalizeBase(u) {
  return String(u || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1\.0$/i, '');
}

/** Start-of-day in Asia/Shanghai → unix MILLISECONDS (00:00:00 +08:00). */
function chinaDayStart(ymd) {
  return Date.parse(`${ymd}T00:00:00+08:00`);
}
/**
 * End-of-day in Asia/Shanghai → unix MILLISECONDS.
 *
 * The doc requires endTime to be "the timestamp at the *end* of a day
 * in East-8". Upstream snaps any non-aligned timestamp, so we encode
 * "end of day Y" as Y+1 day's 00:00:00 — a clean midnight boundary
 * that still semantically includes all of day Y.
 */
function chinaDayEnd(ymd) {
  return chinaDayStart(ymd) + 24 * 3600 * 1000;
}
/** unix MILLISECONDS → 'YYYY-MM-DD' in Asia/Shanghai (UTC+8). */
function chinaDateOf(unixMs) {
  const d = new Date(unixMs + 8 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }

/**
 * Fetch the current number of registered domains for this account.
 *
 * Uses `GET /api/v1.0/domain/list?page=1&size=1000` and returns
 * `data.length`. The `domain/limit` endpoint returns *remaining*
 * quota, not the currently-registered count, so we don't use it here.
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey    Authorization key
 * @param {string} [cfg.baseUrl] Override base URL
 * @returns {Promise<number>}    current number of domains (0 on empty)
 */
async function fetchDomainCount(cfg) {
  if (!cfg.apiKey) throw new Error('source1: api_key is required');
  const baseUrl = normalizeBase(cfg.baseUrl || DEFAULT_BASE);
  const url = `${baseUrl}/api/v1.0/domain/list?page=1&size=1000`;

  const resp = await http.getJSON(url, {
    headers: { Authorization: cfg.apiKey },
    timeoutMs: 30000,
  });

  if (!resp || (resp.code !== 0 && resp.code !== 200 && resp.code !== '0' && resp.code !== '200')) {
    const msg = resp ? `code=${resp.code}, msg=${resp.msg}` : 'empty response';
    throw new Error(`source1 domain-list API error: ${msg}`);
  }

  const data = resp.data;
  if (Array.isArray(data)) return data.length;
  // Some deployments wrap the array in { list: [...], total: N }; be tolerant.
  if (data && Array.isArray(data.list)) return data.list.length;
  if (data && typeof data.total === 'number') return data.total;
  return 0;
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

module.exports = { fetchDailyTraffic, fetchDomainCount, name: 'source1' };
