'use strict';
/**
 * Smoke test — CCDN dual (apiKey, apiUser) pairing.
 */
const drv = require.resolve('./src/services/providers/source2');
const seenCalls = []; // records what driver was called with
require.cache[drv] = {
  id: drv, filename: drv, loaded: true,
  exports: {
    name: 'source2',
    async fetchDailyTraffic({ apiKey, apiUser }) {
      seenCalls.push({ apiKey, apiUser });
      if (apiKey === 'K1') return [{ usage_date: '2026-08-01', traffic_gb: 10, request_count: 0 }];
      if (apiKey === 'K2') return [{ usage_date: '2026-08-01', traffic_gb:  5, request_count: 0 }];
      return [];
    },
  },
};

const db = require('./src/db');
const sync = require('./src/services/sync');

async function main() {
  // --- Test A: both keys have their own user ---
  const nameA = 'smoke_A_' + Date.now();
  const rA = db.prepare(`
    INSERT INTO customers
      (name, provider, api_key, api_key2, api_user, api_user2,
       unit_price_traffic, unit_price_request, unit_price_domain, status, scene)
    VALUES (?, 'source2', 'K1', 'K2', 'U1', 'U2', 1, 0, 0, 'active', 'download')
  `).run(nameA);
  seenCalls.length = 0;
  const cA = db.prepare('SELECT * FROM customers WHERE id=?').get(rA.lastInsertRowid);
  await sync.syncCustomer(cA, { startDate: '2026-08-01', endDate: '2026-08-01' });
  console.log('Test A driver calls:', JSON.stringify(seenCalls));
  console.log('  EXPECT [{K1,U1},{K2,U2}]');

  // --- Test B: api_user2 empty → fall back to api_user ---
  const nameB = 'smoke_B_' + Date.now();
  const rB = db.prepare(`
    INSERT INTO customers
      (name, provider, api_key, api_key2, api_user, api_user2,
       unit_price_traffic, unit_price_request, unit_price_domain, status, scene)
    VALUES (?, 'source2', 'K1', 'K2', 'U1', NULL, 1, 0, 0, 'active', 'download')
  `).run(nameB);
  seenCalls.length = 0;
  const cB = db.prepare('SELECT * FROM customers WHERE id=?').get(rB.lastInsertRowid);
  await sync.syncCustomer(cB, { startDate: '2026-08-01', endDate: '2026-08-01' });
  console.log('Test B driver calls:', JSON.stringify(seenCalls));
  console.log('  EXPECT [{K1,U1},{K2,U1}] (fallback)');

  // --- Test C: no api_key2 → single-key path unchanged ---
  const nameC = 'smoke_C_' + Date.now();
  const rC = db.prepare(`
    INSERT INTO customers
      (name, provider, api_key, api_user,
       unit_price_traffic, unit_price_request, unit_price_domain, status, scene)
    VALUES (?, 'source2', 'K1', 'U1', 1, 0, 0, 'active', 'download')
  `).run(nameC);
  seenCalls.length = 0;
  const cC = db.prepare('SELECT * FROM customers WHERE id=?').get(rC.lastInsertRowid);
  await sync.syncCustomer(cC, { startDate: '2026-08-01', endDate: '2026-08-01' });
  console.log('Test C driver calls:', JSON.stringify(seenCalls));
  console.log('  EXPECT [{K1,U1}] (single-key)');

  // cleanup
  for (const id of [rA.lastInsertRowid, rB.lastInsertRowid, rC.lastInsertRowid]) {
    db.prepare('DELETE FROM usage_records WHERE customer_id=?').run(id);
    db.prepare('DELETE FROM sync_logs     WHERE customer_id=?').run(id);
    db.prepare('DELETE FROM customers     WHERE id=?').run(id);
  }
  console.log('cleanup done.');
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
