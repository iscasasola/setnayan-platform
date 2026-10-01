#!/usr/bin/env node
// Build-time `appType` stamp on .next/routes-manifest.json — runs right after
// `next build` (package.json "build").
//
// ── WHY (2026-10-02) ────────────────────────────────────────────────────────
// Production was refused: `too_many_routes — Max is 2048, received 2057`.
// Vercel's Next.js builder (@vercel/next) decides whether the app has a Pages
// Router from `routesManifest.appType`; when the field is MISSING it assumes
// YES. Next 15.5 never writes the field (Next 16 does — `'app'` when there is
// an app/ dir and no pages/ dir), so the builder treats this App-Router-only app
// as a hybrid and, because we have middleware, emits the whole `/_next/data`
// resolving machinery: one extra `/_next/data/<buildId>/….json` route for EVERY
// dynamic page, plus a handful of normalize/denormalize routes. ~265 routes of
// the 2,048 budget, for a URL family the App Router never requests.
//
// This writes exactly what Next 16 would write, using Next 16's own rule:
//   pages/ AND app/ → 'hybrid' · pages/ only → 'pages' · app/ only → 'app'
// so the moment a real pages/ directory appears, the builder gets 'hybrid' and
// the `/_next/data` routes come back on their own. A manifest that already
// carries `appType` (Next ≥ 16) is left untouched.
//
// Nothing user-visible changes: no page, redirect, header or rewrite moves.
// scripts/check-vercel-route-count.mjs counts the result on every PR.

import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(WEB, '.next', 'routes-manifest.json');

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
// Next's findPagesDir: `pages/` or `src/pages/`, `app/` or `src/app/`.
const pagesDir = isDir(join(WEB, 'pages')) || isDir(join(WEB, 'src', 'pages'));
const appDir = isDir(join(WEB, 'app')) || isDir(join(WEB, 'src', 'app'));

export function appTypeFor({ pagesDir, appDir }) {
  if (pagesDir && appDir) return 'hybrid';
  if (pagesDir) return 'pages';
  if (appDir) return 'app';
  return null;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (!existsSync(MANIFEST)) {
    console.error(`❌ stamp-app-type: ${MANIFEST} not found — run after \`next build\`.`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (manifest.appType) {
    console.log(`stamp-app-type: routes-manifest already says appType=${manifest.appType} — left as is.`);
    process.exit(0);
  }
  const appType = appTypeFor({ pagesDir, appDir });
  if (!appType) {
    console.log('stamp-app-type: neither app/ nor pages/ found — nothing stamped.');
    process.exit(0);
  }
  manifest.appType = appType;
  writeFileSync(MANIFEST, JSON.stringify(manifest));
  console.log(`stamp-app-type: routes-manifest appType=${appType}.`);
}
