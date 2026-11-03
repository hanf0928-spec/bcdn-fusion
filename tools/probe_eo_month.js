'use strict';

/**
 * Fixed-window probe: pull EO billing for an explicit [START, END] range
 * (bypasses the "last N days" rolling window of probe_eo_tag.js).
 *
 * Usage:
 *   TC_SECRET_ID=... TC_SECRET_KEY=... TAG_KEY=客户 TAG_VALUE=604 \
 *     START=2026-10-01 END=2026-10-31 \
 *     [METRICS=acc_flux,smt_flux] [SCENE=cn2] \
 *     node tools/probe_eo_month.js
 */

const path = require('path');
process.chdir(path.resolve(__dirname, '..'));

const SECRET_ID  = process.env.TC_SECRET_ID  || process.env.SECRET_ID;
const SECRET_KEY = process.env.TC_SECRET_KEY || process.env.SECRET_KEY;
const TAG_KEY    = process.env.TAG_KEY;
const TAG_VALUE  = process.env.TAG_VALUE;
const START      = process.env.START;
const END        = process.env.END;
const SCENE      = process.env.SCENE || 'download';
const METRICS    = (process.env.METRICS || 'acc_flux,smt_flux')
  .split(/[,\s]+/).filter(Boolean);

for (const [k, v] of Object.entries({ TC_SECRET_ID: SECRET_ID, TC_SECRET_KEY: SECRET_KEY, TAG_KEY, TAG_VALUE, START, END })) {
  if (!v) { console.error(`❌ Missing env var: ${k}`); process.exit(1); }
}

// Inject metrics via env BEFORE requiring eo.js so the module picks them up.
process.env.EO_METRICS = METRICS.join(',');
process.env[`EO_METRICS_${SCENE.toUpperCase()}`] = METRICS.join(',');

const eo = require('../src/services/providers/eo');

(async () => {
  console.log('==========================================');
  console.log(' EO Fixed-window Probe');
  console.log('==========================================');
  console.log(`  Tag       : ${TAG_KEY}=${TAG_VALUE}`);
  console.log(`  Window    : ${START} ~ ${END}`);
  console.log(`  Scene     : ${SCENE}`);
  console.log(`  Metrics   : ${METRICS.join(' + ')}`);
  console.log('------------------------------------------');

  const t0 = Date.now();
  const rows = await eo.fetchDailyTraffic({
    apiKey:   SECRET_KEY,
    apiUser:  SECRET_ID,
    tagKey:   TAG_KEY,
    tagValue: TAG_VALUE,
    scene:    SCENE,
    startDate: START,
    endDate:   END,
  });

  let sumGb = 0;
  for (const r of rows) {
    console.log(`   ${r.usage_date}  ${r.traffic_gb.toFixed(4)} GB`);
    sumGb += Number(r.traffic_gb || 0);
  }
  console.log('------------------------------------------');
  console.log(` days     : ${rows.length}`);
  console.log(` Σ total  : ${sumGb.toFixed(4)} GB  (${(sumGb/1000).toFixed(6)} TB)`);
  console.log(` elapsed  : ${((Date.now()-t0)/1000).toFixed(2)} s`);
  console.log('==========================================');
})().catch(e => {
  console.error('error:', e.message);
  process.exit(2);
});
