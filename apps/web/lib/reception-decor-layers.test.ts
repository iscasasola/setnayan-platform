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
  SCENE_DECOR_ZONES,
  knockOutSceneBackground,
  type DecorLayerAsset,
  type DecorLayerCatalog,
} from './reception-decor-layers';
import { recolorRGBA, colorDistance, hexToRgb } from './color-recolor';
import sharp from 'sharp';
import { renderVenueSvg, DEFAULT_DESIGN } from './reception-scene';
import { fileURLToPath } from 'node:url';
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

test('falls back to svg for a zone outside the decor list, even with a matching style', () => {
  // 🪤 THIS TEST USED `tables` AS ITS OUT-OF-SCOPE EXEMPLAR, AND `tables` JOINED
  // THE LIST (20271211440288), which retired its premise rather than breaking
  // its claim. Picked again on a durable basis: `entrance` is the aisle runner,
  // a FLOOR TINT rather than a dressable object, and `people` is a modifier
  // drawn from role attire colours — `build-sessions/RECEPTION-ART-PLAN.md`
  // rules both permanently out of scope for generated decor. So this exemplar
  // does not expire the way a merely-not-yet-done zone does.
  const wideCatalog: DecorLayerCatalog = { entrance: { 'tropical heritage': ASSET } };
  assert.deepEqual(resolveDecorLayer('entrance', 'tropical heritage', wideCatalog), {
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
    ['backdrop', 'ceiling', 'stage', 'tables'],
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

/* ════════════════════════════════════════════════════════════════════════════
 * RA1 · A SCENE DRAWING IS NOT A PANEL DRAWING.
 *
 * `20271211370331` put the stage zone live. Every stage drawing is a picture of
 * a table standing in its own cream room — and `renderVenueSvg` already draws a
 * room. Composited opaque, each one lays a rectangle of foreign cream across
 * the floor and the wall behind the stage. On `modern minimalist`, whose
 * background is 48% of its frame, the result reads as a broken image rather
 * than as decor. Found by rendering a room and LOOKING at it; no assertion in
 * the suite was failing.
 *
 * `knockOutSceneBackground` clears it, for the zones named in
 * `SCENE_DECOR_ZONES` only. `backdrop` and `ceiling` are deliberately excluded:
 * their drawings FILL their zone, and clearing their background would punch a
 * hole in the backdrop.
 * ════════════════════════════════════════════════════════════════════════════
 */

const RA1_STAGE_DIR = new URL('../public/moodboard-seed/venue_scene/stage/', import.meta.url);
const RA1_STAGE_FILES = [
  'bridgerton-regal',
  'editorial-cream',
  'elegant-simple-classic',
  'modern-minimalist',
  'tropical-heritage',
] as const;

/** Rasterised the way the SERVER renderer does it — `fit: 'inside'`, not the
 *  square letterboxed `contain` the preview guards use. Testing the knockout on
 *  a differently-shaped raster than production would prove nothing about
 *  production. */
async function ra1SceneRaster(slug: string) {
  const file = fileURLToPath(new URL(`${slug}.svg`, RA1_STAGE_DIR));
  const { data, info } = await sharp(file, { density: 300 })
    .resize(800, 800, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data), w: info.width, h: info.height };
}

test('RA1: only scene zones knock their background out — backdrop and ceiling must not', () => {
  assert.deepEqual(
    [...SCENE_DECOR_ZONES],
    ['stage', 'tables'],
    'SCENE_DECOR_ZONES changed. Adding a zone here is a claim that its drawing is an OBJECT ' +
      'standing in a room, so its background is foreign and should go. Adding `backdrop` or ' +
      '`ceiling` would be wrong in the opposite direction — those drawings FILL their zone, and ' +
      'clearing their background punches a hole in the panel behind the couple.',
  );
  for (const zone of SCENE_DECOR_ZONES) {
    assert.ok(
      PILOT_DECOR_ZONES.includes(zone),
      `${zone} is a scene zone but is not in PILOT_DECOR_ZONES, so it composites nothing at all ` +
        'and this knockout runs on no image.',
    );
  }
});

test('RA1 · REAL RASTER: the knockout clears the drawing\'s own room and keeps its furniture', async () => {
  for (const slug of RA1_STAGE_FILES) {
    const { rgba, w, h } = await ra1SceneRaster(slug);
    const out = knockOutSceneBackground(rgba, w, h);

    // The background is whatever the drawing's own corners carry — sampled the
    // same way the function does, so this asserts the OUTCOME rather than
    // restating the input.
    const c = [rgba[0]!, rgba[1]!, rgba[2]!];
    let bgOpaque = 0;
    let bgTotal = 0;
    let cleared = 0;
    let opaque = 0;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (rgba[i + 3]! < 250) continue;
      opaque++;
      if (out[i + 3]! === 0) cleared++;
      if (rgba[i] === c[0] && rgba[i + 1] === c[1] && rgba[i + 2] === c[2]) {
        bgTotal++;
        if (out[i + 3]! > 0) bgOpaque++;
      }
    }
    assert.ok(bgTotal > 0.1 * opaque, `${slug}: no flat background found to clear`);
    assert.equal(
      bgOpaque,
      0,
      `${slug}: ${bgOpaque} px of the drawing's own background survived the knockout and will ` +
        'paint over the room behind the stage.',
    );
    // 🪤 AND THE OPPOSITE FAILURE, WHICH IS WORSE. A tolerance wide enough to
    // eat the furniture leaves a table with a hole in it — unrecoverable by the
    // viewer in a way a stray cream rectangle is not. Every file measured
    // 2026-09-06 clears between 45% and 78% of its opaque area; a run that
    // clears nearly everything has stopped distinguishing figure from ground.
    assert.ok(
      cleared / opaque < 0.9,
      `${slug}: the knockout cleared ${(100 * cleared / opaque).toFixed(1)}% of the opaque area. ` +
        'That is not a background any more — the tolerance is eating the drawing.',
    );
  }
});

test('RA1 · REAL PIXELS: no panel drawing is ever knocked out — all ten stay whole', async () => {
  // 🔑 THE MIRROR OF THE STAGE ASSERTION, AND THE ONE WITH THE WORSE FAILURE.
  // `backdrop` and `ceiling` drawings FILL their zone: their background IS the
  // panel behind the couple and the canopy overhead. If the knockout ever
  // reached them, those would be punched out — and the SVG bytes on disk would
  // be completely unchanged, so a byte-identity check cannot see it.
  //
  // 🪤 THE FIRST DRAFT OF THIS TEST NAMED ONE FILE, AND PICKED THE ONE THAT
  // COULD NOT FAIL. `backdrop/editorial-cream` has corners that disagree, so
  // `knockOutSceneBackground` REFUSES it and returns the source untouched —
  // adding `backdrop` to SCENE_DECOR_ZONES left that assertion green. Measured
  // 2026-09-07, five of these ten would lose 39.6%–78.1% of their opaque pixels
  // and five are saved only by that accidental refusal. So the claim is made
  // over ALL TEN, and it does not depend on which file someone happened to pick.
  const src = readFileSync(new URL('./reception-decor-layers.ts', import.meta.url), 'utf8');
  for (const zone of ['backdrop', 'ceiling'] as const) {
    assert.ok(
      !SCENE_DECOR_ZONES.includes(zone),
      `${zone} is in SCENE_DECOR_ZONES. Its drawings FILL their zone, so knocking their ` +
        "background out makes the couple's panel see-through.",
    );
    const dir = new URL(`../public/moodboard-seed/venue_scene/${zone}/`, import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
      const { data, info } = await sharp(fileURLToPath(new URL(file, dir)), { density: 300 })
        .resize(800, 800, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const rgba = new Uint8ClampedArray(data);
      const out = knockOutSceneBackground(rgba, info.width, info.height);
      let cleared = 0;
      let opaque = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3]! < 250) continue;
        opaque++;
        if (out[i + 3]! === 0) cleared++;
      }
      // Not an assertion that the knockout is harmless here — five of these ten
      // are NOT — but that the wiring never lets it run on them.
      const wouldLose = (100 * cleared) / opaque;
      assert.ok(
        !SCENE_DECOR_ZONES.includes(zone),
        `${zone}/${file} would lose ${wouldLose.toFixed(1)}% of its opaque pixels if the ` +
          'knockout ran on it, and its zone is now in SCENE_DECOR_ZONES.',
      );
    }
  }
  assert.match(
    src,
    /SCENE_DECOR_ZONES: readonly PartId\[\] = \['stage', 'tables'\]/,
    'SCENE_DECOR_ZONES no longer reads exactly [stage, tables] in the source. Panel zones ' +
      '(backdrop, ceiling) must never appear there.',
  );
});

test('RA1: the knockout refuses to guess when the corners disagree', () => {
  // 🪤 THE SAFETY THAT MAKES SAMPLING SAFE AT ALL. Sampling a background from
  // the corners is only sound for a full-bleed drawing. Hand it something drawn
  // into a corner and it must return the source untouched rather than clear
  // whatever colour it happened to find — otherwise a future zone added to
  // SCENE_DECOR_ZONES silently loses its furniture, with nothing red anywhere.
  const w = 4;
  const h = 4;
  const flat = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < flat.length; i += 4) {
    flat[i] = 0xf3;
    flat[i + 1] = 0xec;
    flat[i + 2] = 0xe0;
    flat[i + 3] = 255;
  }
  assert.ok(
    [...knockOutSceneBackground(flat, w, h)].filter((_, i) => i % 4 === 3).every((a) => a === 0),
    'a frame that is entirely background should be entirely cleared',
  );

  const corner = new Uint8ClampedArray(flat);
  const last = (h - 1) * w * 4 + (w - 1) * 4;
  corner[last] = 0x4a;
  corner[last + 1] = 0x3b;
  corner[last + 2] = 0x45;
  assert.deepEqual(
    [...knockOutSceneBackground(corner, w, h)],
    [...corner],
    'a drawing whose corners disagree is not the full-bleed shape this function assumes and must ' +
      'come back untouched. Clearing a guessed "background" out of the middle of a table erases ' +
      'the furniture, which is worse than compositing a background that should have gone.',
  );
});

test('RA1: a letterboxed raster is still knocked out — the frame corners are not the drawing\'s', async () => {
  // 🔑 THE SILENT NO-OP THIS AVOIDS. A 16:9 drawing rasterised into a square
  // with `fit: 'contain'` has TRANSPARENT bands top and bottom, so the frame's
  // corners carry no colour. Sampling those would make the function return the
  // source untouched — no error, no log, and a cream rectangle back in the
  // room. It samples the opaque CONTENT box instead.
  const file = fileURLToPath(new URL('elegant-simple-classic.svg', RA1_STAGE_DIR));
  const { data, info } = await sharp(file, { density: 300 })
    .resize(520, 520, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(data);
  const out = knockOutSceneBackground(rgba, info.width, info.height);
  let cleared = 0;
  let opaque = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < 250) continue;
    opaque++;
    if (out[i + 3]! === 0) cleared++;
  }
  assert.ok(
    cleared > 0.3 * opaque,
    `a letterboxed raster cleared only ${cleared}/${opaque} opaque px. The function is sampling ` +
      'the transparent frame corners instead of the drawing\'s own content box, and is returning ' +
      'the source untouched — silently.',
  );
});

test('RA1 · REAL BYTES: the served stage layer comes back with its background transparent', async () => {
  // The end-to-end claim, on the actual path a couple's board uses. A unit test
  // on the pure function cannot tell you the server renderer CALLS it — that is
  // the same "a null that means unwired is indistinguishable from a null that
  // means nothing to show" trap MB14b paid for. Assert the bytes.
  const catalog = {
    stage: {
      'elegant · simple · classic': {
        assetId: 'ra1-scene',
        storagePath: '/moodboard-seed/venue_scene/stage/elegant-simple-classic.svg',
        colorRange: {
          slotId: 1,
          sampledHex: '#C9A059',
          toleranceDe: 9,
          regionLabel: 'decor',
        },
      },
    },
  } as const;
  const { renderDecorLayerDataUrl } = await import('./reception-decor-layers-server');
  const url = await renderDecorLayerDataUrl(
    'stage',
    'elegant · simple · classic',
    catalog as never,
    ['#7A1F2B', '#E8D9B5'],
  );
  assert.ok(url, 'renderDecorLayerDataUrl returned null for a seeded, served stage asset');
  const png = Buffer.from(url!.split(',')[1]!, 'base64');
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  assert.ok(
    transparent > 0.3 * info.width * info.height,
    `the served stage layer came back ${(100 * transparent / (info.width * info.height)).toFixed(1)}% ` +
      'transparent. The server renderer is not knocking the scene background out, so the drawing ' +
      "will paint its own cream room over the couple's floor and wall.",
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * RA1 · PART B · THE GUEST TABLES.
 *
 * `20271211440288` seeds `tables` for all five style families — the fourth
 * zone to carry generated artwork, and the first whose geometry does not
 * describe a single object.
 *
 * 🪤 `tables` DRAWS FOUR OF THEM, AT SCATTERED SPOTS, WITH THE AISLE BETWEEN.
 * (150,520,r60) (810,520,r60) (240,432,r44) (720,432,r44). `DECOR_SLOTS` takes
 * one rect per zone, so a single 88..872 × 386..586 rect has to span all four —
 * and that only works because `tables` is ALSO a scene zone: its drawing's
 * background is knocked out first, so the floor, the aisle runner and the dance
 * floor show through BETWEEN the tables. Composited opaque, the same rect would
 * blank the entire lower half of the couple's room. The membership assertions
 * below are not bookkeeping; dropping either one produces a silently wrong room.
 *
 * ── MEASURED WITH NO AREA FLOOR ─────────────────────────────────────────────
 * Every constant is from a 520px `sharp` raster pushed through the real
 * `recolorRGBA` against four unrelated targets, counting opaque pixels that
 * change OUTSIDE a 2px dilation of the tagged cloth. If a drawing is re-cut,
 * RE-MEASURE — do not adjust a number here to make a red test green.
 * ════════════════════════════════════════════════════════════════════════════
 */

const RA1_TABLES_MIGRATION = new URL(
  '../../../supabase/migrations/20271211440288_ra1_tables_decor_five_families.sql',
  import.meta.url,
);

type Ra1Table = { slug: string; servedPath: string; sampledHex: string; tolerance: number };

/** 🪤 Parsed from the migration, never retyped — including the served path,
 *  so a migration pointed at a file `public/` does not serve fails HERE. */
function ra1Tables(): Ra1Table[] {
  const sql = readFileSync(RA1_TABLES_MIGRATION, 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  return [
    ...sql.matchAll(
      /\('(\/moodboard-seed\/venue_scene\/tables\/([a-z0-9-]+)\.svg)',\s*'(#[0-9A-Fa-f]{6})',\s*(\d+)::NUMERIC\)/g,
    ),
  ]
    .map((m) => ({
      slug: m[2]!,
      servedPath: m[1]!,
      sampledHex: m[3]!.toUpperCase(),
      tolerance: Number(m[4]),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

const RA1_TABLES = ra1Tables();

/**
 * Opaque pixels outside the tagged cloth that may recolour at the seeded
 * tolerance: 0.02% of the opaque area (31 px of 154,440). A MEASURED allowance
 * for the antialiasing where a chair leg or a plate rim crosses the cloth's
 * edge — not a concession. Measured 2026-09-07: 17, 6, 28, 4, 28.
 */
const RA1_TABLES_BUDGET = 31;

/**
 * The two drawings whose seeded value sits on a CLIFF: one step up turns a
 * measured field. The other three climb gradually (their real neutrals — chair
 * and plate greys — sit further out), so their bound is the antialiasing budget
 * above rather than a boundary, and this file says so instead of asserting a
 * cliff that is not there.
 */
const RA1_TABLES_CLIFF: Record<string, number> = {
  'bridgerton-regal': 593,
  'tropical-heritage': 351,
};

async function ra1TableObject(t: Ra1Table) {
  const file = fileURLToPath(new URL(`.${t.servedPath}`, new URL('../public/', import.meta.url)));
  const { data, info } = await sharp(file, { density: 300 })
    .resize(520, 520, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(data);
  const { width: w, height: h } = info;
  const [sr, sg, sb] = hexToRgb(t.sampledHex);
  // 🔑 THE OBJECT IS EVERY PIXEL NEAR THE SLOT, NOT ONLY THE EXACT MATCHES.
  // Built from exact matches alone, a cloth's own antialiased interior lands
  // OUTSIDE the mask and every tolerance looks like a bleed — measured on these
  // five, which report "no clean tolerance at all" under that reading.
  const core = new Uint8Array(w * h);
  const mask = new Uint8Array(w * h);
  let opaque = 0;
  let exact = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (rgba[i + 3]! < 250) continue;
    opaque++;
    if (rgba[i] === sr && rgba[i + 1] === sg && rgba[i + 2] === sb) exact++;
    if (colorDistance(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, sr, sg, sb) <= 3) core[p] = 1;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!core[y * w + x]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && nx >= 0 && ny < h && nx < w) mask[ny * w + nx] = 1;
        }
      }
    }
  }
  return { rgba, w, h, core, mask, opaque, exact, slot: [sr, sg, sb] as const };
}

const RA1_TABLE_TARGETS = ['#7A1F2B', '#D4AF37', '#0F766E', '#1E3A8A'] as const;

async function ra1TableRecolour(t: Ra1Table, tolerance: number, hex: string) {
  const o = await ra1TableObject(t);
  const out = recolorRGBA(
    o.rgba,
    [{ slotId: 1, sampledHex: t.sampledHex, toleranceDe: tolerance, regionLabel: 'draped fabric' }],
    { 1: { mode: 'palette', hex } },
  );
  let outside = 0;
  let stuck = 0;
  for (let p = 0; p < o.w * o.h; p++) {
    const i = p * 4;
    if (o.rgba[i + 3]! < 250) continue;
    const moved =
      out[i] !== o.rgba[i] || out[i + 1] !== o.rgba[i + 1] || out[i + 2] !== o.rgba[i + 2];
    if (moved && !o.mask[p]) outside++;
    if (
      o.rgba[i] === o.slot[0] &&
      o.rgba[i + 1] === o.slot[1] &&
      o.rgba[i + 2] === o.slot[2] &&
      !moved
    ) {
      stuck++;
    }
  }
  return { outside, stuck, exact: o.exact, opaque: o.opaque };
}

test('RA1 tables: the migration seeds five measured drawings, one range each', () => {
  assert.deepEqual(
    RA1_TABLES.map((t) => `${t.slug}:${t.sampledHex}:${t.tolerance}`),
    [
      'bridgerton-regal:#8C6BA6:8',
      'editorial-cream:#D98BA6:7',
      'elegant-simple-classic:#C9A059:9',
      'modern-minimalist:#4A3B45:6',
      'tropical-heritage:#9CB29A:5',
    ],
    'a seeded guest-table tolerance or sampled_hex changed. Each of 9, 8, 7, 5 and 6 is a ' +
      'separate measurement against a different neighbour in its own drawing. Re-measure ' +
      'through the real recolorRGBA at 520px before editing this list.',
  );
  for (const t of RA1_TABLES) {
    assert.ok(
      t.tolerance >= 5 && t.tolerance <= 30,
      `${t.slug}: ${t.tolerance} is outside moodboard_asset_color_ranges' CHECK (5..30). A slot ` +
        'needing a value outside it is UNSEEDABLE — re-cut the artwork or ship the cell ' +
        'uncovered. Never widen the CHECK for one file.',
    );
  }
});

test('RA1 tables: the zone is wired all four ways, or the room is silently wrong', () => {
  assert.ok(
    PILOT_DECOR_ZONES.includes('tables'),
    "'tables' is missing from PILOT_DECOR_ZONES — resolveDecorLayer will never return these " +
      'five approved rows and every couple keeps seeing the flat drawing, with nothing logged.',
  );
  assert.ok(
    SCENE_DECOR_ZONES.includes('tables'),
    "'tables' is missing from SCENE_DECOR_ZONES. Its DECOR_SLOTS rect spans all four guest " +
      'tables AND the aisle between them, so without the background knockout the drawing paints ' +
      "an opaque rectangle across the entire lower half of the couple's room. This is the one " +
      'membership whose absence is a visual disaster rather than a no-op.',
  );
});

test('RA1 tables · REAL BYTES: a tables layer actually reaches the composited room', () => {
  // The three-permission failure, asserted on bytes. PILOT_DECOR_ZONES and the
  // rows are not enough — DECOR_SLOTS needs the geometry ("the geometry IS the
  // permission") and renderVenueSvg needs the call site. Missing either is
  // invisible: no error, no null, no log.
  const palette = ['#7A1F2B', '#E8D9B5', '#F4F1EA'];
  const href = '/moodboard-seed/venue_scene/tables/elegant-simple-classic.svg';
  const flat = renderVenueSvg(DEFAULT_DESIGN, palette, undefined, 'hotel_venue');
  const composited = renderVenueSvg(DEFAULT_DESIGN, palette, undefined, 'hotel_venue', {
    tables: href,
  });
  assert.ok(
    composited.includes(href),
    'renderVenueSvg was handed a tables decor layer and did not draw it. Check DECOR_SLOTS has ' +
      "a `tables` geometry and that renderVenueSvg calls decorImage('tables', decor) at the " +
      'tables layer.',
  );
  assert.equal(
    renderVenueSvg(DEFAULT_DESIGN, palette, undefined, 'hotel_venue', {}),
    flat,
    'an empty decor map changed the render — an uncovered cell must be byte-identical to the ' +
      'flat drawing.',
  );
});

test('RA1 tables · REAL RASTER, NO AREA FLOOR: nothing but the cloth wears the palette', async () => {
  for (const t of RA1_TABLES) {
    for (const hex of RA1_TABLE_TARGETS) {
      const { outside, opaque } = await ra1TableRecolour(t, t.tolerance, hex);
      assert.ok(
        outside <= RA1_TABLES_BUDGET,
        `${t.slug}: ${outside} opaque px outside the tagged cloth recoloured under ${hex} ` +
          `(${(100 * outside / opaque).toFixed(3)}% of the frame), above the measured ` +
          `${RA1_TABLES_BUDGET} px antialiasing budget. Chair legs, plate rims and glass stems ` +
          'are hairlines — a census with an area floor cannot see them, which is why this ' +
          'assertion has none. Re-measure; do not raise the budget to fit a wider tolerance.',
      );
    }
  }
});

test('RA1 tables · REAL RASTER: every cloth recolours COMPLETELY', async () => {
  // 🪤 The other half of MB23's rule — but be honest about its reach on THESE
  // drawings. Each cloth is a FLAT fill, so its exact slot pixels match at any
  // tolerance ≥ 0 and a tightening cannot strand them: sabotaging elegant from
  // 9 down to 5 leaves this case green (the pinned-values case above is what
  // catches it). What this case DOES catch is a wrong or swapped `sampled_hex`
  // — then `exact` is 0 and it fires — and it would catch a re-cut that gave a
  // cloth a second tone. Stated rather than left to look stronger than it is.
  for (const t of RA1_TABLES) {
    for (const hex of RA1_TABLE_TARGETS) {
      const { stuck, exact } = await ra1TableRecolour(t, t.tolerance, hex);
      assert.ok(exact > 0, `${t.slug}: no pixel carries the slot colour ${t.sampledHex}`);
      assert.equal(
        stuck,
        0,
        `${t.slug}: ${stuck}/${exact} px of the tablecloth stayed at stock colour under ${hex} ` +
          `at tolerance ${t.tolerance}.`,
      );
    }
  }
});

test('RA1 tables: the two cliff-bounded tolerances really are on a cliff', async () => {
  // 🔑 PINS THE NUMBER RATHER THAN THE OUTCOME, and doubles as "can this
  // harness see a bleed at all". Only the two files that HAVE a cliff are
  // asserted here — claiming one for the other three would be inventing a
  // boundary to make the table look uniform.
  for (const [slug, expected] of Object.entries(RA1_TABLES_CLIFF)) {
    const t = RA1_TABLES.find((x) => x.slug === slug)!;
    let worst = 0;
    for (const hex of RA1_TABLE_TARGETS) {
      const { outside } = await ra1TableRecolour(t, t.tolerance + 1, hex);
      worst = Math.max(worst, outside);
    }
    assert.ok(
      worst > 0.5 * expected,
      `${slug}: widening from ${t.tolerance} to ${t.tolerance + 1} moved ${worst} px outside ` +
        `the cloth, against the ${expected} px measured on 2026-09-07. Either the artwork was ` +
        're-cut, or this harness can no longer see a bleed — in which case the assertions above ' +
        'are vacuous. Re-measure; do not delete this test.',
    );
  }
});
