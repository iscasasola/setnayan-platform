/**
 * MB23 · 🔑 THE RISK IS THE WHITE.
 *
 * Turning attire recolour on (the SELECT fix in `page.tsx`) exposes a defect in
 * the seeded colour ranges. Ten of the forty attire SVGs behind the eight cards
 * this board builds carry an OPAQUE flat background rect rather than
 * transparency, and in four of them that background colour fell INSIDE its
 * slot's tolerance, so applying the palette repainted the page behind the figure.
 *
 * ⚠ ON ONE OF THE FOUR IT WAS WORSE THAN "ALSO". For
 * `modern-minimalist/bride`, the seeded slot was `#FAFAFA ± 15`; its background
 * `#ECEBE7` sits ΔE 6.0 away (matched) and its GOWN `#D3D2D1` sits ΔE 15.6 away
 * (NOT matched). The card recoloured the background and left the gown alone —
 * the couple's colour landed on everything except the dress. Measured, not
 * inferred; it is the reason the "garment still recolours" half of this file
 * exists at all.
 *
 * Fixed in the DATA by migration `20271205919528`, never by an override in the
 * component. THIS FILE IS THE GUARD ON THAT DATA.
 *
 * ── WHY A FIXTURE, AND WHAT IT IS ───────────────────────────────────────────
 * The measurement that found the bug rasterises the real SVGs at the component's
 * own MAX_PREVIEW_PX (520) and pushes them through the real `recolorRGBA`. That
 * needs the network and rsvg-convert, so it cannot run in CI. What CI CAN run is
 * the same engine over the two colours that decide the outcome for each file:
 * its measured background colour and its measured garment colour.
 *
 * So the fixture below is a MEASUREMENT, not an invention. Every hex in it was
 * read out of a real 520px raster of the real asset on 2026-09-05, and the
 * `sampledHex`/`tolerance` columns are the values migration 20271205919528
 * writes. If the artwork is re-cut, RE-MEASURE — do not adjust a number here to
 * make a red test green.
 *
 *   Re-measure (needs `brew install librsvg`):
 *     curl -sO <asset>.svg && rsvg-convert -w 520 -h 520 -o out.png <asset>.svg
 *     # background = the pixel at (3,3)
 *     # garment    = the largest opaque colour that is not the background AND is
 *     #              matched by the slot
 *
 * ── WHAT IT ASSERTS, PER REGION ─────────────────────────────────────────────
 * Two assertions, both required, because either alone is a false green:
 *   1. BACKGROUND — the file's background colour must NOT be matched by its own
 *      slot, under ANY palette colour. This is the bug.
 *   2. GARMENT — the file's garment colour MUST still be matched and must MOVE.
 *      Tightening every tolerance to 1 would satisfy (1) forever while the
 *      feature quietly stopped working — the same shape of false green as
 *      [[presence-of-ink-is-not-fit-of-ink]].
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { stripComments } from '@/lib/strip-comments';
import {
  colorDistance,
  hexToRgb,
  recolorRGBA,
  type ColorRangeSlot,
} from '@/lib/color-recolor';

/**
 * Palette colours to try. Burgundy and gold are real seeded theme colours; the
 * teal is deliberately far from every garment in the fixture, so "the garment
 * moved" measures whether the slot MATCHES rather than how lucky the palette is.
 */
const PALETTE = ['#7A1F2B', '#D4AF37', '#0F766E'] as const;

type Figure = {
  /** `<style-family>/<subtype>` under moodboard-library/figure_attire/. */
  asset: string;
  /** What migration 20271205919528 leaves in moodboard_asset_color_ranges. */
  sampledHex: string;
  tolerance: number;
  /** Measured 2026-09-05 from a 520px raster: the pixel at (3,3). */
  background: string;
  /** Measured 2026-09-05: largest opaque non-background colour the slot matches. */
  garment: string;
  /**
   * Measured 2026-09-05: the matched tone FURTHEST from the slot that still
   * covers ≥0.15% of the frame — the shading a tightened tolerance drops first.
   * Where it equals `garment`, the garment is a single flat vector fill with no
   * shading inside the range; that is a fact about the drawing, not a gap.
   */
  farthestTone: string;
};

/**
 * 🪤 THE TOLERANCES ARE READ OUT OF THE MIGRATION, NOT RETYPED HERE.
 *
 * The first draft of this file restated them as literals — and a sabotage pass
 * caught it: tightening every tolerance to 1 in the migration left all 22
 * assertions green, because the fixture went on describing the old values. A
 * guard that carries its own copy of the thing it guards is guarding a copy.
 *
 * So `sampledHex` and `tolerance` are PARSED from
 * `20271205919528_mb23_retire_internet_placeholder_assets.sql`. Edit the
 * migration and this test re-measures against the new values immediately. The
 * `background` and `garment*` columns stay measured constants — they are facts
 * about the ARTWORK, which no migration can change.
 */
const MIGRATION = new URL(
  '../../../../../../../../supabase/migrations/20271205919528_mb23_retire_internet_placeholder_assets.sql',
  import.meta.url,
);

/** `('figure_attire/<style>/<sub>.svg', '#HEX', NN)` rows from the migration's VALUES list. */
function slotsFromMigration(): Map<string, { sampledHex: string; tolerance: number }> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const body = sql.slice(sql.indexOf('SET sampled_hex'));
  const out = new Map<string, { sampledHex: string; tolerance: number }>();
  for (const m of body.matchAll(
    /\(\s*'figure_attire\/([^']+)\.svg'\s*,\s*'(#[0-9A-Fa-f]{6})'\s*,\s*(\d+)\s*\)/g,
  )) {
    out.set(m[1]!, { sampledHex: m[2]!.toUpperCase(), tolerance: Number(m[3]) });
  }
  assert.equal(
    out.size,
    3,
    'migration 20271205919528 no longer writes three figure_attire colour ranges — this ' +
      'guard now watches nothing. If the set changed on purpose, update FIXED below and ' +
      're-measure the artwork.',
  );
  return out;
}

const FROM_MIGRATION = slotsFromMigration();

/** Measured artwork facts for the three the migration re-samples. Slot values come from it. */
const FIXED: Figure[] = (
  [
    { asset: 'bridgerton-regal/groom', background: '#EDECE6', garment: '#E7C99F', farthestTone: '#D1B68D' },
    { asset: 'tropical-heritage/male_ps', background: '#FAF8F2', garment: '#F7D79E', farthestTone: '#E7B493' },
    { asset: 'bridgerton-regal/male_ps', background: '#F8F8F1', garment: '#F4DDAC', farthestTone: '#EEE5D1' },
  ] as const
).map((f) => {
  const slot = FROM_MIGRATION.get(f.asset);
  assert.ok(slot, `migration 20271205919528 no longer sets a range for ${f.asset}`);
  return { ...f, ...slot! };
});

/**
 * The other six figures with an opaque background, which were already safe and
 * which the migration deliberately does NOT touch. They are here so a future
 * re-seed that widens a tolerance is caught on them too.
 */
const ALREADY_SAFE: Figure[] = [
  { asset: 'modern-minimalist/groomsmen', sampledHex: '#2E3F5C', tolerance: 15, background: '#F9F7F0', garment: '#234171', farthestTone: '#234171' },
  { asset: 'editorial-cream/groomsmen', sampledHex: '#2E3F5C', tolerance: 15, background: '#EAE8E1', garment: '#324363', farthestTone: '#324363' },
  { asset: 'elegant-simple-classic/female_ps', sampledHex: '#D4B896', tolerance: 15, background: '#F6F6EE', garment: '#C9B099', farthestTone: '#C19E88' },
  { asset: 'tropical-heritage/female_ps', sampledHex: '#D4B896', tolerance: 15, background: '#F6F4F0', garment: '#DEB99A', farthestTone: '#BF966C' },
  { asset: 'bridgerton-regal/female_ps', sampledHex: '#D4B896', tolerance: 15, background: '#F4F3EE', garment: '#C8AD91', farthestTone: '#E1D8CC' },
  { asset: 'tropical-heritage/guests', sampledHex: '#7E1F32', tolerance: 15, background: '#F5F4ED', garment: '#A2092D', farthestTone: '#4F020E' },
];

/** The pre-migration values for the four, kept so this fixture can be trusted. */
const BLED_BEFORE: Figure[] = [
  { asset: 'bridgerton-regal/groom', sampledHex: '#E8D9B8', tolerance: 15, background: '#EDECE6', garment: '#E7C99F', farthestTone: '#D1B68D' },
  { asset: 'tropical-heritage/male_ps', sampledHex: '#E8D9B8', tolerance: 15, background: '#FAF8F2', garment: '#F7D79E', farthestTone: '#E7B493' },
  { asset: 'bridgerton-regal/male_ps', sampledHex: '#E8D9B8', tolerance: 15, background: '#F8F8F1', garment: '#F4DDAC', farthestTone: '#EEE5D1' },
];

/**
 * A two-region raster standing in for the real one: a 10x10 field of the file's
 * background colour with a 4x4 patch of its garment colour. Small, but it runs
 * through the SAME `recolorRGBA` the browser runs, with the SAME slot values the
 * database holds — which is where the bug lived.
 */
function render(
  fig: Figure,
  paletteHex: string,
): { backgroundMaxDeviation: number; garmentMaxDeviation: number; shadeMaxDeviation: number } {
  const W = 10;
  const H = 10;
  const src = new Uint8ClampedArray(W * H * 4);
  const [br, bg, bb] = hexToRgb(fig.background);
  const [gr, gg, gb] = hexToRgb(fig.garment);
  const [sr, sg, sb] = hexToRgb(fig.farthestTone);
  // The garment patch carries its own shading, so a tolerance tightened until
  // only the flat body survives is visible as a loss rather than a pass.
  const isShade = (x: number, y: number) => x >= 5 && x < 7 && y >= 5 && y < 7;
  const isGarment = (x: number, y: number) => x >= 3 && x < 7 && y >= 3 && y < 7;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const [r, g, b] = isShade(x, y)
        ? [sr, sg, sb]
        : isGarment(x, y)
          ? [gr, gg, gb]
          : [br, bg, bb];
      src[i] = r!;
      src[i + 1] = g!;
      src[i + 2] = b!;
      src[i + 3] = 255;
    }
  }

  const slots: ColorRangeSlot[] = [
    { slotId: 1, sampledHex: fig.sampledHex, toleranceDe: fig.tolerance, regionLabel: 'attire' },
  ];
  const out = recolorRGBA(src, slots, { 1: { mode: 'palette', hex: paletteHex } });

  let backgroundMaxDeviation = 0;
  let garmentMaxDeviation = 0;
  let shadeMaxDeviation = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const dev = Math.max(
        Math.abs(out[i]! - src[i]!),
        Math.abs(out[i + 1]! - src[i + 1]!),
        Math.abs(out[i + 2]! - src[i + 2]!),
      );
      if (isShade(x, y)) shadeMaxDeviation = Math.max(shadeMaxDeviation, dev);
      else if (isGarment(x, y)) garmentMaxDeviation = Math.max(garmentMaxDeviation, dev);
      else backgroundMaxDeviation = Math.max(backgroundMaxDeviation, dev);
    }
  }
  return { backgroundMaxDeviation, garmentMaxDeviation, shadeMaxDeviation };
}

const distance = (a: string, b: string) =>
  colorDistance(
    ...(hexToRgb(a) as [number, number, number]),
    ...(hexToRgb(b) as [number, number, number]),
  );

for (const fig of [...FIXED, ...ALREADY_SAFE]) {
  test(`${fig.asset}: the BACKGROUND never wears the palette`, () => {
    for (const hex of PALETTE) {
      const { backgroundMaxDeviation } = render(fig, hex);
      assert.equal(
        backgroundMaxDeviation,
        0,
        `${fig.asset}'s background (${fig.background}) is inside the tolerance of its own ` +
          `colour range (${fig.sampledHex} ± ${fig.tolerance}), so applying ${hex} repaints ` +
          'the page behind the figure as well as the figure. Measured distance ' +
          `background→slot = ${distance(fig.background, fig.sampledHex).toFixed(1)}, ` +
          `tolerance ${fig.tolerance}. Fix the DATA — re-sample the slot from the garment ` +
          "and set the tolerance below the distance to that file's own background, in a " +
          'migration on moodboard_asset_color_ranges. Never special-case the asset in the ' +
          'component.',
      );
    }
  });

  test(`${fig.asset}: the GARMENT is still matched and still moves`, () => {
    const moved = PALETTE.map((hex) => render(fig, hex).garmentMaxDeviation);
    assert.ok(
      Math.max(...moved) > 8,
      `${fig.asset}'s garment (${fig.garment}) does not move under any palette colour ` +
        `(max per-channel deviation ${Math.max(...moved)}) with ${fig.sampledHex} ± ` +
        `${fig.tolerance}; distance garment→slot = ` +
        `${distance(fig.garment, fig.sampledHex).toFixed(1)}. A tolerance tightened until ` +
        'nothing matches passes the background assertion forever while "In your colors" ' +
        'quietly shows the couple nothing of their own.',
    );
  });

  test(`${fig.asset}: the garment's SHADING recolours with it`, () => {
    // The half that the first draft of this file missed. Recolouring only the
    // flat body and leaving every shaded fold at its stock colour is a
    // two-tone figure, not a recoloured one — and it is what a tolerance
    // tightened "to be safe" produces. `farthestTone` is the measured matched
    // tone furthest from the slot with ≥0.15% of the frame; if it equals
    // `garment`, this drawing has no shading inside the range and the
    // assertion is satisfied by the body itself, which is honest.
    const moved = PALETTE.map((hex) => render(fig, hex).shadeMaxDeviation);
    assert.ok(
      Math.max(...moved) > 8,
      `${fig.asset}'s shaded tone (${fig.farthestTone}, ΔE ` +
        `${distance(fig.farthestTone, fig.sampledHex).toFixed(1)} from the slot) falls ` +
        `outside ${fig.sampledHex} ± ${fig.tolerance}, so the folds of the garment keep ` +
        'their stock colour while its flat body turns the palette colour. Widen the ' +
        'tolerance in migration 20271205919528 — but only as far as this file\'s measured ' +
        'background distance allows, or the background assertion fires instead. If both ' +
        'cannot hold at once, the range needs a second slot, not a compromise.',
    );
  });
}

test('the fixture can tell a bleeding range from a fixed one', () => {
  // Without this, every assertion above could be passing because the harness is
  // broken rather than because the data is right. These are the exact values
  // that were live before migration 20271205919528.
  for (const fig of BLED_BEFORE) {
    const bled = PALETTE.some((hex) => render(fig, hex).backgroundMaxDeviation > 0);
    assert.ok(
      bled,
      `${fig.asset}: the pre-migration range should bleed into the background, and this ` +
        'harness says it does not — the harness is wrong, not the data.',
    );
  }
});

/**
 * ⚠ THE BRIDE WAS NOT A TOLERANCE PROBLEM — SHE WAS AN ARTWORK PROBLEM.
 *
 * As shipped, `modern-minimalist/bride` drew the gown in #ECEBE7 and then drew a
 * full-canvas backdrop `<path>` in the SAME #ECEBE7 behind it. Measured
 * 2026-09-05 on a 520px raster: ΔE(gown, backdrop) = 0.0, and that one value was
 * 88.0% of the frame.
 *
 * To `recolorRGBA` they were not two regions; they were one. Every (sampledHex,
 * tolerance) pair caught both or neither — so migration 20271205919528 DELETED
 * the range rather than adjusting it. This test is the proof for that decision:
 * it keeps "just tighten the tolerance" from being re-derived, and it is the
 * reason the fix had to happen in the FILE.
 *
 * MB24 re-cut the file — one backdrop path removed, nothing else — and the
 * section below is the guard on the range that became possible. Both halves stay
 * here on purpose: the history is why the new tolerance is measured against skin
 * rather than against a backdrop that no longer exists.
 */
const BRIDE_GOWN = '#ECEBE7';
const BRIDE_BACKDROP_AS_SHIPPED = '#ECEBE7';

test('modern-minimalist/bride: the shipped gown and backdrop were the SAME colour, so no range could isolate the dress', () => {
  assert.equal(
    distance(BRIDE_GOWN, BRIDE_BACKDROP_AS_SHIPPED),
    0,
    'the measurement MB23\'s deletion and MB24\'s re-cut both rest on has changed — ' +
      're-measure the original artwork before trusting either',
  );

  // Whatever slot you invent, the two regions move together or not at all.
  for (const [hex, tol] of [
    ['#FAFAFA', 15],
    ['#ECEBE7', 15],
    ['#ECEBE7', 1],
    ['#D3D2D1', 8],
  ] as const) {
    const fig: Figure = {
      asset: 'modern-minimalist/bride',
      sampledHex: hex,
      tolerance: tol,
      background: BRIDE_BACKDROP_AS_SHIPPED,
      garment: BRIDE_GOWN,
      farthestTone: BRIDE_GOWN,
    };
    const { backgroundMaxDeviation, garmentMaxDeviation } = render(fig, '#7A1F2B');
    assert.equal(
      backgroundMaxDeviation,
      garmentMaxDeviation,
      `${hex} ± ${tol} claims to separate the gown from the backdrop. It cannot — they ` +
        'are the same colour. This is why MB24 re-cut the FILE. Do not reinstate a range ' +
        'against the old artwork; a range is only honest once the backdrop is gone.',
    );
  }
});

test('migration 20271205919528 still does NOT tag modern-minimalist/bride', () => {
  // MB24 gives her a range again — in ITS OWN migration, against the re-cut file.
  // Putting one back HERE would tag the old artwork, whose backdrop is still
  // #ECEBE7, and re-open the exact bug MB23 closed.
  assert.equal(
    FROM_MIGRATION.has('modern-minimalist/bride'),
    false,
    'a colour range has been reinstated for modern-minimalist/bride inside MB23\'s ' +
      'migration. That migration predates the re-cut, so it would tag the artwork that ' +
      'still has the #ECEBE7 backdrop. The range belongs in MB24\'s migration, which also ' +
      'moves the row to the re-cut file — see the MB24 section below.',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MB24 · THE BRIDE, RE-CUT — AND RASTERISED FOR REAL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Everything above this line runs on a synthetic two-colour patch, because those
 * assets live on R2 and CI has no network. THIS asset is different: MB24 moved it
 * into `public/`, so the real file is on disk at test time and there is no excuse
 * for a stand-in. This section rasterises the ACTUAL SVG with `sharp` — an
 * existing apps/web dependency — at the component's own MAX_PREVIEW_PX, and
 * pushes the real pixels through the real `recolorRGBA`.
 *
 * That matters for one specific failure the synthetic harness cannot see. The
 * bug MB23 found was a BACKDROP PATH inside the artwork. A fixture built from
 * two measured colours cannot notice a path coming back; only a raster can.
 *
 * 🪤 NOTHING HERE IS RETYPED FROM THE MIGRATION. The served path, the matched
 * suffix, the sampled hex and the tolerance are all PARSED out of
 * `20271206127987`, and the file that gets rasterised is the one the migration
 * NAMES. Point the migration at another asset and this cannot find it; change
 * the tolerance and this re-measures against the new one. A guard holding its own
 * copy of the thing it guards is guarding a copy — the trap MB23 documents above,
 * caught there by a sabotage pass.
 *
 * 🪤 AND ALPHA IS NOT A SAFETY NET. `recolorRGBA` matches on RGB and never writes
 * the alpha channel, so "the transparent surround stays at alpha 0" is true for
 * EVERY tolerance, including absurd ones — asserting only that would be green at
 * ±40 forever. The assertion that actually constrains the number is her SKIN,
 * which is opaque, 2.66% of the frame, and ΔE 20.8 from the slot.
 */
const MB24_MIGRATION = new URL(
  '../../../../../../../../supabase/migrations/20271206127987_mb24_modern_minimalist_bride_recut_app_served.sql',
  import.meta.url,
);
const PUBLIC_DIR = new URL('../../../../../../public/', import.meta.url);

/** The four decisions MB24's migration makes, read from the migration itself. */
function mb24FromMigration(): {
  servedPath: string;
  matchedSuffix: string;
  sampledHex: string;
  tolerance: number;
  regionLabel: string;
} {
  const sql = readFileSync(MB24_MIGRATION, 'utf8');

  const served = /SET storage_path = '([^']+)'/.exec(sql);
  assert.ok(served, 'MB24 migration no longer SETs a storage_path — this guard watches nothing');

  const suffix = /storage_path LIKE '%([^']+\.svg)'/.exec(sql);
  assert.ok(suffix, 'MB24 migration no longer matches a storage_path suffix');

  const range =
    /SELECT\s+a\.asset_id,\s*\d+,\s*'(#[0-9A-Fa-f]{6})',\s*(\d+),\s*'([^']+)'/.exec(sql);
  assert.ok(range, 'MB24 migration no longer inserts a colour range');

  return {
    servedPath: served[1]!,
    matchedSuffix: suffix[1]!,
    sampledHex: range[1]!.toUpperCase(),
    tolerance: Number(range[2]),
    regionLabel: range[3]!,
  };
}

const MB24 = mb24FromMigration();

/**
 * Measured 2026-09-05 from a 520px `sharp` raster of the re-cut file. Facts about
 * the ARTWORK, which no migration can change — so unlike the slot values these
 * are constants, and the test below re-checks that they are still present rather
 * than trusting them.
 */
const BRIDE = {
  /** The gown body: 20.80% of the frame, ΔE 0.0 from the slot. */
  gown: '#ECEBE7',
  /** The deepest fold still inside the band: ΔE 15.6. Drops out below ±16. */
  farthestShading: '#C6C2C0',
  /**
   * Her shoulders, arms and face: 2.66% of the frame at ΔE 20.8 — the nearest
   * thing to the slot that is NOT attire, and therefore the ceiling on the
   * tolerance. The flat fill enters at ±21 and 67% of her skin recolours.
   */
  skin: '#CEB19F',
  /** Opaque share of the 520px frame. A reinstated backdrop path makes this 100%. */
  opaqueCoverage: 0.3221,
} as const;

/** Warm pixels are skin; the gown and her hair are neutral. Measured r−b: gown ≤6, skin ≥47. */
const isWarmPixel = (r: number, b: number) => r - b > 20;

/** The 6px outer ring MB23's own measurement used as the background sample. */
const FRAME_PX = 6;

const MAX_PREVIEW_PX = 520; // recolor-studio.tsx's own downscale ceiling

type Raster = { rgba: Uint8ClampedArray; w: number; h: number };

async function rasteriseFromPublic(servedPath: string): Promise<Raster> {
  // The migration writes an app-relative URL ('/moodboard-seed/…'); public/ is
  // what serves it. Resolving through the migration is the point: a migration
  // pointed at a path this app does not serve fails HERE, not in a couple's
  // browser.
  const file = new URL(`.${servedPath}`, PUBLIC_DIR);
  const { data, info } = await sharp(fileURLToPath(file), { density: 300 })
    .resize(MAX_PREVIEW_PX, MAX_PREVIEW_PX, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data), w: info.width, h: info.height };
}

const SLOT: ColorRangeSlot[] = [
  { slotId: 1, sampledHex: MB24.sampledHex, toleranceDe: MB24.tolerance, regionLabel: MB24.regionLabel },
];

/**
 * Rasterised once and reused. Not a top-level `await`: tsx transpiles this file
 * to CJS for `node --test`, where top-level await is a transform error.
 */
let rasterCache: Raster | null = null;
async function brideRaster(): Promise<Raster> {
  rasterCache ??= await rasteriseFromPublic(MB24.servedPath);
  return rasterCache;
}

/** Recolour the real raster and report per-population movement. */
async function recolourBride(paletteHex: string) {
  const { rgba, w, h } = await brideRaster();
  const out = recolorRGBA(rgba, SLOT, { 1: { mode: 'palette', hex: paletteHex } });
  const moved = (i: number) =>
    Math.max(
      Math.abs(out[i]! - rgba[i]!),
      Math.abs(out[i + 1]! - rgba[i + 1]!),
      Math.abs(out[i + 2]! - rgba[i + 2]!),
    );

  let opaque = 0;
  let warm = 0;
  let warmMoved = 0;
  let neutral = 0;
  let neutralMoved = 0;
  let frameOpaque = 0;
  let frameMoved = 0;
  let alphaChanged = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (out[i + 3] !== rgba[i + 3]) alphaChanged++;
      const inFrame = x < FRAME_PX || y < FRAME_PX || x >= w - FRAME_PX || y >= h - FRAME_PX;
      if (rgba[i + 3]! < 250) continue; // transparent: nothing the couple can see
      opaque++;
      if (inFrame) {
        frameOpaque++;
        if (moved(i) > 8) frameMoved++;
      }
      if (isWarmPixel(rgba[i]!, rgba[i + 2]!)) {
        warm++;
        if (moved(i) > 8) warmMoved++;
      } else {
        neutral++;
        if (moved(i) > 8) neutralMoved++;
      }
    }
  }
  return { opaque, warm, warmMoved, neutral, neutralMoved, frameOpaque, frameMoved, alphaChanged };
}

test('MB24: the migration serves the bride from public/, and names the row it repoints', async () => {
  assert.match(
    MB24.servedPath,
    /^\/moodboard-seed\//,
    `MB24 points the bride at "${MB24.servedPath}", which this app does not serve. The ` +
      'florals precedent (/moodboard-seed/florals/*.webp) is same-origin, needs no CORS ' +
      'negotiation, and is versioned with the code that reads it. An R2 re-upload is not ' +
      'the fallback: a same-key overwrite is served stale from browser caches and puts the ' +
      'artwork back outside the repo.',
  );
  assert.ok(
    MB24.servedPath.endsWith(MB24.matchedSuffix),
    `MB24 matches rows ending "${MB24.matchedSuffix}" but sets them to ` +
      `"${MB24.servedPath}". Those are different assets. One of the two is a typo, and ` +
      'whichever it is, this migration would repoint a row at a file that is not its own.',
  );
  assert.match(
    MB24.matchedSuffix,
    /figure_attire\/modern-minimalist\/bride\.svg$/,
    `MB24 is the modern-minimalist bride's migration, but it matches ` +
      `"${MB24.matchedSuffix}". \`bride_royal.svg\` and \`bridesmaids.svg\` are real rows ` +
      'one character away; this guard measures the bride and would be reporting on the ' +
      'wrong artwork.',
  );
  // Rasterising already proved the file exists; say so explicitly.
  const { rgba, w } = await brideRaster();
  assert.equal(w, MAX_PREVIEW_PX);
  assert.ok(
    rgba.length === MAX_PREVIEW_PX * MAX_PREVIEW_PX * 4,
    'the file MB24 names did not rasterise to a full frame',
  );
});

test('MB24: the surround is TRANSPARENT — there is no backdrop left to repaint', async () => {
  const { rgba, w, h } = await brideRaster();
  const alphaAt = (x: number, y: number) => rgba[(y * w + x) * 4 + 3]!;
  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [3, 3],
  ] as const) {
    assert.equal(
      alphaAt(x, y),
      0,
      `the re-cut bride has an OPAQUE pixel at (${x},${y}) — the full-canvas backdrop path ` +
        'is back in the SVG. That path is the whole defect: it is filled #ECEBE7, the same ' +
        'as the gown, so the couple\'s colour lands on the page behind her as well as on ' +
        'her dress. Remove it again; do not compensate with the tolerance, which cannot ' +
        'separate two identical colours.',
    );
  }

  let opaque = 0;
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3]! >= 250) opaque++;
  const coverage = opaque / (w * h);
  assert.ok(
    coverage < 0.45,
    `the re-cut bride covers ${(100 * coverage).toFixed(2)}% of the frame in opaque pixels; ` +
      `measured after the re-cut it is ${(100 * BRIDE.opaqueCoverage).toFixed(2)}%, and with ` +
      'the backdrop path reinstated it is 100%. Something behind her is opaque again.',
  );
});

test('MB24: the BACKGROUND never wears the palette', async () => {
  for (const hex of PALETTE) {
    const r = await recolourBride(hex);
    assert.equal(
      r.frameOpaque,
      0,
      `${r.frameOpaque} pixels in the ${FRAME_PX}px outer frame are opaque, so applying ` +
        `${hex} can repaint the card behind the figure (${r.frameMoved} of them move). The ` +
        'frame is where MB23 measured the bug; after the re-cut it must be empty.',
    );
    assert.equal(
      r.alphaChanged,
      0,
      'recolorRGBA wrote the alpha channel — it must never do that, and every ' +
        'transparency assertion in this file assumes it does not.',
    );
  }
});

test('MB24: the GOWN and its SHADING recolour', async () => {
  assert.ok(
    distance(BRIDE.gown, MB24.sampledHex) <= MB24.tolerance,
    `the gown (${BRIDE.gown}) is ΔE ${distance(BRIDE.gown, MB24.sampledHex).toFixed(1)} from ` +
      `${MB24.sampledHex} ± ${MB24.tolerance} and is not matched at all. "In your colors" ` +
      'would show the couple a stock-white dress.',
  );
  assert.ok(
    distance(BRIDE.farthestShading, MB24.sampledHex) <= MB24.tolerance,
    `the gown's deepest fold (${BRIDE.farthestShading}, ΔE ` +
      `${distance(BRIDE.farthestShading, MB24.sampledHex).toFixed(1)}) falls outside ` +
      `${MB24.sampledHex} ± ${MB24.tolerance}, so the folds keep their stock colour while ` +
      'the flat body turns the palette colour — a white dress with coloured trim, which is ' +
      'what a tolerance tightened "to be safe" produces. Her skin sits at ΔE ' +
      `${distance(BRIDE.skin, MB24.sampledHex).toFixed(1)}, so there is room to widen.`,
  );

  for (const hex of PALETTE) {
    const r = await recolourBride(hex);
    const share = r.neutralMoved / r.neutral;
    assert.ok(
      share > 0.85,
      `only ${(100 * share).toFixed(2)}% of the gown moves under ${hex} with ` +
        `${MB24.sampledHex} ± ${MB24.tolerance} (measured after the re-cut: 92.30%). A ` +
        'tolerance tightened until nothing matches passes every background assertion ' +
        'forever while the feature quietly stops working.',
    );
  }
});

test('MB24: nothing but attire recolours — her SKIN stays her skin', async () => {
  // The arithmetic rule. Her skin is the nearest non-attire colour to the slot,
  // so it is the ceiling on the tolerance — not the (now transparent) surround.
  const toSkin = distance(BRIDE.skin, MB24.sampledHex);
  assert.ok(
    toSkin > MB24.tolerance,
    `${MB24.sampledHex} ± ${MB24.tolerance} reaches her skin (${BRIDE.skin}, ΔE ` +
      `${toSkin.toFixed(1)}). Her shoulders, arms and face turn the couple's palette ` +
      'colour. Measured share of skin recoloured, by tolerance: 0.67% at ±16 · 1.64% at ' +
      '±20 · 67.49% at ±22 — it is a cliff, not a slope. Widen the range and you are ' +
      'painting the bride, not the dress.',
  );

  // And the raster proof, so the constant above cannot quietly go stale.
  for (const hex of PALETTE) {
    const r = await recolourBride(hex);
    const share = r.warmMoved / r.warm;
    assert.ok(
      share < 0.05,
      `${(100 * share).toFixed(2)}% of her skin moves under ${hex} with ` +
        `${MB24.sampledHex} ± ${MB24.tolerance}. Below ±21 the only warm pixels caught are ` +
        'the anti-aliased seam where gown meets arm (0.67% at ±16); anything approaching ' +
        'the flat fill means the tolerance has climbed past ΔE 20.8.',
    );
  }
});

test('MB24: the measured artwork constants are still true of the file', async () => {
  // Without this, every assertion above could be describing an asset that has
  // been redrawn — the same "fixture went on describing the old values" failure
  // a sabotage pass caught in MB23's first draft, one layer down.
  const { rgba, w, h } = await brideRaster();
  const counts = new Map<string, number>();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < 250) continue;
    const hex = `#${[rgba[i]!, rgba[i + 1]!, rgba[i + 2]!]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase();
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const frame = w * h;
  for (const [name, hex, minShare] of [
    ['gown', BRIDE.gown, 0.15],
    ['skin', BRIDE.skin, 0.015],
  ] as const) {
    const share = (counts.get(hex) ?? 0) / frame;
    assert.ok(
      share > minShare,
      `the measured ${name} colour ${hex} now covers ${(100 * share).toFixed(3)}% of the ` +
        `frame (expected >${(100 * minShare).toFixed(1)}%). The artwork has been redrawn, ` +
        'so every constant in BRIDE is describing a file that no longer exists. RE-MEASURE ' +
        'the raster — do not adjust a number here to make a red test green.',
    );
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB25 · THE FIRST TWO-SLOT ASSET — the Ceremony church aisle.
 *
 * Everything above this line is a ONE-slot figure: one region, one palette
 * colour, and the only question is whether the range bleeds into the file's own
 * background. The Ceremony drawing
 * (`public/moodboard-seed/venue_scene/church/ceremony-aisle.svg`, seeded by
 * migration 20271206413595) is the first asset in the library with TWO, and it
 * brings a failure mode one-slot assets cannot have: the two slots recolouring
 * each other's region, or collapsing into one.
 *
 * ── 🔑 THE TOLERANCES HERE ARE NOT CIELAB ΔE, AND THAT IS THE WHOLE POINT ───
 * MB25's brief specified the fabric tolerance from a CIELAB measurement of the
 * file: nearest neutral (the floor #D6D1C7) at ΔE 14.4, so "≤ 10 is safe".
 * `recolorRGBA` does not use CIELAB. `colorDistance` is a weighted-RGB
 * Euclidean proxy, and in it that same pair is 5.1 apart — so a tolerance of
 * 10, and even of 6, repaints EVERY floor pixel in the couple's second colour.
 * Measured 2026-09-05 on a real 520px raster: 3,158/3,158 exact floor pixels
 * turn at tolerance 6. The seeded value is 5 for that reason, not for caution.
 *
 * The lesson generalises: a tolerance is a number in the ENGINE'S metric. Never
 * transfer one from a ΔE measurement without re-measuring through this function.
 *
 * ── HOW THESE CONSTANTS WERE OBTAINED ───────────────────────────────────────
 * The fills are read straight out of the SVG (it has 326 flat `fill="rgb(…)"`
 * paths, no gradients and no rasters, so every region IS one exact byte
 * triple). The behaviour was then measured on the real artwork rasterised at
 * the component's own MAX_PREVIEW_PX:
 *
 *   rsvg-convert -w 520 -o out.png \
 *     apps/web/public/moodboard-seed/venue_scene/church/ceremony-aisle.svg
 *   magick out.png -depth 8 RGBA:out.rgba   # then push through recolorRGBA
 *
 * Result at the seeded values, both slots applied together (burgundy + gold):
 *   florals  5,094/5,094 exact px recolour      pews   0/26,958 move
 *   fabric  13,409/13,409 exact px recolour     walls  0/43,552 move
 *                                               floor  0/3,158  move
 *                                               white  0/64,981 move
 * ════════════════════════════════════════════════════════════════════════════
 */

const CEREMONY_MIGRATION = new URL(
  '../../../../../../../../supabase/migrations/20271206413595_mb25_ceremony_church_aisle_drawing_app_served.sql',
  import.meta.url,
);

type CeremonySlot = { slotId: number; sampledHex: string; tolerance: number; region: string };

/**
 * 🪤 PARSED FROM THE MIGRATION, NEVER RETYPED — the same trap MB23's sabotage
 * pass caught above. A guard carrying its own copy of the values it guards is
 * guarding the copy: edit the migration and this file must re-measure at once.
 */
function ceremonySlotsFromMigration(): CeremonySlot[] {
  const sql = readFileSync(CEREMONY_MIGRATION, 'utf8');
  const body = sql.slice(sql.indexOf('moodboard_asset_color_ranges'));
  const out: CeremonySlot[] = [];
  for (const m of body.matchAll(
    /\(\s*(\d+)::SMALLINT\s*,\s*'(#[0-9A-Fa-f]{6})'\s*,\s*(\d+)::NUMERIC\s*,\s*'([a-z]+)'\s*\)/g,
  )) {
    out.push({
      slotId: Number(m[1]),
      sampledHex: m[2]!.toUpperCase(),
      tolerance: Number(m[3]),
      region: m[4]!,
    });
  }
  return out;
}

const CEREMONY_SLOTS = ceremonySlotsFromMigration();

/**
 * MEASURED ARTWORK FACTS — the exact `fill="rgb(…)"` values in the SVG, with
 * the path count each covers. No migration can change these; only a re-cut of
 * the drawing can, and then they must be re-read from the file.
 */
const CEREMONY_ART = {
  florals: '#D98BA6', //  64 paths — altar arch, pew-end clusters
  fabric: '#E8D9B5', //  35 paths — aisle runner, pew ribbons, candle bases
  pews: '#8A6A4E', //  99 paths
  walls: '#F4F1EA', //  83 paths
  floor: '#D6D1C7', //   7 paths — the neutral nearest the fabric slot (5.1)
  white: '#FFFFFF', //   6 paths — window glass
} as const;

type CeremonyRegion = keyof typeof CEREMONY_ART;
const CEREMONY_NEUTRALS: CeremonyRegion[] = ['pews', 'walls', 'floor', 'white'];

/**
 * A six-band raster of the real fills — one horizontal band per region, run
 * through the SAME `recolorRGBA` the browser runs with the SAME rows the
 * database holds. Flat bands are a faithful stand-in here precisely BECAUSE the
 * artwork is flat: every region in this file is a single exact byte triple, so
 * there is no shading for a band to misrepresent (unlike the attire figures
 * above, whose `farthestTone` exists for exactly that reason).
 */
function renderCeremony(
  slots: ColorRangeSlot[],
  edits: Parameters<typeof recolorRGBA>[2],
): Record<CeremonyRegion, { moved: number; total: number; after: string }> {
  const bands = Object.keys(CEREMONY_ART) as CeremonyRegion[];
  const W = 8;
  const H = bands.length * 2;
  const src = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const [r, g, b] = hexToRgb(CEREMONY_ART[bands[Math.floor(y / 2)]!]);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      src[i] = r!;
      src[i + 1] = g!;
      src[i + 2] = b!;
      src[i + 3] = 255;
    }
  }
  const out = recolorRGBA(src, slots, edits);
  const result = {} as Record<CeremonyRegion, { moved: number; total: number; after: string }>;
  for (const [bandIndex, name] of bands.entries()) {
    let moved = 0;
    let total = 0;
    let after = '';
    for (let y = bandIndex * 2; y < bandIndex * 2 + 2; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        total++;
        if (out[i] !== src[i] || out[i + 1] !== src[i + 1] || out[i + 2] !== src[i + 2]) moved++;
        after = `#${[out[i]!, out[i + 1]!, out[i + 2]!]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('')}`;
      }
    }
    result[name] = { moved, total, after };
  }
  return result;
}

/** The seeded rows, in the shape the component passes to `recolorRGBA`. */
const ceremonyLiveSlots = (): ColorRangeSlot[] =>
  CEREMONY_SLOTS.map((s) => ({
    slotId: s.slotId,
    sampledHex: s.sampledHex,
    toleranceDe: s.tolerance,
    regionLabel: s.region,
  }));

test('ceremony-aisle: the migration seeds exactly two slots, one per recolourable region', () => {
  // Catches a dropped slot. With only slot 1 the card silently becomes a
  // one-colour scene — the runner and ribbons keep their stock cream while the
  // flowers turn, and nothing else in this file would notice.
  assert.deepEqual(
    CEREMONY_SLOTS.map((s) => `${s.slotId}:${s.region}`),
    ['1:florals', '2:fabric'],
    'migration 20271206413595 no longer seeds slot 1 = florals and slot 2 = fabric for the ' +
      'Ceremony aisle. moodboard-board.tsx maps slot N to the couple\'s Nth ceremony colour ' +
      '(`out[r.slotId] = palette[i % palette.length]`), so the slot NUMBERS are the colour ' +
      'order the couple chose — they are not free to renumber.',
  );
});

test('ceremony-aisle: each slot samples the region it claims', () => {
  // Catches the two sampled_hex values being swapped. Without this the swap is
  // still caught below (the fabric hex at tolerance 10 turns the floor), but it
  // is caught as "the floor moved" — which sends the next reader hunting for a
  // tolerance bug that is not there. This says what actually happened.
  for (const s of CEREMONY_SLOTS) {
    assert.equal(
      s.sampledHex,
      (CEREMONY_ART as Record<string, string>)[s.region]?.toUpperCase(),
      `slot ${s.slotId} is labelled '${s.region}' but samples ${s.sampledHex}, which is not ` +
        `that region's fill in the artwork (${(CEREMONY_ART as Record<string, string>)[s.region]}). ` +
        'If the two sampled_hex values were swapped, the couple\'s first ceremony colour lands ' +
        'on the aisle runner and their second on the flowers — the card is wrong in a way that ' +
        'still LOOKS recoloured. Re-read the fills from the SVG; do not adjust this test.',
    );
  }
});

test('ceremony-aisle: each slot recolours its OWN region and nothing else', () => {
  for (const s of CEREMONY_SLOTS) {
    for (const hex of PALETTE) {
      const bands = renderCeremony(ceremonyLiveSlots(), { [s.slotId]: { mode: 'palette', hex } });
      const own = bands[s.region as CeremonyRegion]!;
      assert.equal(
        own.moved,
        own.total,
        `slot ${s.slotId} (${s.region}, ${s.sampledHex} ± ${s.tolerance}) leaves ` +
          `${own.total - own.moved}/${own.total} of its own region at stock colour under ` +
          `${hex}. A tolerance tightened until the region stops matching passes every ` +
          '"the neutrals did not move" assertion forever while the Ceremony card quietly ' +
          'shows the couple nothing of their own.',
      );
      // The other slot's region must not follow along.
      const other = CEREMONY_SLOTS.find((o) => o.slotId !== s.slotId);
      if (other) {
        const theirs = bands[other.region as CeremonyRegion]!;
        assert.equal(
          theirs.moved,
          0,
          `applying ${hex} to slot ${s.slotId} (${s.region}) also moved ${theirs.moved}/` +
            `${theirs.total} of the ${other.region} region. The two ranges overlap, so the ` +
            'couple cannot give the flowers and the fabric different colours — they are one ' +
            'region wearing two labels. Re-sample; do not widen.',
        );
      }
    }
  }
});

test('ceremony-aisle: the walls, the floor and the pews move by NOTHING', () => {
  // 🔑 THE FLOOR IS THE ONE. #D6D1C7 sits 5.1 from the fabric slot in the
  // engine's own metric (CIELAB says 14.4 — see the header). At tolerance 6 the
  // whole floor turns; the seeded 5 is the only clean value, and this assertion
  // is what stops it drifting back up "because ΔE says there is room".
  for (const first of PALETTE) {
    for (const second of PALETTE) {
      const bands = renderCeremony(ceremonyLiveSlots(), {
        1: { mode: 'palette', hex: first },
        2: { mode: 'palette', hex: second },
      });
      for (const n of CEREMONY_NEUTRALS) {
        assert.equal(
          bands[n]!.moved,
          0,
          `the ${n} (${CEREMONY_ART[n]}) wear the palette: ${bands[n]!.moved}/` +
            `${bands[n]!.total} px moved with florals→${first}, fabric→${second}. Distances: ` +
            // Built by ITERATING the seeded slots, never by index. An earlier
            // draft read CEREMONY_SLOTS[1] here; assert's message argument is
            // evaluated eagerly, so with slot 2 dropped this line threw a
            // TypeError and the test reported "cannot read sampledHex" instead
            // of which neutral had turned. A guard whose failure message
            // crashes tells you about the guard, not about the data.
            CEREMONY_SLOTS.map(
              (s) =>
                `${n}→slot ${s.slotId} (${s.region}) = ` +
                `${distance(CEREMONY_ART[n], s.sampledHex).toFixed(1)} vs tolerance ${s.tolerance}`,
            ).join(', ') +
            '. ' +
            'A church whose stone turns burgundy is the same defect MB23 fixed on the attire ' +
            'figures. Fix the DATA in a migration on moodboard_asset_color_ranges — never ' +
            'special-case the asset in the component.',
        );
      }
    }
  }
});

test('ceremony-aisle: the two slots recolour INDEPENDENTLY', () => {
  // The assertion a one-slot asset cannot make. Two DIFFERENT palette colours
  // must land two DIFFERENT colours on the two regions; if a single range
  // covered both, or the board collapsed them, this is where it shows.
  const [a, b] = ['#7A1F2B', '#D4AF37'];
  const bands = renderCeremony(ceremonyLiveSlots(), {
    1: { mode: 'palette', hex: a },
    2: { mode: 'palette', hex: b },
  });
  assert.notEqual(
    bands.florals.after,
    bands.fabric.after,
    `the florals and the fabric both ended at ${bands.florals.after} when the couple asked ` +
      `for ${a} and ${b}. Their two ceremony colours have collapsed into one, so the card ` +
      'shows a scene they did not choose.',
  );
  // …and each landed the colour meant for IT, not the other one's.
  const soloFlorals = renderCeremony(ceremonyLiveSlots(), { 1: { mode: 'palette', hex: a } });
  const soloFabric = renderCeremony(ceremonyLiveSlots(), { 2: { mode: 'palette', hex: b } });
  assert.equal(
    bands.florals.after,
    soloFlorals.florals.after,
    'the florals region renders differently when the fabric slot is also edited — the two ' +
      'ranges are interfering, so what the couple sees on the flowers depends on what they ' +
      'chose for the runner.',
  );
  assert.equal(
    bands.fabric.after,
    soloFabric.fabric.after,
    'the fabric region renders differently when the florals slot is also edited — the two ' +
      'ranges are interfering.',
  );
});

test('ceremony-aisle: the harness can tell a bleeding tolerance from a clean one', () => {
  // Without this, every ceremony assertion above could be green because the
  // six-band raster never moves at all. This is the fabric tolerance MB25's
  // brief originally specified, and the reason it was not used: it paints the
  // floor AND the walls.
  const bled = renderCeremony(
    [
      { slotId: 1, sampledHex: CEREMONY_ART.florals, toleranceDe: 10, regionLabel: 'florals' },
      { slotId: 2, sampledHex: CEREMONY_ART.fabric, toleranceDe: 15, regionLabel: 'fabric' },
    ],
    { 1: { mode: 'palette', hex: '#7A1F2B' }, 2: { mode: 'palette', hex: '#D4AF37' } },
  );
  assert.ok(
    bled.floor.moved > 0 && bled.walls.moved > 0,
    'a fabric tolerance of 15 should repaint the floor and the walls, and this harness says ' +
      'it does not — the harness is wrong, not the data. (Measured on the real 520px raster: ' +
      'at 15, all 3,158 floor px and all 43,552 wall px turn.)',
  );
});

/**
 * ── AND NOW ON THE REAL PIXELS ──────────────────────────────────────────────
 *
 * The six-band harness above is a faithful stand-in for THIS artwork because
 * every region in it is one exact byte triple. But MB24 landed
 * `rasteriseFromPublic` in this same file, on the reasoning that an asset served
 * out of `public/` is on disk at test time and there is no excuse for a
 * stand-in — and the Ceremony aisle is served out of `public/` too. So the same
 * claims are re-made against the ACTUAL file, rasterised at the component's own
 * MAX_PREVIEW_PX and pushed through the real `recolorRGBA`.
 *
 * This catches two things flat bands cannot:
 *   • ANTIALIASED EDGE PIXELS. The rasteriser blends fabric into floor along the
 *     runner's edge, producing colours that exist in neither region. If a
 *     tolerance is wide enough to swallow that blend, the aisle grows a fringe
 *     the couple can see and the band harness cannot.
 *   • A REDRAWN REGION. The path counts are asserted by proxy: if the artwork is
 *     re-cut and a region moves or shrinks, its measured share moves with it.
 *
 * 🪤 The served path is PARSED from the migration, not retyped — so a migration
 * pointed at a file this app does not serve fails HERE, not in a couple's
 * browser.
 */
const CEREMONY_SERVED = (() => {
  const sql = readFileSync(CEREMONY_MIGRATION, 'utf8');
  const m = /'(\/moodboard-seed\/[^']+\.svg)'/.exec(sql);
  assert.ok(m, 'migration 20271206413595 no longer names an app-served /moodboard-seed path');
  return m[1]!;
})();

let ceremonyRasterCache: Raster | null = null;
async function ceremonyRaster(): Promise<Raster> {
  ceremonyRasterCache ??= await rasteriseFromPublic(CEREMONY_SERVED);
  return ceremonyRasterCache;
}

/**
 * Count, for each named fill, how many pixels hold it EXACTLY and how many of
 * those moved. Exact-match populations are the honest unit here: an antialiased
 * pixel belongs to no region, so counting it as one would let a fringe hide
 * inside a rounding argument. Fringe is measured separately, below.
 */
async function recolourCeremony(edits: Parameters<typeof recolorRGBA>[2]) {
  const { rgba } = await ceremonyRaster();
  const out = recolorRGBA(rgba, ceremonyLiveSlots(), edits);
  const stats = {} as Record<CeremonyRegion, { moved: number; total: number }>;
  for (const name of Object.keys(CEREMONY_ART) as CeremonyRegion[]) {
    const [r, g, b] = hexToRgb(CEREMONY_ART[name]);
    let moved = 0;
    let total = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i] === r && rgba[i + 1] === g && rgba[i + 2] === b) {
        total++;
        if (out[i] !== rgba[i] || out[i + 1] !== rgba[i + 1] || out[i + 2] !== rgba[i + 2]) moved++;
      }
    }
    stats[name] = { moved, total };
  }
  // Pixels that moved but hold NO named fill exactly — the antialiased blend.
  let fringe = 0;
  const exact = (i: number) =>
    (Object.values(CEREMONY_ART) as string[]).some((hex) => {
      const [r, g, b] = hexToRgb(hex);
      return rgba[i] === r && rgba[i + 1] === g && rgba[i + 2] === b;
    });
  for (let i = 0; i < rgba.length; i += 4) {
    if (out[i] !== rgba[i] || out[i + 1] !== rgba[i + 1] || out[i + 2] !== rgba[i + 2]) {
      if (!exact(i)) fringe++;
    }
  }
  // Denominator is the OPAQUE area, not the frame. `rasteriseFromPublic` fits a
  // 3:2 drawing into a 520x520 box, so ~35% of the frame is transparent padding
  // — measuring against it would make every share depend on the aspect ratio of
  // the artwork rather than on the artwork.
  let opaquePx = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]! > 0) opaquePx++;
  return { stats, fringe, opaque: opaquePx };
}

test('ceremony-aisle · REAL RASTER: both regions are actually present in the served file', async () => {
  // If the migration points at a file public/ does not serve, rasteriseFromPublic
  // throws here. If the artwork is re-cut and a region vanishes, this is where it
  // shows — before any tolerance claim is made about it.
  const { stats, opaque } = await recolourCeremony({});
  // Measured 2026-09-05 on the sharp raster, as a share of the OPAQUE area
  // (175,760 px). Floors sit ~25% below each measurement, so ordinary
  // rasteriser drift does not fire this but a re-cut region does:
  //   florals 2.90% · fabric 7.63% · pews 15.34% · walls 24.78% · floor 1.80%
  // These same exact-pixel counts reproduce independently under rsvg-convert
  // (5,094 / 13,409 / 26,958 / 43,552 / 3,158), which is why they are trusted.
  for (const [name, minShare] of [
    ['florals', 0.021],
    ['fabric', 0.057],
    ['pews', 0.115],
    ['walls', 0.185],
    ['floor', 0.013],
  ] as const) {
    const share = stats[name].total / opaque;
    assert.ok(
      share > minShare,
      `the ${name} fill (${CEREMONY_ART[name]}) now covers ${(100 * share).toFixed(2)}% of the ` +
        `opaque area, under the ${(100 * minShare).toFixed(1)}% floor this guard was measured ` +
        'against. ' +
        'The artwork has been re-cut, so every constant in CEREMONY_ART describes a file that no ' +
        'longer exists. RE-MEASURE the raster — do not adjust a number here to make a red test green.',
    );
  }
});

test('ceremony-aisle · REAL RASTER: the seeded ranges recolour both regions and no neutral', async () => {
  for (const [first, second] of [
    ['#7A1F2B', '#D4AF37'],
    ['#0F766E', '#7A1F2B'],
  ] as const) {
    const { stats } = await recolourCeremony({
      1: { mode: 'palette', hex: first },
      2: { mode: 'palette', hex: second },
    });
    for (const region of ['florals', 'fabric'] as const) {
      assert.equal(
        stats[region].moved,
        stats[region].total,
        `on the REAL raster, ${stats[region].total - stats[region].moved} of ` +
          `${stats[region].total} exact ${region} pixels kept their stock colour with ` +
          `florals→${first}, fabric→${second}.`,
      );
    }
    for (const n of CEREMONY_NEUTRALS) {
      assert.equal(
        stats[n].moved,
        0,
        `on the REAL raster, ${stats[n].moved} of ${stats[n].total} exact ${n} pixels ` +
          `(${CEREMONY_ART[n]}) wore the palette with florals→${first}, fabric→${second}. ` +
          'This is the MB23 defect on a venue scene. Fix the DATA in a migration.',
      );
    }
  }
});

test('ceremony-aisle · REAL RASTER: the recolour does not grow a fringe along the aisle', async () => {
  // The assertion the flat-band harness structurally cannot make. Antialiased
  // pixels along the runner's edge blend fabric into floor; a tolerance wide
  // enough to catch that blend paints a halo the couple sees. Some fringe is
  // correct and desirable — it is the region's own edge — so this is a CEILING,
  // not zero. Measured at the seeded values; ±15 on the fabric slot blows well
  // past it because the floor itself joins in.
  const { fringe, opaque } = await recolourCeremony({
    1: { mode: 'palette', hex: '#7A1F2B' },
    2: { mode: 'palette', hex: '#D4AF37' },
  });
  const share = fringe / opaque;
  assert.ok(
    share < 0.015,
    `${fringe} antialiased pixels (${(100 * share).toFixed(2)}% of the opaque area) recoloured — ` +
      'above the 1.5% ceiling. Measured at the seeded tolerances the fringe is 0.97% of the ' +
      'opaque area (1,709 px); raising the fabric slot to ±15 takes it to 4.60%. The ranges ' +
      'have widened far ' +
      'enough to catch the blend between a region and its neighbour, which reads as a halo ' +
      'around the arch or a fringe along the aisle runner.',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB14b · THE TEN DECOR LAYERS — ten ONE-slot cases, on the real rasters.
 *
 * The 2026-09-03 pilot generated ten venue scenes (backdrop × 5 style
 * families, ceiling × 5) and pointed them at `media.setnayan.com`, a host that
 * never resolved. MB26 retired all ten; MB14b's migration `20271207934361`
 * repoints them at `public/moodboard-seed/venue_scene/` and publishes them.
 * That makes them the first venue scenes a couple sees INSIDE THE RECEPTION
 * ROOM — composited by `renderVenueSvg` over the flat drawing — so they are
 * now exposed to exactly the defect this file was written for.
 *
 * ── WHY THEY ARE A HARDER CASE THAN THE CEREMONY AISLE ──────────────────────
 * The Ceremony drawing is flat: 326 paths, six exact fills, no gradients. These
 * ten are shaded AI vectors whose "region" is a family of tones around one
 * sampled colour, and whose background is a pale cream generated on purpose to
 * sit near-neutral. So "the background never wears the palette" cannot be
 * measured by band colours here — it has to be measured on the real raster,
 * and it has to distinguish three populations, not two:
 *
 *   • the EXACT background fill — the flat cream field. It must not move. At
 *     all. Zero pixels, on all ten files. This is the MB23 rule.
 *   • the BACKGROUND FAMILY (within ΔE 6 of that fill) — includes antialiased
 *     pixels along the region's own edge, which legitimately blend toward the
 *     region. Some movement here is correct; a lot is a halo. Ceiling, not zero.
 *   • the exact REGION fill — must move completely, or the couple's colour
 *     lands on part of the decor and leaves the rest at stock.
 *
 * ── 🔑 THE FINDING: ONE FILE'S MARGIN IS 0.6 ────────────────────────────────
 * `backdrop/elegant-simple-classic` samples #F7C680 and was generated on a
 * #ECE6DD background. Through the engine's own metric those are 15.6 apart,
 * and the seeded tolerance is 15. The margin is SIX TENTHS. It is outside — no
 * exact background pixel moves — but it is the reason `bgFamilyMoved` is 100 px
 * on that file and 0 on seven others, and it is why this guard pins the margin
 * itself rather than only the outcome. The next re-cut of that artwork, or any
 * widening of that tolerance, crosses the line.
 *
 * MB23's bride was the other side of this: her gown WAS her background (ΔE 0.0)
 * and no tolerance could separate them, so her range was deleted. None of these
 * ten is in that state — all ten are strictly outside — so all ten ship.
 *
 * 🪤 NOTHING BELOW IS RETYPED FROM AN ARTEFACT. The background colours come out
 * of `scripts/reception-decor-pilot-prompts.ts` (the generator's own input),
 * the slot values out of the seed migration, and the served path is DERIVED
 * from the seed's own storage_path using the replacement pair parsed out of
 * MB14b's migration — the same derivation the SQL performs. A guard that
 * retypes what it guards is guarding the copy.
 * ════════════════════════════════════════════════════════════════════════════
 */

const DECOR_SEED_MIGRATION = new URL(
  '../../../../../../../../supabase/migrations/20271194970382_moodboard_reception_decor_layers_pilot.sql',
  import.meta.url,
);
const DECOR_LIVE_MIGRATION = new URL(
  '../../../../../../../../supabase/migrations/20271207934361_mb14b_decor_pilot_live_app_served.sql',
  import.meta.url,
);
const DECOR_PROMPTS_SRC = new URL('../../../../../../scripts/reception-decor-pilot-prompts.ts', import.meta.url);

type DecorCase = {
  zone: 'backdrop' | 'ceiling';
  style: string;
  slug: string;
  servedPath: string;
  sampledHex: string;
  tolerance: number;
  region: string;
  /** The exact `background_color` handed to the generator for this cell. */
  background: string;
};

/** The `replace(storage_path, '<from>', '<to>')` MB14b's migration performs. */
function repointPair(): { from: string; to: string } {
  const sql = readFileSync(DECOR_LIVE_MIGRATION, 'utf8');
  const m = /replace\(storage_path,\s*'([^']+)',\s*'([^']+)'\)/s.exec(sql);
  assert.ok(m, 'migration 20271207934361 no longer derives the served path with replace() — if it now writes literal paths, this guard must read those instead of deriving them.');
  return { from: m[1]!, to: m[2]! };
}

function decorCases(): DecorCase[] {
  const seed = readFileSync(DECOR_SEED_MIGRATION, 'utf8');
  const prompts = readFileSync(DECOR_PROMPTS_SRC, 'utf8');
  const { from, to } = repointPair();

  // Generator background per (zone, style) — read out of DECOR_PROMPTS itself.
  const bg = new Map<string, string>();
  for (const m of prompts.matchAll(
    /zone:\s*'([a-z]+)',\s*\n\s*style:\s*'([^']+)',[\s\S]*?backgroundColor:\s*'(#[0-9A-Fa-f]{6})'/g,
  )) {
    bg.set(`${m[1]}/${m[2]}`, m[3]!.toUpperCase());
  }

  // Slot-1 tag per (zone, style) — read out of the seed migration's range INSERTs.
  const slot = new Map<string, { hex: string; tol: number; region: string }>();
  for (const m of seed.matchAll(
    /SELECT a\.asset_id, 1, '(#[0-9A-Fa-f]{6})', (\d+), '([^']+)'\s*\nFROM public\.moodboard_library_assets a\s*\nWHERE a\.asset_subtype = '([a-z]+)' AND a\.style_theme = '([^']+)'/g,
  )) {
    slot.set(`${m[4]}/${m[5]}`, { hex: m[1]!.toUpperCase(), tol: Number(m[2]), region: m[3]! });
  }

  // The rows themselves, in the seed's own order.
  const out: DecorCase[] = [];
  for (const m of seed.matchAll(
    /'(https:\/\/media\.setnayan\.com\/moodboard-library\/venue_scene\/(backdrop|ceiling)\/([a-z0-9-]+)\.svg)', 'higgsfield_generated', '([^']+)', NULL/g,
  )) {
    const zone = m[2] as 'backdrop' | 'ceiling';
    const key = `${zone}/${m[4]}`;
    const s = slot.get(key);
    const b = bg.get(key);
    assert.ok(s, `seed migration 20271194970382 has no slot-1 range for ${key}`);
    assert.ok(b, `scripts/reception-decor-pilot-prompts.ts has no backgroundColor for ${key}`);
    out.push({
      zone,
      style: m[4]!,
      slug: m[3]!,
      servedPath: m[1]!.replace(from, to),
      sampledHex: s.hex,
      tolerance: s.tol,
      region: s.region,
      background: b,
    });
  }
  return out;
}

const DECOR = decorCases();

test('MB14b: the ten decor rows parse out of their artefacts, five per zone', () => {
  // If this drops to nine, a later edit deleted a row from the seed and every
  // per-file assertion below silently stopped covering it.
  assert.equal(DECOR.length, 10, `expected ten decor-pilot cases, parsed ${DECOR.length}`);
  for (const zone of ['backdrop', 'ceiling'] as const) {
    assert.equal(
      DECOR.filter((d) => d.zone === zone).length,
      5,
      `expected five ${zone} decor scenes, one per style family`,
    );
  }
  for (const d of DECOR) {
    assert.match(
      d.servedPath,
      /^\/moodboard-seed\/venue_scene\/(backdrop|ceiling)\/[a-z0-9-]+\.svg$/,
      `${d.zone}/${d.style} derives to "${d.servedPath}", which this app does not serve.`,
    );
  }
});

/**
 * 🔑 THE PRE-CONDITION MB23's BRIDE FAILED. Before any pixel is rasterised: is
 * the region's colour even SEPARABLE from the background it was drawn on? Her
 * gown was #ECEBE7 on an #ECEBE7 backdrop — distance 0.0 — and no tolerance in
 * the allowed 5..30 range could pick one without the other. This asserts every
 * one of the ten is strictly outside, and reports the margin, because the
 * margin is what a future re-cut spends.
 */
test('MB14b: every decor slot is strictly OUTSIDE its own generated background', () => {
  const margins = DECOR.map((d) => {
    const [sr, sg, sb] = hexToRgb(d.sampledHex);
    const [br, bg2, bb] = hexToRgb(d.background);
    return { d, dist: distance(d.sampledHex, d.background), margin: distance(d.sampledHex, d.background) - d.tolerance, sr, sg, sb, br, bg2, bb };
  });
  for (const m of margins) {
    assert.ok(
      m.margin > 0,
      `${m.d.zone}/${m.d.style} samples ${m.d.sampledHex} at tolerance ${m.d.tolerance}, but its own ` +
        `generated background ${m.d.background} is only ${m.dist.toFixed(1)} away in the engine's ` +
        'metric — INSIDE the range. This is MB23\'s bride disease on a venue scene: the couple\'s ' +
        'colour lands on the whole panel, background included. Do not widen or narrow a number ' +
        'here. Leave this row RETIRED in the migration and drop the expected count from 10 to 9, ' +
        'exactly as MB23 deleted the bride\'s false range rather than inventing a tolerance.',
    );
  }
  // The thinnest margin, pinned. Measured 2026-09-05:
  //   backdrop/elegant-simple-classic  #F7C680 → #ECE6DD  15.6 vs tol 15  = 0.6
  // Everything else is 5.5 or wider. If this floor moves DOWN, a re-cut or a
  // tolerance edit has eaten the only margin the pilot has left.
  const thinnest = margins.reduce((a, b) => (a.margin <= b.margin ? a : b));
  assert.equal(
    `${thinnest.d.zone}/${thinnest.d.slug}`,
    'backdrop/elegant-simple-classic',
    `the thinnest slot-to-background margin has moved to ${thinnest.d.zone}/${thinnest.d.slug} ` +
      `(${thinnest.margin.toFixed(1)}). It was backdrop/elegant-simple-classic at 0.6. Re-measure ` +
      'before trusting any tolerance in this set.',
  );
  assert.ok(
    thinnest.margin >= 0.5,
    `the thinnest margin is now ${thinnest.margin.toFixed(2)}, below the 0.5 floor this pilot ` +
      'was measured at (0.6). The generated cream backgrounds and the sampled regions have ' +
      'drifted together far enough that antialiasing alone will start repainting the panel.',
  );
});

const decorRasterCache = new Map<string, Raster>();
async function decorRaster(servedPath: string): Promise<Raster> {
  let r = decorRasterCache.get(servedPath);
  if (!r) {
    r = await rasteriseFromPublic(servedPath);
    decorRasterCache.set(servedPath, r);
  }
  return r;
}

/**
 * Recolour one decor scene's REAL raster with one palette colour in its single
 * slot, and split the opaque pixels into the three populations the header
 * describes.
 */
async function recolourDecor(d: DecorCase, hex: string) {
  const { rgba } = await decorRaster(d.servedPath);
  const slots: ColorRangeSlot[] = [
    { slotId: 1, sampledHex: d.sampledHex, toleranceDe: d.tolerance, regionLabel: d.region },
  ];
  const out = recolorRGBA(rgba, slots, { 1: { mode: 'palette', hex } });
  const [sr, sg, sb] = hexToRgb(d.sampledHex);
  const [br, bg2, bb] = hexToRgb(d.background);
  let opaque = 0;
  let regionExact = 0;
  let regionMoved = 0;
  let bgExact = 0;
  let bgExactMoved = 0;
  let bgFamily = 0;
  let bgFamilyMoved = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < 250) continue; // transparent padding from `fit: contain`
    opaque++;
    const moved =
      out[i] !== rgba[i] || out[i + 1] !== rgba[i + 1] || out[i + 2] !== rgba[i + 2];
    if (rgba[i] === sr && rgba[i + 1] === sg && rgba[i + 2] === sb) {
      regionExact++;
      if (moved) regionMoved++;
    }
    if (rgba[i] === br && rgba[i + 1] === bg2 && rgba[i + 2] === bb) {
      bgExact++;
      if (moved) bgExactMoved++;
    }
    if (distance(
      `#${[rgba[i]!, rgba[i + 1]!, rgba[i + 2]!].map((n) => n.toString(16).padStart(2, '0')).join('')}`,
      d.background,
    ) <= 6) {
      bgFamily++;
      if (moved) bgFamilyMoved++;
    }
  }
  return { opaque, regionExact, regionMoved, bgExact, bgExactMoved, bgFamily, bgFamilyMoved };
}

test('MB14b · REAL RASTER: every decor file is served, and its tagged region is really in it', async () => {
  for (const d of DECOR) {
    // rasteriseFromPublic throws if the migration's path has no file behind it,
    // which is the failure a SQL-only guard structurally cannot see.
    const { regionExact, opaque } = await recolourDecor(d, '#7A1F2B');
    // Measured 2026-09-05 as a share of the OPAQUE area. The smallest is
    // backdrop/tropical-heritage at 16.6%; the floor is set well under every
    // measurement so rasteriser drift does not fire it but a re-cut does.
    const share = regionExact / opaque;
    assert.ok(
      share > 0.1,
      `${d.zone}/${d.style}: the tagged region ${d.sampledHex} covers ${(100 * share).toFixed(2)}% ` +
        'of the opaque area, under the 10% floor this guard was measured against (16.6%–44.7%). ' +
        'The artwork has been re-cut and the seeded sample no longer describes it. RE-MEASURE ' +
        'with scripts/verify-decor-pilot-colors.mjs — do not adjust a number here.',
    );
  }
});

test('MB14b · REAL RASTER: the tagged region recolours COMPLETELY, on all ten', async () => {
  for (const hex of ['#7A1F2B', '#0F766E'] as const) {
    for (const d of DECOR) {
      const { regionExact, regionMoved } = await recolourDecor(d, hex);
      assert.equal(
        regionMoved,
        regionExact,
        `${d.zone}/${d.style}: ${regionExact - regionMoved} of ${regionExact} exact ` +
          `${d.region} pixels kept their stock colour with the slot set to ${hex}. Half a ` +
          'recoloured decor panel is worse than none — the couple sees their colour next to ' +
          'the pilot\'s stock colour and reads it as a rendering bug.',
      );
    }
  }
});

test('MB14b · REAL RASTER: the background field moves by NOTHING, on all ten', async () => {
  // The MB23 rule, on the ten hardest files we have. `bgExact` is the flat
  // generated cream field — the "page behind the figure" of this asset class.
  for (const hex of ['#7A1F2B', '#0F766E'] as const) {
    for (const d of DECOR) {
      const { bgExact, bgExactMoved } = await recolourDecor(d, hex);
      assert.ok(bgExact > 0, `${d.zone}/${d.style}: no pixel holds the generated background ${d.background} exactly — the artwork was re-cut and this guard is measuring nothing.`);
      assert.equal(
        bgExactMoved,
        0,
        `${d.zone}/${d.style}: ${bgExactMoved} of ${bgExact} exact background pixels ` +
          `(${d.background}) wore the palette with the slot set to ${hex}. This is the MB23 ` +
          'defect — the couple\'s colour on the panel behind the decor, not on the decor. Fix ' +
          'the DATA in a migration, or leave this row retired; never widen the assertion.',
      );
    }
  }
});

test('MB14b · REAL RASTER: the antialiased fringe stays under its measured ceiling', async () => {
  // The population between the two above: pixels within ΔE 6 of the background
  // that are NOT the exact fill — the blend along the region's own edge. Some
  // movement is correct (it IS the edge); a lot is a halo around the whole
  // panel. Measured 2026-09-05, as a share of each file's background family:
  //   backdrop/elegant-simple-classic  100/114,912 = 0.087%   ← the 0.6 margin
  //   ceiling/tropical-heritage         97/100,902 = 0.096%
  //   backdrop/tropical-heritage        23/129,556 = 0.018%
  //   the other seven                            0 = 0.000%
  for (const d of DECOR) {
    const { bgFamily, bgFamilyMoved } = await recolourDecor(d, '#7A1F2B');
    const share = bgFamilyMoved / bgFamily;
    assert.ok(
      share < 0.005,
      `${d.zone}/${d.style}: ${bgFamilyMoved} of ${bgFamily} near-background pixels ` +
        `(${(100 * share).toFixed(3)}%) recoloured — above the 0.5% ceiling. Measured at the ` +
        'seeded values the worst file is 0.096%, so this is a ~50x jump: the range has widened ' +
        'far enough to catch the blend between the decor and the panel behind it, which reads ' +
        'as a halo around the whole backdrop.',
    );
  }
});

test('MB14b: the decor harness can tell a bleeding tolerance from a clean one', async () => {
  // Without this, every assertion above could be green because the harness
  // cannot see a background move at all. `backdrop/elegant-simple-classic` is
  // the right probe precisely BECAUSE its margin is 0.6: widening its tolerance
  // from the seeded 15 to 25 puts its own background (15.6 away) inside the
  // range, and the whole cream field must turn.
  const d = DECOR.find((x) => x.zone === 'backdrop' && x.slug === 'elegant-simple-classic');
  assert.ok(d, 'backdrop/elegant-simple-classic is no longer in the pilot set');
  const { rgba } = await decorRaster(d.servedPath);
  const bleeding: ColorRangeSlot[] = [
    { slotId: 1, sampledHex: d.sampledHex, toleranceDe: 25, regionLabel: d.region },
  ];
  const out = recolorRGBA(rgba, bleeding, { 1: { mode: 'palette', hex: '#7A1F2B' } });
  const [br, bg2, bb] = hexToRgb(d.background);
  let bgExact = 0;
  let bgMoved = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < 250) continue;
    if (rgba[i] === br && rgba[i + 1] === bg2 && rgba[i + 2] === bb) {
      bgExact++;
      if (out[i] !== rgba[i] || out[i + 1] !== rgba[i + 1] || out[i + 2] !== rgba[i + 2]) bgMoved++;
    }
  }
  assert.equal(
    bgMoved,
    bgExact,
    `widening backdrop/elegant-simple-classic to ±25 moved only ${bgMoved} of ${bgExact} ` +
      'background pixels. It must move ALL of them — its background is 15.6 away. If it does ' +
      'not, this harness cannot see a background bleed and every assertion above is vacuous.',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB28 · THE SAME CLAIMS, ON NINE CEREMONY SCENES INSTEAD OF ONE.
 *
 * MB25's church is guarded above. Migration `20271208519468` seeds the other
 * EIGHT `events.ceremony_venue_setting` values as their own two-slot drawings,
 * so the Ceremony card can show a couple the place they are actually marrying.
 * Everything the church section asserts is re-asserted here per file, on the
 * REAL raster: each slot recolours its own region completely, the two do not
 * touch each other, and every neutral field moves by NOTHING — including the
 * ones the church does not have: sky, sea, sand, lawn, foliage, driftwood.
 *
 * ── 🔑 EVERY TOLERANCE IN THE MIGRATION IS TIGHTER THAN ITS BRIEF SAID ──────
 * MB28's brief carried per-file ceilings measured in CIELAB ΔE (8..15). The
 * engine is not CIELAB — `colorDistance` is a weighted-RGB proxy, the point
 * MB25 made and paid for — and re-measured through it, EVERY ceiling was too
 * wide. The seeded fabric values are 5..10 and each is the LARGEST INTEGER AT
 * WHICH NO NEUTRAL MOVES; one step higher and a measured field turns. That is
 * asserted below, per file, in both directions.
 *
 * ── ⚠ AS SHIPPED, THE BEACH HAD FIFTEEN RANGES' WORTH OF SLOTS, NOT SIXTEEN ──
 * The beach arch was DRIFTWOOD, #DDD6C8, and it sat 3.536 from the fabric slot
 * in the engine's metric. `moodboard_asset_color_ranges` CHECKs
 * `tolerance_de BETWEEN 5 AND 30`, so the tightest LEGAL tolerance was 5 — and
 * at 5 the whole arch would have turned the couple's second colour. There was
 * no legal value that separated the drapes from the trees, so the beach
 * shipped slot 1 only, exactly as MB23 deleted the modern-minimalist bride's
 * false range rather than inventing a tolerance for it. This was surfaced as
 * an owner decision, not silently worked around.
 *
 * The brief called #DDD6C8 "the sand". It was not — the sand is #B8B2A6, a
 * comfortable 15.8 away. The 2026-09-06 oversight round could not have caught
 * this, because every candidate was judged on a simulated recolour performed by
 * EXACT FILL SWAP, and a fill swap structurally cannot show a tolerance
 * bleeding into a neighbouring colour.
 *
 * 🔑 MB28b RE-CUT THE DRIFTWOOD AND SEEDED THE SLOT. Both halves stay here on
 * purpose — the history is why the seeded tolerance (5, the legal floor) is
 * measured against the sky rather than invented outright. `MB28` below already
 * carries the beach with two slots; see the MB28b section near the end of this
 * file for the re-cut's own migration, parse, and boundary test.
 *
 * ── HOW THE CONSTANTS BELOW WERE OBTAINED ───────────────────────────────────
 *   node -e "…"  # sharp → 520px raster → exact-fill census → recolorRGBA
 * Every share is a fraction of the OPAQUE area (~175,760 px of the 520×520
 * frame; the rest is the letterbox `fit: 'contain'` adds to a 3:2 drawing).
 * If the artwork is re-cut, RE-MEASURE — do not adjust a number here to make a
 * red test green.
 * ════════════════════════════════════════════════════════════════════════════
 */

const MB28_MIGRATION = new URL(
  '../../../../../../../../supabase/migrations/20271208519468_mb28_ceremony_settings_eight_venue_scenes.sql',
  import.meta.url,
);

type Mb28Slot = { slotId: number; sampledHex: string; tolerance: number; region: string };
type Mb28Scene = { setting: string; servedPath: string; slots: Mb28Slot[] };

/**
 * 🪤 DERIVED FROM THE MIGRATION, NEVER RETYPED — including the served path,
 * which the SQL builds by concatenation (`'…/' || v.setting || '/…svg'`). This
 * reproduces that concatenation from the migration's own literals, the same way
 * MB14b's `repointPair()` reproduces its `replace()`. A migration pointed at a
 * file this app does not serve therefore fails HERE, not in a couple's browser.
 */
function mb28Scenes(): Mb28Scene[] {
  const sql = stripComments(readFileSync(MB28_MIGRATION, 'utf8'));
  const path = /'(\/moodboard-seed\/venue_scene\/)'\s*\|\|\s*v\.setting\s*\|\|\s*'(\/[a-z-]+\.svg)'/.exec(sql);
  assert.ok(
    path,
    'migration 20271208519468 no longer builds the served path from the setting. If it now ' +
      'writes literal paths, this guard must read those instead of deriving them.',
  );
  const bySetting = new Map<string, Mb28Scene>();
  for (const m of sql.matchAll(
    /\(\s*'([a-z_]+)',\s*(\d+)::SMALLINT\s*,\s*'(#[0-9A-Fa-f]{6})'\s*,\s*(\d+)::NUMERIC\s*,\s*'([a-z]+)'\s*\)/g,
  )) {
    const setting = m[1]!;
    let scene = bySetting.get(setting);
    if (!scene) {
      scene = { setting, servedPath: `${path[1]}${setting}${path[2]}`, slots: [] };
      bySetting.set(setting, scene);
    }
    scene.slots.push({
      slotId: Number(m[2]),
      sampledHex: m[3]!.toUpperCase(),
      tolerance: Number(m[4]),
      region: m[5]!,
    });
  }
  for (const s of bySetting.values()) s.slots.sort((a, b) => a.slotId - b.slotId);
  return [...bySetting.values()];
}

/**
 * MB28b's migration, one range: the beach's fabric slot, seeded after the
 * driftwood re-cut. Same parse-don't-retype rule as `mb28Scenes` above.
 */
const MB28B_MIGRATION = new URL(
  '../../../../../../../../supabase/migrations/20271209690679_mb28b_beach_ceremony_fabric_slot_seeded_after_driftwood_recut.sql',
  import.meta.url,
);

function mb28bBeachFabricSlot(): Mb28Slot {
  const sql = stripComments(readFileSync(MB28B_MIGRATION, 'utf8'));
  const m = /SELECT\s+a\.asset_id,\s*(\d+)::SMALLINT,\s*'(#[0-9A-Fa-f]{6})',\s*(\d+)::NUMERIC,\s*'([a-z]+)'/.exec(
    sql,
  );
  assert.ok(
    m,
    'migration 20271209690679 no longer inserts a colour range for the beach — this guard ' +
      'watches nothing',
  );
  return {
    slotId: Number(m![1]),
    sampledHex: m![2]!.toUpperCase(),
    tolerance: Number(m![3]),
    region: m![4]!,
  };
}

/**
 * MB28's eight scenes, with the beach's MB28b fabric slot folded in — so every
 * generic MB28 assertion below (own region moves, neutrals don't, no
 * sampled_hex swap, no fringe) runs on the beach exactly like the other seven,
 * without a single beach-shaped exception in the test bodies themselves.
 */
const MB28 = mb28Scenes();
{
  const beach = MB28.find((s) => s.setting === 'beach');
  assert.ok(beach, 'MB28 no longer seeds a beach ceremony drawing');
  beach!.slots.push(mb28bBeachFabricSlot());
  beach!.slots.sort((a, b) => a.slotId - b.slotId);
}

/**
 * MEASURED ARTWORK FACTS — every exact `fill="rgb(…)"` that covers ≥0.2% of
 * the opaque area, with the share it covered on 2026-09-06 and what it draws.
 * No migration can change these; only a re-cut of a drawing can, and then they
 * must be re-read from the file.
 *
 * The `neutrals` of a scene are simply every named fill that is not one of its
 * two slot colours. They are listed by NAME because a failure that says "the
 * sea wore the palette" is a bug report and one that says "#7FA6A8 moved" is a
 * puzzle.
 */
const MB28_ART: Record<string, { fills: Record<string, string>; shares: Record<string, number> }> = {
  ancestral_house: {
    fills: {
      white: '#FFFFFF',
      hardwood: '#6B4A32',
      ceiling: '#F4F1EA',
      capiz: '#D6D1C7',
      florals: '#D98BA6',
      fabric: '#E8D9B5',
    },
    shares: { white: 0.2893, hardwood: 0.2446, ceiling: 0.1518, capiz: 0.1147, florals: 0.0360, fabric: 0.1007 },
  },
  beach: {
    fills: {
      white: '#FFFFFF',
      sand: '#B8B2A6',
      shore: '#E3EBEE',
      sea: '#7FA6A8',
      // MB28b re-cut the driftwood arch from #DDD6C8 (3.5 from the fabric slot,
      // unseedable) to #ACA8A0 (19.8 away) so slot 2 could be seeded. See the
      // MB28b section below.
      driftwood: '#ACA8A0',
      florals: '#D98BA6',
      fabric: '#E8D9B5',
    },
    shares: { white: 0.5356, sand: 0.1307, shore: 0.0918, sea: 0.0661, driftwood: 0.0129, florals: 0.0199, fabric: 0.0324 },
  },
  chapel: {
    fills: { white: '#FFFFFF', pews: '#8A6A4E', walls: '#F4F1EA', floor: '#D6D1C7', florals: '#D98BA6', fabric: '#E8D9B5' },
    shares: { white: 0.4695, pews: 0.1461, walls: 0.1038, floor: 0.0060, florals: 0.0898, fabric: 0.1135 },
  },
  civil_registrar: {
    fills: {
      white: '#FFFFFF',
      walls: '#F4F1EA',
      floor: '#D6D1C7',
      windows: '#9A948A',
      trim: '#BCBBBA',
      florals: '#D98BA6',
      fabric: '#E8D9B5',
    },
    shares: { white: 0.3033, walls: 0.3014, floor: 0.1427, windows: 0.0137, trim: 0.0021, florals: 0.0046, fabric: 0.1051 },
  },
  garden: {
    fills: { chairs: '#FFFFFF', lawn: '#8FA98A', foliage: '#A8BC9E', shrubs: '#E3EBEE', florals: '#D98BA6', fabric: '#E8D9B5' },
    shares: { chairs: 0.4496, lawn: 0.2448, foliage: 0.0848, shrubs: 0.0245, florals: 0.0193, fabric: 0.0653 },
  },
  hotel_venue: {
    fills: { walls: '#F4F1EA', chairs: '#FFFFFF', floor: '#A9A49B', chandelier: '#CFCBC2', florals: '#D98BA6', fabric: '#E8D9B5' },
    shares: { walls: 0.5072, chairs: 0.1806, floor: 0.0506, chandelier: 0.0028, florals: 0.0185, fabric: 0.1067 },
  },
  mosque: {
    fills: {
      walls: '#F4F1EA',
      white: '#FFFFFF',
      floor: '#CFCBC2',
      lattice: '#FEFEFE',
      glass: '#FDFDFD',
      florals: '#D98BA6',
      fabric: '#E8D9B5',
    },
    shares: { walls: 0.3003, white: 0.2545, floor: 0.1427, lattice: 0.0038, glass: 0.0020, florals: 0.0490, fabric: 0.1000 },
  },
  temple: {
    fills: { white: '#FFFFFF', walls: '#F4F1EA', pillars: '#5E4634', florals: '#D98BA6', fabric: '#E8D9B5' },
    shares: { white: 0.3374, walls: 0.2869, pillars: 0.1539, florals: 0.0506, fabric: 0.1116 },
  },
};

/**
 * The antialiased-blend ceiling, per file, as a share of the OPAQUE area.
 *
 * 🪤 THIS IS NOT ONE NUMBER FOR NINE FILES, AND IT MUST NOT BECOME ONE. The
 * church is a FLAT drawing (six exact fills, no shading), so almost everything
 * outside its named fills is genuine antialiasing and 1.5% is a real ceiling.
 * These eight are shaded AI vectors whose florals and fabric carry their own
 * tone families — legitimately recoloured — so their "fringe" is structurally
 * larger and differs per drawing. Measured 2026-09-06 at the seeded tolerances
 * with florals→#7A1F2B and fabric→#D4AF37; each ceiling is that measurement
 * rounded up to the next half point.
 */
const MB28_FRINGE_CEILING: Record<string, number> = {
  ancestral_house: 0.02, // measured 1.36%
  // Re-measured after MB28b seeded slot 2 (florals-only was 0.66%): the fabric
  // slot's own antialiased edge (drapes/sashes against sand and shore) adds to
  // the fringe, same as every other two-slot scene below.
  beach: 0.015, //          measured 0.96%
  chapel: 0.01, //          measured 0.64%
  civil_registrar: 0.015, // measured 0.86%
  garden: 0.05, //          measured 4.35%
  hotel_venue: 0.03, //     measured 2.26%
  mosque: 0.03, //          measured 2.59%
  temple: 0.025, //         measured 1.73%
};

const mb28RasterCache = new Map<string, Raster>();
async function mb28Raster(scene: Mb28Scene): Promise<Raster> {
  let r = mb28RasterCache.get(scene.servedPath);
  if (!r) {
    r = await rasteriseFromPublic(scene.servedPath);
    mb28RasterCache.set(scene.servedPath, r);
  }
  return r;
}

const liveSlots = (scene: Mb28Scene): ColorRangeSlot[] =>
  scene.slots.map((s) => ({
    slotId: s.slotId,
    sampledHex: s.sampledHex,
    toleranceDe: s.tolerance,
    regionLabel: s.region,
  }));

/**
 * Recolour one scene's real raster and split the opaque pixels by NAMED fill.
 *
 * `others` is the population that matters most and that no hand-typed list can
 * cover: every exact fill holding ≥0.2% of the opaque area that MB28_ART does
 * NOT name. A re-cut that introduces a region — or a name this file forgot —
 * lands there, and it must not move either.
 */
async function recolourScene(
  scene: Mb28Scene,
  edits: Parameters<typeof recolorRGBA>[2],
  slots: ColorRangeSlot[] = liveSlots(scene),
) {
  const { rgba } = await mb28Raster(scene);
  const out = recolorRGBA(rgba, slots, edits);
  const art = MB28_ART[scene.setting]!;
  const byName = Object.entries(art.fills).map(([name, hex]) => ({ name, hex, rgb: hexToRgb(hex) }));

  const stats: Record<string, { moved: number; total: number }> = {};
  for (const { name } of byName) stats[name] = { moved: 0, total: 0 };

  const census = new Map<string, { n: number; moved: number }>();
  let opaque = 0;
  let fringe = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < 250) continue;
    opaque++;
    const moved = out[i] !== rgba[i] || out[i + 1] !== rgba[i + 1] || out[i + 2] !== rgba[i + 2];
    const hit = byName.find(
      (c) => rgba[i] === c.rgb[0] && rgba[i + 1] === c.rgb[1] && rgba[i + 2] === c.rgb[2],
    );
    if (hit) {
      stats[hit.name]!.total++;
      if (moved) stats[hit.name]!.moved++;
      continue;
    }
    if (moved) fringe++;
    const key = `#${[rgba[i]!, rgba[i + 1]!, rgba[i + 2]!]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
    const c = census.get(key) ?? { n: 0, moved: 0 };
    c.n++;
    if (moved) c.moved++;
    census.set(key, c);
  }
  const others = [...census.entries()]
    .filter(([, c]) => c.n / opaque >= 0.002)
    .map(([hex, c]) => ({ hex, ...c }));
  return { stats, others, fringe, opaque };
}

/** The two slot colours' names inside MB28_ART, and everything else. */
const SLOT_NAMES = ['florals', 'fabric'] as const;
const neutralNames = (setting: string) =>
  Object.keys(MB28_ART[setting]!.fills).filter(
    (n) => !(SLOT_NAMES as readonly string[]).includes(n),
  );

test('MB28+MB28b: the migrations together seed a drawing for every ceremony setting, two slots each', () => {
  assert.equal(
    MB28.length,
    8,
    `expected the migration to seed eight ceremony settings beside MB25's church, parsed ` +
      `${MB28.length}: ${MB28.map((s) => s.setting).join(', ')}. A setting with no drawing ` +
      'falls back to the church silently — nothing anywhere reports it.',
  );
  assert.deepEqual(
    MB28.map((s) => s.setting).sort(),
    Object.keys(MB28_ART).sort(),
    'the settings seeded by the migration and the settings measured in MB28_ART have ' +
      'diverged. Every assertion below is keyed on that name, so an unmatched setting is a ' +
      'file nothing in here covers.',
  );
  const ranges = MB28.reduce((n, s) => n + s.slots.length, 0);
  assert.equal(
    ranges,
    16,
    `MB28 + MB28b together seed ${ranges} colour ranges across eight drawings. It must be ` +
      '16: two each, now including the beach — MB28b re-cut its driftwood arch (was 3.5 from ' +
      "the fabric slot, unseedable at the table's CHECK floor of 5) and seeded slot 2 at 5, " +
      'the same value the church uses. See the MB28b section below.',
  );
  for (const scene of MB28) {
    assert.deepEqual(
      scene.slots.map((s) => `${s.slotId}:${s.region}`),
      ['1:florals', '2:fabric'],
      `${scene.setting} no longer seeds slot 1 = florals and slot 2 = fabric. ` +
        "moodboard-board.tsx maps slot N to the couple's Nth ceremony colour " +
        "(`out[r.slotId] = palette[i % palette.length]`), so the slot NUMBERS are the colour " +
        'order the couple chose — they are not free to renumber.',
    );
  }
});

test('MB28: each slot samples the region it claims, in its own file', () => {
  // Catches two sampled_hex being swapped between files, or a slot pointed at a
  // colour that is not in the drawing at all. Both leave a card that still
  // LOOKS recoloured while painting the wrong thing.
  for (const scene of MB28) {
    const art = MB28_ART[scene.setting]!;
    for (const s of scene.slots) {
      assert.equal(
        s.sampledHex,
        art.fills[s.region]?.toUpperCase(),
        `${scene.setting} slot ${s.slotId} is labelled '${s.region}' but samples ` +
          `${s.sampledHex}, which is not that region's fill in the artwork ` +
          `(${art.fills[s.region]}). If the two sampled_hex were swapped, the couple's first ` +
          'ceremony colour lands on the aisle runner and their second on the flowers.',
      );
    }
  }
});

test('MB28 · REAL RASTER: every named region is actually present in the served file', async () => {
  // rasteriseFromPublic throws if the migration's path has no file behind it —
  // the failure a SQL-only guard structurally cannot see. Floors sit ~25% under
  // each 2026-09-06 measurement, so rasteriser drift does not fire this but a
  // re-cut region does.
  for (const scene of MB28) {
    const { stats, opaque } = await recolourScene(scene, {});
    for (const [name, measured] of Object.entries(MB28_ART[scene.setting]!.shares)) {
      const floor = measured * 0.75;
      const share = stats[name]!.total / opaque;
      assert.ok(
        share > floor,
        `${scene.setting}: the ${name} fill (${MB28_ART[scene.setting]!.fills[name]}) now ` +
          `covers ${(100 * share).toFixed(2)}% of the opaque area, under the ` +
          `${(100 * floor).toFixed(2)}% floor measured for it (${(100 * measured).toFixed(2)}%). ` +
          'The artwork has been re-cut, so every constant in MB28_ART describes a file that ' +
          'no longer exists. RE-MEASURE — do not adjust a number here to make a red test green.',
      );
    }
  }
});

test('MB28 · REAL RASTER: each slot recolours its OWN region and nothing else', async () => {
  for (const scene of MB28) {
    for (const s of scene.slots) {
      for (const hex of PALETTE) {
        const { stats } = await recolourScene(scene, { [s.slotId]: { mode: 'palette', hex } });
        const own = stats[s.region]!;
        assert.equal(
          own.moved,
          own.total,
          `${scene.setting}: slot ${s.slotId} (${s.region}, ${s.sampledHex} ± ${s.tolerance}) ` +
            `leaves ${own.total - own.moved}/${own.total} of its own region at stock colour ` +
            `under ${hex}. A tolerance tightened until the region stops matching passes every ` +
            '"the neutrals did not move" assertion forever while the Ceremony card quietly ' +
            'shows the couple nothing of their own.',
        );
        for (const other of scene.slots) {
          if (other.slotId === s.slotId) continue;
          const theirs = stats[other.region]!;
          assert.equal(
            theirs.moved,
            0,
            `${scene.setting}: applying ${hex} to slot ${s.slotId} (${s.region}) also moved ` +
              `${theirs.moved}/${theirs.total} of the ${other.region} region. The two ranges ` +
              'overlap, so the couple cannot give the flowers and the fabric different ' +
              'colours — they are one region wearing two labels. Re-sample; do not widen.',
          );
        }
      }
    }
  }
});

test('MB28 · REAL RASTER: the walls, floor, chairs, sky, sea, grass and sand move by NOTHING', async () => {
  // The MB23 rule, on nine scenes. Both slots applied together, in both orders,
  // because a bleed can depend on which slot claims a pixel first
  // (`recolorRGBA` is nearest-slot-wins).
  for (const scene of MB28) {
    for (const [first, second] of [
      ['#7A1F2B', '#D4AF37'],
      ['#0F766E', '#7A1F2B'],
    ] as const) {
      const edits: Parameters<typeof recolorRGBA>[2] = { 1: { mode: 'palette', hex: first } };
      if (scene.slots.some((s) => s.slotId === 2)) edits[2] = { mode: 'palette', hex: second };
      const { stats, others } = await recolourScene(scene, edits);
      for (const n of neutralNames(scene.setting)) {
        assert.equal(
          stats[n]!.moved,
          0,
          `${scene.setting}: the ${n} (${MB28_ART[scene.setting]!.fills[n]}) wore the ` +
            `palette — ${stats[n]!.moved}/${stats[n]!.total} px moved with florals→${first}` +
            `${edits[2] ? `, fabric→${second}` : ''}. Distances: ` +
            scene.slots
              .map(
                (s) =>
                  `${n}→slot ${s.slotId} (${s.region}) = ` +
                  `${distance(MB28_ART[scene.setting]!.fills[n]!, s.sampledHex).toFixed(2)} vs ` +
                  `tolerance ${s.tolerance}`,
              )
              .join(', ') +
            '. A beach whose sand turns burgundy is the same defect MB23 fixed on the attire ' +
            'figures. Fix the DATA in a migration on moodboard_asset_color_ranges — never ' +
            'special-case the asset in the component.',
        );
      }
      // 🪤 And the regions this file forgot to name. A re-cut that introduces a
      // new field cannot hide behind an incomplete MB28_ART.
      for (const o of others) {
        assert.equal(
          o.moved,
          0,
          `${scene.setting}: an UNNAMED fill ${o.hex}, covering ${(100 * o.n / 175760).toFixed(2)}% ` +
            `of the frame, moved ${o.moved}/${o.n} px with florals→${first}. It is not one of ` +
            'the two tagged regions and it is not in MB28_ART, so either the artwork was ' +
            're-cut and MB28_ART is stale, or a tolerance is now swallowing a region nobody ' +
            'measured. Re-measure the census before touching either.',
        );
      }
    }
  }
});

test('MB28 · REAL RASTER: the recolour does not grow a fringe, per file', async () => {
  for (const scene of MB28) {
    const edits: Parameters<typeof recolorRGBA>[2] = { 1: { mode: 'palette', hex: '#7A1F2B' } };
    if (scene.slots.some((s) => s.slotId === 2)) edits[2] = { mode: 'palette', hex: '#D4AF37' };
    const { fringe, opaque } = await recolourScene(scene, edits);
    const share = fringe / opaque;
    const ceiling = MB28_FRINGE_CEILING[scene.setting]!;
    assert.ok(
      share < ceiling,
      `${scene.setting}: ${fringe} pixels outside every named fill (${(100 * share).toFixed(2)}% ` +
        `of the opaque area) recoloured — above its measured ${(100 * ceiling).toFixed(1)}% ` +
        'ceiling. The ranges have widened far enough to catch the blend between a region and ' +
        'its neighbour, which reads as a halo around the arch or a fringe along the runner.',
    );
  }
});

test('MB28: each seeded fabric tolerance is the LARGEST clean one — a single step higher bleeds', async () => {
  // 🔑 THE ASSERTION THAT PINS THE NUMBER RATHER THAN THE OUTCOME. Without it
  // every test above stays green at a tolerance tightened to 5 everywhere, or
  // at any value that happens not to bleed on the two palettes tried. This says
  // the seeded value is exactly the boundary: at tolerance+1, a MEASURED
  // neutral field turns. It doubles as the "can this harness see a bleed at
  // all" check — if the widened run moves nothing, nothing above means anything.
  for (const scene of MB28) {
    const fabric = scene.slots.find((s) => s.region === 'fabric');
    if (!fabric) continue;
    // The beach is seeded at the LEGAL FLOOR (5), not at the largest clean
    // value (which MB28b measured at 9 — see the boundary test in the MB28b
    // section below). It deliberately does not follow this file's "tightest
    // value before a neutral turns" rule, so it cannot be asserted by it;
    // skipping it here is not a gap, because the boundary it actually sits at
    // is pinned separately.
    if (scene.setting === 'beach') continue;
    const widened = liveSlots(scene).map((s) =>
      s.slotId === fabric.slotId ? { ...s, toleranceDe: fabric.tolerance + 1 } : s,
    );
    const { stats } = await recolourScene(
      scene,
      { 1: { mode: 'palette', hex: '#7A1F2B' }, 2: { mode: 'palette', hex: '#D4AF37' } },
      widened,
    );
    const turned = neutralNames(scene.setting).filter((n) => stats[n]!.moved > 0);
    assert.ok(
      turned.length > 0,
      `${scene.setting}: widening the fabric slot from ${fabric.tolerance} to ` +
        `${fabric.tolerance + 1} moved no neutral at all. Either the seeded tolerance is ` +
        'needlessly tight — there is clean room above it and the drapes may be under-selected ' +
        '— or this harness can no longer see a background bleed, in which case every ' +
        'assertion above is vacuous. Re-measure the census; do not delete this test.',
    );
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * MB28b · THE BEACH DRAPES TAKE THE COUPLE'S COLOUR.
 *
 * MB28 shipped the beach florals-only: its driftwood arch was #DDD6C8, 3.536
 * from the fabric slot in the engine's metric, and the table's
 * `tolerance_de BETWEEN 5 AND 30` CHECK made 5 the tightest legal value — at
 * which the whole arch would have turned. Oversight re-cut the driftwood to
 * #ACA8A0 (19.8 away) and migration 20271209690679 seeds slot 2 at tolerance
 * 5, the same value the church uses.
 *
 * Every ordinary MB28 claim above already covers the beach's fabric slot,
 * because `MB28` (built above) has the beach carrying two slots exactly like
 * the other seven — own-region-moves, neutrals-move-by-nothing, sampled_hex
 * matches its region, no fringe growth. A sabotage that swaps the beach's two
 * sampled_hex values, or reverts the driftwood fill in the SVG, fails one of
 * those tests already; nothing beach-specific needs to check for either.
 *
 * What IS beach-specific is that 5 is not the largest clean tolerance here —
 * it is the legal floor, chosen for margin (the church's own reasoning) over
 * the seven other files' "largest integer before a neutral turns" rule. That
 * is why the beach is excluded from the "LARGEST clean one" test above, and
 * why its actual boundary needs pinning here instead.
 * ════════════════════════════════════════════════════════════════════════════
 */

test('MB28b: the migration seeds exactly one range for the beach — its fabric slot', () => {
  const slot = mb28bBeachFabricSlot();
  assert.deepEqual(
    slot,
    { slotId: 2, sampledHex: '#E8D9B5', tolerance: 5, region: 'fabric' },
    'migration 20271209690679 no longer seeds slot 2 = fabric at #E8D9B5 ± 5 for the beach. ' +
      'If the value changed on purpose, re-measure the sky margin below before updating this.',
  );
});

test('MB28b: the beach fabric tolerance sits well inside its margin — the sky is the ceiling, not the driftwood', async () => {
  const beach = MB28.find((s) => s.setting === 'beach')!;
  // At the seeded tolerance (5) and right up to the true boundary (9), no
  // neutral moves — the driftwood re-cut and the sky's own 9.25 distance both
  // hold. This is the honest reason beach is excluded from the generic
  // "largest clean" test: 5 is not that boundary, 9 is, and the gap is
  // deliberate margin, not an oversight.
  for (const tolerance of [5, 9]) {
    const { stats } = await recolourScene(
      beach,
      { 1: { mode: 'palette', hex: '#7A1F2B' }, 2: { mode: 'palette', hex: '#D4AF37' } },
      [
        { slotId: 1, sampledHex: '#D98BA6', toleranceDe: 10, regionLabel: 'florals' },
        { slotId: 2, sampledHex: '#E8D9B5', toleranceDe: tolerance, regionLabel: 'fabric' },
      ],
    );
    for (const n of neutralNames('beach')) {
      assert.equal(
        stats[n]!.moved,
        0,
        `beach: at fabric tolerance ${tolerance}, the ${n} (${MB28_ART.beach!.fills[n]!}) ` +
          `wore the palette — ${stats[n]!.moved}/${stats[n]!.total} px moved. The margin to ` +
          "the sky (#E3EBEE, 9.25 from the slot) is what actually bounds this tolerance, not " +
          'the driftwood re-cut (19.8 away) — see the next assertion.',
      );
    }
  }
  // 🔑 THE SABOTAGE THIS CATCHES: raising the seeded tolerance from 5 toward
  // 10 eventually repaints the sky. At 10 it does, completely — this is the
  // boundary the seeded value of 5 leaves 4-plus points of margin against.
  const { stats: bled } = await recolourScene(
    beach,
    { 1: { mode: 'palette', hex: '#7A1F2B' }, 2: { mode: 'palette', hex: '#D4AF37' } },
    [
      { slotId: 1, sampledHex: '#D98BA6', toleranceDe: 10, regionLabel: 'florals' },
      { slotId: 2, sampledHex: '#E8D9B5', toleranceDe: 10, regionLabel: 'fabric' },
    ],
  );
  assert.equal(
    bled.shore!.moved,
    bled.shore!.total,
    'widening the beach fabric tolerance to 10 should turn the whole sky (#E3EBEE, 9.25 from ' +
      'the slot) and this harness says it does not — the harness is wrong, not the data. If ' +
      'this ever fires for real (the seeded tolerance itself reached 10), a beach sky is about ' +
      'to turn burgundy or gold for a real couple.',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * RA1 · THE STAGE'S FIVE SEEDED TOLERANCES, MEASURED WITH NO AREA FLOOR.
 *
 * `20271211370331` (PR #5270) shipped the stage zone with five ranges. THREE OF
 * THEM REPAINT THE ROOM — measured on the served files through the real
 * `recolorRGBA`, against four unrelated targets:
 *
 *   bridgerton · regal   seeded 12 → 2572 px outside the cloth (1.67%)
 *   editorial cream      seeded 15 →  628 px (0.41%)
 *   tropical heritage    seeded 15 → 1480 px (0.96%)
 *
 * `20271212320441` corrects them to 8, 12 and (for tropical) no range at all.
 *
 * ── 🔑 WHY THE GUARD THAT SHIPPED WITH THEM COULD NOT SEE IT ────────────────
 * It asked a CENSUS question with a "fills ≥0.2% of the opaque area" floor.
 * Every region these tolerances repaint — chair outlines, plate rims, wall
 * mouldings, glass stems — is HAIRLINE, and none of them reaches 0.2%. The
 * measurement was blind to exactly the class of pixel a too-wide tolerance
 * takes first. There is NO area floor anywhere in this section.
 *
 * The question asked here is SPATIAL: after a real recolour, did any opaque
 * pixel change OUTSIDE the tagged object? The object is derived from the file —
 * its exact slot-colour pixels, dilated by 2px so it keeps its own antialiased
 * edge — so a one-pixel stroke anywhere else in the frame counts exactly like a
 * wall.
 *
 * ⚠ AND A HUE FILTER IS NOT A SUBSTITUTE FOR POSITION. Exempting "same-hue"
 * pixels as antialiasing was measured on these five files and fails in BOTH
 * directions at once:
 *
 *   • `modern minimalist`'s slot #4A3B45 has HSL saturation 0.113. Any
 *     near-grey cutoff at 0.12 classifies THE SLOT ITSELF as off-hue and
 *     reports its own 77,650 correctly-recoloured pixels as a 50% bleed — it
 *     accuses the one file with nothing wrong with it.
 *   • `elegant`'s cream background #F3ECE0 sits at hue 37.9° against a slot at
 *     38.0°. A >40° off-hue rule exempts it as "the slot's own edge", so the
 *     same filter reports a clean max of 30 for a file whose real clean max is
 *     9 — it would bless widening the one tolerance that is already correct.
 *
 * A pixel is either part of the tagged object or it is not, and that is a
 * question about WHERE it is, not what colour it happens to be.
 * ════════════════════════════════════════════════════════════════════════════
 */

const RA1_FIX = new URL(
  '../../../../../../../../supabase/migrations/20271212320441_ra1_stage_tolerances_that_bleed.sql',
  import.meta.url,
);

/** A fourth target beyond this file's shared PALETTE. The stage slots span
 *  gold, purple, pink and plum; a navy is far from all four, so "the region
 *  moved" measures whether the slot MATCHES rather than how lucky the palette
 *  is. */
const RA1_PALETTE = [...PALETTE, '#1E3A8A'] as const;

type Ra1Stage = { slug: string; servedPath: string; sampledHex: string; tolerance: number };

/**
 * 🪤 DERIVED FROM THE CORRECTION MIGRATION'S OWN GUARD, NEVER RETYPED. That
 * guard enumerates the four (path, hex, tolerance) triples it will allow to
 * survive; parsing it here means the SQL and this file cannot drift apart
 * silently — if someone edits a tolerance in the migration without
 * re-measuring, the assertions below run against the new value and go red.
 */
function ra1Stages(): Ra1Stage[] {
  const sql = stripComments(readFileSync(RA1_FIX, 'utf8'));
  const out: Ra1Stage[] = [];
  for (const m of sql.matchAll(
    /a\.storage_path = '(\/moodboard-seed\/venue_scene\/stage\/([a-z0-9-]+)\.svg)'\s*\n\s*AND c\.sampled_hex = '(#[0-9A-Fa-f]{6})' AND c\.tolerance_de = (\d+)/g,
  )) {
    out.push({
      slug: m[2]!,
      servedPath: m[1]!,
      sampledHex: m[3]!.toUpperCase(),
      tolerance: Number(m[4]),
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

const RA1 = ra1Stages();
const RA1_TROPICAL = '/moodboard-seed/venue_scene/stage/tropical-heritage.svg';

/**
 * The pixel budget OUTSIDE the tagged object, per file, at the seeded
 * tolerance. Zero on three of the four.
 *
 * It is not zero on `modern minimalist`, and that is measured rather than
 * conceded: its bench and arch are drawn ON TOP of the plum block, so their
 * antialiased join with the block falls just outside the 2px dilation. 15 px
 * were measured; the budget is 0.05% of the opaque area (77 px), which leaves
 * real margin without hiding a bleed — the same file at the CHECK ceiling of 30
 * puts 346 px outside.
 */
const RA1_OUTSIDE_BUDGET: Record<string, number> = {
  'bridgerton-regal': 0,
  'editorial-cream': 0,
  'elegant-simple-classic': 0,
  'modern-minimalist': 77,
};

/** What `20271211370331` shipped, and what each of those values costs. Kept so
 *  the harness must PROVE it can see the bleed it was written to catch — a
 *  guard that cannot fail on the known-bad values is not evidence for the good
 *  ones. */
const RA1_SHIPPED_BLEED: Record<string, { tolerance: number; outside: number }> = {
  'bridgerton-regal': { tolerance: 12, outside: 2572 },
  'editorial-cream': { tolerance: 15, outside: 628 },
};

const ra1RasterCache = new Map<string, Raster>();
const ra1MaskCache = new Map<string, { core: Uint8Array; mask: Uint8Array; opaque: number }>();

async function ra1Object(servedPath: string, sampledHex: string) {
  let m = ra1MaskCache.get(servedPath);
  if (m) return m;
  let r = ra1RasterCache.get(servedPath);
  if (!r) {
    r = await rasteriseFromPublic(servedPath);
    ra1RasterCache.set(servedPath, r);
  }
  const { rgba, w, h } = r;
  const [sr, sg, sb] = hexToRgb(sampledHex);
  const core = new Uint8Array(w * h);
  const mask = new Uint8Array(w * h);
  let opaque = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (rgba[i + 3]! < 250) continue;
    opaque++;
    if (rgba[i] === sr && rgba[i + 1] === sg && rgba[i + 2] === sb) core[p] = 1;
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
  m = { core, mask, opaque };
  ra1MaskCache.set(servedPath, m);
  return m;
}

/** Recolour one stage drawing at `tolerance` and count, with NO area floor:
 *  how much of the tagged region moved, and how many opaque pixels moved that
 *  are not part of it. */
async function ra1Recolour(servedPath: string, sampledHex: string, tolerance: number, hex: string) {
  const { rgba, w, h } = ra1RasterCache.get(servedPath) ?? (await rasteriseFromPublic(servedPath));
  ra1RasterCache.set(servedPath, { rgba, w, h });
  const { core, mask, opaque } = await ra1Object(servedPath, sampledHex);
  const out = recolorRGBA(
    rgba,
    [{ slotId: 1, sampledHex, toleranceDe: tolerance, regionLabel: 'decor' }],
    { 1: { mode: 'palette', hex } },
  );
  let regionMoved = 0;
  let regionTotal = 0;
  let outside = 0;
  const offenders = new Map<string, number>();
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (rgba[i + 3]! < 250) continue;
    const moved =
      out[i] !== rgba[i] || out[i + 1] !== rgba[i + 1] || out[i + 2] !== rgba[i + 2];
    if (core[p]) {
      regionTotal++;
      if (moved) regionMoved++;
    }
    if (moved && !mask[p]) {
      outside++;
      const k = `#${[rgba[i]!, rgba[i + 1]!, rgba[i + 2]!]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
      offenders.set(k, (offenders.get(k) ?? 0) + 1);
    }
  }
  const worst = [...offenders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { regionMoved, regionTotal, outside, opaque, worst };
}

test('RA1: the correction migration leaves exactly four measured stage ranges', () => {
  assert.deepEqual(
    RA1.map((s) => `${s.slug}:${s.sampledHex}:${s.tolerance}`),
    [
      'bridgerton-regal:#8C6BA6:8',
      'editorial-cream:#D98BA6:12',
      'elegant-simple-classic:#C9A059:9',
      'modern-minimalist:#4A3B45:15',
    ],
    'the four surviving stage tolerances changed. Each is a separate measurement against a ' +
      'different neighbour in its own drawing — 8, 12, 9 and 15, no two alike. If one moved on ' +
      'purpose, re-measure it through the real recolorRGBA at 520px against the SERVED file ' +
      'before editing this list.',
  );
  const sql = stripComments(readFileSync(RA1_FIX, 'utf8'));
  assert.match(
    sql,
    /DELETE FROM public\.moodboard_asset_color_ranges[\s\S]*tropical-heritage\.svg/,
    'the migration no longer deletes tropical heritage\'s colour range. Its nearest neutral is ' +
      "3.60 away in the engine metric and the table's CHECK floor is 5, so NO legal tolerance " +
      'separates them. Re-cut the artwork before seeding one.',
  );
  for (const s of RA1) {
    assert.ok(
      s.tolerance >= 5 && s.tolerance <= 30,
      `${s.slug}: ${s.tolerance} is outside moodboard_asset_color_ranges' CHECK (5..30)`,
    );
  }
});

test('RA1 · REAL RASTER, NO AREA FLOOR: nothing outside the tagged surface wears the palette', async () => {
  for (const s of RA1) {
    const budget = RA1_OUTSIDE_BUDGET[s.slug]!;
    for (const hex of RA1_PALETTE) {
      const { outside, opaque, worst } = await ra1Recolour(
        s.servedPath,
        s.sampledHex,
        s.tolerance,
        hex,
      );
      assert.ok(
        outside <= budget,
        `${s.slug}: ${outside} opaque px OUTSIDE the tagged surface recoloured under ${hex} ` +
          `(${(100 * outside / opaque).toFixed(2)}% of the frame), above its measured budget of ` +
          `${budget}. Worst offenders: ${worst.map(([h, n]) => `${h}×${n}`).join(' ')}. ` +
          'These are hairlines — chair outlines, plate rims, wall mouldings — which is why a ' +
          'census with an area floor could not see them and why this assertion has none. ' +
          'Re-measure the boundary; do not raise the budget to fit a wider tolerance.',
      );
    }
  }
});

test('RA1 · REAL RASTER: the tagged surface still recolours COMPLETELY', async () => {
  // 🪤 The other half. "Nothing outside moved" passes vacuously at a tolerance
  // tightened until the region stops matching, and the couple's stage would
  // then show them nothing of their own. Tightening 12→8 and 15→12 must not
  // have cost the cloth.
  for (const s of RA1) {
    for (const hex of RA1_PALETTE) {
      const { regionMoved, regionTotal } = await ra1Recolour(
        s.servedPath,
        s.sampledHex,
        s.tolerance,
        hex,
      );
      assert.ok(regionTotal > 0, `${s.slug}: no pixel carries the slot colour ${s.sampledHex}`);
      assert.equal(
        regionMoved,
        regionTotal,
        `${s.slug}: at tolerance ${s.tolerance}, ${regionTotal - regionMoved}/${regionTotal} px ` +
          `of the tagged surface stayed at stock colour under ${hex}. The correction went too ` +
          'far — it stopped the bleed by stopping the feature.',
      );
    }
  }
});

test('RA1: the values that shipped DO bleed — this harness can see what it was written to catch', async () => {
  // 🔑 WITHOUT THIS, EVERY ASSERTION ABOVE IS UNFALSIFIED. A guard that has
  // never failed on the known-bad input is not evidence about the good one.
  // These are the exact values `20271211370331` put in front of couples.
  for (const [slug, { tolerance, outside: expected }] of Object.entries(RA1_SHIPPED_BLEED)) {
    const s = RA1.find((x) => x.slug === slug)!;
    let worstSeen = 0;
    for (const hex of RA1_PALETTE) {
      const { outside } = await ra1Recolour(s.servedPath, s.sampledHex, tolerance, hex);
      worstSeen = Math.max(worstSeen, outside);
    }
    assert.ok(
      worstSeen > 0.5 * expected,
      `${slug}: restoring the shipped tolerance of ${tolerance} moved only ${worstSeen} px ` +
        `outside the tagged surface, against the ${expected} px measured on 2026-09-06. Either ` +
        'the artwork was re-cut, or this harness has lost the ability to see a bleed — in which ' +
        'case every assertion above is vacuous. Re-measure; do not delete this test.',
    );
  }
});

test('RA1: tropical heritage has no legal tolerance at all, and therefore no range', async () => {
  // Both ends of the CHECK. At 5 — the tightest value the table permits — the
  // chair and foliage grey #A7A99D (3.60 from the slot) already turns; at 30
  // three quarters of the frame does. There is nothing in between to seed.
  const sql = stripComments(readFileSync(RA1_FIX, 'utf8'));
  assert.ok(
    !new RegExp(`tropical-heritage\\.svg'\\s*\\n\\s*AND c\\.sampled_hex`).test(sql),
    'tropical heritage appears among the migration\'s allowed (path, hex, tolerance) triples. ' +
      'It must carry no range.',
  );
  for (const tolerance of [5, 30]) {
    const { outside } = await ra1Recolour(RA1_TROPICAL, '#9CB29A', tolerance, '#7A1F2B');
    assert.ok(
      outside > 0,
      `tropical heritage at tolerance ${tolerance} moved NOTHING outside its tagged surface. ` +
        'That would mean a legal tolerance exists after all and the range should be re-seeded ' +
        'rather than left deleted — re-measure before acting on it.',
    );
  }
});
