'use strict';

/**
 * Provider 4 — YCN2 CDN Platform.
 * 
 * Expected API characteristics (adjust based on actual YCN2 documentation):
 *   - Authentication: API Key in Authorization header
 *   - Endpoint: /api/v1/traffic or similar
 *   - Request parameters: dates, domains, etc.
 *   - Response format: daily traffic data with units
 *   - Rate limits: typical API constraints
 */

const http = require('./http');

const DEFAULT_BASE = process.env.YCN2_BASE_URL || 'http://cdn-hw.com';
const FLUX_UNIT    = (process.env.YCN2_FLUX_UNIT || 'byte').toLowerCase();

const UNIT_TO_GB = {
  // SI / decimal base (1 GB = 1e9 bytes), aligned with CDN billing
  byte: 1 / 1e9,
  kb:   1 / 1e6,
  mb:   1 / 1e3,
  gb:   1,
};

/**
 * Fetch daily traffic (GB) for a date range.
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey       Authorization key
 * @param {string} [cfg.apiUser]    Optional username for auth
 * @param {string} [cfg.baseUrl]    Override base URL
 * @param {string} [cfg.zoneIds]    Zone IDs (for multi-zone providers)
 * @param {string} cfg.startDate    'YYYY-MM-DD' inclusive (Asia/Shanghai)
 * @param {string} cfg.endDate      'YYYY-MM-DD' inclusive (Asia/Shanghai)
 * @param {string[]} [cfg.domainNames]
 * @returns {Promise<Array<{usage_date:string, traffic_gb:number}>>}
 */
async function fetchDailyTraffic(cfg) {
  if (!cfg.apiKey) throw new Error('ycn2: api_key is required');
  if (!cfg.startDate || !cfg.endDate) throw new Error('ycn2: startDate/endDate required');

  const baseUrl = normalizeBase(cfg.baseUrl || DEFAULT_BASE);

  // YCN2 API likely has date range limits - use 30 days as safe default
  const chunks = chunkDateRange(cfg.startDate, cfg.endDate, 30);

  const factor = UNIT_TO_GB[FLUX_UNIT] != null ? UNIT_TO_GB[FLUX_UNIT] : UNIT_TO_GB.byte;
  const daily = new Map();
  const errors = [];
  let okCount = 0;

  for (const [from, to] of chunks) {
    try {
      const series = await callYcn2Api({
        baseUrl,
        apiKey: cfg.apiKey,
        apiUser: cfg.apiUser,
        zoneIds: cfg.zoneIds,
        startDate: from,
        endDate: to,
        domainNames: cfg.domainNames,
      });
      
      for (const { usage_date, traffic } of series) {
        daily.set(usage_date, (daily.get(usage_date) || 0) + Number(traffic || 0));
      }
      okCount++;
    } catch (e) {
      errors.push(`[${from}~${to}] ${e.message}`);
    }
    
    // Small delay between chunks to avoid rate limiting
    await sleep(100);
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
 * Call YCN2 API for a single date window.
 * This is a template implementation - adjust based on actual YCN2 API documentation.
 */
async function callYcn2Api({ baseUrl, apiKey, apiUser, zoneIds, startDate, endDate, domainNames }) {
  // Build query parameters based on YCN2 API specification
  const qs = new URLSearchParams();
  qs.set('startTime', String(chinaDayStart(startDate)));
  qs.set('endTime', String(chinaDayEnd(endDate)));
  qs.set('interval', '3600');
  
  if (domainNames && domainNames.length) {
    for (const d of domainNames) qs.append('domains', d);
  }
  
  if (zoneIds && zoneIds.length) {
    for (const z of zoneIds) qs.append('zone_ids', z);
  }

  // Construct URL - adjust endpoint based on actual YCN2 API
  const endpoint = '/api/v1.0/domain/domain-statistics'; // Adjust based on actual API
  const url = `${baseUrl}${endpoint}?${qs.toString()}`;

  // Build headers - adjust authentication method based on actual YCN2 API
  const headers = {
    'Authorization': apiKey,
    'Accept': 'application/json',
    'User-Agent': 'BCDN-Fusion/1.0',
  };
  
  if (apiUser) {
    headers['X-API-User'] = apiUser;
  }

  const resp = await http.getJSON(url, {
    headers,
    timeoutMs: 30000,
  });

  // Parse response - adjust based on actual YCN2 API response format
  if (!resp || (resp.code !== 0 && resp.code !== 200 && resp.code !== '0' && resp.code !== '200')) {
    const msg = resp ? `code=${resp.code}, msg=${resp.msg || resp.message}` : 'empty response';
    throw new Error(`YCN2 API error: ${msg}`);
  }

  // Extract data - adjust based on actual response structure
  const data = resp.data || resp;
  
  // YCDN format: { data: { flux: [], startTime, endTime, interval } }
  if (data && Array.isArray(data.flux)) {
    const flux = data.flux;
    const t0Ms = Number(data.startTime || chinaDayStart(startDate));
    const stepMs = Number(data.interval || 3600) * 1000;
    
    const out = [];
    for (let i = 0; i < flux.length; i++) {
      const tsMs = t0Ms + i * stepMs;
      const date = chinaDateOf(tsMs);
      out.push({ usage_date: date, traffic: flux[i] });
    }
    return out;
  }

  throw new Error('YCN2: unexpected response format');
}

// -------- helpers --------

function normalizeBase(u) {
  return String(u || '')
    .trim()
    .replace(/\/+$/, '');
}

function round4(n) { 
  return Math.round((n + Number.EPSILON) * 10000) / 10000; 
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

/** Start-of-day in Asia/Shanghai → unix MILLISECONDS (00:00:00 +08:00). */
function chinaDayStart(ymd) {
  return Date.parse(`${ymd}T00:00:00+08:00`);
}

/** End-of-day in Asia/Shanghai → unix MILLISECONDS. */
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

module.exports = { fetchDailyTraffic, name: 'ycn2' };