'use strict';

/**
 * Seed two demo customers — one per provider — using the API keys the
 * user provided. Idempotent: re-running won't duplicate customers.
 *
 *   Run once:  npm run seed
 */

try { require('dotenv').config(); } catch (_) {}

const db = require('../db');

const customers = [
  {
    name: 'Source 1 — BCDN',
    contact: 'source1@example.com',
    provider: 'source1',
    api_key: 'ApiKey_4728b33b1e8140888287ac3ab6f76089',
    api_user: null,
    api_base_url: 'http://cdn-hw.com',
    unit_price: 0.20,
    alert_threshold: 200,
    remark: 'Built-in CDN. http://cdn-hw.com/api/v1.0/domain/domain-statistics',
  },
  {
    name: 'Source 2 — CDNetworks',
    contact: 'bxwkse56428@chacuo.net',
    provider: 'source2',
    api_key: '31515MMGRWdGXZmVI5vb9vLBgsXayK',
    api_user: 'bxwkse56428@chacuo.net',
    api_base_url: null,
    unit_price: 0.25,
    alert_threshold: 200,
    remark: 'CDNetworks /api/report/traffic (HMAC-SHA1 signed Basic auth)',
  },
];

const insertCustomer = db.prepare(`
  INSERT INTO customers
    (name, contact, provider, api_key, api_user, api_base_url,
     unit_price, alert_threshold, remark)
  VALUES (?,?,?,?,?,?,?,?,?)
`);
const updateCustomer = db.prepare(`
  UPDATE customers SET
    contact = ?, provider = ?, api_key = ?, api_user = ?, api_base_url = ?,
    unit_price = ?, alert_threshold = ?, remark = ?,
    updated_at = datetime('now','localtime')
  WHERE id = ?
`);

db.exec('BEGIN');
try {
  for (const c of customers) {
    const exist = db.prepare(`SELECT id FROM customers WHERE name = ?`).get(c.name);
    if (exist) {
      updateCustomer.run(
        c.contact, c.provider, c.api_key, c.api_user, c.api_base_url,
        c.unit_price, c.alert_threshold, c.remark,
        exist.id,
      );
      console.log(`  · updated  ${c.name} (id=${exist.id})`);
    } else {
      const r = insertCustomer.run(
        c.name, c.contact, c.provider, c.api_key, c.api_user, c.api_base_url,
        c.unit_price, c.alert_threshold, c.remark,
      );
      console.log(`  + created  ${c.name} (id=${r.lastInsertRowid})`);
    }
  }
  db.exec('COMMIT');
  console.log('\n✅ seed done. You can now run `npm start` and click "Sync all".');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('seed failed:', e);
  process.exit(1);
}
