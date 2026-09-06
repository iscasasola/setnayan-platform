/**
 * Reception decor AI-image layers — PILOT (2026-09-03).
 *
 * Upgrades `renderVenueSvg`'s flat hand-coded zones to composite real
 * AI-generated decor images, retinted to the couple's palette with the
 * EXISTING Color Range Manipulator engine (@/lib/color-recolor) — the same
 * math the admin tagger and the couple-facing Recolor Studio already use.
 * No new tinting mechanism is invented here.
 *
 * Scope is deliberately capped: `PILOT_DECOR_ZONES` lists exactly the zones
 * that have a generated image library (Backdrop + Ceiling today — see
 * changelog.d/moodboard-ai-decor-layers-pilot.md). Every other zone, and
 * every (zone, style) combination without a matching approved asset, keeps
 * rendering through the original flat SVG in reception-scene.ts UNCHANGED —
 * this module never touches that file's output.
 *
 * This file is pure + DOM-free (like color-recolor.ts and reception-scene.ts)
 * so `resolveDecorLayer` is unit-testable without a browser or a database.
 * The actual fetch-image + canvas-pixel-read step is necessarily DOM-bound
 * and lives in the client component that calls this module
 * (reception-designer.tsx), exactly like ColorRangeManipulator keeps its own
 * Canvas plumbing separate from color-recolor.ts's math.
 */

import {
  colorDistance,
  recolorRGBA,
  type ColorRangeSlot,
  type RegionEditMap,
} from './color-recolor';
import type { DecorLayers, PartId } from './reception-scene';
import type { MoodboardStyleFamily } from './moodboard-templates';

/** Zones with a generated AI-image decor library today. Backdrop + Ceiling
 *  were picked as the pilot pair because they're the most visually dominant
 *  zones in the composited scene — see the task brief in
 *  changelog.d/moodboard-ai-decor-layers-pilot.md. Expanding coverage later
 *  is just: generate more images (apps/web/scripts/reception-decor-pilot-
 *  prompts.ts documents the exact recipe), seed them, and add the zone id
 *  here. */
/**
 * ⚠ THIS LIST IS THE SWITCH. A zone with seeded artwork that is NOT named here
 * gets `{kind:'svg'}` from `resolveDecorLayer` and its rows are dead — the
 * exact shape MB14b shipped ten of. Adding a zone means: seed the assets, add
 * the id here, and prove BYTES come back (see `renderDecorLayerDataUrl`).
 *
 * `stage` joined 2026-09-06 (migration 20271211370331) — the first zone added
 * since the pilot pair, under `build-sessions/RECEPTION-ART-PLAN.md`.
 */
export const PILOT_DECOR_ZONES: readonly PartId[] = ['backdrop', 'ceiling', 'stage'];

/** One zone's decor image, ready to composite: where the source pixels live
 *  + the single tagged color region to retint (slot 1 only, for the pilot —
 *  the schema supports up to 6, matching figure_attire's convention, but
 *  every pilot asset was generated with exactly one isolable dominant
 *  region). */
export type DecorLayerAsset = {
  assetId: string;
  storagePath: string;
  colorRange: ColorRangeSlot;
};

/** zone → style_family → asset, built from moodboard_library_assets +
 *  moodboard_asset_color_ranges (see getReceptionDecorLayerCatalog in
 *  app/dashboard/[eventId]/studio/mood-board/actions.ts). A style_family
 *  absent from the inner map, or a zone absent entirely, both mean "no
 *  approved pilot asset yet" — never an error, always a fallback signal. */
export type DecorLayerCatalog = Partial<
  Record<PartId, Partial<Record<MoodboardStyleFamily, DecorLayerAsset>>>
>;

/**
 * Decide, for one zone, whether to composite an AI image or fall back to the
 * existing flat SVG rendering. Pure + total — never throws, and the only way
 * to get an image back is an exact zone+style match already present in the
 * catalog. Every other input (zone outside the pilot pair, no style_family
 * known for this couple yet, or a style_family the catalog doesn't have an
 * asset for) resolves to `{ kind: 'svg' }`, which callers render exactly as
 * `renderVenueSvg` already does today.
 *
 * `styleFamily: null` used to mean "nobody can ever know" — no event stored a
 * style family anywhere, because applyMoodboardTemplate merged a template's
 * palette + design in and discarded which family produced them, so EVERY
 * caller passed null and this pilot was dormant for everyone. That is closed:
 * `events.moodboard_style_family` (migration 20271197327520) records it, both
 * apply modes write it, and the three callers (the couple's Reception
 * Designer, the vendor read-only board, and this module's server half) now
 * pass a real value when there is one.
 *
 * Null remains a legitimate, common input — a couple who builds their
 * reception design from scratch, never applying a template, genuinely has no
 * style family — and this function still refuses to guess one. Whether
 * couples should be able to pick a family directly, independent of a
 * template, is a product decision for the owner, not something to infer here.
 */
export function resolveDecorLayer(
  zone: PartId,
  styleFamily: MoodboardStyleFamily | null,
  catalog: DecorLayerCatalog,
): { kind: 'image'; asset: DecorLayerAsset } | { kind: 'svg' } {
  if (!styleFamily) return { kind: 'svg' };
  if (!PILOT_DECOR_ZONES.includes(zone)) return { kind: 'svg' };
  const asset = catalog[zone]?.[styleFamily];
  if (!asset) return { kind: 'svg' };
  return { kind: 'image', asset };
}

/**
 * MB14b · The whole pilot's decision, in the shape `renderVenueSvg` consumes.
 *
 * Runs `resolveDecorLayer` over every pilot zone and keeps only the zones that
 * produced BOTH a match and an href — so a zone with no asset, a couple with no
 * style family, and an asset whose href the caller cannot build all land in the
 * same place: absent from the map, which `renderVenueSvg` renders as today's
 * flat SVG, byte for byte.
 *
 * 🪤 THIS IS THE FUNCTION A NEAR-MISS WOULD CORRUPT. The one thing that must
 * never happen is an uncovered (zone, style) getting SOME asset — the nearest
 * style, the zone's only asset, a default. Every one of those would render a
 * room the couple did not design, and every one of them is a one-line edit
 * inside `resolveDecorLayer`. `reception-scene.test.ts` sabotages exactly that
 * and asserts the byte-equality guard goes red.
 *
 * @param hrefFor Builds the drawable href for a matched asset — a data: URI on
 *   the server (`renderDecorLayerDataUrl`), the app-served path on the client.
 *   Returning null means "I could not produce one", which is a fallback, never
 *   an error.
 */
export function decorLayerHrefs(
  styleFamily: MoodboardStyleFamily | null,
  catalog: DecorLayerCatalog,
  hrefFor: (asset: DecorLayerAsset) => string | null,
): DecorLayers {
  const layers: DecorLayers = {};
  for (const zone of PILOT_DECOR_ZONES) {
    const resolved = resolveDecorLayer(zone, styleFamily, catalog);
    if (resolved.kind !== 'image') continue;
    const href = hrefFor(resolved.asset);
    if (href) layers[zone] = href;
  }
  return layers;
}

/**
 * Retint a decor layer's raw RGBA pixels to the couple's target color for
 * that zone, using the asset's single tagged color region. Thin wrapper
 * around `recolorRGBA` (palette mode) — no pixel math is reimplemented here,
 * matching the task's explicit instruction to reuse color-recolor.ts's
 * actual functions.
 */
export function retintDecorLayerRGBA(
  src: Uint8ClampedArray,
  colorRange: ColorRangeSlot,
  targetHex: string,
): Uint8ClampedArray {
  const edits: RegionEditMap = {
    [colorRange.slotId]: { mode: 'palette', hex: targetHex },
  };
  return recolorRGBA(src, [colorRange], edits);
}

/**
 * RA1 · ZONES WHOSE DRAWING IS A SCENE, NOT A PANEL.
 *
 * 🔑 THE DIFFERENCE THAT DECIDES WHETHER THE ROOM LOOKS RIGHT. A `backdrop` or
 * `ceiling` drawing FILLS its zone — the panel behind the couple, the band
 * overhead. Every pixel of those files is meant to be drawn, background
 * included, and clearing their background would punch a hole in the backdrop.
 *
 * A `stage` drawing is not like that. It is a picture OF a draped table,
 * standing in its own little cream room — and `renderVenueSvg` already has a
 * room. Composited as-is it lays an opaque rectangle of foreign cream across
 * the floor and the wall behind the stage: measured on all four covered
 * families, and on `modern minimalist`, whose background is 48% of its frame,
 * it reads as a broken image rather than as decor. So a scene zone's background
 * is made TRANSPARENT before the image reaches the renderer, and only the
 * furniture composites.
 *
 * ⚠ EVERY REMAINING RECEPTION ZONE IS A SCENE ZONE. `tables`, `feast`,
 * `program`, `booths`, `photo_wall`, `tunnel` and `welcome_signage` are all
 * objects standing in a room, exactly like `stage` — so this list is expected
 * to grow with each of them, and the alternative is shipping the same opaque
 * rectangle eight more times.
 *
 * Adding a zone here is a claim about its ARTWORK, not its geometry: the
 * drawing must be a full-bleed object on a flat, uniform background that its
 * own corners agree on. `knockOutSceneBackground` refuses the job otherwise
 * rather than guessing.
 */
export const SCENE_DECOR_ZONES: readonly PartId[] = ['stage'];

/**
 * Make a scene drawing's flat background transparent, returning a NEW buffer.
 *
 * The background colour is SAMPLED FROM THE IMAGE rather than passed in or
 * hardcoded: a full-bleed drawing carries its background at every corner, so
 * sampling means a re-cut or a newly generated file needs no constant updated
 * anywhere. If the corners DISAGREE (beyond `cornerTolerance`) the image is not
 * the shape this function assumes — something is drawn into a corner — and it
 * returns the source untouched. Compositing a background that should have gone
 * is a cosmetic flaw; erasing a table because this function guessed a
 * "background" out of the middle of it is not.
 *
 * @param tolerance how far from the sampled background a pixel may sit and
 *   still be cleared, in `colorDistance`'s metric. Kept TIGHT: the flat field
 *   is one exact colour, so this only has to cover the rasteriser's own dither,
 *   and every point of slack eats into the drawing's antialiased edge.
 */
export function knockOutSceneBackground(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 8,
  cornerTolerance = 4,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  if (width < 2 || height < 2 || src.length !== width * height * 4) return out;

  const at = (x: number, y: number) => (y * width + x) * 4;

  // 🪤 THE CORNERS OF THE FRAME ARE NOT ALWAYS THE CORNERS OF THE DRAWING. A
  // 16:9 drawing rasterised into a square with `fit: 'contain'` is letterboxed
  // with TRANSPARENT bands, so the frame's corners carry no colour at all. The
  // server renderer uses `fit: 'inside'` and has no bands — but a caller that
  // letterboxes would otherwise get a silent no-op here, which is exactly the
  // "it just didn't happen" failure this whole change exists to stop. So sample
  // the corners of the OPAQUE CONTENT instead of the frame.
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (src[at(x, y) + 3]! < 250) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) return out; // nothing opaque at all

  const corners = [at(x0, y0), at(x1, y0), at(x0, y1), at(x1, y1)];
  if (corners.some((i) => src[i + 3]! < 250)) return out;
  const br = src[corners[0]!]!;
  const bg = src[corners[0]! + 1]!;
  const bb = src[corners[0]! + 2]!;
  for (const i of corners) {
    if (colorDistance(src[i]!, src[i + 1]!, src[i + 2]!, br, bg, bb) > cornerTolerance) {
      return out; // corners disagree — refuse rather than guess
    }
  }

  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3]! === 0) continue;
    if (colorDistance(src[i]!, src[i + 1]!, src[i + 2]!, br, bg, bb) <= tolerance) {
      out[i + 3] = 0;
    }
  }
  return out;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** The couple's target color for a pilot zone's dominant region: the
 *  reception palette's first color, same convention `renderVenueSvg`'s
 *  `paletteFn` already uses for a zone's primary fabric (P(0) — e.g. the
 *  'draped' backdrop/ceiling treatments already paint their fabric in
 *  palette[0]). Falls back to the same default `paletteFn` uses so an empty
 *  palette still renders something reasonable rather than an invalid hex. */
export function primaryZoneTargetHex(palette: string[]): string {
  const valid = palette.filter((c) => HEX6.test(c));
  return valid[0] ?? '#C9A059';
}
