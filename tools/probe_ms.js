'use strict';
// Try millisecond timestamps + a few interval semantics.
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
            qs, status: res.statusCode, code: j.code, msg: j.msg,
            outStart: d.startTime, outEnd: d.endTime, interval: d.interval,
            fluxLen: (d.flux || []).length, totalFlux: d.totalFlux,
            sample: (d.flux || []).slice(0, 5),
          });
        } catch (e) { resolve({ qs, error: e.message, body: buf.slice(0, 300) }); }
      });
    });
    r.on('error', e => resolve({ qs, error: e.message }));
    r.setTimeout(20000, () => r.destroy(new Error('timeout')));
    r.end();
  });
}

function asMs(v) { return v && v < 1e12 ? new Date(v * 1000) : new Date(v); }

(async () => {
  const cases = [
    // ---- ms timestamps ----
    ['ms: 7 days, end=next-day 00:00',
      Date.parse('2026-06-01T00:00:00+08:00'),
      Date.parse('2026-06-08T00:00:00+08:00'), 3600],
    ['ms: 1 day, yesterday 00:00 ~ today 00:00',
      Date.parse('2026-06-07T00:00:00+08:00'),
      Date.parse('2026-06-08T00:00:00+08:00'), 3600],
    ['ms: 1 day, May-10 (in case data exists there)',
      Date.parse('2026-05-10T00:00:00+08:00'),
      Date.parse('2026-05-11T00:00:00+08:00'), 3600],

    // ---- ms with bigger interval values ----
    ['ms: 1d Jun-7, interval=300',
      Date.parse('2026-06-07T00:00:00+08:00'),
      Date.parse('2026-06-08T00:00:00+08:00'), 300],
    ['ms: 30d, interval=14400',
      Date.parse('2026-05-09T00:00:00+08:00'),
      Date.parse('2026-06-08T00:00:00+08:00'), 14400],
  ];
  for (const [label, s, e, interval] of cases) {
    const r = await req(`startTime=${s}&endTime=${e}&interval=${interval}`);
    console.log('---');
    console.log(label);
    console.log('  in:', s, '(' + new Date(s).toISOString() + ')', '~', e, '(' + new Date(e).toISOString() + ')');
    if (r.error) { console.log('  ERR', r.error, r.body || ''); continue; }
    const oStart = asMs(r.outStart), oEnd = asMs(r.outEnd);
    console.log('  out:', r.outStart, '(' + (oStart && oStart.toISOString()) + ')',
                '~',     r.outEnd,   '(' + (oEnd   && oEnd.toISOString())   + ')');
    console.log('  flux.length=', r.fluxLen, 'totalFlux=', r.totalFlux,
                'interval=', r.interval, 'sample=', r.sample);
  }
})();
