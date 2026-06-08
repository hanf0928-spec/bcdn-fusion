'use strict';
// One-off probe: call domain-statistics with explicit domainNames pulled
// from the previously-saved /tmp/domains.json. Used to verify the upstream
// returns non-empty flux when domains are explicitly listed.
const fs = require('fs');
const https = require('https');

const list = JSON.parse(fs.readFileSync('/tmp/domains.json', 'utf8')).data.map(x => x.domainName);
console.log('domains to query:', list.length, list);

const start = Math.floor(Date.parse('2026-06-01T00:00:00+08:00') / 1000);
const end   = Math.floor(Date.parse('2026-06-08T00:00:00+08:00') / 1000);
const params = [
  'startTime=' + start,
  'endTime='   + end,
  'interval=3600',
  ...list.map(d => 'domainNames=' + encodeURIComponent(d)),
].join('&');

const path = '/api/v1.0/domain/domain-statistics?' + params;
console.log('path length:', path.length);

const req = https.request({
  hostname: 'cdn-hw.com', port: 443, method: 'GET', path,
  headers: { Authorization: 'ApiKey_4728b33b1e8140888287ac3ab6f76089', Accept: 'application/json' },
}, res => {
  console.log('status:', res.statusCode);
  let buf = '';
  res.on('data', c => { buf += c; });
  res.on('end', () => {
    try {
      const j = JSON.parse(buf);
      console.log('code=', j.code, 'msg=', j.msg);
      const d = j.data || {};
      console.log('startTime=', d.startTime, 'endTime=', d.endTime, 'interval=', d.interval);
      console.log('totalFlux=', d.totalFlux, 'maxBw=', d.maxBw, 'flux.length=', (d.flux || []).length);
      console.log('flux nonzero=', (d.flux || []).filter(x => x > 0).length, '/', (d.flux || []).length);
      console.log('first 5 flux:', (d.flux || []).slice(0, 5));
      console.log('last  5 flux:', (d.flux || []).slice(-5));
    } catch (e) { console.error('parse fail', e.message, buf.slice(0, 400)); }
  });
});
req.on('error', e => console.error('req err', e.message));
req.setTimeout(30000, () => req.destroy(new Error('timeout')));
req.end();
