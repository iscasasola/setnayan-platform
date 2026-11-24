#!/usr/bin/env node
/**
 * LIVE TTFB OF THE SIGNED-OUT PUBLIC PAGES (speed audit, 24 Nov 2026).
 *
 * Read-only: plain GETs on public pages of https://www.setnayan.com. No sign-in, no cookies, no query
 * string that writes, no POST. Each page is asked RUNS times, one after another (never in parallel, so
 * the site sees an ordinary visitor), and the median is kept.
 *
 *   node scripts/audit/live-ttfb.mjs > ttfb.tsv
 *   BASE=https://www.setnayan.com RUNS=3 node scripts/audit/live-ttfb.mjs /pricing /features
 *
 * Columns: path · HTTP status of the first answer (redirects are NOT followed, so a 307 to /login is
 * said as a 307) · median TTFB s (curl `time_starttransfer`, which includes DNS + TCP + TLS from wherever
 * this runs) · median SERVER WAIT s (`time_starttransfer − time_pretransfer`: the request sent → the first
 * byte back, i.e. the render plus one network trip) · median total s · bytes on the wire · the TTFB
 * samples · the redirect target, if any. `/manifest.json` (a static file, no render) is measured first as
 * the network floor.
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE ?? 'https://www.setnayan.com';
const RUNS = Number(process.env.RUNS ?? 3);
const DEFAULT_PATHS = [
  '/', '/about', '/acceptable-use', '/alaala', '/articles', '/budget', '/cookies', '/creators', '/download',
  '/explore/compare', '/features', '/for-coordinators', '/for-suppliers', '/forgot-password', '/guest-list', '/help',
  '/help/topics', '/live', '/login', '/marketplace', '/monogram', '/mood-board', '/open-shop', '/our-story', '/pa3d',
  '/pa3d/try', '/pakanta', '/palogo', '/panood', '/papic', '/papic/try', '/patiktok', '/pawebsite', '/pricing',
  '/pricing/plan', '/privacy', '/refunds', '/samahan', '/sample', '/sample/hub', '/schedule', '/seat-plan',
  '/setnayan-ai', '/signup', '/start', '/suppliers', '/terms', '/tl/about', '/tl/features', '/tour', '/tour/budget',
  '/tour/gallery', '/tour/seating', '/tour/vendors', '/waitlist',
];
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/manifest.json', ...DEFAULT_PATHS];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

console.log(['path', 'status', 'ttfb_median_s', 'server_wait_median_s', 'total_median_s', 'bytes', 'ttfb_samples', 'redirect'].join('\t'));
for (const p of paths) {
  const ttfb = [];
  const wait = [];
  const total = [];
  let status = '';
  let bytes = '';
  let redirect = '';
  for (let i = 0; i < RUNS; i++) {
    try {
      const out = execFileSync(
        'curl',
        ['-s', '-o', '/dev/null', '--compressed', '--max-time', '30', '-A', 'Mozilla/5.0 (speed-audit; read-only)', '-H', 'Accept: text/html',
          '-w', '%{http_code}\t%{time_starttransfer}\t%{time_total}\t%{size_download}\t%{time_pretransfer}\t%{redirect_url}', `${BASE}${p}`],
        { encoding: 'utf8' },
      );
      const [code, tt, tot, size, pre, red] = out.split('\t');
      status = code;
      ttfb.push(Number(tt));
      wait.push(Number(tt) - Number(pre));
      total.push(Number(tot));
      bytes = size;
      redirect = red ?? '';
    } catch (err) {
      status = `ERR ${String(err?.status ?? '')}`;
    }
  }
  console.log([p, status, median(ttfb).toFixed(3), median(wait).toFixed(3), median(total).toFixed(3), bytes, ttfb.map((t) => t.toFixed(3)).join(','), redirect.replace(BASE, '')].join('\t'));
}
