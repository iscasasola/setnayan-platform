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
import { readFileSync, readdirSync } from 'node:fs';
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

test('PILOT_DECOR_ZONES is a DELIBERATE list, and every zone on it has artwork', () => {
  // Was "exactly the 2-zone pilot scope". `stage` joined on 2026-09-06 under
  // the owner's Q10 ruling and `build-sessions/RECEPTION-ART-PLAN.md`, so the
  // literal pair is no longer the claim — but the SHAPE of the claim is, and it
  // matters more than the count: this list is a switch, and a zone on it with
  // no seeded artwork silently returns an image href for a file that does not
  // exist, while a zone off it with artwork is five dead rows (MB14b).
  //
  // 🔑 So the assertion is now "every named zone has files behind it", which
  // stays true for the NEXT zone without anyone editing this line — and still
  // fails loudly if someone adds a zone speculatively.
  assert.deepEqual(
    [...PILOT_DECOR_ZONES].sort(),
    ['backdrop', 'ceiling', 'stage'],
    'PILOT_DECOR_ZONES changed. That is allowed — but it is a switch, so update the artwork ' +
      'and the count in the same change, never the list alone.',
  );
  for (const zone of PILOT_DECOR_ZONES) {
    const dir = new URL(`../public/moodboard-seed/venue_scene/${zone}/`, import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));
    assert.equal(
      files.length,
      5,
      `zone "${zone}" is switched on but public/moodboard-seed/venue_scene/${zone}/ holds ` +
        `${files.length} SVGs, not one per style family. A zone on this list with no file ` +
        'behind it hands the compositor an href that 404s, and the couple sees nothing.',
    );
  }
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

/* ════════════════════════════════════════════════════════════════════════════
 * THE STAGE ZONE · the first zone added since the pilot pair (2026-09-06).
 *
 * Owner ruling Q10: *go on the staged plan, not on ~55 images*. `stage` is that
 * plan's pilot zone (`build-sessions/RECEPTION-ART-PLAN.md`), seeded by
 * migration `20271211370331`. Everything MB14b asserts about backdrop/ceiling
 * has to hold here too, and the assertions below are deliberately keyed on
 * `PILOT_DECOR_ZONES` rather than on the literal 'stage', so the NEXT zone is
 * covered the day it is added instead of the day someone remembers to type it.
 * ════════════════════════════════════════════════════════════════════════════
 */

const STAGE_MIGRATION = new URL(
  '../../../supabase/migrations/20271211370331_mb_stage_decor_layers_app_served.sql',
  import.meta.url,
);

/** (style_theme → sampled_hex + tolerance), PARSED from the migration. */
function stageSlotsFromMigration(): Map<string, { hex: string; tol: number }> {
  const sql = readFileSync(STAGE_MIGRATION, 'utf8');
  const out = new Map<string, { hex: string; tol: number }>();
  for (const m of sql.matchAll(
    /\('([^']+)',\s*'(#[0-9A-Fa-f]{6})',\s*(\d+)::NUMERIC\)/g,
  )) {
    out.set(m[1]!, { hex: m[2]!.toUpperCase(), tol: Number(m[3]) });
  }
  return out;
}

test('stage: the migration seeds one tagged region per style family', () => {
  const slots = stageSlotsFromMigration();
  assert.equal(
    slots.size,
    5,
    `expected five stage colour ranges, parsed ${slots.size}. A family with no range renders ` +
      "at the artist's colours while the other four wear the couple's — and nothing reports it.",
  );
  // Tolerances are PER FILE. A uniform value is the defect MB28 spent a session
  // correcting, so this fails if they ever collapse to one number.
  const distinct = new Set([...slots.values()].map((v) => v.tol));
  assert.ok(
    distinct.size > 1,
    `all five stage tolerances are ${[...distinct][0]}. They were measured per file (9 · 12 · ` +
      '15 · 15 · 15) as the largest integer at which no neutral moves; a single value across ' +
      'five different drawings means someone stopped measuring.',
  );
  for (const [style, v] of slots) {
    assert.ok(v.tol >= 5 && v.tol <= 30, `${style} tolerance ${v.tol} is outside the table CHECK`);
  }
});

test('stage: every seeded style family has a file behind it in public/', () => {
  const slugs: Record<string, string> = {
    'elegant · simple · classic': 'elegant-simple-classic',
    'bridgerton · regal': 'bridgerton-regal',
    'editorial cream': 'editorial-cream',
    'tropical heritage': 'tropical-heritage',
    'modern minimalist': 'modern-minimalist',
  };
  for (const style of stageSlotsFromMigration().keys()) {
    const slug = slugs[style];
    assert.ok(slug, `the migration seeds an unknown style family "${style}"`);
    const file = new URL(
      `../public/moodboard-seed/venue_scene/stage/${slug}.svg`,
      import.meta.url,
    );
    const bytes = readFileSync(file);
    assert.ok(
      bytes.length > 5000,
      `${slug}.svg is ${bytes.length} bytes — that is not a generated scene. A migration ` +
        'pointed at a file this app does not serve fails HERE, not in a couple\'s browser.',
    );
  }
});

test('stage: the zone is SWITCHED ON, or its rows are dead', () => {
  // 🪤 MB14b's exact defect, one layer up: seeding assets without naming the
  // zone in PILOT_DECOR_ZONES leaves `resolveDecorLayer` returning {kind:'svg'}
  // and five live rows drawing nothing, with every other test green.
  assert.ok(
    PILOT_DECOR_ZONES.includes('stage'),
    'the stage artwork is seeded but `stage` is not in PILOT_DECOR_ZONES, so resolveDecorLayer ' +
      'never returns it and the five rows are dead.',
  );
});

test('stage · REAL BYTES: the server half retints the actual file', async () => {
  // The assertion MB14b learned to make: not "non-null", but BYTES.
  const { renderDecorLayerDataUrl } = await import('./reception-decor-layers-server');
  const slots = stageSlotsFromMigration();
  const slot = slots.get('elegant · simple · classic')!;
  const asset: DecorLayerAsset = {
    assetId: 'S89A-STAGE-ESC',
    storagePath: '/moodboard-seed/venue_scene/stage/elegant-simple-classic.svg',
    colorRange: { slotId: 1, sampledHex: slot.hex, toleranceDe: slot.tol, regionLabel: 'decor' },
  };
  const catalog: DecorLayerCatalog = { stage: { 'elegant · simple · classic': asset } };
  const url = await renderDecorLayerDataUrl('stage', 'elegant · simple · classic', catalog, [
    '#7A1F2B',
  ]);
  assert.ok(url, 'the stage decor layer produced null — five live rows drawing nothing.');
  assert.match(url, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  assert.ok(url.length > 5000, `retinted stage layer is only ${url.length} chars`);
});

test('stage: an uncovered style family still renders the flat drawing, byte for byte', () => {
  // MB14b's invariant, restated for this zone: a couple whose family has no
  // stage asset must get EXACTLY what shipped before, never a near-miss
  // substitute from another family.
  const asset: DecorLayerAsset = {
    assetId: 'S89A-STAGE-ESC',
    storagePath: '/moodboard-seed/venue_scene/stage/elegant-simple-classic.svg',
    colorRange: { slotId: 1, sampledHex: '#C9A059', toleranceDe: 9, regionLabel: 'decor' },
  };
  const catalog: DecorLayerCatalog = { stage: { 'elegant · simple · classic': asset } };
  assert.deepEqual(
    resolveDecorLayer('stage', 'tropical heritage', catalog),
    { kind: 'svg' },
    'a tropical-heritage couple was handed the elegant stage image. The nearest style is ' +
      'never a substitute — that is a room they did not design.',
  );
  assert.deepEqual(resolveDecorLayer('stage', null, catalog), { kind: 'svg' });
});
