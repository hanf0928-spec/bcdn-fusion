'use strict';

/**
 * One-shot probe: resolve a Tencent Cloud resource tag into EO zone-ids,
 * then pull billing traffic for those zones.
 *
 * Modes (set via MODE env):
 *   daily   - last N days daily breakdown (default)
 *   monthly - last N months monthly totals
 *   split   - last N days, but break out EACH metric separately
 *             (acc_flux vs smt_flux vs zxctg_flux vs …)
 *
 * Usage:
 *   TC_SECRET_ID=... TC_SECRET_KEY=... TAG_KEY=客户 TAG_VALUE=604 \
 *     [MODE=daily|monthly|split] [DAYS=7] [MONTHS=6] \
 *     [METRICS=acc_flux,smt_flux,zxctg_flux] [SCENE=download] \
 *     node tools/probe_eo_tag.js
 */

const path = require('path');
process.chdir(path.resolve(__dirname, '..'));

const { resolveZoneIdsByTag } = require('../src/services/providers/eoTag');
const eo = require('../src/services/providers/eo');

const SECRET_ID  = process.env.TC_SECRET_ID  || process.env.SECRET_ID;
const SECRET_KEY = process.env.TC_SECRET_KEY || process.env.SECRET_KEY;
const TAG_KEY    = process.env.TAG_KEY;
const TAG_VALUE  = process.env.TAG_VALUE;
const DAYS       = Math.max(1, parseInt(process.env.DAYS   || '7', 10));
const MONTHS     = Math.max(1, parseInt(process.env.MONTHS || '6', 10));
const SCENE      = process.env.SCENE || 'download';
const MODE       = (process.env.MODE || 'daily').toLowerCase();
const METRICS    = (process.env.METRICS || '').split(/[,\s]+/).filter(Boolean);

if (!SECRET_ID || !SECRET_KEY) {
  console.error('❌ Missing TC_SECRET_ID / TC_SECRET_KEY env vars');
  process.exit(1);
}
if (!TAG_KEY || !TAG_VALUE) {
  console.error('❌ Missing TAG_KEY / TAG_VALUE env vars');
  process.exit(1);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(d)  { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function monthStart(y, m) { return `${y}-${pad2(m)}-01`; }
function monthEnd(y, m) {
  const last = new Date(y, m, 0).getDate(); // m=1..12 → last day of month
  return `${y}-${pad2(m)}-${pad2(last)}`;
}

(async () => {
  console.log('==========================================');
  console.log(' EO Tag Probe');
  console.log('==========================================');
  console.log(`  TagKey    : ${TAG_KEY}`);
  console.log(`  TagValue  : ${TAG_VALUE}`);
  console.log(`  SecretId  : ${SECRET_ID.slice(0, 6)}...${SECRET_ID.slice(-4)}`);
  console.log(`  Scene     : ${SCENE}`);
  console.log(`  Mode      : ${MODE}`);
  console.log('------------------------------------------');

  // ---- Step 1: Tag → ZoneIds ----
  console.log('[step 1] resolving tag → zone-ids …');
  const t0 = Date.now();
  let zoneIds;
  try {
    zoneIds = await resolveZoneIdsByTag({
      apiKey:  SECRET_KEY,
      apiUser: SECRET_ID,
      tagKey:  TAG_KEY,
      tagValue: TAG_VALUE,
    });
  } catch (e) {
    console.error(`   ❌ FAILED: ${e.message}`);
    process.exit(2);
  }
  console.log(`   ✅ matched ${zoneIds.length} zone(s) in ${Date.now()-t0} ms`);
  if (!zoneIds.length) process.exit(0);
  console.log(`   zones: ${zoneIds.join(', ')}`);
  console.log('------------------------------------------');

  // common fetcher — delegates to eo.fetchDailyTraffic
  async function fetchRange(startDate, endDate, overrideMetrics) {
    // override metrics via env — monkeypatch not needed, we just set a
    // scene the driver maps via EO_METRICS fallback. Here we instead
    // bypass by calling the driver and letting it use scene; but we
    // ALSO want to force per-metric split. So we call driver per metric.
    const metrics = overrideMetrics || null;
    if (!metrics) {
      return await eo.fetchDailyTraffic({
        apiKey:  SECRET_KEY, apiUser: SECRET_ID,
        tagKey:  TAG_KEY, tagValue: TAG_VALUE,
        scene:   SCENE, startDate, endDate,
      });
    }
    // per-metric: temporarily set EO_METRICS env so the driver sums only
    // the requested single metric. We restore afterwards.
    const prev = process.env.EO_METRICS;
    const prevScene = process.env[`EO_METRICS_${SCENE.toUpperCase()}`];
    try {
      process.env.EO_METRICS = metrics.join(',');
      process.env[`EO_METRICS_${SCENE.toUpperCase()}`] = metrics.join(',');
      // we need to re-require eo.js to pick up the new env; easier: just
      // call internals directly. Instead we re-import a fresh copy.
      delete require.cache[require.resolve('../src/services/providers/eo')];
      const eo2 = require('../src/services/providers/eo');
      return await eo2.fetchDailyTraffic({
        apiKey:  SECRET_KEY, apiUser: SECRET_ID,
        tagKey:  TAG_KEY, tagValue: TAG_VALUE,
        scene:   SCENE, startDate, endDate,
      });
    } finally {
      process.env.EO_METRICS = prev;
      if (prevScene === undefined) delete process.env[`EO_METRICS_${SCENE.toUpperCase()}`];
      else process.env[`EO_METRICS_${SCENE.toUpperCase()}`] = prevScene;
    }
  }

  if (MODE === 'monthly') {
    // Last MONTHS months (including current). Chunk per-month to see
    // monthly totals that align with the UI table in the screenshot.
    console.log(`[step 2] monthly totals — last ${MONTHS} month(s)`);
    const now = new Date();
    let grand = 0;
    const metricsOverride = METRICS.length ? METRICS : null;
    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const from = monthStart(y, m);
      // for the current (latest) month only go up to today, since future
      // days obviously have no data and EO rejects >31-day windows.
      const to = (i === 0) ? ymd(now) : monthEnd(y, m);
      const rows = await fetchRange(from, to, metricsOverride);
      const sum = rows.reduce((s, r) => s + Number(r.traffic_gb || 0), 0);
      grand += sum;
      console.log(`   ${y}-${pad2(m)}  rows=${String(rows.length).padStart(2)}  ${sum.toFixed(4)} GB  (${(sum/1000).toFixed(4)} TB)`);
    }
    console.log('------------------------------------------');
    console.log(` Σ grand : ${grand.toFixed(4)} GB  (${(grand/1000).toFixed(4)} TB)`);
    const metLabel = metricsOverride ? metricsOverride.join('+') : `scene=${SCENE} (default)`;
    console.log(` metrics : ${metLabel}`);

  } else if (MODE === 'split') {
    // Per-metric split for last DAYS days. Helps answer "是不是某个 metric 漏算了".
    const DEFAULT_SPLIT_METRICS = METRICS.length ? METRICS : [
      'acc_flux', 'smt_flux', 'zxctg_flux', 'l4_flux', 'sec_flux',
    ];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (DAYS - 1));
    const startDate = ymd(start);
    const endDate   = ymd(today);
    console.log(`[step 2] per-metric split ${startDate} ~ ${endDate}`);
    for (const metric of DEFAULT_SPLIT_METRICS) {
      try {
        const rows = await fetchRange(startDate, endDate, [metric]);
        const sum = rows.reduce((s, r) => s + Number(r.traffic_gb || 0), 0);
        console.log(`   ${metric.padEnd(14)}  rows=${String(rows.length).padStart(2)}  ${sum.toFixed(4)} GB  (${(sum/1000).toFixed(4)} TB)`);
      } catch (e) {
        console.log(`   ${metric.padEnd(14)}  ❌ ${e.message}`);
      }
    }

  } else {
    // daily
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (DAYS - 1));
    const startDate = ymd(start);
    const endDate   = ymd(today);
    console.log(`[step 2] daily rows ${startDate} ~ ${endDate}`);
    const metricsOverride = METRICS.length ? METRICS : null;
    const rows = await fetchRange(startDate, endDate, metricsOverride);
    let sum = 0;
    for (const r of rows) {
      console.log(`   ${r.usage_date}  ${r.traffic_gb.toFixed(4)} GB`);
      sum += Number(r.traffic_gb || 0);
    }
    console.log('------------------------------------------');
    console.log(` Σ total  : ${sum.toFixed(4)} GB  (${(sum/1000).toFixed(4)} TB)`);
    console.log(` metrics  : ${metricsOverride ? metricsOverride.join('+') : `scene=${SCENE} default`}`);
  }
  console.log('==========================================');
})().catch(e => {
  console.error('unexpected error:', e);
  process.exit(99);
});
