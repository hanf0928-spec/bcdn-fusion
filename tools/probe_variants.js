'use strict';
// Try several timestamp variants to figure out what the upstream
// actually accepts as a valid (startTime, endTime) pair.
const https = require('https');

const KEY  = 'ApiKey_4728b33b1e8140888287ac3ab6f76089';
const HOST = 'cdn-hw.com';

function req(qs) {
  return new Promise((resolve) => {
    const path = '/api/v1.0/domain/domain-statistics?' + qs;
    const r = https.request({
      hostname: HOST, port: 443, method: 'GET', path,
      headers: { Authorization: KEY, Accept: 'application/json' },
    }, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(buf);
          const d = j.data || {};
          resolve({
            qs,
            status: res.statusCode,
            code: j.code, msg: j.msg,
            inStart: parseInt(qs.match(/startTime=(\d+)/)[1], 10),
            inEnd:   parseInt(qs.match(/endTime=(\d+)/)[1], 10),
            outStart: d.startTime, outEnd: d.endTime,
            fluxLen: (d.flux || []).length, totalFlux: d.totalFlux,
          });
        } catch (e) { resolve({ qs, error: e.message, body: buf.slice(0, 200) }); }
      });
    });
    r.on('error', e => resolve({ qs, error: e.message }));
    r.setTimeout(20000, () => r.destroy(new Error('timeout')));
    r.end();
  });
}

function fmt(t) {
  if (!t) return '-';
  return new Date((t + 8 * 3600) * 1000).toISOString().slice(0, 19) + ' +08';
}

(async () => {
  const cases = [
    // [label, startISO, endISO, intervalSec]
    ['7 days, end = next-day 00:00 (current code)',
      '2026-06-01T00:00:00+08:00', '2026-06-08T00:00:00+08:00', 3600],
    ['7 days, end = same-day 23:59:59',
      '2026-06-01T00:00:00+08:00', '2026-06-07T23:59:59+08:00', 3600],
    ['1 day  (yesterday only)',
      '2026-06-07T00:00:00+08:00', '2026-06-08T00:00:00+08:00', 3600],
    ['1 day  (yesterday, 23:59:59)',
      '2026-06-07T00:00:00+08:00', '2026-06-07T23:59:59+08:00', 3600],
    ['range that brackets the upstream-default 2026-05-10',
      '2026-05-10T00:00:00+08:00', '2026-05-11T00:00:00+08:00', 3600],
    ['1 day  May-10 with interval=300',
      '2026-05-10T00:00:00+08:00', '2026-05-11T00:00:00+08:00', 300],
    ['big window: last 30 days',
      '2026-05-09T00:00:00+08:00', '2026-06-08T00:00:00+08:00', 14400],
  ];

  for (const [label, sIso, eIso, interval] of cases) {
    const s = Math.floor(Date.parse(sIso) / 1000);
    const e = Math.floor(Date.parse(eIso) / 1000);
    const r = await req(`startTime=${s}&endTime=${e}&interval=${interval}`);
    console.log('---');
    console.log(label);
    console.log('  in :', s, fmt(s), '~', e, fmt(e), 'step=', interval);
    if (r.error) { console.log('  ERR', r.error, r.body || ''); continue; }
    console.log('  out:', r.outStart, fmt(r.outStart), '~', r.outEnd, fmt(r.outEnd));
    console.log('  flux.length=', r.fluxLen, 'totalFlux=', r.totalFlux, 'code=', r.code);
  }
})();
