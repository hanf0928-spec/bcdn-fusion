'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'bcdn.db');

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialize all tables. Idempotent: safe to call on every boot.
 */
function init() {
  db.exec(`
    -- ===========================
    -- Customers
    -- ===========================
    CREATE TABLE IF NOT EXISTS customers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL UNIQUE,
      contact         TEXT,
      remark          TEXT,
      -- Provider: 'source1' (built-in CDN) | 'source2' (cdnetworks media-live-vod) | 'eo' (Tencent EdgeOne) | 'ycn2' (YCN2 CDN)
      provider        TEXT    NOT NULL DEFAULT 'source1',
      -- Business scenario (business dimension): 'download' | 'vod' | 'cn2'
      -- Defaults to 'download' when not otherwise specified.
      scene           TEXT    NOT NULL DEFAULT 'download',
      -- API key for the upstream provider (kept server-side only)
      api_key         TEXT,
      -- API username (for providers that use HTTP Basic auth, e.g. CDNetworks)
      api_user        TEXT,
      -- Optional override for provider base URL
      api_base_url    TEXT,
      -- Last successful sync time
      last_sync_at    TEXT,
      -- Unit price for traffic, USDT / GB
      unit_price      REAL    NOT NULL DEFAULT 0,
      -- Balance threshold; alert when balance < threshold
      alert_threshold REAL    NOT NULL DEFAULT 0,
      -- Per-customer override of TG chat id; if null, uses global TELEGRAM_CHAT_ID
      tg_chat_id      TEXT,
      status          TEXT    NOT NULL DEFAULT 'active',  -- active | disabled
      created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ===========================
    -- Recharge records (top-up)
    -- ===========================
    CREATE TABLE IF NOT EXISTS recharges (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount      REAL    NOT NULL,        -- USDT
      method      TEXT,                    -- transfer / usdt / cash / ...
      remark      TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_recharges_customer ON recharges(customer_id);

    -- ===========================
    -- Daily traffic usage
    --   - traffic_gb : traffic for this date (GB)
    --   - unit_price : snapshot price at recording time (USDT/GB)
    --   - amount     : traffic_gb * unit_price (USDT)
    -- ===========================
    CREATE TABLE IF NOT EXISTS usage_records (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL,
      usage_date   TEXT    NOT NULL,         -- YYYY-MM-DD
      traffic_gb   REAL    NOT NULL DEFAULT 0,
      unit_price   REAL    NOT NULL DEFAULT 0,
      amount       REAL    NOT NULL DEFAULT 0,
      -- Cost-model placeholders (collected separately "in the future";
      -- kept at 0 for now so the existing flow is untouched):
      --   request_count : number of HTTP requests for the day
      --   domain_count  : number of billed domains for the day
      request_count REAL NOT NULL DEFAULT 0,
      domain_count  REAL NOT NULL DEFAULT 0,
      remark       TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      UNIQUE (customer_id, usage_date)
    );
    CREATE INDEX IF NOT EXISTS idx_usage_customer_date ON usage_records(customer_id, usage_date);

    -- ===========================
    -- Alert log (avoid spamming)
    -- ===========================
    CREATE TABLE IF NOT EXISTS alert_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL,
      type         TEXT    NOT NULL,         -- low_balance
      balance      REAL    NOT NULL,
      threshold    REAL    NOT NULL,
      message      TEXT,
      sent_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_alert_logs_customer ON alert_logs(customer_id, type, sent_at);

    -- ===========================
    -- Sync log (for debugging upstream API issues)
    -- ===========================
    CREATE TABLE IF NOT EXISTS sync_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL,
      provider     TEXT    NOT NULL,
      ok           INTEGER NOT NULL,         -- 1 | 0
      days         INTEGER NOT NULL DEFAULT 0,
      traffic_gb   REAL    NOT NULL DEFAULT 0,
      message      TEXT,
      synced_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sync_logs_customer ON sync_logs(customer_id, synced_at);

    -- ===========================
    -- Cost configuration keyed by (provider, scene).
    --
    --   platform_cost_ratio   : 0~1 ratio of revenue paid to the upstream
    --                           platform (e.g. 0.30 == 30% of revenue).
    --   traffic_unit_price    : USDT / GB  (resource traffic cost)
    --   request_unit_price    : USDT / 万次 request (resource request cost)
    --   domain_unit_price     : USDT / 域名 (resource domain cost)
    --
    -- Resource cost (per aggregate) is the SUM of three parts:
    --   traffic_fee = traffic_gb   * traffic_unit_price
    --   request_fee = request_count * request_unit_price
    --   domain_fee  = domain_count  * domain_unit_price
    -- Total resource cost = traffic_fee + request_fee + domain_fee.
    -- Total cost = platform_cost (revenue * ratio) + resource_cost.
    -- ===========================
    CREATE TABLE IF NOT EXISTS scene_costs (
      provider             TEXT NOT NULL,
      scene                TEXT NOT NULL,
      platform_cost_ratio  REAL NOT NULL DEFAULT 0,
      traffic_unit_price   REAL NOT NULL DEFAULT 0,
      request_unit_price   REAL NOT NULL DEFAULT 0,
      domain_unit_price    REAL NOT NULL DEFAULT 0,
      remark               TEXT,
      updated_at           TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (provider, scene)
    );
  `);

  // -------- lightweight migrations for older DBs --------
  ensureColumn('customers', 'provider',     `TEXT NOT NULL DEFAULT 'source1'`);
  ensureColumn('customers', 'api_key',      `TEXT`);
  ensureColumn('customers', 'api_user',     `TEXT`);
  ensureColumn('customers', 'api_base_url', `TEXT`);
  ensureColumn('customers', 'last_sync_at', `TEXT`);
  // Business scenario dimension (download | vod | cn2).
  ensureColumn('customers', 'scene',        `TEXT NOT NULL DEFAULT 'download'`);

  // Customer-level three-mode pricing (revenue = traffic + request + domain):
  //   unit_price_traffic : USDT / GB       (UI edits USDT/TB)
  //   unit_price_request : USDT / request  (UI edits USDT/万次)
  //   unit_price_domain  : USDT / domain   (UI edits USDT/个)
  // Legacy `unit_price` column is kept as an alias for `unit_price_traffic`
  // for backwards-compat (existing seed / API payload keeps working).
  ensureColumn('customers', 'unit_price_traffic', `REAL NOT NULL DEFAULT 0`);
  ensureColumn('customers', 'unit_price_request', `REAL NOT NULL DEFAULT 0`);
  ensureColumn('customers', 'unit_price_domain',  `REAL NOT NULL DEFAULT 0`);
  // One-time backfill: copy legacy unit_price → unit_price_traffic when the
  // new column is still zero. Idempotent (only affects rows where the new
  // column is 0 AND the legacy one is > 0).
  db.exec(`
    UPDATE customers
    SET unit_price_traffic = unit_price
    WHERE (unit_price_traffic IS NULL OR unit_price_traffic = 0)
      AND unit_price IS NOT NULL AND unit_price > 0
  `);

  // Extend usage_records with per-row three-mode price/fee snapshots.
  //   *_unit_price_*  : snapshot of the customer's price when the row was written
  //   *_fee           : rounded fee for the axis on that day
  // The legacy `amount` column now stores traffic_fee + request_fee + domain_fee.
  ensureColumn('usage_records', 'request_count', `REAL NOT NULL DEFAULT 0`);
  ensureColumn('usage_records', 'domain_count',  `REAL NOT NULL DEFAULT 0`);
  ensureColumn('usage_records', 'unit_price_traffic', `REAL NOT NULL DEFAULT 0`);
  ensureColumn('usage_records', 'unit_price_request', `REAL NOT NULL DEFAULT 0`);
  ensureColumn('usage_records', 'unit_price_domain',  `REAL NOT NULL DEFAULT 0`);
  ensureColumn('usage_records', 'traffic_fee', `REAL NOT NULL DEFAULT 0`);
  ensureColumn('usage_records', 'request_fee', `REAL NOT NULL DEFAULT 0`);
  ensureColumn('usage_records', 'domain_fee',  `REAL NOT NULL DEFAULT 0`);
  // Backfill: for historical rows written under the old model, seed the
  // traffic snapshot from the legacy per-row unit_price.
  db.exec(`
    UPDATE usage_records
    SET unit_price_traffic = unit_price,
        traffic_fee        = amount
    WHERE (unit_price_traffic IS NULL OR unit_price_traffic = 0)
      AND unit_price IS NOT NULL AND unit_price > 0
  `);
  // EO requires a list of ZoneIds (or ["*"] for all zones under the
  // account). Stored as JSON-encoded array text. NULL/empty => default "*".
  ensureColumn('customers', 'zone_ids',     `TEXT`);
  // Traffic calibration knobs applied at sync time:
  //   adjusted = max(0, raw * (1 + traffic_adjust_pct/100) + traffic_adjust_delta_gb)
  // Both are stored as REAL with default 0 (no adjustment).
  //   - traffic_adjust_pct           : percentage offset, e.g.  5 means +5%, -3 means -3%
  //   - traffic_adjust_delta_gb      : absolute offset in GB, applied ONCE per sync,
  //                                    spread across days of `traffic_adjust_anchor_month`
  //                                    proportional to each day's raw traffic.
  //   - traffic_adjust_anchor_month  : YYYY-MM. The month whose days are used as the
  //                                    weighting basis for delta. Empty/NULL =>
  //                                    fall back to the month of the sync window's endDate.
  ensureColumn('customers', 'traffic_adjust_pct',           `REAL NOT NULL DEFAULT 0`);
  ensureColumn('customers', 'traffic_adjust_delta_gb',      `REAL NOT NULL DEFAULT 0`);
  ensureColumn('customers', 'traffic_adjust_anchor_month',  `TEXT`);

  // Make sure every (provider, scene) combo has a cost row (zeros until configured).
  const seedSceneCost = db.prepare(`
    INSERT OR IGNORE INTO scene_costs (provider, scene, platform_cost_ratio, traffic_unit_price, request_unit_price, domain_unit_price)
    VALUES (?, ?, 0, 0, 0, 0)
  `);
  for (const p of ['source1', 'source2', 'eo', 'ycn2']) {
    for (const s of ['download', 'vod', 'cn2']) seedSceneCost.run(p, s);
  }
}

function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some(c => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}

init();

module.exports = db;
