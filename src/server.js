'use strict';

// Load .env if present (no hard dep on dotenv at boot time; optional)
try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

const path = require('path');
const express = require('express');
const cron = require('node-cron');

require('./db'); // ensure DB initialized
const apiRouter = require('./routes/api');
const { checkAndAlert } = require('./services/alert');
const { syncAll } = require('./services/sync');

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple admin-token guard for /api (optional). When ADMIN_TOKEN is empty, no auth.
app.use('/api', (req, res, next) => {
  const required = process.env.ADMIN_TOKEN;
  if (!required) return next();
  const got = req.headers['x-admin-token'] || req.query.token;
  if (got !== required) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
});

app.use('/api', apiRouter);

// Static UI
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Health
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Schedule alert check
const cronExpr = process.env.ALERT_CRON || '0 * * * *';
if (cron.validate(cronExpr)) {
  cron.schedule(cronExpr, async () => {
    try {
      const r = await checkAndAlert();
      // eslint-disable-next-line no-console
      console.log(`[cron] alert check: ${JSON.stringify(r)}`);
    } catch (e) {
      console.error('[cron] alert check failed:', e.message);
    }
  });
  console.log(`[cron] alert scheduler enabled: "${cronExpr}"`);
} else {
  console.warn(`[cron] invalid ALERT_CRON: "${cronExpr}", scheduler disabled.`);
}

// Schedule traffic sync (pull from upstream providers)
const syncCron = process.env.SYNC_CRON || '15 * * * *'; // every hour at :15
if (cron.validate(syncCron)) {
  cron.schedule(syncCron, async () => {
    try {
      const r = await syncAll();
      console.log(`[cron] sync: ${r.total} customers, results=${r.results.filter(x => x.ok).length} ok`);
    } catch (e) {
      console.error('[cron] sync failed:', e.message);
    }
  });
  console.log(`[cron] sync scheduler enabled: "${syncCron}"`);
} else {
  console.warn(`[cron] invalid SYNC_CRON: "${syncCron}", scheduler disabled.`);
}

app.listen(PORT, () => {
  console.log(`\n  BCDN Fusion is running:`);
  console.log(`    UI : http://localhost:${PORT}/`);
  console.log(`    API: http://localhost:${PORT}/api/customers`);
  if (process.env.ADMIN_TOKEN) console.log(`    Admin token guard: ON`);
  console.log('');
});
