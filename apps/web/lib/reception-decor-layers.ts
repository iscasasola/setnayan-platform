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
