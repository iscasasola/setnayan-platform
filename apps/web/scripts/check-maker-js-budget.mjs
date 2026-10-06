#!/usr/bin/env node
/**
 * check-maker-js-budget.mjs — ⚡ THE EVENT HUB MAKER'S FIRST-LOAD JAVASCRIPT
 * HAS A CEILING.
 *
 * Owner, 2026-09-29: *"we also want to make sure 100% that there is no slow
 * response on the maker"* (DECISION_LOG "THE MAKER MUST NEVER FEEL SLOW": "a
 * Maker JS budget"). The Maker opens on a phone; every kilobyte it downloads,
 * parses and runs before the first tap is paid at the phone's speed, so a quiet
 * import that doubles it would make the first open slow without breaking a test.
 *
 * WHAT IT MEASURES: the JavaScript a cold open of the Maker route
 * (`/dashboard/[eventId]/launch`) loads before it can run — the route's page
 * chunks, every layout and loading file above it, and the app router's root
 * files (`rootMainFiles`), each chunk counted ONCE, gzipped as the browser
 * receives it — read from the build's own manifests, not a number anybody typed.
 * ⚠ It is LARGER than the "First Load JS" column `next build` prints for the
 * route: Next counts the page entry alone, while a cold open also downloads the
 * layouts' own chunks above it (the dashboard layout, the event layout). Those
 * are paid on the phone too, so they count here.
 *
 * NOT MEASURED (so a green is not over-read): chunks the Maker loads LATER on
 * purpose (`next/dynamic`, a sheet opened on tap), the canvas iframe (the guest
 * page, its own route), and images/fonts.
 *
 * Usage (after `next build`):   node scripts/check-maker-js-budget.mjs
 * Tuning: MAX_MAKER_FIRST_LOAD_GZIP below. Raise it only with the measured
 * reason in a comment and a DECISION_LOG row, as `check-bundle-size.mjs` does.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = join(WEB_ROOT, '.next');
export const MAKER_ROUTE = '/dashboard/[eventId]/launch';

// MEASURED 2026-09-29 on origin/main bd0ba53b8 (next build, this script):
// 481.5KB gzipped across 50 chunks (`next build` prints 313 kB for the page
// entry alone). The ceiling is that plus ~5% headroom, so an ordinary feature
// passes and a heavy import (a chart library, a second copy of a studio) fails
// at the PR that adds it.
export const MAKER_FIRST_LOAD_MEASURED_KB = 481.5;
// RAISED 2026-10-07 505 → 507 KB (owner, verbatim: "raise to 507"; DECISION_LOG
// "MAKER FIRST-LOAD BUDGET RAISED TO 507 KB"). Measured: main after the Stages |
// Studio frame (#6386) = 505.0 KB; the Studio editors PR (#6388) = 505.2 KB, its
// whole cost one lazy stand-in (+56 B) and webpack runtime (+57 B). Every
// remaining Stages | Studio PR adds such a lazy door, so ~2 KB, once.
export const MAX_MAKER_FIRST_LOAD_GZIP = 507 * 1024;

/** The manifest entries a cold open of `route` loads: its page and every layout/loading above it. */
export function firstLoadEntries(pages, route) {
  const segs = route.split('/').filter(Boolean);
  const ancestors = [''];
  for (let i = 0; i < segs.length; i++) ancestors.push('/' + segs.slice(0, i + 1).join('/'));
  const wanted = new Set();
  for (const a of ancestors) for (const kind of ['layout', 'loading', 'template']) wanted.add(`${a}/${kind}`);
  wanted.add(`${route}/page`);
  return Object.keys(pages).filter((k) => wanted.has(k));
}

export function measure(nextDir = NEXT_DIR, route = MAKER_ROUTE) {
  const manifestPath = join(nextDir, 'app-build-manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`No ${manifestPath} — run next build first.`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const pages = manifest.pages ?? {};
  const entries = firstLoadEntries(pages, route);
  if (!entries.includes(`${route}/page`)) throw new Error(`The build has no ${route}/page entry — did the Maker route move?`);
  // The app router's root files (webpack runtime, main-app) live in build-manifest.json.
  const buildManifestPath = join(nextDir, 'build-manifest.json');
  const rootMain = existsSync(buildManifestPath) ? (JSON.parse(readFileSync(buildManifestPath, 'utf8')).rootMainFiles ?? []) : [];
  const chunks = new Set([...(manifest.rootMainFiles ?? []), ...rootMain]);
  for (const e of entries) for (const c of pages[e] ?? []) if (c.endsWith('.js')) chunks.add(c);
  let gzip = 0;
  const per = [];
  for (const c of chunks) {
    const p = join(nextDir, c.replace(/^\/?_next\//, ''));
    if (!existsSync(p) || !statSync(p).isFile()) continue;
    const buf = readFileSync(p);
    const gz = gzipSync(buf).length;
    gzip += gz;
    per.push({ chunk: c, gz, raw: buf.length });
  }
  per.sort((a, b) => b.gz - a.gz);
  return { entries, chunks: per, gzip };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let m;
  try {
    m = measure();
  } catch (e) {
    console.error(`\n❌ ${e.message}\n`);
    process.exit(1);
  }
  const kb = (n) => (n / 1024).toFixed(1);
  console.log(`\nEvent Hub Maker (${MAKER_ROUTE}) — first-load JavaScript`);
  console.log(`  ${m.chunks.length} chunks · ${kb(m.gzip)}KB gzipped · entries: ${m.entries.join(', ')}`);
  console.log(`  budget: ${kb(MAX_MAKER_FIRST_LOAD_GZIP)}KB (measured ${MAKER_FIRST_LOAD_MEASURED_KB}KB on 2026-09-29)\n`);
  for (const c of m.chunks.slice(0, 10)) console.log(`  ${kb(c.gz)}KB gz · ${kb(c.raw)}KB raw · ${c.chunk}`);
  if (m.gzip > MAX_MAKER_FIRST_LOAD_GZIP) {
    console.error(
      `\n❌ The Maker's first-load JavaScript is over budget by ${kb(m.gzip - MAX_MAKER_FIRST_LOAD_GZIP)}KB gzipped.\n` +
        `   Load the new code when it is first used (next/dynamic, a sheet's own chunk), or — if it must be\n` +
        `   there on the first tap — raise MAX_MAKER_FIRST_LOAD_GZIP with the measured reason and a DECISION_LOG row.\n`,
    );
    process.exit(1);
  }
  console.log(`\n✅ Within budget (${kb(MAX_MAKER_FIRST_LOAD_GZIP - m.gzip)}KB headroom).\n`);
}
