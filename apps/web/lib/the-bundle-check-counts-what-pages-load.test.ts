/**
 * The bundle size check counts what an app-router page ACTUALLY downloads.
 *
 * Owner ruling 2026-11-10, answered "A" (DECISION_LOG "THE BUNDLE BUDGET
 * MEASURES WHAT A PAGE ACTUALLY DOWNLOADS"): the 202.3KB gzipped KPI stays
 * exactly as it is; `framework-*` and `main-*` (the pages router's chunks, which
 * the live home page and /maria-and-jose never download) stop being counted —
 * UNLESS an app route lists one, which the guard must count.
 *
 * Fixtures copy the shape Next 15.5 writes (BuildManifestPlugin +
 * AppBuildManifestPlugin in node_modules/next/dist/build/webpack/plugins): every
 * app-build-manifest entry is main-app's files + the entry's own files, and
 * build-manifest's `/_app` / `/_error` lists start with the main entry's files.
 * No build runs here; CI's `bundle size check` job measures the real one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_SHARED_GZIP_BYTES,
  looksLikePagesRouterChunk,
  selectSharedChunks,
  chunkPath,
} from '../scripts/check-bundle-size.mjs';

const C = 'static/chunks/';
const WEBPACK = `${C}webpack-1a2b3c4d5.js`;
const FRAMEWORK = `${C}framework-aaaaaaaaa.js`;
const MAIN = `${C}main-bbbbbbbbb.js`;
const MAIN_APP = `${C}main-app-ccccccccc.js`;
const APP_CORE = `${C}5fe533a1-ddddddddd.js`;
const SHARED_5006 = `${C}5006-eeeeeeeee.js`;
const PAGES_APP = `${C}pages/_app-fffffffff.js`;
const PAGES_ERROR = `${C}pages/_error-ggggggggg.js`;
const ROOT_MAIN = [WEBPACK, APP_CORE, SHARED_5006, MAIN_APP];

function buildManifest() {
  return {
    polyfillFiles: [`${C}polyfills-42372ed130431b0a.js`],
    devFiles: [],
    ampDevFiles: [],
    lowPriorityFiles: ['static/BUILD_ID/_buildManifest.js', 'static/BUILD_ID/_ssgManifest.js'],
    rootMainFiles: ROOT_MAIN,
    rootMainFilesTree: {},
    pages: {
      '/_app': [WEBPACK, FRAMEWORK, MAIN, PAGES_APP],
      '/_error': [WEBPACK, FRAMEWORK, MAIN, PAGES_ERROR],
    },
    ampFirstPages: [],
  };
}

function appBuildManifest(extra: Record<string, string[]> = {}) {
  return {
    pages: {
      '/layout': [...ROOT_MAIN, `${C}app/layout-111111111.js`],
      '/page': [...ROOT_MAIN, `${C}2222-222222222.js`, `${C}app/page-333333333.js`],
      '/[slug]/page': [...ROOT_MAIN, `${C}2222-222222222.js`, `${C}app/[slug]/page-444444444.js`],
      '/_not-found/page': [...ROOT_MAIN, `${C}app/_not-found/page-555555555.js`],
      ...extra,
    },
  };
}

const chunks = (list: { chunk: string }[]) => list.map((e) => e.chunk).sort();

test('the KPI number is unchanged: 202.3KB gzipped', () => {
  assert.equal(MAX_SHARED_GZIP_BYTES, Math.round(202.3 * 1024));
});

test('counts the webpack runtime, the app-router core and main-app; not framework or main', () => {
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: appBuildManifest() });
  assert.deepEqual(chunks(r.counted), [...ROOT_MAIN].sort());
  assert.ok(!chunks(r.counted).includes(FRAMEWORK), 'framework-* is pages-router only here');
  assert.ok(!chunks(r.counted).includes(MAIN), 'main-* is pages-router only here');
  assert.equal(r.guardHits.length, 0);
  assert.equal(r.appRoutes, 4);
});

test('a chunk only some routes list is per-route, not shared', () => {
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: appBuildManifest() });
  assert.ok(!chunks(r.counted).includes(`${C}2222-222222222.js`));
});

test('a chunk every app route lists is counted even if rootMainFiles does not name it', () => {
  const shared = `${C}9999-999999999.js`;
  const m = appBuildManifest();
  for (const list of Object.values(m.pages)) list.push(shared);
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: m });
  const e = r.counted.find((x) => x.chunk === shared);
  assert.ok(e, 'the intersection must be counted');
  assert.match(e.reason, /every app-router route/);
});

test('every excluded chunk is printed with a reason — framework, main, _app, _error, manifests, polyfills', () => {
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: appBuildManifest() });
  const byChunk = new Map(r.excluded.map((e) => [e.chunk, e.reason]));
  for (const c of [FRAMEWORK, MAIN, PAGES_APP, PAGES_ERROR]) {
    assert.match(byChunk.get(c) ?? '', /pages router only/, `${c} must be listed as excluded`);
  }
  assert.match(byChunk.get('static/BUILD_ID/_buildManifest.js') ?? '', /client manifest/);
  assert.match(byChunk.get(`${C}polyfills-42372ed130431b0a.js`) ?? '', /legacy browsers/);
  // The shared webpack runtime is in /_app's list too, and must NOT be excluded.
  assert.ok(!byChunk.has(WEBPACK));
  // Nothing is both counted and excluded.
  const counted = new Set(chunks(r.counted));
  for (const e of r.excluded) assert.ok(!counted.has(e.chunk), `${e.chunk} is both counted and excluded`);
});

test('GUARD: framework-* in ONE app route\'s load list is counted', () => {
  const m = appBuildManifest({ '/legacy/page': [...ROOT_MAIN, FRAMEWORK, `${C}app/legacy/page-666666666.js`] });
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: m });
  const e = r.counted.find((x) => x.chunk === FRAMEWORK);
  assert.ok(e, 'a pages-router chunk an app route loads must be counted');
  assert.match(e.reason, /GUARD/);
  assert.deepEqual(r.guardHits, [{ chunk: FRAMEWORK, routes: ['/legacy/page'] }]);
  assert.ok(!r.excluded.some((x) => x.chunk === FRAMEWORK));
});

test('GUARD: main-* and pages/_app in every app route are counted and flagged', () => {
  const m = appBuildManifest();
  for (const list of Object.values(m.pages)) list.push(MAIN, PAGES_APP);
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: m });
  assert.ok(chunks(r.counted).includes(MAIN));
  assert.ok(chunks(r.counted).includes(PAGES_APP));
  assert.deepEqual(r.guardHits.map((h) => h.chunk).sort(), [MAIN, PAGES_APP].sort());
  for (const h of r.guardHits) assert.equal(h.routes.length, 4);
});

test('GUARD: a framework-named chunk is caught by name even if build-manifest does not list it', () => {
  const stray = `${C}framework-zzzzzzzzz.js`;
  const m = appBuildManifest({ '/x/page': [...ROOT_MAIN, stray] });
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: m });
  assert.ok(chunks(r.counted).includes(stray));
});

test('the pages-router name test: framework, main, _app, _error — never main-app or app chunks', () => {
  assert.equal(looksLikePagesRouterChunk(FRAMEWORK), true);
  assert.equal(looksLikePagesRouterChunk(MAIN), true);
  assert.equal(looksLikePagesRouterChunk(PAGES_APP), true);
  assert.equal(looksLikePagesRouterChunk(PAGES_ERROR), true);
  assert.equal(looksLikePagesRouterChunk(MAIN_APP), false);
  assert.equal(looksLikePagesRouterChunk(WEBPACK), false);
  assert.equal(looksLikePagesRouterChunk(`${C}app/main/page-123456789.js`), false);
  assert.equal(looksLikePagesRouterChunk(`${C}app/(shell)/layout-123456789.js`), false);
});

test('rootMainFiles still counts when the app manifest entries forget a file', () => {
  const m = appBuildManifest();
  for (const list of Object.values(m.pages)) list.splice(list.indexOf(MAIN_APP), 1);
  const r = selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: m });
  assert.ok(chunks(r.counted).includes(MAIN_APP));
});

test('no app routes is a loud failure, never a pass on nothing', () => {
  assert.throws(
    () => selectSharedChunks({ buildManifest: buildManifest(), appBuildManifest: { pages: {} } }),
    /no app-router routes/,
  );
});

test('chunk paths resolve under .next/, with or without the /_next/ URL prefix', () => {
  assert.equal(chunkPath('/n', WEBPACK), join('/n', WEBPACK));
  assert.equal(chunkPath('/n', `/_next/${WEBPACK}`), join('/n', WEBPACK));
});

test('the script keeps the output lines CI is read by', () => {
  const src = readFileSync(join(process.cwd(), 'scripts/check-bundle-size.mjs'), 'utf8');
  assert.match(src, /`Measured: \$\{totalKB\}KB · Budget: \$\{maxKB\}KB`/);
  assert.match(src, /`\\nexcluded \(/);
  assert.match(src, /owner ruling 2026-11-10/i);
});
