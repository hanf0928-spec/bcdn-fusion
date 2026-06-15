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
      -- Provider: 'source1' (built-in CDN) | 'source2' (cdnetworks media-live-vod)
      provider        TEXT    NOT NULL DEFAULT 'source1',
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
    -- Provider-level cost configuration
    --   - resource_cost_price : USDT / GB     (server / bandwidth / etc.)
    --   - platform_cost_price : ratio 0~1     (% of revenue paid to upstream)
    --
    --   NOTE: column name 'platform_cost_price' is kept for backwards-
    --   compat, but the value is a *ratio*, not a price (e.g. 0.30
    --   means 30% of revenue).
    -- ===========================
    CREATE TABLE IF NOT EXISTS provider_costs (
      provider             TEXT PRIMARY KEY,
      platform_cost_price  REAL NOT NULL DEFAULT 0,
      resource_cost_price  REAL NOT NULL DEFAULT 0,
      remark               TEXT,
      updated_at           TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  // -------- lightweight migrations for older DBs --------
  ensureColumn('customers', 'provider',     `TEXT NOT NULL DEFAULT 'source1'`);
  ensureColumn('customers', 'api_key',      `TEXT`);
  ensureColumn('customers', 'api_user',     `TEXT`);
  ensureColumn('customers', 'api_base_url', `TEXT`);
  ensureColumn('customers', 'last_sync_at', `TEXT`);
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

  // Make sure every known provider has a cost row (zeros until configured).
  const seedProviderCost = db.prepare(`
    INSERT OR IGNORE INTO provider_costs (provider, platform_cost_price, resource_cost_price)
    VALUES (?, 0, 0)
  `);
  for (const p of ['source1', 'source2', 'eo']) seedProviderCost.run(p);
}

function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some(c => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}

init();

module.exports = db;
