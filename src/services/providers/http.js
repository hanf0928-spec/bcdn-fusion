'use strict';

/**
 * Tiny zero-dep HTTP helper using Node's built-in http/https.
 * Returns parsed JSON. Throws on network / status / JSON errors.
 *
 * Follows 301/302/307/308 redirects up to 5 hops. Authorization
 * headers are preserved across redirects only when the host stays the
 * same (cross-host redirects drop them, as curl/fetch do).
 */

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const MAX_REDIRECTS = 5;

function getJSON(url, opts = {}) {
  return doRequest(url, opts, 0);
}

function doRequest(url, opts, hop) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;

    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BCDN-Fusion/1.0',
          ...(opts.headers || {}),
        },
      },
      (res) => {
        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (hop >= MAX_REDIRECTS) {
            res.resume();
            return reject(new Error(`Too many redirects (>${MAX_REDIRECTS})`));
          }
          const next = new URL(res.headers.location, url);
          // Drop Authorization when crossing hosts (curl/browser default)
          let nextHeaders = { ...(opts.headers || {}) };
          if (next.hostname !== u.hostname) {
            for (const k of Object.keys(nextHeaders)) {
              if (k.toLowerCase() === 'authorization') delete nextHeaders[k];
            }
          }
          res.resume();
          return doRequest(next.toString(), { ...opts, headers: nextHeaders }, hop + 1)
            .then(resolve, reject);
        }

        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          }
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Invalid JSON: ${body.slice(0, 300)}`)); }
        });
      },
    );

    req.on('error', reject);
    if (opts.timeoutMs) {
      req.setTimeout(opts.timeoutMs, () => {
        req.destroy(new Error(`Request timeout after ${opts.timeoutMs}ms`));
      });
    }
    req.end();
  });
}

module.exports = { getJSON };
