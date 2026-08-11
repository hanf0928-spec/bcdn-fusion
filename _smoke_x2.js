'use strict';

/**
 * End-to-end smoke test for X2 policy:
 *   - amount holds only traffic_fee + request_fee (NOT domain_fee)
 *   - domain_count is billed monthly at MAX(domain_count) × price
 *   - stats.getCustomerStats / getCustomerMonthlyUsage / listCustomersWithStats /
 *     listProviderSummaries / listSceneCosts all follow the X2 policy consistently.
 */

const db = require('./src/db');
const stats = require('./src/services/stats');

const NAME = '__smoke_x2_customer__';
let failed = 0;
function eq(label, got, expect, tol = 0.011) {
  const pass = Math.abs(Number(got) - Number(expect)) <= tol;
  const tag = pass ? '✅' : '❌';
  console.log(`${tag} ${label.padEnd(42)} got=${got}  expect=${expect}`);
  if (!pass) failed++;
}

function cleanup() {
  db.prepare(`DELETE FROM usage_records WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE '__smoke_x2%')`).run();
  db.prepare(`DELETE FROM customers WHERE name LIKE '__smoke_x2%'`).run();
}
cleanup();

// ---- Customer setup ----
// Prices: 200 USDT/TB traffic = 0.2 USDT/GB
//         1.5 USDT/万次 request = 0.00015 USDT/次
//         3 USDT/domain
const pT = 0.2, pR = 0.00015, pD = 3;
const cid = db.prepare(`
  INSERT INTO customers (name, provider, scene, status,
    unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
    alert_threshold)
  VALUES (?, 'source1', 'download', 'active', ?, ?, ?, ?, 100)
`).run(NAME, pT, pT, pR, pD).lastInsertRowid;

// 3 usage rows across the same month with fluctuating domain counts.
//   day1: 50 GB, 100000 requests, 5 domains
//   day2: 30 GB, 200000 requests, 7 domains  <- peak
//   day3: 20 GB, 150000 requests, 6 domains
// Per X2, amount stored per-row = traffic_fee + request_fee ONLY.
const rows = [
  { d: '2026-08-01', tr: 50, rq: 100000, dm: 5 },
  { d: '2026-08-02', tr: 30, rq: 200000, dm: 7 },
  { d: '2026-08-03', tr: 20, rq: 150000, dm: 6 },
];
const ins = db.prepare(`
  INSERT INTO usage_records
    (customer_id, usage_date, traffic_gb, request_count, domain_count,
     unit_price, unit_price_traffic, unit_price_request, unit_price_domain,
     traffic_fee, request_fee, domain_fee, amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const r of rows) {
  const tf = Math.round(r.tr * pT * 100) / 100;
  const rf = Math.round(r.rq * pR * 100) / 100;
  const df = Math.round(r.dm * pD * 100) / 100; // stamped for audit; NOT in amount
  const amt = Math.round((tf + rf) * 100) / 100;
  ins.run(cid, r.d, r.tr, r.rq, r.dm, pT, pT, pR, pD, tf, rf, df, amt);
}

// ---- 1) getCustomerStats: total_domains = MAX; revenue = SUM(amount) + peak*price ----
console.log('\n=== 1) getCustomerStats — domain uses MAX, revenue adds domain_fee ===');
const s = stats.getCustomerStats(cid);
const expTraffic  = 50 + 30 + 20;                                              // 100
const expRequests = 100000 + 200000 + 150000;                                  // 450000
const expDomains  = 7;                                                          // MAX
const expTrafficFee = expTraffic  * pT;                                        // 20
const expRequestFee = expRequests * pR;                                        // 67.5
const expAmountSum  = Math.round((expTrafficFee + expRequestFee) * 100) / 100; // 87.5
const expDomainRev  = expDomains * pD;                                          // 21
const expRevenue    = Math.round((expAmountSum + expDomainRev) * 100) / 100;   // 108.5

eq('totalTraffic',        s.totalTraffic,        expTraffic);
eq('totalRequests',       s.totalRequests,       expRequests);
eq('totalDomains (MAX)',  s.totalDomains,        expDomains);
eq('totalRevenue',        s.totalRevenue,        expRevenue);
eq('totalDomainRevenueFee', s.totalDomainRevenueFee, expDomainRev);

// ---- 2) getCustomerMonthlyUsage: 单月同样口径 ----
console.log('\n=== 2) getCustomerMonthlyUsage — same policy per month ===');
const monthly = stats.getCustomerMonthlyUsage(cid);
const m = monthly.find(x => x.month === '2026-08');
if (!m) { console.log('❌ month row missing'); failed++; }
else {
  eq('m.traffic_gb',         m.traffic_gb,         expTraffic);
  eq('m.request_count',      m.request_count,      expRequests);
  eq('m.domain_count (MAX)', m.domain_count,       expDomains);
  eq('m.amount (flow only)', m.amount,             expAmountSum);
  eq('m.domain_revenue_fee', m.domain_revenue_fee, expDomainRev);
  eq('m.revenue',            m.revenue,            expRevenue);
}

// ---- 3) listCustomersWithStats: 与上面口径一致 ----
console.log('\n=== 3) listCustomersWithStats ===');
const list = stats.listCustomersWithStats('2026-08');
const row = list.find(r => r.name === NAME);
if (!row) { console.log('❌ smoke customer missing'); failed++; }
else {
  eq('row.month_revenue',        row.month_revenue,        expRevenue);
  eq('row.month_domain_count',   row.month_domain_count,   expDomains);
  eq('row.total_domain_count',   row.total_domain_count,   expDomains);
  eq('row.total_revenue',        row.total_revenue,        expRevenue);
}

// ---- 4) 修改单价触发 recompute → amount 不含 domain_fee ----
console.log('\n=== 4) recomputeUsageAmounts — amount excludes domain_fee ===');
const pT2 = 0.5, pR2 = 0.0002, pD2 = 10;
db.prepare(`UPDATE customers SET unit_price_traffic=?, unit_price_request=?, unit_price_domain=?, unit_price=? WHERE id=?`)
  .run(pT2, pR2, pD2, pT2, cid);
stats.recomputeUsageAmounts(cid);
const check = db.prepare(`SELECT * FROM usage_records WHERE customer_id=? AND usage_date='2026-08-02'`).get(cid);
const expTf2 = 30 * pT2;              // 15
const expRf2 = 200000 * pR2;          // 40
const expDf2 = 7 * pD2;               // 70 (stamped, but NOT in amount)
const expAmt2 = expTf2 + expRf2;      // 55
eq('day2.traffic_fee (v2)', check.traffic_fee, expTf2);
eq('day2.request_fee (v2)', check.request_fee, expRf2);
eq('day2.domain_fee  (v2)', check.domain_fee,  expDf2);
eq('day2.amount (v2, excl domain)', check.amount, expAmt2);

// After recompute, revenue with new prices:
const s2 = stats.getCustomerStats(cid);
const expTrafficFee2 = expTraffic  * pT2;                             // 50
const expRequestFee2 = expRequests * pR2;                             // 90
const expAmount2     = expTrafficFee2 + expRequestFee2;               // 140
const expDomainRev2  = expDomains * pD2;                               // 70
const expRevenue2    = expAmount2 + expDomainRev2;                    // 210
eq('totalRevenue (v2)', s2.totalRevenue, expRevenue2);

// ---- 5) listProviderSummaries: (source1, download) 合计 ----
console.log('\n=== 5) listProviderSummaries — (source1, download) rollup ===');
const summ = stats.listProviderSummaries('2026-08');
const bucket = summ.find(p => p.provider === 'source1' && p.scene === 'download');
if (!bucket) { console.log('❌ bucket missing'); failed++; }
else {
  // The bucket includes other customers too; we only assert the smoke
  // customer's contribution is REFLECTED by checking that revenue ≥ expected.
  const contrib = expRevenue2;   // our customer's revenue (after v2 prices)
  console.log(`   bucket.month_revenue=${bucket.month_revenue} (must be ≥ ${contrib})`);
  const covered = bucket.month_revenue >= contrib - 0.02;
  console.log(covered ? '✅ bucket revenue reflects the smoke customer' : '❌ bucket revenue too low');
  if (!covered) failed++;
}

// ---- cleanup ----
cleanup();
console.log(failed === 0
  ? `\n🎉 ALL SMOKE TESTS PASSED`
  : `\n❌ ${failed} assertion(s) failed`);
process.exit(failed === 0 ? 0 : 1);
