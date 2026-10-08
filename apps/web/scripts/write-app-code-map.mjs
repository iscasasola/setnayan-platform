#!/usr/bin/env node
// write-app-code-map.mjs — runs right after `next build` (package.json "build").
//
// ── WHY (2026-10-08) ────────────────────────────────────────────────────────
// The signed-in shell preloads the CODE of the pages an account will tap next.
// It used to learn a page's chunk files by asking the server to RENDER the page
// (`?_rsc=preload`) — a full server render, every database read in it — up to
// 14 pages on every signed-in page load. Production: eleven routes nobody had
// tapped rendered within nine seconds of one Maker open; ~1,090 database
// requests around that open, on a database that allows nine connections.
//
// The build already knows which chunk files each page loads
// (`.next/app-build-manifest.json`). This folds it into ONE static file per
// deploy — `.next/static/app-code/<build version>.json`, served at
// `/_next/static/app-code/<build version>.json` with the chunks themselves — so
// the preload asks the CDN one small question and the server none.
//
// Only the signed-in app's own pages are listed (`/dashboard/…`,
// `/vendor-dashboard…` — the same rule as `isPreloadableAppRoute`), each chunk
// once, pages pointing into the list by index.
//
// ⚠ IF THIS FILE IS MISSING at runtime (a host that does not serve files added
// to `.next/static` after the build, a local `next dev`), the preload does
// NOTHING: a section's code then downloads when it is tapped. It never falls
// back to rendering a page.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstLoadEntries } from './check-maker-js-budget.mjs';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The same value next.config.ts inlines as `NEXT_PUBLIC_BUILD_VERSION`. */
export function buildVersion(env = process.env) {
  return env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
}

/** `/dashboard/(launcher)/x` → `/dashboard/x`: a route group is not part of the address. */
export function urlRouteOf(manifestRoute) {
  const out = manifestRoute
    .split('/')
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
    .join('/');
  return out || '/';
}

const preloadable = (route) => route === '/vendor-dashboard' || route.startsWith('/vendor-dashboard/') || route.startsWith('/dashboard/');

/**
 * The map, from the build manifest's `pages`. For each signed-in page: its own
 * entry and every layout / loading / template above it (`firstLoadEntries`, the
 * Maker budget's own rule), `.js` files only, as `/_next/static/…` paths. Pure.
 */
export function appCodeMap(pages) {
  const chunks = [];
  const at = new Map();
  const routes = {};
  for (const key of Object.keys(pages).sort()) {
    if (!key.endsWith('/page')) continue;
    const manifestRoute = key.slice(0, -'/page'.length);
    const route = urlRouteOf(manifestRoute);
    if (!preloadable(route)) continue;
    const idx = new Set();
    for (const entry of firstLoadEntries(pages, manifestRoute)) {
      for (const c of pages[entry] ?? []) {
        if (typeof c !== 'string' || !c.endsWith('.js') || !c.startsWith('static/chunks/')) continue;
        const url = `/_next/${c}`;
        if (!at.has(url)) {
          at.set(url, chunks.length);
          chunks.push(url);
        }
        idx.add(at.get(url));
      }
    }
    // Two manifest routes can share one address (a group); keep every chunk either needs.
    routes[route] = [...new Set([...(routes[route] ?? []), ...idx])].sort((a, b) => a - b);
  }
  return { v: 1, chunks, routes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifestPath = join(WEB, '.next', 'app-build-manifest.json');
  if (!existsSync(manifestPath)) {
    // Never fail a build over a preload: without the file the app simply does not preload.
    console.warn(`[app-code-map] no ${manifestPath} — skipped (the app will not preload page code).`);
    process.exit(0);
  }
  const map = appCodeMap(JSON.parse(readFileSync(manifestPath, 'utf8')).pages ?? {});
  const out = join(WEB, '.next', 'static', 'app-code', `${buildVersion()}.json`);
  mkdirSync(dirname(out), { recursive: true });
  const body = JSON.stringify(map);
  writeFileSync(out, body);
  console.log(`[app-code-map] ${Object.keys(map.routes).length} pages · ${map.chunks.length} chunk files · ${(body.length / 1024).toFixed(1)} KB → ${out.replace(WEB, '.')}`);
}
