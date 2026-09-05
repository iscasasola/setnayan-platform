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
 * ⚠ THE BRIDE IS NOT A TOLERANCE PROBLEM, AND THIS IS WHY.
 *
 * `modern-minimalist/bride` draws the gown in #ECEBE7 — byte-identical to its
 * own background rect. Measured 2026-09-05 on a 520px raster: that one value is
 * 76.6% of the figure column, and ΔE(gown, background) = 0.0.
 *
 * To `recolorRGBA` they are not two regions; they are one. Every (sampledHex,
 * tolerance) pair either catches both or neither — so migration 20271205919528
 * DELETES the range rather than adjusting it, and `page.tsx` prefers a variant
 * that has one. This test is the proof for that decision, so nobody re-derives
 * "just tighten the tolerance" and ships a white dress with pink trim.
 */
const BRIDE_GOWN = '#ECEBE7';
const BRIDE_BACKGROUND = '#ECEBE7';

test('modern-minimalist/bride: gown and background are the SAME colour, so no range can isolate the dress', () => {
  assert.equal(
    distance(BRIDE_GOWN, BRIDE_BACKGROUND),
    0,
    'the measurement this decision rests on has changed — re-measure the asset before ' +
      'reinstating a colour range for it',
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
      background: BRIDE_BACKGROUND,
      garment: BRIDE_GOWN,
      farthestTone: BRIDE_GOWN,
    };
    const { backgroundMaxDeviation, garmentMaxDeviation } = render(fig, '#7A1F2B');
    assert.equal(
      backgroundMaxDeviation,
      garmentMaxDeviation,
      `${hex} ± ${tol} claims to separate the gown from the backdrop. It cannot — they ` +
        'are the same colour. Do not reinstate a colour range for this asset; either ' +
        're-cut the artwork so the gown and the background differ, or leave the range ' +
        'deleted and let page.tsx prefer a variant that has one.',
    );
  }
});

test('migration 20271205919528 does NOT tag modern-minimalist/bride', () => {
  assert.equal(
    FROM_MIGRATION.has('modern-minimalist/bride'),
    false,
    'a colour range has been reinstated for modern-minimalist/bride. Its gown and its ' +
      'background are the same colour (ΔE 0.0); any range there recolours the page behind ' +
      'the figure, or nothing but her shading. See the test above.',
  );
});
