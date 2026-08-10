'use strict';

/**
 * End-to-end smoke test for customer-level three-mode pricing (revenue side).
 * Verifies:
 *   1. DB migration back-filled unit_price_traffic from legacy unit_price.
 *   2. usage_records.amount = traffic_fee + request_fee + domain_fee snapshot.
 *   3. stats.getCustomerStats totals match the three-mode formula.
 *   4. recomputeUsageAmounts re-stamps history when prices change.
 */

const db = require('./src/db');
const stats = require('./src/services/stats');

const NAME = '__smoke_customer_pricing__';
let failed = 0;
function eq(label, got, expect, tol = 0.011) {
  const pass = Math.abs(Number(got) - Number(expect)) <= tol;
  const tag = pass ? '✅' : '❌';
  console.log(`${tag} ${label.padEnd(38)} got=${got}  expect=${expect}`);
  if (!pass) failed++;
}

function cleanup() {
  db.prepare(`DELETE FROM usage_records WHERE customer_id IN (SELECT id FROM customers WHERE name = ?)`).run(NAME);
  db.prepare(`DELETE FROM customers WHERE name = ?`).run(NAME);
}
cleanup();

// ---- create a customer with three-mode prices ----
// prices: 200 USDT/TB traffic = 0.2 USDT/GB
//         1.5 USDT/万次 request = 0.00015 USDT/次
//         3 USDT/域名
const pT = 0.2, pR = 0.00015, pD = 3;
const cid = db.prepare(`
  INSERT INTO customers (name, provider, scene, status,
    unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
    alert_threshold)
  VALUES (?, 'source1', 'download', 'active', ?, ?, ?, ?, 100)
`).run(NAME, pT, pT, pR, pD).lastInsertRowid;

// ---- insert usage: 50 GB, 300000 requests, 4 domains ----
const traffic = 50, reqs = 300000, doms = 4;
const trafficFee = 50 * 0.2;            // 10
const requestFee = 300000 * 0.00015;    // 45
const domainFee  = 4 * 3;               // 12
const amount     = trafficFee + requestFee + domainFee; // 67

db.prepare(`
  INSERT INTO usage_records
    (customer_id, usage_date, traffic_gb, request_count, domain_count,
     unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
     traffic_fee, request_fee, domain_fee, amount)
  VALUES (?, '2026-08-01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(cid, traffic, reqs, doms, pT, pT, pR, pD, trafficFee, requestFee, domainFee, amount);

// ---- 1) direct row: amount == three-mode sum ----
console.log('\n=== 1) usage_records row snapshot ===');
const row = db.prepare(`SELECT * FROM usage_records WHERE customer_id = ?`).get(cid);
eq('row.traffic_fee', row.traffic_fee, trafficFee);
eq('row.request_fee', row.request_fee, requestFee);
eq('row.domain_fee',  row.domain_fee,  domainFee);
eq('row.amount == Σfees', row.amount, amount);

// ---- 2) stats.getCustomerStats revenue reflects the sum ----
console.log('\n=== 2) getCustomerStats — revenue is three-mode ===');
const s = stats.getCustomerStats(cid);
eq('totalRevenue == 67', s.totalRevenue, amount);
eq('totalTraffic',   s.totalTraffic,  traffic);
eq('totalRequests',  s.totalRequests, reqs);
eq('totalDomains',   s.totalDomains,  doms);

// ---- 3) change prices, recompute, verify snapshot updates ----
console.log('\n=== 3) price change → recomputeUsageAmounts ===');
const pT2 = 0.5, pR2 = 0.0002, pD2 = 5;
db.prepare(`UPDATE customers SET unit_price_traffic=?, unit_price_request=?, unit_price_domain=?, unit_price=? WHERE id=?`)
  .run(pT2, pR2, pD2, pT2, cid);
const r = stats.recomputeUsageAmounts(cid);
console.log('   recomputed rows:', r.rows);
const row2 = db.prepare(`SELECT * FROM usage_records WHERE customer_id = ?`).get(cid);
const expTraffic2 = 50 * 0.5;         // 25
const expReq2     = 300000 * 0.0002;  // 60
const expDom2     = 4 * 5;            // 20
const expAmt2     = expTraffic2 + expReq2 + expDom2; // 105
eq('row.traffic_fee (v2)', row2.traffic_fee, expTraffic2);
eq('row.request_fee (v2)', row2.request_fee, expReq2);
eq('row.domain_fee  (v2)', row2.domain_fee,  expDom2);
eq('row.amount      (v2)', row2.amount,      expAmt2);
eq('row.unit_price_traffic (v2)', row2.unit_price_traffic, pT2);
eq('row.unit_price_request (v2)', row2.unit_price_request, pR2);
eq('row.unit_price_domain  (v2)', row2.unit_price_domain,  pD2);

const s2 = stats.getCustomerStats(cid);
eq('totalRevenue after recompute', s2.totalRevenue, expAmt2);

// ---- 4) migration: unit_price -> unit_price_traffic backfill ----
console.log('\n=== 4) DB migration backfill ===');
const legacyCheck = db.prepare(`
  SELECT COUNT(*) AS n FROM customers
  WHERE unit_price > 0 AND (unit_price_traffic IS NULL OR unit_price_traffic = 0)
`).get().n;
eq('customers backfilled (0 stale)', legacyCheck, 0);
const legacyUsageCheck = db.prepare(`
  SELECT COUNT(*) AS n FROM usage_records
  WHERE unit_price > 0 AND (unit_price_traffic IS NULL OR unit_price_traffic = 0)
`).get().n;
eq('usage rows backfilled (0 stale)', legacyUsageCheck, 0);

// ---- cleanup ----
cleanup();

console.log(failed === 0
  ? `\n🎉 ALL SMOKE TESTS PASSED`
  : `\n❌ ${failed} assertion(s) failed`);
process.exit(failed === 0 ? 0 : 1);
