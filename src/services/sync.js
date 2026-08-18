'use strict';

/**
 * Sync service — pull daily traffic for a customer from its upstream
 * provider, then upsert into `usage_records`.
 *
 * Each customer carries a `provider` ('source1' | 'source2') and an
 * `api_key`. We dispatch to the matching driver under ./providers/.
 */

const db = require('../db');
const stats = require('./stats');
const source1 = require('./providers/source1');
const source2 = require('./providers/source2');
const eo      = require('./providers/eo');

const PROVIDERS = {
  source1,
  source2,
  eo,
};

/** Best-effort parse of `customers.zone_ids` (TEXT, JSON-encoded array). */
function parseZoneIds(raw) {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
  } catch (_) {
    // tolerate plain comma/space separated strings stored historically.
    return String(raw).split(/[,\s]+/).filter(Boolean);
  }
  return undefined;
}

/**
 * Sync one customer.
 *
 * @param {object} customer  row from `customers`
 * @param {object} [opts]
 * @param {string} [opts.startDate] YYYY-MM-DD
 *   (default: env SYNC_DEFAULT_DAYS days ago, otherwise 1st of current month)
 * @param {string} [opts.endDate]   YYYY-MM-DD (default = today)
 */
async function syncCustomer(customer, opts = {}) {
  if (!customer) throw new Error('customer is required');
  const driver = PROVIDERS[customer.provider || 'source1'];
  if (!driver) throw new Error(`unknown provider: ${customer.provider}`);
  if (!customer.api_key) throw new Error(`customer "${customer.name}" has no api_key`);

  const startDate = opts.startDate || defaultStartDate();
  const endDate   = opts.endDate   || today();

  // ---- Fetch daily traffic --------------------------------------------
  // CCDN (source2) can carry a secondary api_key2. When present, we pull
  // with both keys, sum traffic_gb / request_count per (usage_date), and
  // pick the MAX for domain_count-style snapshots later.
  //
  // Multi-key policy (Q3-C): "any success wins" — if at least one key
  // returns data, we proceed with the merged result; only when EVERY key
  // errors do we surface the failure. Per-key failures are recorded into
  // the sync_logs message so the operator can still diagnose them.
  //
  // CCDN requires (apiKey, apiUser) tuples — each key ships paired with
  // its own user. We fall back to the primary api_user when api_user2 is
  // absent, so a legacy row that only set api_key2 still works.
  const isCcdn = (customer.provider || 'source1') === 'source2';
  const creds = [{
    apiKey:  customer.api_key,
    apiUser: customer.api_user || undefined,
  }];
  if (isCcdn && customer.api_key2 && String(customer.api_key2).trim()) {
    const u2 = (customer.api_user2 && String(customer.api_user2).trim())
      ? String(customer.api_user2).trim()
      : (customer.api_user || undefined);
    creds.push({
      apiKey:  String(customer.api_key2).trim(),
      apiUser: u2,
    });
  }

  let rows;
  const keyErrors = [];         // failures encountered across all keys
  const keySucc   = [];         // 1-based indexes of keys that returned rows
  try {
    if (creds.length === 1) {
      rows = await driver.fetchDailyTraffic({
        apiKey:   creds[0].apiKey,
        apiUser:  creds[0].apiUser,
        baseUrl:  customer.api_base_url || undefined,
        zoneIds:  parseZoneIds(customer.zone_ids),
        startDate,
        endDate,
      });
      keySucc.push(1);
    } else {
      // Merge daily rows by usage_date. traffic_gb and request_count sum;
      // any per-day flag we can't merge is dropped. Order restored by date.
      const merged = new Map(); // usage_date -> { traffic_gb, request_count }
      for (let i = 0; i < creds.length; i++) {
        try {
          const partial = await driver.fetchDailyTraffic({
            apiKey:   creds[i].apiKey,
            apiUser:  creds[i].apiUser,
            baseUrl:  customer.api_base_url || undefined,
            zoneIds:  parseZoneIds(customer.zone_ids),
            startDate,
            endDate,
          });
          for (const r of partial || []) {
            const d = String(r.usage_date || '');
            if (!d) continue;
            const cur = merged.get(d) || { usage_date: d, traffic_gb: 0, request_count: 0 };
            cur.traffic_gb    += Number(r.traffic_gb   || 0);
            cur.request_count += Number(r.request_count || 0);
            merged.set(d, cur);
          }
          keySucc.push(i + 1);
        } catch (e) {
          keyErrors.push(`key#${i + 1}: ${e.message}`);
        }
      }
      if (keySucc.length === 0) {
        // All keys failed — bubble up the first error, keep the rest in
        // logSync message below.
        throw new Error(keyErrors.join(' | '));
      }
      rows = [...merged.values()].sort((a, b) => a.usage_date < b.usage_date ? -1 : 1);
    }
  } catch (e) {
    logSync(customer, false, 0, 0, e.message);
    throw e;
  }

  // Try to fetch a current snapshot of registered-domain count. This is a
  // once-per-sync value; we stamp it onto every day in the sync window so
  // that MAX(domain_count) over any month gives the peak observed value.
  // Only providers that expose fetchDomainCount participate; others get 0.
  //
  //   NOTE: request_count remains a placeholder (upstream doesn't expose
  //   per-day request counts). It stays 0 until upstream provides it.
  //
  //   Billing model (X2): usage_records.amount holds ONLY the daily flow
  //   fees (traffic_fee + request_fee). domain_fee is NOT part of amount —
  //   it's billed per-month using MAX(domain_count) × domain_unit_price at
  //   aggregation time (see stats.js).
  let domainCount = 0;
  let domainCountOk = false;
  if (typeof driver.fetchDomainCount === 'function') {
    const partialCounts = [];
    for (let i = 0; i < creds.length; i++) {
      try {
        const n = await driver.fetchDomainCount({
          apiKey:  creds[i].apiKey,
          apiUser: creds[i].apiUser,
          baseUrl: customer.api_base_url || undefined,
          zoneIds: parseZoneIds(customer.zone_ids),
        });
        partialCounts.push(Number(n) || 0);
      } catch (e) {
        // Non-fatal: continue. Domain fetch failure is separate from
        // traffic fetch — one key's fetchDomainCount failing does NOT
        // invalidate the traffic data we already merged above.
        // eslint-disable-next-line no-console
        console.warn(`[sync] fetchDomainCount(${customer.provider}) key#${i + 1} failed for "${customer.name}": ${e.message}`);
      }
    }
    if (partialCounts.length > 0) {
      // Q2-B: multiple keys → take MAX (keys often mirror the same domain
      // pool; summing would double-count).
      domainCount = partialCounts.reduce((m, v) => v > m ? v : m, 0);
      domainCountOk = true;
    }
  }

  const upsert = db.prepare(`
    INSERT INTO usage_records
      (customer_id, usage_date, traffic_gb, request_count, domain_count,
       unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
       traffic_fee, request_fee, domain_fee, amount, remark)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    ON CONFLICT(customer_id, usage_date) DO UPDATE SET
      traffic_gb         = excluded.traffic_gb,
      domain_count       = excluded.domain_count,
      unit_price         = excluded.unit_price,
      unit_price_traffic = excluded.unit_price_traffic,
      unit_price_request = excluded.unit_price_request,
      unit_price_domain  = excluded.unit_price_domain,
      traffic_fee        = excluded.traffic_fee,
      amount             = excluded.amount,
      remark             = excluded.remark
  `);

  let totalTraffic = 0;
  // Per-customer traffic calibration.
  //   pct           : per-row scaling, applied to every day independently.
  //   delta_gb      : ONE-OFF absolute offset for the whole sync run,
  //                   spread across the days of `anchor_month` proportional
  //                   to each day's RAW traffic (heavy days carry more).
  //   anchor_month  : 'YYYY-MM'. The basis used for delta weighting.
  //                   When empty/null we fall back to the month of `endDate`.
  // Final formula per row:
  //   adjusted_i = max(0, raw_i * (1 + pct/100) + delta_share_i)
  //   where Σ delta_share_i ≈ delta_gb, and delta_share_i = 0 for any
  //   day NOT in anchor_month.
  // If the sync window has no overlap with anchor_month (i.e. the driver
  // returned no rows for that month), we skip delta entirely and surface
  // the reason in sync_logs.message — never silently re-target the offset.
  const adjPct      = Number(customer.traffic_adjust_pct      || 0);
  const adjDelta    = Number(customer.traffic_adjust_delta_gb || 0);
  const anchorMonth = (customer.traffic_adjust_anchor_month
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(customer.traffic_adjust_anchor_month)))
    ? String(customer.traffic_adjust_anchor_month)
    : String(endDate || '').slice(0, 7); // fallback: month of endDate

  // Compute the anchor-month subset of the rows the driver returned.
  // `c` mode: weights come from THIS sync's data, no DB pollution.
  const anchorRows = anchorMonth
    ? rows.filter(r => String(r.usage_date || '').slice(0, 7) === anchorMonth)
    : [];
  const anchorRawTotal = anchorRows.reduce((s, r) => s + Number(r.traffic_gb || 0), 0);
  const anchorN = anchorRows.length;

  // Decide whether delta can actually be applied.
  let deltaSkipReason = null;
  let deltaApplied = false;
  if (Math.abs(adjDelta) > 1e-9) {
    if (anchorN === 0) {
      deltaSkipReason = `anchor month ${anchorMonth} not in sync window — delta skipped`;
    } else {
      deltaApplied = true;
    }
  }

  const adjustEnabled = Math.abs(adjPct) > 1e-9 || deltaApplied;
  const adjTag = (Math.abs(adjPct) > 1e-9 || Math.abs(adjDelta) > 1e-9)
    ? `,adj=${adjPct >= 0 ? '+' : ''}${stats.round2(adjPct)}%${adjDelta >= 0 ? '+' : ''}${stats.round4(adjDelta)}GB(${deltaApplied ? `anchor=${anchorMonth}` : 'delta-skipped'})`
    : '';

  // Per-row delta share. Days outside anchor_month get 0; inside, weighted
  // by raw traffic (or evenly when every anchor day is 0).
  const deltaShare = (it) => {
    if (!deltaApplied) return 0;
    if (String(it.usage_date || '').slice(0, 7) !== anchorMonth) return 0;
    const raw = Number(it.traffic_gb || 0);
    if (anchorRawTotal > 1e-12) return adjDelta * (raw / anchorRawTotal);
    return adjDelta / anchorN;   // anchor month exists but every day is 0 -> even split within the month
  };

  const domainTag = domainCountOk ? `,domains=${domainCount}` : '';

  const tx = db.transaction((items) => {
    // Snapshot the customer's current three-mode pricing. request_count is
    // still 0 (upstream lacks the endpoint); domain_count is stamped from
    // the just-fetched snapshot onto every day, so MAX() over any month
    // yields the peak observed value.
    //
    // amount holds ONLY the daily flow fees (traffic + request) — domain
    // is billed at the monthly aggregate level using MAX(domain_count).
    const pT = Number(customer.unit_price_traffic || customer.unit_price || 0);
    const pR = Number(customer.unit_price_request || 0);
    const pD = Number(customer.unit_price_domain  || 0);
    for (const it of items) {
      const rawTraffic = Number(it.traffic_gb || 0);
      const traffic = adjustEnabled
        ? Math.max(0, rawTraffic * (1 + adjPct / 100) + deltaShare(it))
        : rawTraffic;
      const trafficR   = stats.round4(traffic);
      const trafficFee = stats.round2(trafficR * pT);
      // request_fee is 0 today (request_count is 0). domain_fee is NOT in
      // amount — billed monthly by MAX(domain_count) × price.
      const amount = trafficFee;
      upsert.run(
        customer.id,
        it.usage_date,
        trafficR,
        domainCount,
        pT, pT, pR, pD,
        trafficFee,
        amount,
        `auto:${customer.provider}${adjTag}${domainTag}`,
      );
      totalTraffic += trafficR;
    }
  });
  tx(rows);

  db.prepare(`UPDATE customers SET last_sync_at = datetime('now','localtime') WHERE id = ?`)
    .run(customer.id);

  const adjMsgParts = [];
  if (Math.abs(adjPct) > 1e-9) {
    adjMsgParts.push(`${adjPct >= 0 ? '+' : ''}${stats.round2(adjPct)}%`);
  }
  if (Math.abs(adjDelta) > 1e-9) {
    adjMsgParts.push(deltaApplied
      ? `${adjDelta >= 0 ? '+' : ''}${stats.round4(adjDelta)}GB once @anchor=${anchorMonth}`
      : `${adjDelta >= 0 ? '+' : ''}${stats.round4(adjDelta)}GB SKIPPED (${deltaSkipReason})`);
  }
  // Multi-key trace: only surface when >1 key is configured so the common
  // single-key case keeps its short log line.
  const keyMsgParts = [];
  if (creds.length > 1) {
    keyMsgParts.push(`keys=${keySucc.length}/${creds.length}`);
    if (keyErrors.length) keyMsgParts.push(keyErrors.join(' | '));
  }
  const suffixBits = [];
  if (adjMsgParts.length) suffixBits.push(`adj ${adjMsgParts.join(' ')}`);
  if (keyMsgParts.length) suffixBits.push(keyMsgParts.join(' '));
  const logMsg = suffixBits.length
    ? `${startDate} ~ ${endDate} (${suffixBits.join('; ')})`
    : `${startDate} ~ ${endDate}`;
  logSync(customer, true, rows.length, stats.round4(totalTraffic), logMsg);

  return {
    customer_id: customer.id,
    provider:    customer.provider,
    startDate, endDate,
    days: rows.length,
    traffic_gb: stats.round4(totalTraffic),
  };
}

/** Sync every active customer that has a provider+api_key. */
async function syncAll(opts = {}) {
  const customers = db.prepare(`
    SELECT * FROM customers
    WHERE status = 'active' AND api_key IS NOT NULL AND api_key <> ''
  `).all();

  const results = [];
  for (const c of customers) {
    try {
      const r = await syncCustomer(c, opts);
      results.push({ ok: true, ...r, name: c.name });
    } catch (e) {
      results.push({ ok: false, name: c.name, customer_id: c.id, error: e.message });
    }
  }
  return { total: customers.length, results };
}

function logSync(customer, ok, days, trafficGb, message) {
  try {
    db.prepare(`
      INSERT INTO sync_logs (customer_id, provider, ok, days, traffic_gb, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(customer.id, customer.provider || '', ok ? 1 : 0, days, trafficGb, message || '');
  } catch (_) { /* never break sync due to logging */ }
}

function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
/**
 * Default sync start date.
 * - If env SYNC_DEFAULT_DAYS is a positive integer, pull that many days back.
 * - Otherwise fall back to the 1st day of the current month.
 */
function defaultStartDate() {
  const n = parseInt(process.env.SYNC_DEFAULT_DAYS, 10);
  if (Number.isFinite(n) && n > 0) return daysAgo(n);
  return firstDayOfMonth();
}

module.exports = { syncCustomer, syncAll };
