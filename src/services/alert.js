'use strict';

const db = require('../db');
const stats = require('./stats');
const { sendTelegramMessage } = require('./telegram');

const COOLDOWN_MIN = parseInt(process.env.ALERT_COOLDOWN_MIN || '360', 10);

/**
 * Check all active customers; if balance < threshold, send TG alert.
 * Cooldown prevents spamming the same customer repeatedly.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.force]   - skip cooldown check
 * @param {number}  [opts.customerId] - only check one customer
 * @returns {Promise<{checked:number, alerted:number, results:Array}>}
 */
async function checkAndAlert(opts = {}) {
  const { force = false, customerId } = opts;

  let customers;
  if (customerId) {
    customers = db.prepare(`SELECT * FROM customers WHERE id = ?`).all(customerId);
  } else {
    customers = db.prepare(`SELECT * FROM customers WHERE status = 'active'`).all();
  }

  const results = [];
  let alerted = 0;

  for (const c of customers) {
    if (!c.alert_threshold || c.alert_threshold <= 0) {
      results.push({ customer: c.name, skipped: 'no threshold' });
      continue;
    }
    const s = stats.getCustomerStats(c.id);
    if (s.balance >= c.alert_threshold) {
      results.push({ customer: c.name, balance: s.balance, threshold: c.alert_threshold, ok: true });
      continue;
    }

    // Cooldown
    if (!force) {
      const last = db.prepare(`
        SELECT sent_at FROM alert_logs
        WHERE customer_id = ? AND type = 'low_balance'
        ORDER BY id DESC LIMIT 1
      `).get(c.id);
      if (last) {
        const lastTs = new Date(last.sent_at.replace(' ', 'T')).getTime();
        const diffMin = (Date.now() - lastTs) / 60000;
        if (diffMin < COOLDOWN_MIN) {
          results.push({
            customer: c.name, balance: s.balance, threshold: c.alert_threshold,
            skipped: `cooldown (${Math.round(COOLDOWN_MIN - diffMin)} min remaining)`,
          });
          continue;
        }
      }
    }

    const chatId = c.tg_chat_id || process.env.TELEGRAM_CHAT_ID;
    const msg = buildAlertMessage(c, s);

    try {
      if (chatId) {
        await sendTelegramMessage(chatId, msg);
      }
      db.prepare(`
        INSERT INTO alert_logs (customer_id, type, balance, threshold, message)
        VALUES (?, 'low_balance', ?, ?, ?)
      `).run(c.id, s.balance, c.alert_threshold, msg);
      alerted++;
      results.push({
        customer: c.name, balance: s.balance, threshold: c.alert_threshold,
        sent: !!chatId,
      });
    } catch (e) {
      results.push({
        customer: c.name, balance: s.balance, threshold: c.alert_threshold,
        error: e.message,
      });
    }
  }

  return { checked: customers.length, alerted, results };
}

function buildAlertMessage(customer, s) {
  return [
    `🚨 <b>BCDN 余额不足告警</b>`,
    ``,
    `<b>客户</b>：${escapeHtml(customer.name)}`,
    `<b>当前余额</b>：$ ${s.balance.toFixed(2)} USDT`,
    `<b>告警阈值</b>：$ ${Number(customer.alert_threshold).toFixed(2)} USDT`,
    `<b>累计充值</b>：$ ${s.totalRecharge.toFixed(2)} USDT`,
    `<b>累计消费</b>：$ ${s.totalUsage.toFixed(2)} USDT`,
    `<b>累计流量</b>：${(Number(s.totalTraffic || 0) / 1000).toFixed(4)} TB`,
    ``,
    `请尽快充值，以免影响正常使用。`,
  ].join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { checkAndAlert };
