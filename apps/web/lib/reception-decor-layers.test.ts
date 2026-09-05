/**
 * Reception decor AI-image layers — pilot. Guards the two pure pieces:
 *
 *   1. resolveDecorLayer's fallback selection — the ONLY way to get an image
 *      back is a pilot zone + a known style_family + a catalog hit. Every
 *      other input must fall back to the flat SVG, so a couple with no
 *      style_family (today, everyone) or a zone outside the pilot pair never
 *      breaks — they see exactly what renderVenueSvg already renders.
 *   2. retintDecorLayerRGBA's delegation to the real color-recolor.ts engine
 *      — no reimplemented pixel math to drift from the admin tagger / Recolor
 *      Studio's behavior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDecorLayer,
  retintDecorLayerRGBA,
  primaryZoneTargetHex,
  PILOT_DECOR_ZONES,
  type DecorLayerAsset,
  type DecorLayerCatalog,
} from './reception-decor-layers';
import { recolorRGBA } from './color-recolor';
import { createRequire } from 'node:module';
import path from 'node:path';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * `reception-decor-layers-server.ts` opens with `import 'server-only'`, a
 * module Next.js supplies to the BUNDLER and which does not exist in
 * node_modules — a static import here dies with MODULE_NOT_FOUND before one
 * assertion runs. The import is a bundler assertion ("never ship me to a
 * client") with no runtime behaviour, so resolving it to an empty module is
 * faithful rather than a shortcut. Same shim, same reasoning as
 * `lib/booking-fee-anchor.test.ts`; the real import stays dynamic, inside the
 * tests, because a static one would hoist above this block and defeat it. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
{
  const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor })
    .Module;
  const STUB = path.join(process.cwd(), '__server_only_stub_decor__.js');
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

const ASSET = {
  assetId: 'a1',
  storagePath: 'https://media.setnayan.com/moodboard-library/venue_scene/backdrop/tropical-heritage.svg',
  colorRange: { slotId: 1, sampledHex: '#9CB29A', toleranceDe: 15 },
};

const CATALOG: DecorLayerCatalog = {
  backdrop: { 'tropical heritage': ASSET },
};

// ── resolveDecorLayer ────────────────────────────────────────────────────

test('resolves an image when zone + style_family + catalog all match', () => {
  const result = resolveDecorLayer('backdrop', 'tropical heritage', CATALOG);
  assert.deepEqual(result, { kind: 'image', asset: ASSET });
});

test('falls back to svg when style_family is null (the real, unsolved gap)', () => {
  assert.deepEqual(resolveDecorLayer('backdrop', null, CATALOG), { kind: 'svg' });
});

test('falls back to svg for a zone outside the pilot pair, even with a matching style', () => {
  const wideCatalog: DecorLayerCatalog = { tables: { 'tropical heritage': ASSET } };
  assert.deepEqual(resolveDecorLayer('tables', 'tropical heritage', wideCatalog), {
    kind: 'svg',
  });
});

test('falls back to svg when the catalog has the zone but not this style_family', () => {
  assert.deepEqual(resolveDecorLayer('backdrop', 'modern minimalist', CATALOG), {
    kind: 'svg',
  });
});

test('falls back to svg on a totally empty catalog', () => {
  assert.deepEqual(resolveDecorLayer('backdrop', 'tropical heritage', {}), { kind: 'svg' });
});

test('PILOT_DECOR_ZONES is exactly the 2-zone pilot scope, not full coverage', () => {
  assert.deepEqual([...PILOT_DECOR_ZONES].sort(), ['backdrop', 'ceiling']);
});

// ── retintDecorLayerRGBA ─────────────────────────────────────────────────

test('retintDecorLayerRGBA matches calling recolorRGBA directly (no reimplemented math)', () => {
  const src = new Uint8ClampedArray([156, 178, 154, 255, 255, 255, 255, 255]);
  const via = retintDecorLayerRGBA(src, ASSET.colorRange, '#8C6BA6');
  const direct = recolorRGBA(src, [ASSET.colorRange], {
    [ASSET.colorRange.slotId]: { mode: 'palette', hex: '#8C6BA6' },
  });
  assert.deepEqual(Array.from(via), Array.from(direct));
});

test('retintDecorLayerRGBA leaves pixels outside the tagged region untouched', () => {
  // Pure white (255,255,255) is far outside the sage-green slot's tolerance.
  const src = new Uint8ClampedArray([255, 255, 255, 255]);
  const out = retintDecorLayerRGBA(src, ASSET.colorRange, '#8C6BA6');
  assert.deepEqual(Array.from(out), [255, 255, 255, 255]);
});

// ── primaryZoneTargetHex ─────────────────────────────────────────────────

test('primaryZoneTargetHex picks the first valid palette color', () => {
  assert.equal(primaryZoneTargetHex(['#111111', '#222222']), '#111111');
});

test('primaryZoneTargetHex skips invalid entries and falls back to the same default paletteFn uses', () => {
  assert.equal(primaryZoneTargetHex(['not-a-color', '#222222']), '#222222');
  assert.equal(primaryZoneTargetHex([]), '#C9A059');
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB14b · THE PIPELINE MUST ACTUALLY PRODUCE BYTES.
 *
 * 🔑 THE FINDING THIS FILE EXISTS FOR NOW. `renderDecorLayerDataUrl` returns
 * `null` for "no asset", "unreachable", "undecodable" and "corrupt" alike, and
 * every caller treats all four as "show the flat SVG". So the pilot could — and
 * did — go from ten dead rows to ten LIVE rows and still draw nothing, with
 * every test green, because the server half fetched storage_path through
 * `safeFetchImageBytes` and MB14b's app-served `/moodboard-seed/…` path is not
 * a URL. `new URL()` throws on it; the helper catches and returns null.
 *
 * Measured before the fix, not reasoned about:
 *   safeFetchImageBytes('/moodboard-seed/venue_scene/backdrop/editorial-cream.svg')
 *     → null
 *
 * A `null` that means "nothing to show" and a `null` that means "the whole
 * feature is unwired" are indistinguishable to a caller. This asserts the
 * difference at the only place it is still visible.
 * ════════════════════════════════════════════════════════════════════════════
 */

test('MB14b: an app-served decor asset produces REAL retinted bytes, not a silent null', async () => {
  const { renderDecorLayerDataUrl } = await import('./reception-decor-layers-server');
  const asset: DecorLayerAsset = {
    assetId: 'S89A-EDITORIAL',
    storagePath: '/moodboard-seed/venue_scene/backdrop/editorial-cream.svg',
    colorRange: { slotId: 1, sampledHex: '#D98BA6', toleranceDe: 15, regionLabel: 'draped fabric' },
  };
  const catalog: DecorLayerCatalog = { backdrop: { 'editorial cream': asset } };
  const url = await renderDecorLayerDataUrl('backdrop', 'editorial cream', catalog, ['#7A1F2B']);
  assert.ok(
    url,
    'renderDecorLayerDataUrl returned null for a LIVE app-served asset that exists in ' +
      'public/. Every caller reads that as "no decor layer" and shows the flat SVG, so the ' +
      'whole pilot goes dark with nothing failing. Check that decorSourceBytes still reads a ' +
      'leading-slash path off disk instead of handing it to safeFetchImageBytes.',
  );
  assert.match(url, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  // Not merely non-null: a 1-pixel PNG would satisfy that. The retint of a
  // 520-wide vector is tens of kilobytes.
  assert.ok(url.length > 5000, `the retinted layer is only ${url.length} chars — that is not a rendered scene`);
});

test('MB14b: a traversal path is refused before it reaches the filesystem', async () => {
  const { renderDecorLayerDataUrl } = await import('./reception-decor-layers-server');
  for (const storagePath of [
    '/moodboard-seed/../../../etc/hosts.svg',
    '/moodboard-seed/venue_scene/../../../../package.json.svg',
    '/etc/passwd.svg',
    // 🪤 THE ONE THE CONTAINMENT CHECK CANNOT SEE. This resolves INSIDE
    // public/ and names a file that really exists, so `path.resolve` +
    // `startsWith` are both satisfied; only `isCompositableDecorHref`'s `..`
    // refusal stops it. Without this case, deleting that predicate left every
    // assertion here green — measured, and the reason this line is here.
    '/moodboard-seed/venue_scene/backdrop/../backdrop/editorial-cream.svg',
  ]) {
    const catalog: DecorLayerCatalog = {
      backdrop: {
        'editorial cream': {
          assetId: 'X',
          storagePath,
          colorRange: { slotId: 1, sampledHex: '#D98BA6', toleranceDe: 15 },
        },
      },
    };
    assert.equal(
      await renderDecorLayerDataUrl('backdrop', 'editorial cream', catalog, ['#7A1F2B']),
      null,
      `${storagePath} was not refused. storage_path is a database column; a row that escapes ` +
        'public/ must fall back, never read.',
    );
  }
});
