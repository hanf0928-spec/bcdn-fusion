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

const PROVIDERS = {
  source1,
  source2,
};

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

  let rows;
  try {
    rows = await driver.fetchDailyTraffic({
      apiKey:   customer.api_key,
      apiUser:  customer.api_user || undefined,
      baseUrl:  customer.api_base_url || undefined,
      startDate,
      endDate,
    });
  } catch (e) {
    logSync(customer, false, 0, 0, e.message);
    throw e;
  }

  // Upsert each daily row using the customer's current unit_price.
  const upsert = db.prepare(`
    INSERT INTO usage_records (customer_id, usage_date, traffic_gb, unit_price, amount, remark)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(customer_id, usage_date) DO UPDATE SET
      traffic_gb = excluded.traffic_gb,
      unit_price = excluded.unit_price,
      amount     = excluded.amount,
      remark     = excluded.remark
  `);

  let totalTraffic = 0;
  const tx = db.transaction((items) => {
    for (const it of items) {
      const traffic = Number(it.traffic_gb || 0);
      const amount  = stats.round2(traffic * Number(customer.unit_price || 0));
      upsert.run(
        customer.id,
        it.usage_date,
        traffic,
        Number(customer.unit_price || 0),
        amount,
        `auto:${customer.provider}`,
      );
      totalTraffic += traffic;
    }
  });
  tx(rows);

  db.prepare(`UPDATE customers SET last_sync_at = datetime('now','localtime') WHERE id = ?`)
    .run(customer.id);

  logSync(customer, true, rows.length, stats.round4(totalTraffic), `${startDate} ~ ${endDate}`);

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
