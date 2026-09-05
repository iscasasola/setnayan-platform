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
