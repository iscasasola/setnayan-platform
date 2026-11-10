#!/usr/bin/env node
/**
 * check-bundle-size.mjs
 *
 * Fails when the shared client JavaScript that EVERY app-router page downloads
 * exceeds the locked budget: 202.3KB gzipped (CLAUDE.md decision log row
 * 2026-05-22 engineering KPIs, locked alongside LCP <1.5s mobile 4G PH, INP
 * <100ms, CLS <0.05; history of each move in the comment above
 * MAX_SHARED_GZIP_BYTES below).
 *
 * Why this exists: bundle size has zero observability until users complain
 * about cold-start latency. One bad PR (a chunky chart lib, a moment.js
 * drop-in, an unintentional `'use client'` boundary on a heavy module) silently
 * regresses LCP for every page. This guard catches the regression at PR-merge
 * time, before it compounds.
 *
 * ── OWNER RULING 2026-11-10, answered "A" ─────────────────────────────────────
 * DECISION_LOG "THE BUNDLE BUDGET MEASURES WHAT A PAGE ACTUALLY DOWNLOADS".
 * Until this ruling the check also counted `framework-*` (58.5KB) and `main-*`
 * (39.7KB) — the PAGES ROUTER's chunks, taken from build-manifest.json's
 * `/_app` + `/_error` lists. No page of this app downloads them: measured on
 * the live site with performance.getEntriesByType('resource'), the home page
 * and /maria-and-jose load `webpack-*` and `main-app-*` of those files and
 * never `framework-*` or `main-*`. Counting ~98KB nobody downloads left main at
 * 202.3/202.3KB, so every PR failed at random.
 *
 * 🔑 THE KPI NUMBER IS UNCHANGED — still 202.3KB gzipped. What changed is what
 * is counted, so the number now measures something a phone actually pays for.
 *
 * WHAT IS COUNTED (each chunk once, gzipped from the file on disk):
 *   1. The chunks EVERY app-router entry lists — the intersection over every
 *      route in `.next/app-build-manifest.json` `pages` (Next 15.5's
 *      AppBuildManifestPlugin writes each entry as main-app's files + the
 *      entry's own files, so this is at least main-app's set).
 *   2. `rootMainFiles` from `.next/build-manifest.json` — the files Next's
 *      app-render bootstraps on every app-router page (`getRequiredScripts`):
 *      the webpack runtime, the app-router core chunks and `main-app-*`.
 *   3. THE GUARD (part of the ruling): any PAGES-ROUTER chunk — anything in a
 *      build-manifest.json `pages` list (`/_app`, `/_error`: framework, main,
 *      pages/_app, pages/_error), or named `framework-*`, `main-*` (not
 *      main-app), `pages/_app*`, `pages/_error*` — that appears in ANY app
 *      route's load list is counted, even if only one route lists it. The day
 *      an app route really downloads `framework-*`, it is paid for here.
 *
 * WHAT IS EXCLUDED is printed on every run, chunk by chunk with the reason, so
 * nothing is hidden: pages-router chunks no app route lists, the pages
 * router's own client manifests (`lowPriorityFiles`), and the `nomodule`
 * polyfills only legacy browsers fetch. Per-route chunks are NOT counted — a
 * page can carry a heavier bundle of its own as long as the shared surface
 * stays inside the budget; the Maker's own first load has its own ceiling in
 * `check-maker-js-budget.mjs` (CI runs both in the `bundle size check` job).
 *
 * Usage (after `next build`):
 *   pnpm bundle-size-check    # from apps/web
 *   node scripts/check-bundle-size.mjs
 * Tests: lib/the-bundle-check-counts-what-pages-load.test.ts (fixture manifests,
 * no build).
 *
 * Tuning: edit MAX_SHARED_GZIP_BYTES below. If raising the ceiling, leave a
 * one-line comment explaining why + which decision-log row authorized it.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const NEXT_DIR = join(WEB_ROOT, '.next');

// ⚠ Every measurement quoted in the history below (2026-08-15 → 2026-11-08) was
// taken under the OLD counting, which included framework-* and main-*. The
// ceiling itself is unchanged by the 2026-11-10 ruling; only the counting is.
//
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
//
// 202KB — raised by 1KB on 2026-09-10 for the Next.js 15.5.21 → 15.5.24
// security release (#5397). `DECISION_LOG.md` 2026-09-10 (deploy headroom).
//
// 🔑 NONE OF THE GROWTH IS OURS. That PR changes two files — the `next`
// version in package.json and the lockfile — so every byte that moved is
// framework code. MEASURED, CI bundle-size job, main (a692363) vs #5397:
//     app-router shared chunk   44.9 → 45.8KB  (+0.9)
//     pages-router main         39.4 → 39.6KB  (+0.2)
//     framework 58.6 · app core 53.2 · webpack 3.9 · main-app 0.4 — same size
//     TOTAL                    200.5 → 201.5KB  (+1.0)
// Paying for Next's bytes by trimming ours would hide the cause, and refusing
// them would hold back a critical-rated security fix over a KPI it moves by
// 0.25%. Same rule as above: the ceiling moves by the measured amount and no
// more, leaving the same 0.5KB of headroom main had before the bump.
//
// 202.3KB — raised by 0.3KB on 2026-11-08, owner-approved (verbatim: "ok", to the choice put to him by the
// release controller), PR #7403 (the picked client loads its pages on demand). No DECISION_LOG row yet.
//
// 🔑 SAME SHAPE AS 2026-08-15: NONE OF IT IS APPLICATION CODE IN THE SHARED CHUNKS. framework 58.5 · 5fe533a1
// 53.1 · 5006 45.6 · main 39.7 · main-app 0.2 are byte-identical to the base (f309382064). What grew is the
// WEBPACK RUNTIME's lazy-chunk list, 4.8 → 5.1KB gzipped: the ~26 async chunks the picked client's pages now
// load on demand (Chat/Quotation parts 18 · Hub parts 7 · picked pages 2), each ~10–12 bytes in a list every
// page downloads. MEASURED locally, dummy env: 207,083 bytes vs 206,848 — and the base had ~16 bytes of
// headroom, so ANY lazy chunk anywhere would have failed this check.
// What the 0.3KB buys, First Load JS from the build table (base → #7403):
//     /vendor-dashboard/clients/[eventId] (+ the customers intercept)   510 → 359 kB
//     /vendor-dashboard/messages/[threadId]                             396 → 262 kB
//     /vendor-dashboard/on-the-day                                      286 → 181 kB
// Same rule as above: moved by the measured amount and no more.
export const MAX_SHARED_GZIP_BYTES = Math.round(202.3 * 1024);

// ── What a chunk is ──────────────────────────────────────────────────────────

/** Pages-router chunk names, for the guard when a manifest list is not enough. */
export function looksLikePagesRouterChunk(file) {
  return (
    /(^|\/)framework-[^/]*\.js$/.test(file) ||
    /(^|\/)main-(?!app-)[^/]*\.js$/.test(file) ||
    /(^|\/)pages\/_(app|error)[-.][^/]*$/.test(file)
  );
}

function listsOf(manifestPages) {
  if (!manifestPages || typeof manifestPages !== 'object') return [];
  return Object.entries(manifestPages).filter(([, v]) => Array.isArray(v));
}

function intersection(lists) {
  let acc = null;
  for (const list of lists) {
    const s = new Set(list);
    acc = acc === null ? s : new Set([...acc].filter((c) => s.has(c)));
  }
  return acc ?? new Set();
}

/**
 * Decide which chunks are the shared app-router download. Pure: takes the two
 * parsed manifests, returns what is counted and what is excluded, each with a
 * reason. No file system, so the tests drive it with small fixtures.
 *
 * @returns {{
 *   appRoutes: number,
 *   counted: { chunk: string, reason: string }[],
 *   excluded: { chunk: string, reason: string }[],
 *   guardHits: { chunk: string, routes: string[] }[],
 * }}
 */
export function selectSharedChunks({ buildManifest, appBuildManifest }) {
  const appEntries = listsOf(appBuildManifest?.pages);
  if (appEntries.length === 0) {
    throw new Error(
      'app-build-manifest.json lists no app-router routes, so what every app page downloads cannot be measured.',
    );
  }

  // 2. What app-render bootstraps on every app page. With webpack,
  // rootMainFilesTree is {} and rootMainFiles is the list; if a tree is ever
  // present, a file every route's tree lists is equally shared.
  const tree = buildManifest?.rootMainFilesTree;
  const treeLists = tree && typeof tree === 'object' ? Object.values(tree).filter(Array.isArray) : [];
  const rootMain = new Set([
    ...(buildManifest?.rootMainFiles ?? appBuildManifest?.rootMainFiles ?? []),
    ...(treeLists.length ? intersection(treeLists) : []),
  ]);

  // Pages-router chunks: everything build-manifest's page lists name, except
  // the files app-render also bootstraps (the webpack runtime is one runtime
  // chunk shared by both routers).
  const pagesRouterChunks = new Set();
  for (const [, list] of listsOf(buildManifest?.pages)) {
    for (const c of list) if (!rootMain.has(c)) pagesRouterChunks.add(c);
  }

  const counted = new Map();
  const add = (chunk, reason) => {
    if (!counted.has(chunk)) counted.set(chunk, reason);
  };

  for (const c of rootMain) add(c, 'rootMainFiles — bootstrapped on every app-router page');
  for (const c of intersection(appEntries.map(([, l]) => l))) {
    add(c, 'listed by every app-router route');
  }

  // 3. THE GUARD.
  const hitRoutes = new Map();
  for (const [route, list] of appEntries) {
    for (const c of list) {
      if (rootMain.has(c)) continue;
      if (pagesRouterChunks.has(c) || looksLikePagesRouterChunk(c)) {
        if (!hitRoutes.has(c)) hitRoutes.set(c, []);
        hitRoutes.get(c).push(route);
      }
    }
  }
  const guardHits = [...hitRoutes].map(([chunk, routes]) => ({ chunk, routes }));
  for (const { chunk, routes } of guardHits) {
    // A guard hit is counted even when the intersection already holds it; the
    // reason says so, because that is the case the ruling is about.
    counted.set(
      chunk,
      `GUARD — pages-router chunk in an app route's load list (${routes.length} route${routes.length === 1 ? '' : 's'}, e.g. ${routes[0]})`,
    );
  }

  const excluded = new Map();
  const exclude = (chunk, reason) => {
    if (!counted.has(chunk) && !excluded.has(chunk)) excluded.set(chunk, reason);
  };
  for (const c of pagesRouterChunks) {
    exclude(c, 'pages router only — no app-router route lists it');
  }
  for (const c of buildManifest?.lowPriorityFiles ?? []) {
    exclude(c, "pages router's client manifest — app-router pages do not load it");
  }
  for (const c of buildManifest?.polyfillFiles ?? []) {
    exclude(c, 'nomodule polyfills — only legacy browsers fetch them');
  }

  const toList = (m) => [...m].map(([chunk, reason]) => ({ chunk, reason }));
  return { appRoutes: appEntries.length, counted: toList(counted), excluded: toList(excluded), guardHits };
}

/** Manifest entries are relative to .next/; a `/_next/` URL form is accepted too. */
export function chunkPath(nextDir, rel) {
  const clean = rel.startsWith('/_next/') ? rel.slice('/_next/'.length) : rel;
  return join(nextDir, clean);
}

// ── The run ──────────────────────────────────────────────────────────────────

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

function loadManifest(name) {
  const path = join(NEXT_DIR, name);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`Could not parse ${name}: ${err.message}`);
  }
}

function gzipOf(rel) {
  const p = chunkPath(NEXT_DIR, rel);
  if (!existsSync(p) || !statSync(p).isFile()) return null;
  const buf = readFileSync(p);
  return { raw: buf.length, gzip: gzipSync(buf).length };
}

function main() {
  if (!existsSync(NEXT_DIR)) {
    fail('No .next/ directory found.', [
      'Run `pnpm --filter @setnayan/web build` first.',
      `Looked at: ${NEXT_DIR}`,
    ]);
  }

  const buildManifest = loadManifest('build-manifest.json');
  const appBuildManifest = loadManifest('app-build-manifest.json');
  if (!appBuildManifest) {
    fail('No app-build-manifest.json in .next/.', [
      'This check measures what app-router pages download and reads that manifest to know it.',
      'Did the build complete? If Next stopped writing it, port the check — do not let it pass on nothing.',
    ]);
  }

  let sel;
  try {
    sel = selectSharedChunks({ buildManifest, appBuildManifest });
  } catch (err) {
    fail(err.message);
  }

  let totalGzip = 0;
  const perChunk = [];
  const missing = [];
  for (const { chunk, reason } of sel.counted) {
    const size = gzipOf(chunk);
    if (!size) {
      missing.push(chunk);
      continue;
    }
    totalGzip += size.gzip;
    perChunk.push({ chunk, reason, ...size });
  }
  if (perChunk.length === 0) {
    fail('Could not identify any shared client chunks on disk.', [
      'This usually means the build did not emit a manifest — check for build errors.',
    ]);
  }
  perChunk.sort((a, b) => b.gzip - a.gzip);

  const totalKB = (totalGzip / 1024).toFixed(1);
  const maxKB = (MAX_SHARED_GZIP_BYTES / 1024).toFixed(1);
  const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

  console.log(`\nShared client bundle (chunks every app-router page downloads, ${sel.appRoutes} app routes):`);
  console.log(`  ${perChunk.length} chunks · ${totalKB}KB gzipped total`);
  console.log(`  budget: ${maxKB}KB gzipped (CLAUDE.md 2026-05-22 KPI lock · owner ruling 2026-11-10 "A")\n`);
  console.log(`Counted:`);
  for (const e of perChunk) {
    console.log(`  ${kb(e.gzip)} gz · ${(e.raw / 1024).toFixed(0)}KB raw · ${e.chunk} — ${e.reason}`);
  }
  for (const c of missing) console.log(`  ⚠ listed but not on disk, so not sized: ${c}`);

  const excludedSized = sel.excluded.map((e) => ({ ...e, size: gzipOf(e.chunk) }));
  const excludedKB = kb(excludedSized.reduce((n, e) => n + (e.size?.gzip ?? 0), 0));
  console.log(
    `\nexcluded (${excludedSized.length}, ${excludedKB} gz — not downloaded by app-router pages): ` +
      (excludedSized.length
        ? excludedSized
            .map((e) => `${e.chunk}${e.size ? ` (${kb(e.size.gzip)})` : ''} — ${e.reason}`)
            .join(' · ')
        : 'none'),
  );
  if (sel.guardHits.length) {
    console.log(
      `\n⚠ GUARD: ${sel.guardHits.length} pages-router chunk(s) found in app routes' load lists — COUNTED above: ` +
        sel.guardHits.map((h) => `${h.chunk} (${h.routes.length} routes)`).join(' · '),
    );
  }

  if (totalGzip > MAX_SHARED_GZIP_BYTES) {
    const overKB = ((totalGzip - MAX_SHARED_GZIP_BYTES) / 1024).toFixed(1);
    fail(`Shared client bundle exceeds budget by ${overKB}KB gzipped.`, [
      `Measured: ${totalKB}KB · Budget: ${maxKB}KB`,
      'Counted chunks are listed above. Common fixes:',
      '  · Dynamic-import heavy components (charts, maps, PDF viewers).',
      '  · Move imports behind `next/dynamic({ ssr: false })`.',
      '  · Check for accidentally-client modules: any `"use client"` file',
      '    transitively pulled into a shared layout will widen the budget.',
      '  · If the regression is intentional + justified, update the CLAUDE.md',
      '    decision log AND raise MAX_SHARED_GZIP_BYTES in the same PR.',
    ]);
  }

  const remainingKB = ((MAX_SHARED_GZIP_BYTES - totalGzip) / 1024).toFixed(1);
  ok(`Shared client bundle within budget (${remainingKB}KB headroom).`, [
    `Measured: ${totalKB}KB · Budget: ${maxKB}KB`,
  ]);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
