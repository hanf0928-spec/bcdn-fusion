'use strict';

/**
 * CN2 minimum-traffic-commitment settlement.
 *
 * Business rules (from product spec):
 *   - Only applies to customers whose scene = 'cn2' AND
 *     min_commit_gb > 0.
 *   - Two scheduled settlements per month:
 *       * mode='mid'   : fires on the 28th of the current month.
 *                        Settles the CURRENT month using the
 *                        traffic accumulated so far. This is a
 *                        preview / informational settlement — the
 *                        final revenue for the month is decided by
 *                        the 'final' run below.
 *       * mode='final' : fires on the 1st of each month.
 *                        Settles the PREVIOUS month using its final
 *                        SUM(traffic_gb). This is the row that
 *                        actually contributes to monthly revenue
 *                        (see stats.js).
 *
 *   For each settled month:
 *     actual_gb    = SUM(usage_records.traffic_gb) for that month
 *     shortfall_gb = max(0, min_commit_gb - actual_gb)
 *     fee          = shortfall_gb * customer.unit_price_traffic
 *
 *   The record is upserted per (customer_id, month, mode), so a
 *   re-run (manual retry / re-schedule after a crash) safely
 *   overwrites the previous value instead of double-billing.
 */

const db = require('../db');

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function round4(n) { return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000; }

/** Return 'YYYY-MM' for the current month (server local time). */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Return 'YYYY-MM' for the month immediately before `ym`. */
function previousMonth(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(y, m - 2, 1); // JS month is 0-based; m-2 = m-1 (0-based) then -1 month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Basic YYYY-MM sanity check. */
function isValidMonth(ym) {
  return typeof ym === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

/**
 * Settle one customer for one month.
 *
 * @param {number} customerId
 * @param {string} month  YYYY-MM
 * @param {'mid'|'final'} mode
 * @returns {object|null}  the settlement row (also persisted), or null if
 *                         the customer is not eligible (not CN2 / commit=0
 *                         / customer disabled / not found).
 */
function settleForMonth(customerId, month, mode) {
  if (!isValidMonth(month)) throw new Error(`invalid month: ${month}`);
  if (mode !== 'mid' && mode !== 'final') {
    throw new Error(`invalid mode: ${mode} (expected 'mid' | 'final')`);
  }

  const c = db.prepare(`
    SELECT id, name, scene, status, min_commit_gb,
           unit_price_traffic, unit_price
    FROM customers WHERE id = ?
  `).get(customerId);
  if (!c) return null;

  // Eligibility gate: CN2 scene + positive commitment. We deliberately
  // still settle 'disabled' customers so that closing an account mid-
  // month doesn't drop the commit — operators can delete the customer
  // if they truly want the row gone.
  const scene = c.scene || 'download';
  const commit = Number(c.min_commit_gb || 0);
  if (scene !== 'cn2' || commit <= 0) return null;

  const price = Number(c.unit_price_traffic || c.unit_price || 0);

  const u = db.prepare(`
    SELECT COALESCE(SUM(traffic_gb), 0) AS actual
    FROM usage_records
    WHERE customer_id = ? AND substr(usage_date, 1, 7) = ?
  `).get(customerId, month);

  // Billing rule (product spec):
  //   billable_gb = max(commit, actual)
  //   fee         = billable_gb * unit_price
  // I.e. the commit acts as a FLOOR on the billable traffic — the customer
  // is charged at least the commit even if the actual usage is lower, and
  // exactly the actual usage when it exceeds the commit. `shortfall_gb`
  // stays as an informational field for the UI (= max(0, commit - actual)).
  const actual      = round4(Number(u.actual || 0));
  const shortfall   = round4(Math.max(0, commit - actual));
  const billableGb  = round4(Math.max(commit, actual));
  const fee         = round2(billableGb * price);

  const remark = shortfall > 0
    ? `min-commit ${mode}: actual ${actual}GB < commit ${commit}GB → charge floor ${commit}GB × ${price}USDT/GB`
    : `min-commit ${mode}: actual ${actual}GB >= commit ${commit}GB → charge actual ${actual}GB × ${price}USDT/GB`;

  db.prepare(`
    INSERT INTO min_commit_records
      (customer_id, month, mode, min_commit_gb, actual_gb, shortfall_gb,
       unit_price, fee, remark, settled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(customer_id, month, mode) DO UPDATE SET
      min_commit_gb = excluded.min_commit_gb,
      actual_gb     = excluded.actual_gb,
      shortfall_gb  = excluded.shortfall_gb,
      unit_price    = excluded.unit_price,
      fee           = excluded.fee,
      remark        = excluded.remark,
      settled_at    = excluded.settled_at
  `).run(customerId, month, mode, commit, actual, shortfall, price, fee, remark);

  return {
    customer_id:   customerId,
    customer_name: c.name,
    month, mode,
    min_commit_gb: commit,
    actual_gb:     actual,
    billable_gb:   billableGb,
    shortfall_gb:  shortfall,
    unit_price:    price,
    fee,
    remark,
  };
}

/**
 * Settle every eligible customer for a given month + mode.
 *
 * @param {'mid'|'final'} mode
 * @param {string} [month]  YYYY-MM. Defaults to:
 *                            - current month for mode='mid'
 *                            - previous month for mode='final'
 * @returns {{ mode:string, month:string, results: Array }}
 */
function settleAll(mode, month) {
  const targetMonth = month || (mode === 'final'
    ? previousMonth(currentMonth())
    : currentMonth());

  const rows = db.prepare(`
    SELECT id FROM customers
    WHERE scene = 'cn2' AND min_commit_gb > 0
  `).all();

  const results = [];
  for (const r of rows) {
    try {
      const out = settleForMonth(r.id, targetMonth, mode);
      if (out) results.push({ ok: true, ...out });
    } catch (e) {
      results.push({ ok: false, customer_id: r.id, error: e.message });
    }
  }
  return { mode, month: targetMonth, total: rows.length, results };
}

/**
 * Fetch min-commit settlements for one customer. Optionally filter by
 * month. Returned rows are ordered by month desc, mode desc so 'final'
 * shows above 'mid' for the same month.
 */
function listForCustomer(customerId, month) {
  let sql = `SELECT * FROM min_commit_records WHERE customer_id = ?`;
  const params = [customerId];
  if (month && isValidMonth(month)) {
    sql += ` AND month = ?`;
    params.push(month);
  }
  sql += ` ORDER BY month DESC, mode DESC`;
  return db.prepare(sql).all(...params);
}

/**
 * Aggregate map of {month -> {final_fee, mid_fee, ...}} for one customer.
 * Used by stats.js when computing monthly revenue that includes the
 * min-commit top-up (only 'final' feeds revenue).
 */
function feeMapByMonth(customerId) {
  const rows = db.prepare(`
    SELECT month, mode, fee, shortfall_gb, min_commit_gb, actual_gb, unit_price
    FROM min_commit_records
    WHERE customer_id = ?
  `).all(customerId);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.month)) map.set(r.month, { final: null, mid: null });
    map.get(r.month)[r.mode] = r;
  }
  return map;
}

module.exports = {
  settleForMonth,
  settleAll,
  listForCustomer,
  feeMapByMonth,
  currentMonth,
  previousMonth,
};
