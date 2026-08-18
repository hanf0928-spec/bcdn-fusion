'use strict';
/**
 * Smoke test — CCDN (source2) dual api_key path.
 */
const path = require('path');
const drvPath = require.resolve('./src/services/providers/source2');
require.cache[drvPath] = {
  id: drvPath,
  filename: drvPath,
  loaded: true,
  exports: {
    name: 'source2',
    async fetchDailyTraffic({ apiKey }) {
      if (apiKey === 'CCDN_A') return [
        { usage_date: '2026-08-01', traffic_gb: 10, request_count: 100 },
        { usage_date: '2026-08-02', traffic_gb: 20, request_count: 200 },
      ];
      if (apiKey === 'CCDN_B') return [
        { usage_date: '2026-08-01', traffic_gb:  5, request_count:  50 },
        { usage_date: '2026-08-03', traffic_gb:  3, request_count:  30 },
      ];
      if (apiKey === 'BAD') throw new Error('unauthorized');
      return [];
    },
  },
};
// Also stub out YCDN to verify api_key2 is IGNORED for source1 now.
const drv1 = require.resolve('./src/services/providers/source1');
require.cache[drv1] = {
  id: drv1, filename: drv1, loaded: true,
  exports: {
    name: 'source1',
    async fetchDailyTraffic({ apiKey }) {
      return [{ usage_date: '2026-08-01', traffic_gb: apiKey === 'Y_A' ? 100 : 999, request_count: 0 }];
    },
  },
};

const db = require('./src/db');
const sync = require('./src/services/sync');

async function main() {
  // ---- Test A: CCDN dual key merges ----
  const name = 'smoke_ccdn_' + Date.now();
  const r = db.prepare(`
    INSERT INTO customers
      (name, provider, api_key, api_key2, unit_price_traffic, unit_price_request, unit_price_domain, status, scene)
    VALUES (?, 'source2', ?, ?, 1, 0.01, 0.5, 'active', 'download')
  `).run(name, 'CCDN_A', 'CCDN_B');
  const cid = r.lastInsertRowid;
  let c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  await sync.syncCustomer(c, { startDate: '2026-08-01', endDate: '2026-08-03' });
  const rows = db.prepare('SELECT usage_date, traffic_gb FROM usage_records WHERE customer_id=? ORDER BY usage_date').all(cid);
  console.log('CCDN dual-key rows:', JSON.stringify(rows));
  console.log('  EXPECT 08-01=15, 08-02=20, 08-03=3');

  // ---- Test B: YCDN with api_key2 set should IGNORE it (single-key only) ----
  const nameY = 'smoke_ycdn_' + Date.now();
  const rY = db.prepare(`
    INSERT INTO customers
      (name, provider, api_key, api_key2, unit_price_traffic, unit_price_request, unit_price_domain, status, scene)
    VALUES (?, 'source1', 'Y_A', 'Y_B', 1, 0, 0, 'active', 'download')
  `).run(nameY);
  const cidY = rY.lastInsertRowid;
  const cy = db.prepare('SELECT * FROM customers WHERE id=?').get(cidY);
  await sync.syncCustomer(cy, { startDate: '2026-08-01', endDate: '2026-08-01' });
  const rowsY = db.prepare('SELECT usage_date, traffic_gb FROM usage_records WHERE customer_id=? ORDER BY usage_date').all(cidY);
  console.log('YCDN (api_key2 ignored) rows:', JSON.stringify(rowsY));
  console.log('  EXPECT 08-01=100 (only Y_A used, Y_B ignored because source1)');

  // cleanup
  for (const id of [cid, cidY]) {
    db.prepare('DELETE FROM usage_records WHERE customer_id=?').run(id);
    db.prepare('DELETE FROM sync_logs     WHERE customer_id=?').run(id);
    db.prepare('DELETE FROM customers     WHERE id=?').run(id);
  }
  console.log('cleanup done.');
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
