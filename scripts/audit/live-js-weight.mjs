#!/usr/bin/env node
/**
 * LIVE CLIENT JS WEIGHT OF THE SIGNED-OUT PUBLIC PAGES (speed audit, 24 Nov 2026).
 *
 * Read-only GETs. For each page: fetch its HTML once (no cookies), list every `/_next/static/…js` it
 * loads with a <script src> tag, and download each file ONCE with `Accept-Encoding: gzip` to read its
 * size on the wire. A file shared by every page measured is counted under "shared" (what every page
 * pays); the rest is the page's own.
 *
 *   node scripts/audit/live-js-weight.mjs > js.tsv
 *
 * It is the live stand-in for the build's route table: CI's main-branch builds were cancelled in the
 * queue on 24 Nov, so the per-route "First Load JS" column was not there to read. Signed-in pages are not
 * measured (no sign-in from an audit).
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE ?? 'https://www.setnayan.com';
const UA = 'Mozilla/5.0 (speed-audit; read-only)';
const paths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/features', '/for-suppliers', '/pricing', '/open-shop', '/about', '/tour', '/tour/gallery', '/tour/budget', '/help', '/articles', '/login', '/signup', '/papic', '/start', '/waitlist', '/privacy', '/marketplace', '/setnayan-ai', '/alaala'];

const get = (url, extra = []) => execFileSync('curl', ['-s', '--max-time', '30', '-A', UA, ...extra, url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sizeOf = new Map();
function gzBytes(src) {
  if (sizeOf.has(src)) return sizeOf.get(src);
  const out = execFileSync('curl', ['-s', '-o', '/dev/null', '--max-time', '30', '-A', UA, '-H', 'Accept-Encoding: gzip', '-w', '%{size_download}', `${BASE}${src}`], { encoding: 'utf8' });
  const n = Number(out);
  sizeOf.set(src, n);
  return n;
}

const pages = [];
for (const p of paths) {
  const html = get(`${BASE}${p}`, ['-H', 'Accept: text/html']);
  const srcs = [...new Set([...html.matchAll(/<script[^>]+src="(\/_next\/static\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map((m) => m[1]))];
  pages.push({ p, srcs });
}
const shared = pages.length ? pages.map((x) => new Set(x.srcs)).reduce((a, b) => new Set([...a].filter((s) => b.has(s)))) : new Set();
const sharedKb = [...shared].reduce((a, s) => a + gzBytes(s), 0) / 1024;
console.log(['path', 'scripts', 'total_js_gz_kb', 'shared_gz_kb', 'own_gz_kb'].join('\t'));
for (const { p, srcs } of pages) {
  const total = srcs.reduce((a, s) => a + gzBytes(s), 0) / 1024;
  console.log([p, srcs.length, total.toFixed(1), sharedKb.toFixed(1), (total - sharedKb).toFixed(1)].join('\t'));
}
