'use strict';
/**
 * Smoke test for the double-api-key YCDN sync path.
 * Run: node _smoke_dualkey.js
 */

// Monkey-patch the YCDN driver BEFORE anything requires it.
const path = require('path');
const drvPath = require.resolve('./src/services/providers/source1');
require.cache[drvPath] = {
  id: drvPath,
  filename: drvPath,
  loaded: true,
  exports: {
    name: 'source1',
    async fetchDailyTraffic({ apiKey }) {
      if (apiKey === 'KEY_A') return [
        { usage_date: '2026-08-01', traffic_gb: 10, request_count: 100 },
        { usage_date: '2026-08-02', traffic_gb: 20, request_count: 200 },
      ];
      if (apiKey === 'KEY_B') return [
        { usage_date: '2026-08-01', traffic_gb:  5, request_count:  50 },
        { usage_date: '2026-08-02', traffic_gb:  7, request_count:  70 },
        { usage_date: '2026-08-03', traffic_gb:  3, request_count:  30 },
      ];
      if (apiKey === 'BAD') throw new Error('unauthorized');
      return [];
    },
    async fetchDomainCount({ apiKey }) {
      if (apiKey === 'KEY_A') return 100;
      if (apiKey === 'KEY_B') return 50;
      if (apiKey === 'BAD')   throw new Error('key expired');
      return 0;
    },
  },
};

const db = require('./src/db');
const sync = require('./src/services/sync');

async function main() {
  const name = 'smoke_' + Date.now();
  const r = db.prepare(`
    INSERT INTO customers
      (name, provider, api_key, api_key2, unit_price_traffic, unit_price_request, unit_price_domain, status, scene)
    VALUES (?, 'source1', ?, ?, 1, 0.01, 0.5, 'active', 'download')
  `).run(name, 'KEY_A', 'KEY_B');
  const cid = r.lastInsertRowid;
  console.log('customer id:', cid);

  function fetchRows() {
    return db.prepare(`
      SELECT usage_date, traffic_gb, domain_count
      FROM usage_records WHERE customer_id = ? ORDER BY usage_date
    `).all(cid);
  }
  function reset(k1, k2) {
    db.prepare('UPDATE customers SET api_key=?, api_key2=? WHERE id=?').run(k1, k2, cid);
    db.prepare('DELETE FROM usage_records WHERE customer_id=?').run(cid);
  }

  // ---- Case 1: both keys ok ----
  let c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  await sync.syncCustomer(c, { startDate: '2026-08-01', endDate: '2026-08-03' });
  console.log('case1 (both ok) rows:', JSON.stringify(fetchRows()));
  console.log('  EXPECT 08-01=15, 08-02=27, 08-03=3, domain=100');

  // ---- Case 2: primary bad, secondary ok ----
  reset('BAD', 'KEY_B');
  c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  await sync.syncCustomer(c, { startDate: '2026-08-01', endDate: '2026-08-03' });
  console.log('case2 (primary BAD, secondary ok) rows:', JSON.stringify(fetchRows()));
  console.log('  EXPECT only KEY_B data, domain=50');

  // ---- Case 3: both bad ----
  reset('BAD', 'BAD');
  c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  try {
    await sync.syncCustomer(c, { startDate: '2026-08-01', endDate: '2026-08-03' });
    console.log('case3 UNEXPECTED SUCCESS');
  } catch (e) {
    console.log('case3 (both BAD) expected error:', e.message);
  }

  // ---- Case 4: single key path unchanged ----
  reset('KEY_A', null);
  c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  await sync.syncCustomer(c, { startDate: '2026-08-01', endDate: '2026-08-03' });
  console.log('case4 (single key) rows:', JSON.stringify(fetchRows()));
  console.log('  EXPECT 08-01=10, 08-02=20, no 08-03, domain=100');

  // ---- Cleanup ----
  db.prepare('DELETE FROM usage_records WHERE customer_id=?').run(cid);
  db.prepare('DELETE FROM sync_logs     WHERE customer_id=?').run(cid);
  db.prepare('DELETE FROM customers     WHERE id=?').run(cid);
  console.log('cleanup done.');
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
