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
