#!/usr/bin/env node
/**
 * check-bundle-size.mjs
 *
 * Fails when the shared client bundle (chunks loaded on every page) exceeds
 * the locked target. Today: 200KB gzipped hard ceiling per CLAUDE.md decision
 * log row 2026-05-22 (engineering KPIs locked alongside LCP <1.5s mobile 4G PH,
 * INP <100ms, CLS <0.05).
 *
 * Why this exists: bundle size has zero observability until users complain
 * about cold-start latency. Pilot cohort is small enough that one bad PR
 * (a chunky chart lib, a moment.js drop-in, an unintentional `'use client'`
 * boundary on a heavy module) silently regresses LCP for the entire couple
 * surface. This guard catches the regression at PR-merge time, before it
 * compounds.
 *
 * What it measures: the union of chunks shared by every route under
 * `app/` (the framework + main-app + shared vendor split that Next emits
 * for every client navigation). Per-route chunks are NOT counted — a single
 * dashboard page can carry a heavier per-route bundle as long as the shared
 * surface stays inside the budget.
 *
 * Usage:
 *   pnpm bundle-size-check    # from apps/web (runs build first if .next missing)
 *   node scripts/check-bundle-size.mjs
 *
 * Tuning: edit MAX_SHARED_GZIP_BYTES below. If raising the ceiling, leave a
 * one-line comment explaining why + which decision-log row authorized it.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const NEXT_DIR = join(WEB_ROOT, '.next');

// 201KB gzipped — CLAUDE.md 2026-05-22 KPI lock, raised by 1KB on 2026-08-15.
// The decision log row is `DECISION_LOG.md` 2026-08-15 (one shell mount).
//
// 🔑 WHY IT MOVED, AND WHY THE MOVE IS A REDUCTION. Mounting the shared shell
// once in `app/(shell)/layout.tsx` — instead of inside twenty separate pages —
// grew the WEBPACK RUNTIME MANIFEST from 3.2KB to 3.7KB gzipped. Every other
// shared chunk is byte-identical: framework 58.6 · c680e03e 53.2 · 68240 44.9 ·
// main 39.4 · main-app 0.4, unchanged to the decimal. What grew is the chunk
// map, because the route tree changed shape — not application code.
//
// MEASURED across all 468 routes in the build table, main vs this branch:
//     13 routes SMALLER by an average of 88.5KB  (total -1,150KB)
//    128 routes LARGER  by an average of  1.0KB  (total   +133KB)
//    NET: -1,017KB of JavaScript shipped to visitors.
// The twenty converted pages each drop ~100KB because the shell stopped being
// bundled into each of their page chunks; every other route pays ~1KB for the
// larger manifest.
//
// ⚠ SO THIS GUARD IS RIGHT ABOUT ITS NUMBER AND BLIND TO THE OUTCOME. It
// measures only the globally-shared chunks, which is where the manifest lives;
// the -1,017KB lives in per-route chunks it never looks at. That is worth
// knowing before anyone treats a +0.5KB reading here as "the bundle grew".
// The ceiling is still a real ceiling — it moved by the measured amount and no
// more, so the next regression fails exactly as it should.
const MAX_SHARED_GZIP_BYTES = 201 * 1024;

function fail(message, details = []) {
  console.error(`\n❌ ${message}`);
  for (const line of details) console.error(`   ${line}`);
  console.error('');
  process.exit(1);
}

function ok(message, details = []) {
  console.log(`\n✅ ${message}`);
  for (const line of details) console.log(`   ${line}`);
  console.log('');
  process.exit(0);
}

if (!existsSync(NEXT_DIR)) {
  fail('No .next/ directory found.', [
    'Run `pnpm --filter @setnayan/web build` first, or set NEXT_BUILD_AUTO=1.',
    `Looked at: ${NEXT_DIR}`,
  ]);
}

// build-manifest.json maps every page route to the chunks it needs. Pages
// share most of these — the union of chunks listed under every route IS the
// shared client bundle (modulo per-route chunks). app-build-manifest.json
// does the same for the /app router.
function loadManifest(name) {
  const path = join(NEXT_DIR, name);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`Could not parse ${name}: ${err.message}`);
  }
}

const buildManifest = loadManifest('build-manifest.json');
const appBuildManifest = loadManifest('app-build-manifest.json');

if (!buildManifest && !appBuildManifest) {
  fail('Neither build-manifest.json nor app-build-manifest.json exists in .next/.', [
    'Did the build complete? Check for errors in the preceding step.',
  ]);
}

// Collect the chunks that EVERY route loads — that's the shared client
// surface. We compute the intersection of route → chunks across all routes
// in the app-router manifest (the canonical one for Next 13+). Fall back
// to build-manifest.json if app-router manifest is empty.
function intersectionAcrossRoutes(manifest) {
  if (!manifest || !manifest.pages) return new Set();
  const routes = Object.keys(manifest.pages);
  if (routes.length === 0) return new Set();
  let acc = null;
  for (const route of routes) {
    const chunks = new Set(manifest.pages[route] || []);
    if (acc === null) {
      acc = chunks;
    } else {
      acc = new Set([...acc].filter((c) => chunks.has(c)));
    }
  }
  return acc || new Set();
}

const appShared = appBuildManifest
  ? intersectionAcrossRoutes({
      pages: Object.fromEntries(
        Object.entries(appBuildManifest.pages || appBuildManifest).filter(
          ([, v]) => Array.isArray(v),
        ),
      ),
    })
  : new Set();
const pagesShared = buildManifest ? intersectionAcrossRoutes(buildManifest) : new Set();

// The app router manifest also exposes a `rootMainFiles` list — those are
// loaded on every app-router navigation even when the route's per-page
// list is empty. Include them.
const rootMainFiles = new Set(
  (appBuildManifest && appBuildManifest.rootMainFiles) || [],
);

const sharedChunks = new Set([...appShared, ...pagesShared, ...rootMainFiles]);

if (sharedChunks.size === 0) {
  fail('Could not identify any shared client chunks.', [
    'This usually means the build did not emit a manifest — check for build errors.',
  ]);
}

// Size each chunk by reading the file from .next/ and gzipping it. We use
// the on-disk file rather than `next/server`'s reported sizes because the
// manifest doesn't carry size data and gzip is what the browser actually
// receives.
function chunkPath(rel) {
  // build-manifest entries are relative to .next/, except for /_next/static
  // which is the public-facing URL — strip the leading slash + _next/.
  const clean = rel.startsWith('/_next/') ? rel.slice('/_next/'.length) : rel;
  return join(NEXT_DIR, clean);
}

let totalGzip = 0;
const perChunk = [];
for (const rel of sharedChunks) {
  const p = chunkPath(rel);
  if (!existsSync(p)) {
    // Manifest may list pages/_app.js style virtual entries that don't
    // physically exist; skip silently rather than failing.
    continue;
  }
  const stat = statSync(p);
  if (!stat.isFile()) continue;
  const buf = readFileSync(p);
  const gz = gzipSync(buf).length;
  totalGzip += gz;
  perChunk.push({ chunk: rel, raw: buf.length, gzip: gz });
}

// Sort biggest first so logs are useful.
perChunk.sort((a, b) => b.gzip - a.gzip);

const totalKB = (totalGzip / 1024).toFixed(1);
const maxKB = (MAX_SHARED_GZIP_BYTES / 1024).toFixed(0);

const top = perChunk
  .slice(0, 8)
  .map(
    (e) =>
      `${(e.gzip / 1024).toFixed(1)}KB gz · ${(e.raw / 1024).toFixed(0)}KB raw · ${e.chunk}`,
  );

console.log(`\nShared client bundle (chunks loaded on every page):`);
console.log(`  ${sharedChunks.size} chunks · ${totalKB}KB gzipped total`);
console.log(`  budget: ${maxKB}KB gzipped (CLAUDE.md 2026-05-22 KPI lock)\n`);
console.log(`Top contributors:`);
for (const line of top) console.log(`  ${line}`);

if (totalGzip > MAX_SHARED_GZIP_BYTES) {
  const overKB = ((totalGzip - MAX_SHARED_GZIP_BYTES) / 1024).toFixed(1);
  fail(
    `Shared client bundle exceeds budget by ${overKB}KB gzipped.`,
    [
      `Measured: ${totalKB}KB · Budget: ${maxKB}KB`,
      'Top contributors are listed above. Common fixes:',
      '  · Dynamic-import heavy components (charts, maps, PDF viewers).',
      '  · Move imports behind `next/dynamic({ ssr: false })`.',
      '  · Check for accidentally-client modules: any `"use client"` file',
      '    transitively pulled into a shared layout will widen the budget.',
      '  · If the regression is intentional + justified, update the CLAUDE.md',
      '    decision log AND raise MAX_SHARED_GZIP_BYTES in the same PR.',
    ],
  );
}

const remainingKB = ((MAX_SHARED_GZIP_BYTES - totalGzip) / 1024).toFixed(1);
ok(`Shared client bundle within budget (${remainingKB}KB headroom).`, [
  `Measured: ${totalKB}KB · Budget: ${maxKB}KB`,
]);
