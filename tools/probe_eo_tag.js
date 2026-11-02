'use strict';

/**
 * One-shot probe: resolve a Tencent Cloud resource tag into EO zone-ids,
 * then pull the last-N-days billing traffic for those zones.
 *
 * Usage:
 *   TC_SECRET_ID=... TC_SECRET_KEY=... TAG_KEY=客户 TAG_VALUE=604 \
 *     [DAYS=7] [SCENE=download] node tools/probe_eo_tag.js
 */

const path = require('path');
process.chdir(path.resolve(__dirname, '..'));

const { resolveZoneIdsByTag } = require('../src/services/providers/eoTag');
const eo = require('../src/services/providers/eo');

const SECRET_ID  = process.env.TC_SECRET_ID  || process.env.SECRET_ID;
const SECRET_KEY = process.env.TC_SECRET_KEY || process.env.SECRET_KEY;
const TAG_KEY    = process.env.TAG_KEY;
const TAG_VALUE  = process.env.TAG_VALUE;
const DAYS       = Math.max(1, parseInt(process.env.DAYS || '7', 10));
const SCENE      = process.env.SCENE || 'download';

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

(async () => {
  console.log('==========================================');
  console.log(' EO Tag Probe');
  console.log('==========================================');
  console.log(`  TagKey    : ${TAG_KEY}`);
  console.log(`  TagValue  : ${TAG_VALUE}`);
  console.log(`  SecretId  : ${SECRET_ID.slice(0, 6)}...${SECRET_ID.slice(-4)}`);
  console.log(`  Scene     : ${SCENE}`);
  console.log(`  Days      : last ${DAYS}`);
  console.log('------------------------------------------');

  // ---- Step 1: Tag → ZoneIds ----
  console.log('[1/2] resolving tag → zone-ids …');
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
  const t1 = Date.now();
  console.log(`   ✅ matched ${zoneIds.length} zone(s) in ${t1 - t0} ms`);
  if (zoneIds.length === 0) {
    console.log('   (no zones match this tag — stopping before billing call)');
    process.exit(0);
  }
  console.log(`   preview: ${zoneIds.slice(0, 10).join(', ')}${zoneIds.length > 10 ? ', …' : ''}`);

  // ---- Step 2: ZoneIds → BillingData (last N days) ----
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (DAYS - 1));
  const startDate = ymd(start);
  const endDate   = ymd(today);

  console.log(`[2/2] fetching daily traffic ${startDate} ~ ${endDate} …`);
  const t2 = Date.now();
  let rows;
  try {
    rows = await eo.fetchDailyTraffic({
      apiKey:  SECRET_KEY,
      apiUser: SECRET_ID,
      // pass tag directly so the driver re-resolves (end-to-end path)
      tagKey:  TAG_KEY,
      tagValue: TAG_VALUE,
      scene:   SCENE,
      startDate,
      endDate,
    });
  } catch (e) {
    console.error(`   ❌ FAILED: ${e.message}`);
    process.exit(3);
  }
  const t3 = Date.now();
  console.log(`   ✅ got ${rows.length} day row(s) in ${t3 - t2} ms`);

  const totalGb = rows.reduce((s, r) => s + Number(r.traffic_gb || 0), 0);
  const totalTb = totalGb / 1000;
  console.log('------------------------------------------');
  console.log(' Daily traffic (GB):');
  for (const r of rows) {
    console.log(`   ${r.usage_date}  ${r.traffic_gb.toFixed(4)} GB`);
  }
  console.log('------------------------------------------');
  console.log(` Σ total  : ${totalGb.toFixed(4)} GB  (${totalTb.toFixed(4)} TB)`);
  console.log(` Elapsed  : ${((t3 - t0) / 1000).toFixed(2)} s`);
  console.log('==========================================');
})().catch(e => {
  console.error('unexpected error:', e);
  process.exit(99);
});
