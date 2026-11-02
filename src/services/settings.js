'use strict';

const db = require('../db');

/**
 * Generic key/value settings backed by the `app_settings` table.
 *
 * Semantics:
 *   - A missing row OR an empty/whitespace-only value is treated as "unset"
 *     and (for TG keys) falls back to the matching process.env.* value.
 *   - Writes with a null / undefined / '' value are stored as NULL so the
 *     fallback kicks in again (easy way to "clear" a stored override).
 */

const KEYS = {
  TG_TOKEN:   'telegram_bot_token',
  TG_CHAT_ID: 'telegram_chat_id',
};

function get(key) {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key);
  if (!row) return '';
  const v = row.value;
  if (v == null) return '';
  return String(v);
}

function set(key, value) {
  const v = (value == null || String(value).trim() === '') ? null : String(value).trim();
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET
      value      = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, v);
  return v;
}

// ---------- Telegram helpers (DB first, env fallback) ----------

function getTelegramToken() {
  const fromDb = get(KEYS.TG_TOKEN);
  if (fromDb) return fromDb;
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function getTelegramChatId() {
  const fromDb = get(KEYS.TG_CHAT_ID);
  if (fromDb) return fromDb;
  return process.env.TELEGRAM_CHAT_ID || '';
}

/**
 * Which layer currently provides each TG value — purely informational,
 * surfaced in the admin UI so the operator can tell DB override vs .env
 * fallback apart.
 */
function getTelegramMeta() {
  const dbToken  = get(KEYS.TG_TOKEN);
  const dbChatId = get(KEYS.TG_CHAT_ID);
  const envToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const envChatId = process.env.TELEGRAM_CHAT_ID || '';

  const row = db.prepare(`
    SELECT key, updated_at FROM app_settings
    WHERE key IN (?, ?)
  `).all(KEYS.TG_TOKEN, KEYS.TG_CHAT_ID);
  const updatedMap = {};
  row.forEach(r => { updatedMap[r.key] = r.updated_at; });

  return {
    token: {
      value:    dbToken || envToken,
      source:   dbToken ? 'db' : (envToken ? 'env' : 'none'),
      has_db:   !!dbToken,
      has_env:  !!envToken,
      updated_at: updatedMap[KEYS.TG_TOKEN] || null,
    },
    chat_id: {
      value:    dbChatId || envChatId,
      source:   dbChatId ? 'db' : (envChatId ? 'env' : 'none'),
      has_db:   !!dbChatId,
      has_env:  !!envChatId,
      updated_at: updatedMap[KEYS.TG_CHAT_ID] || null,
    },
  };
}

function setTelegramToken(v)   { return set(KEYS.TG_TOKEN,   v); }
function setTelegramChatId(v)  { return set(KEYS.TG_CHAT_ID, v); }

module.exports = {
  KEYS,
  get,
  set,
  getTelegramToken,
  getTelegramChatId,
  getTelegramMeta,
  setTelegramToken,
  setTelegramChatId,
};
