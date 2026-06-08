'use strict';

const https = require('https');

/**
 * Send a Telegram message via Bot API.
 * Uses the global TELEGRAM_BOT_TOKEN. The chat_id is per-customer or the
 * global TELEGRAM_CHAT_ID fallback.
 */
function sendTelegramMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return reject(new Error('TELEGRAM_BOT_TOKEN is not configured'));
    }
    if (!chatId) {
      return reject(new Error('chat_id is empty'));
    }

    const payload = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (!j.ok) return reject(new Error(`Telegram API error: ${body}`));
          resolve(j);
        } catch (e) {
          reject(new Error('Telegram API invalid response: ' + body));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { sendTelegramMessage };
