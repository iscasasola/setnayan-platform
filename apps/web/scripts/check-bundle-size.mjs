#!/usr/bin/env node
/**
 * check-bundle-size.mjs — THE JAVASCRIPT EVERY APP PAGE DOWNLOADS ON FIRST LOAD
 * HAS A CEILING.
 *
 * KPI: CLAUDE.md / DECISION_LOG 2026-05-22 engineering KPIs ("client bundle
 * ≤200KB gzipped, hard fail"), alongside LCP <1.5s mobile 4G PH, INP <100ms,
 * CLS <0.05. REDEFINED 2026-10-22 — owner, verbatim, "Yes to all"
 * (DECISION_LOG 2026-10-22 "THE BUNDLE CHECK COUNTS WHAT A PAGE LOADS").
 *
 * ── WHAT IT MEASURES NOW ───────────────────────────────────────────────────
 * The chunks a REAL BUILT APP PAGE'S HTML makes the browser download: every
 * `static/chunks/….js` the page names — its `<script src>` tags and the client
 * chunks its RSC payload asks for while hydrating — read from the prerendered
 * app-router HTML that `next build` writes to `.next/server/app/**.html`.
 * The SHARED first load is the set EVERY such page downloads (the intersection):
 * the app router's runtime + React DOM + the ROOT LAYOUT's own client code.
 * Each chunk counted once, gzipped as the browser receives it. `polyfills-*`
 * is `noModule` (only a browser too old to run modules fetches it) — not counted.
 *
 * ── WHAT IT MEASURED UNTIL 2026-10-22, AND WHY THAT WAS WRONG ───────────────
 * The intersection of `build-manifest.json`'s routes plus `rootMainFiles`. Two
 * of the six chunks that counted — `framework` and `main` (≈98KB of the 202KB)
 * — are loaded only by the LEGACY pages-router `_app` / `_error`; no app page
 * ever fetches them. And it never saw the root layout's own JavaScript
 * (≈107KB gz of OUR code — `one-copy-layout` 77.0 · `app/layout` 12.5 · two
 * small split chunks), which IS on every page. So it guarded Next's bytes and
 * was blind to ours. Evidence: shots-2026-10-22/shared-headroom/work/.
 *
 * NOT MEASURED (so a green is not over-read): a route's OWN chunks beyond the
 * shared set (the Maker has its own ceiling: check-maker-js-budget.mjs, 507KB),
 * chunks loaded later on purpose (`import()`, `next/dynamic` without SSR), CSS,
 * images, fonts. A dynamic (non-prerendered) route has no HTML at build time —
 * but it renders under the same root layout, so it downloads the same shared set.
 *
 * Usage (after `next build`):   pnpm bundle-size-check   (= node scripts/check-bundle-size.mjs)
 *   node scripts/check-bundle-size.mjs <path/to/.next>   measures another build (e.g. main's, to compare)
 * Tuning: MAX_SHARED_FIRST_LOAD_GZIP below. Move it only with the measured
 * reason in a comment and a DECISION_LOG row.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = join(WEB_ROOT, '.next');

// CEILING_PLACEHOLDER
export const MAX_SHARED_FIRST_LOAD_GZIP = 0;

/** A page must name at least this many app HTML files, or the scan is blind (a build that prerendered nothing). */
export const MIN_APP_PAGES = 5;

/** `static/chunks/….js` paths named in one page's HTML (script tags + RSC payload), `polyfills-*` excluded. */
export function chunksInHtml(html) {
  const out = new Set();
  for (const m of html.matchAll(/static\/chunks\/[^"'\s\\<>()]+?\.js/g)) {
    let p = m[0];
    try {
      p = decodeURIComponent(p);
    } catch {
      /* a literal % stays as written */
    }
    if (/(^|\/)polyfills-[^/]*\.js$/.test(p)) continue;
    out.add(p);
  }
  return out;
}

/** Every prerendered app-router HTML file under `.next/server/app`. */
export function appHtmlFiles(nextDir = NEXT_DIR) {
  const root = join(nextDir, 'server', 'app');
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

function gz(nextDir, chunk) {
  const p = join(nextDir, chunk);
  if (!existsSync(p) || !statSync(p).isFile()) return null;
  const buf = readFileSync(p);
  return { raw: buf.length, gz: gzipSync(buf).length };
}

/**
 * Measure the shared first load: the chunks EVERY prerendered app page downloads.
 * Throws when the scan cannot be trusted (too few pages, a named chunk missing on
 * disk, or the app router's own root files not in the shared set).
 */
export function measure(nextDir = NEXT_DIR) {
  const files = appHtmlFiles(nextDir);
  if (files.length < MIN_APP_PAGES) {
    throw new Error(`Found ${files.length} prerendered app pages under ${join(nextDir, 'server', 'app')} (need ≥ ${MIN_APP_PAGES}) — run next build first.`);
  }
  const pages = files.map((f) => ({ page: relative(join(nextDir, 'server', 'app'), f), chunks: chunksInHtml(readFileSync(f, 'utf8')) }));
  const withJs = pages.filter((p) => p.chunks.size > 0);
  if (withJs.length < MIN_APP_PAGES) throw new Error(`Only ${withJs.length} app pages name any static/chunks/*.js — the HTML parse is blind.`);
  let shared = null;
  for (const p of withJs) shared = shared === null ? new Set(p.chunks) : new Set([...shared].filter((c) => p.chunks.has(c)));

  // The app router's root files (webpack runtime, main-app, React DOM, the router) are on every app page by
  // construction; if the intersection lost one, the parse — not the app — is wrong.
  const readJson = (n) => (existsSync(join(nextDir, n)) ? JSON.parse(readFileSync(join(nextDir, n), 'utf8')) : {});
  const buildManifest = readJson('build-manifest.json');
  const appManifest = readJson('app-build-manifest.json');
  const rootMain = [...new Set([...(buildManifest.rootMainFiles ?? []), ...(appManifest.rootMainFiles ?? [])])].filter((c) => c.endsWith('.js'));
  const missingRoot = rootMain.filter((c) => !shared.has(c.replace(/^\/?_next\//, '')));
  if (missingRoot.length) throw new Error(`The app router's root files are not in every page's HTML: ${missingRoot.join(', ')} — the HTML parse is wrong.`);

  // Legacy-only: chunks the pages router's _app/_error load and NO app page names. Reported, never counted.
  const named = new Set(pages.flatMap((p) => [...p.chunks]));
  const legacy = [...new Set(Object.values(buildManifest.pages ?? {}).flat())].filter((c) => c.endsWith('.js') && !named.has(c) && !/polyfills-/.test(c));

  const per = [];
  let total = 0;
  for (const c of shared) {
    const s = gz(nextDir, c);
    if (!s) throw new Error(`${c} is named by every app page but is not on disk under ${nextDir}.`);
    total += s.gz;
    per.push({ chunk: c, ...s });
  }
  per.sort((a, b) => b.gz - a.gz);
  const pageTotal = (p) => [...p.chunks].reduce((n, c) => n + (gz(nextDir, c)?.gz ?? 0), 0);
  const sized = withJs.map((p) => ({ page: p.page, gzip: pageTotal(p) })).sort((a, b) => a.gzip - b.gzip);
  return { pages: withJs.length, shared: per, gzip: total, smallest: sized[0], largest: sized[sized.length - 1], legacy: legacy.map((c) => ({ chunk: c, ...(gz(nextDir, c) ?? { raw: 0, gz: 0 }) })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kb = (n) => (n / 1024).toFixed(1);
  let m;
  try {
    m = measure(process.argv[2] ? resolve(process.argv[2]) : NEXT_DIR);
  } catch (e) {
    console.error(`\n❌ ${e.message}\n`);
    process.exit(1);
  }
  console.log(`\nShared first-load JavaScript — what EVERY app page's HTML makes the browser download`);
  console.log(`  ${m.shared.length} chunks · ${kb(m.gzip)}KB gzipped · from ${m.pages} prerendered app pages`);
  console.log(`  budget: ${kb(MAX_SHARED_FIRST_LOAD_GZIP)}KB gzipped (DECISION_LOG 2026-05-22 KPI, redefined 2026-10-22)`);
  console.log(`  lightest page: ${m.smallest.page} ${kb(m.smallest.gzip)}KB · heaviest: ${m.largest.page} ${kb(m.largest.gzip)}KB\n`);
  for (const c of m.shared) console.log(`  ${kb(c.gz)}KB gz · ${kb(c.raw)}KB raw · ${c.chunk}`);
  if (m.legacy.length) {
    console.log(`\n  not counted — loaded only by the legacy pages router (_app/_error), never by an app page:`);
    for (const c of m.legacy) console.log(`  ${kb(c.gz)}KB gz · ${c.chunk}`);
  }
  if (m.gzip > MAX_SHARED_FIRST_LOAD_GZIP) {
    console.error(
      `\n❌ Every app page's first-load JavaScript is over budget by ${kb(m.gzip - MAX_SHARED_FIRST_LOAD_GZIP)}KB gzipped.\n` +
        `   Something the ROOT LAYOUT reaches got heavier. Load it where it is used (the route that needs it,\n` +
        `   import() inside the effect, next/dynamic) — see lib/the-root-layout-stays-light.test.ts — or, if every\n` +
        `   page truly needs it on the first tap, move MAX_SHARED_FIRST_LOAD_GZIP with the measured reason and a DECISION_LOG row.\n`,
    );
    process.exit(1);
  }
  console.log(`\n✅ Within budget (${kb(MAX_SHARED_FIRST_LOAD_GZIP - m.gzip)}KB headroom).\n`);
}
