'use strict';

const express = require('express');
const db = require('../db');
const stats = require('../services/stats');
const sync  = require('../services/sync');

const router = express.Router();

// ----- helpers -----
function ok(res, data) { res.json({ ok: true, data }); }
function fail(res, code, msg) { res.status(code).json({ ok: false, error: msg }); }
function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Clamp the calibration percentage to a sane range to avoid runaway numbers. */
function clampPct(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  if (n < -100)  return -100;
  if (n > 1000)  return 1000;
  return n;
}

/**
 * Normalise the anchor month input.
 *   - undefined         : caller didn't touch the field    -> sentinel `undefined`
 *   - null / '' / empty : explicitly cleared                -> null (use endDate's month at sync time)
 *   - 'YYYY-MM'         : kept as-is
 *   - anything else     : rejected (callers should send YYYY-MM)
 */
function normAnchorMonth(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) {
    throw new Error('traffic_adjust_anchor_month must be YYYY-MM');
  }
  return s;
}

/** Mask an api_key for display: keep first 6 and last 4 characters. */
function maskKey(k) {
  if (!k) return '';
  const s = String(k);
  if (s.length <= 12) return s.slice(0, 2) + '***';
  return s.slice(0, 6) + '***' + s.slice(-4);
}
/** Convert a customer row for safe outbound use (mask api_key). */
function shapeCustomer(c) {
  if (!c) return c;
  const out = { ...c };
  out.api_key_masked = maskKey(c.api_key);
  out.has_api_key = !!c.api_key;
  delete out.api_key;
  // Secondary key (CCDN only). Mirror the same masked/has-flag pattern so
  // the UI can render/edit it independently without ever seeing plaintext.
  out.api_key2_masked = maskKey(c.api_key2);
  out.has_api_key2 = !!c.api_key2;
  delete out.api_key2;
  // Surface zone_ids as a clean array for the UI; keep null when unset.
  out.zone_ids = parseZoneIdsField(c.zone_ids);
  return out;
}

/**
 * Normalise a zone_ids input (string CSV / array / null) to either
 *   - a JSON-encoded array string (for storage), or
 *   - null when empty / not provided.
 */
function normalizeZoneIdsForStorage(input) {
  if (input == null) return null;
  let arr;
  if (Array.isArray(input)) arr = input;
  else arr = String(input).split(/[,\s]+/);
  arr = arr.map(s => String(s || '').trim()).filter(Boolean);
  if (!arr.length) return null;
  return JSON.stringify(arr);
}

/** Inverse of normalizeZoneIdsForStorage: storage → UI-friendly array. */
function parseZoneIdsField(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch (_) {
    return String(raw).split(/[,\s]+/).filter(Boolean);
  }
}

// =====================================================
// Customers
// =====================================================

// List customers + current month stats
router.get('/customers', (req, res) => {
  const month = req.query.month;
  const list = stats.listCustomersWithStats(month).map(shapeCustomer);
  ok(res, list);
});

// Detail of one customer
router.get('/customers/:id', (req, res) => {
  const id = num(req.params.id);
  const c = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  if (!c) return fail(res, 404, 'customer not found');

  const cm = stats.buildCostMap();
  const s = stats.getCustomerStats(id, cm);
  const monthly = stats.getCustomerMonthlyUsage(id, undefined, cm);
  const cost = stats.resolveCost(cm, c.provider, c.scene || 'download');

  ok(res, {
    ...shapeCustomer(c),
    total_recharge:       s.totalRecharge,
    total_usage:          s.totalUsage,         // legacy alias
    total_revenue:        s.totalRevenue,
    total_traffic_gb:     s.totalTraffic,
    total_request_count:  s.totalRequests,
    total_domain_count:   s.totalDomains,
    total_platform_cost:  s.totalPlatformCost,
    total_traffic_fee:    s.totalTrafficFee,
    total_request_fee:    s.totalRequestFee,
    total_domain_fee:     s.totalDomainFee,
    total_resource_cost:  s.totalResourceCost,
    total_gross_profit:   s.totalGrossProfit,
    balance:              s.balance,
    platform_cost_ratio:  cost.platform,        // 0~1 ratio
    traffic_unit_price:   cost.traffic,         // USDT / GB
    request_unit_price:   cost.request,         // USDT / 万次
    domain_unit_price:    cost.domain,          // USDT / 域名
    monthly,
  });
});

// Create
router.post('/customers', (req, res) => {
  const {
    name, contact, remark,
    provider, api_key, api_key2, api_user, api_base_url, zone_ids,
    unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
    alert_threshold, tg_chat_id, status, scene,
    traffic_adjust_pct, traffic_adjust_delta_gb, traffic_adjust_anchor_month,
  } = req.body || {};
  if (!name || !String(name).trim()) return fail(res, 400, 'name is required');

  let anchorMonthIn;
  try { anchorMonthIn = normAnchorMonth(traffic_adjust_anchor_month); }
  catch (e) { return fail(res, 400, e.message); }

  // Three-mode pricing. `unit_price_traffic` is the primary source of
  // truth; legacy `unit_price` is kept as a mirror for backwards-compat
  // (falls back to whichever the caller provided).
  const priceTraffic = num(unit_price_traffic ?? unit_price, 0);
  const priceRequest = num(unit_price_request, 0);
  const priceDomain  = num(unit_price_domain,  0);

  try {
    const r = db.prepare(`
      INSERT INTO customers
        (name, contact, remark, provider, scene, api_key, api_key2, api_user, api_base_url, zone_ids,
         unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
         alert_threshold, tg_chat_id, status,
         traffic_adjust_pct, traffic_adjust_delta_gb, traffic_adjust_anchor_month)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(name).trim(),
      contact || null,
      remark  || null,
      provider || 'source1',
      (scene && ['download', 'vod', 'cn2'].includes(scene)) ? scene : 'download',
      api_key || null,
      // api_key2 is optional & CCDN-only, but we store it regardless of
      // provider so switching providers back and forth doesn't lose the value.
      (api_key2 && String(api_key2).trim()) ? String(api_key2).trim() : null,
      api_user || null,
      api_base_url || null,
      normalizeZoneIdsForStorage(zone_ids),
      priceTraffic,       // legacy unit_price mirror
      priceTraffic,
      priceRequest,
      priceDomain,
      num(alert_threshold, 0),
      tg_chat_id || null,
      status || 'active',
      clampPct(num(traffic_adjust_pct, 0)),
      num(traffic_adjust_delta_gb, 0),
      anchorMonthIn === undefined ? null : anchorMonthIn,
    );
    ok(res, { id: r.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return fail(res, 400, 'name already exists');
    fail(res, 500, e.message);
  }
});

// Update
router.put('/customers/:id', (req, res) => {
  const id = num(req.params.id);
  const c = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  if (!c) return fail(res, 404, 'customer not found');

  const {
    name, contact, remark,
    provider, api_key, api_key2, api_user, api_base_url, zone_ids,
    unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
    alert_threshold, tg_chat_id, status, scene,
    traffic_adjust_pct, traffic_adjust_delta_gb, traffic_adjust_anchor_month,
  } = req.body || {};

  let anchorMonthIn;
  try { anchorMonthIn = normAnchorMonth(traffic_adjust_anchor_month); }
  catch (e) { return fail(res, 400, e.message); }

  // For api_key: if client sends `null`, clear; if undefined/empty string,
  // keep existing (so the masked-key UI can save without exposing the key).
  let nextApiKey = c.api_key;
  if (api_key === null) nextApiKey = null;
  else if (typeof api_key === 'string' && api_key.trim() !== '') nextApiKey = api_key.trim();

  // Same pattern for api_key2 (optional secondary key, CCDN-only usage).
  let nextApiKey2 = c.api_key2;
  if (api_key2 === null) nextApiKey2 = null;
  else if (typeof api_key2 === 'string' && api_key2.trim() !== '') nextApiKey2 = api_key2.trim();

  // api_user is not sensitive — empty string clears, undefined keeps.
  const nextApiUser = (api_user === undefined) ? c.api_user : (api_user || null);

  // zone_ids: undefined keeps current; empty/null/[] clears; else normalise.
  const nextZoneIds = (zone_ids === undefined)
    ? c.zone_ids
    : normalizeZoneIdsForStorage(zone_ids);

  // Calibration knobs: undefined keeps current; non-undefined coerces to a
  // safe number (0 fallback, pct clamped to a sane range).
  const nextAdjPct = (traffic_adjust_pct === undefined)
    ? Number(c.traffic_adjust_pct || 0)
    : clampPct(num(traffic_adjust_pct, 0));
  const nextAdjDelta = (traffic_adjust_delta_gb === undefined)
    ? Number(c.traffic_adjust_delta_gb || 0)
    : num(traffic_adjust_delta_gb, 0);
  const nextAnchorMonth = (anchorMonthIn === undefined)
    ? (c.traffic_adjust_anchor_month || null)
    : anchorMonthIn;

  // scene: undefined keeps current; otherwise validate into the allowed set
  // (download | vod | cn2), falling back to the existing value if invalid.
  const nextScene = (scene === undefined)
    ? c.scene
    : (['download', 'vod', 'cn2'].includes(scene) ? scene : c.scene);

  // Three-mode pricing on update: `undefined` keeps the current value,
  // any provided number overwrites. Legacy `unit_price` is treated as an
  // alias for `unit_price_traffic` when the caller only sent the old key.
  const nextPriceTraffic = (unit_price_traffic !== undefined)
    ? num(unit_price_traffic, c.unit_price_traffic || 0)
    : (unit_price !== undefined ? num(unit_price, c.unit_price_traffic || c.unit_price || 0)
                                : Number(c.unit_price_traffic || c.unit_price || 0));
  const nextPriceRequest = (unit_price_request !== undefined)
    ? num(unit_price_request, c.unit_price_request || 0)
    : Number(c.unit_price_request || 0);
  const nextPriceDomain = (unit_price_domain !== undefined)
    ? num(unit_price_domain, c.unit_price_domain || 0)
    : Number(c.unit_price_domain || 0);

  db.prepare(`
    UPDATE customers SET
      name = ?,
      contact = ?,
      remark = ?,
      provider = ?,
      scene = ?,
      api_key = ?,
      api_key2 = ?,
      api_user = ?,
      api_base_url = ?,
      zone_ids = ?,
      unit_price = ?,
      unit_price_traffic = ?,
      unit_price_request = ?,
      unit_price_domain = ?,
      alert_threshold = ?,
      tg_chat_id = ?,
      status = ?,
      traffic_adjust_pct = ?,
      traffic_adjust_delta_gb = ?,
      traffic_adjust_anchor_month = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    name ? String(name).trim() : c.name,
    contact ?? c.contact,
    remark  ?? c.remark,
    provider || c.provider || 'source1',
    nextScene,
    nextApiKey,
    nextApiKey2,
    nextApiUser,
    (api_base_url === undefined) ? c.api_base_url : (api_base_url || null),
    nextZoneIds,
    nextPriceTraffic,   // legacy unit_price mirror
    nextPriceTraffic,
    nextPriceRequest,
    nextPriceDomain,
    num(alert_threshold, c.alert_threshold),
    tg_chat_id ?? c.tg_chat_id,
    status || c.status,
    nextAdjPct,
    nextAdjDelta,
    nextAnchorMonth,
    id,
  );
  // If any of the three price knobs changed, recompute every usage_records
  // row of this customer so amount/balance stay consistent. (`amount` is a
  // snapshot of the three-mode fee sum at insert time.)
  const priceChanged =
       Math.abs(nextPriceTraffic - Number(c.unit_price_traffic || c.unit_price || 0)) > 1e-9
    || Math.abs(nextPriceRequest - Number(c.unit_price_request || 0)) > 1e-9
    || Math.abs(nextPriceDomain  - Number(c.unit_price_domain  || 0)) > 1e-9;
  let recomputed = null;
  if (priceChanged) {
    recomputed = stats.recomputeUsageAmounts(id);
  }

  ok(res, { id, recomputed });
});

// Delete
router.delete('/customers/:id', (req, res) => {
  const id = num(req.params.id);
  // Run the delete inside a transaction so the parent row and all its
  // ON DELETE CASCADE children (usage_records / recharges / alert_logs /
  // sync_logs) are removed atomically.
  let result;
  try {
    result = db.transaction(() => {
      const before = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM usage_records WHERE customer_id = ?) AS usage,
          (SELECT COUNT(*) FROM recharges     WHERE customer_id = ?) AS recharges
      `).get(id, id);
      const r = db.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
      if (!r.changes) return { found: false, usage: 0, recharges: 0 };
      return { found: true, usage: before.usage, recharges: before.recharges };
    })();
  } catch (e) {
    return fail(res, 500, e.message);
  }
  if (!result.found) return fail(res, 404, 'customer not found');
  ok(res, { id, deleted_usage_records: result.usage, deleted_recharges: result.recharges });
});

// Recompute usage_records.amount for ONE customer using current unit_price
router.post('/customers/:id/recompute', (req, res) => {
  const id = num(req.params.id);
  const c = db.prepare(`SELECT id FROM customers WHERE id = ?`).get(id);
  if (!c) return fail(res, 404, 'customer not found');
  const r = stats.recomputeUsageAmounts(id);
  ok(res, r);
});

// Recompute usage_records.amount for ALL customers
router.post('/recompute/all', (req, res) => {
  const r = stats.recomputeUsageAmounts(null);
  ok(res, r);
});

// =====================================================
// Sync (pull traffic from upstream provider)
// =====================================================

// Sync one customer
router.post('/customers/:id/sync', async (req, res) => {
  const id = num(req.params.id);
  const c = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  if (!c) return fail(res, 404, 'customer not found');
  try {
    const r = await sync.syncCustomer(c, {
      startDate: req.body?.start_date,
      endDate:   req.body?.end_date,
    });
    ok(res, r);
  } catch (e) {
    fail(res, 500, e.message);
  }
});

// Sync everyone
router.post('/sync/all', async (req, res) => {
  try {
    const r = await sync.syncAll({
      startDate: req.body?.start_date,
      endDate:   req.body?.end_date,
    });
    ok(res, r);
  } catch (e) {
    fail(res, 500, e.message);
  }
});

// Sync logs (for debugging upstream)
router.get('/sync/logs', (req, res) => {
  const cid = req.query.customer_id ? num(req.query.customer_id) : null;
  let sql = `
    SELECT s.*, c.name AS customer_name
    FROM sync_logs s LEFT JOIN customers c ON c.id = s.customer_id
  `;
  const params = [];
  if (cid) { sql += ` WHERE s.customer_id = ?`; params.push(cid); }
  sql += ` ORDER BY s.id DESC LIMIT 100`;
  ok(res, db.prepare(sql).all(...params));
});

// =====================================================
// Recharges
// =====================================================

// List recharges of a customer
router.get('/customers/:id/recharges', (req, res) => {
  const id = num(req.params.id);
  const list = db.prepare(`
    SELECT * FROM recharges WHERE customer_id = ? ORDER BY id DESC
  `).all(id);
  ok(res, list);
});

// Add recharge
router.post('/customers/:id/recharges', (req, res) => {
  const id = num(req.params.id);
  const c = db.prepare(`SELECT id FROM customers WHERE id = ?`).get(id);
  if (!c) return fail(res, 404, 'customer not found');

  const amount = num(req.body?.amount, 0);
  if (amount <= 0) return fail(res, 400, 'amount must be > 0');

  const r = db.prepare(`
    INSERT INTO recharges (customer_id, amount, method, remark)
    VALUES (?, ?, ?, ?)
  `).run(id, amount, req.body?.method || null, req.body?.remark || null);

  ok(res, { id: r.lastInsertRowid });
});

// Delete recharge
router.delete('/recharges/:rid', (req, res) => {
  const rid = num(req.params.rid);
  const r = db.prepare(`DELETE FROM recharges WHERE id = ?`).run(rid);
  if (!r.changes) return fail(res, 404, 'recharge not found');
  ok(res, { id: rid });
});

// =====================================================
// Usage records
// =====================================================

// List usage of a customer (optionally filter by month YYYY-MM, or 'all')
router.get('/customers/:id/usage', (req, res) => {
  const id = num(req.params.id);
  const month = req.query.month;
  let sql = `SELECT * FROM usage_records WHERE customer_id = ?`;
  const params = [id];
  if (month && month !== 'all' && month !== 'ALL') {
    sql += ` AND substr(usage_date,1,7) = ?`;
    params.push(month);
  }
  sql += ` ORDER BY usage_date DESC`;
  ok(res, db.prepare(sql).all(...params));
});

// Add (or upsert) one daily usage record
router.post('/customers/:id/usage', (req, res) => {
  const id = num(req.params.id);
  const c = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  if (!c) return fail(res, 404, 'customer not found');

  const usage_date = req.body?.usage_date;
  if (!usage_date || !/^\d{4}-\d{2}-\d{2}$/.test(usage_date)) {
    return fail(res, 400, 'usage_date is required (YYYY-MM-DD)');
  }
  const traffic_gb = num(req.body?.traffic_gb, 0);
  if (traffic_gb < 0) return fail(res, 400, 'traffic_gb must be >= 0');
  // Placeholder cost-mode metrics; default to 0 (collected upstream later).
  const request_count = num(req.body?.request_count, 0);
  const domain_count  = num(req.body?.domain_count, 0);
  if (request_count < 0) return fail(res, 400, 'request_count must be >= 0');
  if (domain_count  < 0) return fail(res, 400, 'domain_count must be >= 0');

  // Snapshot current customer three-mode pricing unless overridden.
  //   Legacy `unit_price` acts as an alias for the traffic price when the
  //   caller only sent the old key.
  const pT = req.body?.unit_price_traffic != null
    ? num(req.body.unit_price_traffic, 0)
    : (req.body?.unit_price != null
        ? num(req.body.unit_price, 0)
        : Number(c.unit_price_traffic || c.unit_price || 0));
  const pR = req.body?.unit_price_request != null
    ? num(req.body.unit_price_request, 0)
    : Number(c.unit_price_request || 0);
  const pD = req.body?.unit_price_domain != null
    ? num(req.body.unit_price_domain, 0)
    : Number(c.unit_price_domain || 0);

  const trafficFee = stats.round2(traffic_gb    * pT);
  const requestFee = stats.round2(request_count * pR);
  const domainFee  = stats.round2(domain_count  * pD);
  // Per X2 policy: amount holds daily flow fees only. domain_fee is stamped
  // for per-row auditability but excluded from amount; monthly billing uses
  // MAX(domain_count) × domain price at aggregation time.
  const amount     = stats.round2(trafficFee + requestFee);

  // Upsert by (customer_id, usage_date)
  db.prepare(`
    INSERT INTO usage_records
      (customer_id, usage_date, traffic_gb, request_count, domain_count,
       unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
       traffic_fee, request_fee, domain_fee, amount, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(customer_id, usage_date) DO UPDATE SET
      traffic_gb         = excluded.traffic_gb,
      request_count      = excluded.request_count,
      domain_count       = excluded.domain_count,
      unit_price         = excluded.unit_price,
      unit_price_traffic = excluded.unit_price_traffic,
      unit_price_request = excluded.unit_price_request,
      unit_price_domain  = excluded.unit_price_domain,
      traffic_fee        = excluded.traffic_fee,
      request_fee        = excluded.request_fee,
      domain_fee         = excluded.domain_fee,
      amount             = excluded.amount,
      remark             = excluded.remark
  `).run(
    id, usage_date, traffic_gb, request_count, domain_count,
    pT, pT, pR, pD,
    trafficFee, requestFee, domainFee, amount,
    req.body?.remark || null,
  );

  ok(res, {
    customer_id: id, usage_date, traffic_gb, request_count, domain_count,
    unit_price_traffic: pT, unit_price_request: pR, unit_price_domain: pD,
    traffic_fee: trafficFee, request_fee: requestFee, domain_fee: domainFee, amount,
  });
});

// Delete a single usage record
router.delete('/usage/:uid', (req, res) => {
  const uid = num(req.params.uid);
  const r = db.prepare(`DELETE FROM usage_records WHERE id = ?`).run(uid);
  if (!r.changes) return fail(res, 404, 'usage record not found');
  ok(res, { id: uid });
});

// =====================================================
// Bills (monthly aggregated)
// =====================================================

// Monthly billing summary for a customer
router.get('/customers/:id/bills', (req, res) => {
  const id = num(req.params.id);
  const c = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  if (!c) return fail(res, 404, 'customer not found');

  const cm = stats.buildCostMap();
  const monthly = stats.getCustomerMonthlyUsage(id, undefined, cm);
  const s = stats.getCustomerStats(id, cm);

  ok(res, {
    customer: {
      id: c.id,
      name: c.name,
      provider: c.provider,
      scene: c.scene,
      unit_price: c.unit_price_traffic ?? c.unit_price,          // legacy alias
      unit_price_traffic: c.unit_price_traffic ?? c.unit_price ?? 0,
      unit_price_request: c.unit_price_request ?? 0,
      unit_price_domain:  c.unit_price_domain  ?? 0,
    },
    summary:  s,
    monthly,
  });
});

// =====================================================
// Alert logs
// =====================================================

router.get('/alerts/logs', (req, res) => {
  const customerId = req.query.customer_id ? num(req.query.customer_id) : null;
  let sql = `
    SELECT a.*, c.name AS customer_name
    FROM alert_logs a
    LEFT JOIN customers c ON c.id = a.customer_id
  `;
  const params = [];
  if (customerId) { sql += ` WHERE a.customer_id = ?`; params.push(customerId); }
  sql += ` ORDER BY a.id DESC LIMIT 200`;
  ok(res, db.prepare(sql).all(...params));
});

// Manual: trigger alert check now
router.post('/alerts/check', async (req, res) => {
  const { checkAndAlert } = require('../services/alert');
  try {
    const result = await checkAndAlert({
      force: req.body?.force === true,
      customerId: req.body?.customer_id ? num(req.body.customer_id) : undefined,
    });
    ok(res, result);
  } catch (e) {
    fail(res, 500, e.message);
  }
});

// Test TG message (sanity check for bot setup)
router.post('/alerts/test', async (req, res) => {
  const { sendTelegramMessage } = require('../services/telegram');
  const chatId = req.body?.chat_id || process.env.TELEGRAM_CHAT_ID;
  const text   = req.body?.text || '✅ BCDN test message - your bot is working.';
  try {
    await sendTelegramMessage(chatId, text);
    ok(res, { sent: true, chat_id: chatId });
  } catch (e) {
    fail(res, 500, e.message);
  }
});

// =====================================================
// Scene-level cost prices  (provider × scene)
// =====================================================

// Aggregated metrics grouped by (provider, scene) (for the dashboard's
// "按融合平台汇总" card). Honors ?month=YYYY-MM (default = current month).
router.get('/provider-summaries', (req, res) => {
  ok(res, stats.listProviderSummaries(req.query.month));
});

// =====================================================
// Reports (revenue export)
// =====================================================

/**
 * One-shot data bundle for the revenue report preview / PDF export.
 *
 * Query:
 *   ?month=YYYY-MM   (default = current month)
 *   ?month=all       (lifetime view; uses every recorded row)
 *
 * Returns:
 *   {
 *     period:    'YYYY-MM' | 'all',
 *     label:     human readable label,
 *     generated_at: ISO datetime string,
 *     totals:    { customers, traffic_gb, revenue, platform_cost,
 *                  resource_cost, total_cost, gross_profit, margin,
 *                  total_recharge, total_balance },
 *     providers: [ provider summary rows ],
 *     customers: [ customer rows scoped to the period ],
 *   }
 */
router.get('/reports/revenue', (req, res) => {
  try {
    const monthIn = req.query.month;
    const isAll   = monthIn === 'all' || monthIn === 'ALL';
    const period  = isAll ? 'all' : (monthIn || stats.nowYearMonth());
    const label   = isAll ? '全区间' : period;

    const customers = stats.listCustomersWithStats(isAll ? 'all' : period);
    const providers = stats.listProviderSummaries(isAll ? 'all' : period);

    // Pick the period-scoped numbers from each customer row (the helper
    // already exposes month_* fields that fall back to lifetime when the
    // caller passed 'all').
    const totals = customers.reduce((acc, c) => {
      acc.traffic_gb    += Number(c.month_traffic_gb || 0);
      acc.revenue       += Number(c.month_revenue ?? c.month_amount ?? 0);
      acc.platform_cost += Number(c.month_platform_cost || 0);
      acc.resource_cost += Number(c.month_resource_cost || 0);
      acc.gross_profit  += Number(c.month_gross_profit  || 0);
      acc.total_recharge += Number(c.total_recharge || 0);
      acc.total_balance  += Number(c.balance || 0);
      return acc;
    }, {
      customers: customers.length,
      traffic_gb: 0, revenue: 0,
      platform_cost: 0, resource_cost: 0, gross_profit: 0,
      total_recharge: 0, total_balance: 0,
    });
    totals.total_cost = stats.round2(totals.platform_cost + totals.resource_cost);
    totals.platform_cost = stats.round2(totals.platform_cost);
    totals.resource_cost = stats.round2(totals.resource_cost);
    totals.revenue       = stats.round2(totals.revenue);
    totals.gross_profit  = stats.round2(totals.gross_profit);
    totals.traffic_gb    = stats.round4(totals.traffic_gb);
    totals.total_recharge = stats.round2(totals.total_recharge);
    totals.total_balance  = stats.round2(totals.total_balance);
    totals.margin = totals.revenue > 0
      ? stats.round4(totals.gross_profit / totals.revenue)
      : null;

    ok(res, {
      period,
      label,
      generated_at: new Date().toISOString(),
      totals,
      providers,
      customers: customers.map(c => ({
        id:                 c.id,
        name:               c.name,
        provider:           c.provider,
        scene:              c.scene || 'download',
        status:             c.status,
        unit_price:         c.unit_price_traffic ?? c.unit_price ?? 0,
        unit_price_traffic: c.unit_price_traffic ?? c.unit_price ?? 0,
        unit_price_request: c.unit_price_request ?? 0,
        unit_price_domain:  c.unit_price_domain  ?? 0,
        month_traffic_gb:   c.month_traffic_gb,
        month_revenue:      c.month_revenue ?? c.month_amount ?? 0,
        month_platform_cost: c.month_platform_cost,
        month_resource_cost: c.month_resource_cost,
        month_gross_profit:  c.month_gross_profit,
        total_recharge:     c.total_recharge,
        balance:            c.balance,
      })),
    });
  } catch (e) {
    fail(res, 500, e.message);
  }
});

// =====================================================
// Scene-level cost prices  (provider × scene)
// =====================================================

// Read all configured (provider, scene) cost rows, optionally with stats.
// Query: ?with_stats=1 -> include customer_count + lifetime totals.
router.get('/scene-costs', (req, res) => {
  const withStats = req.query.with_stats === '1' || req.query.with_stats === 'true';
  ok(res, stats.listSceneCosts(withStats));
});

// Upsert one (provider, scene) cost config.
// Body: {
//   platform_cost_ratio: 0~1 (ratio, % of revenue),
//   traffic_unit_price:  USDT / GB,
//   request_unit_price:  USDT / 万次 request,
//   domain_unit_price:   USDT / 域名,
//   remark?
// }
router.put('/scene-costs/:provider/:scene', (req, res) => {
  const provider = String(req.params.provider || '').trim();
  const scene    = String(req.params.scene || '').trim();
  if (!provider) return fail(res, 400, 'provider is required');
  if (!scene)    return fail(res, 400, 'scene is required');
  try {
    const row = stats.setSceneCost(provider, scene, {
      platform_cost_ratio:  num(req.body?.platform_cost_ratio, 0),
      traffic_unit_price:   num(req.body?.traffic_unit_price, 0),
      request_unit_price:   num(req.body?.request_unit_price, 0),
      domain_unit_price:    num(req.body?.domain_unit_price, 0),
      remark: req.body?.remark || null,
    });
    ok(res, row);
  } catch (e) {
    fail(res, 500, e.message);
  }
});

module.exports = router;
