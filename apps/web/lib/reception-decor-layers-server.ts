import 'server-only';

/**
 * Server-side half of the reception decor AI-image layer pilot — the DB
 * catalog read + the actual fetch/rasterize/retint/re-encode pipeline for
 * server-rendered surfaces (e.g. the vendor-facing read-only Mood Board page,
 * which is a React Server Component and can do this work directly with
 * `sharp`, no browser canvas needed).
 *
 * Kept separate from lib/reception-decor-layers.ts (which stays pure +
 * environment-agnostic, importable from a client component too) so THIS
 * file's Node-only bits (`sharp`, DB reads, `safeFetchImageBytes`) never leak
 * into a client bundle.
 */
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeFetchImageBytes } from './safe-image-fetch';
import {
  resolveDecorLayer,
  retintDecorLayerRGBA,
  primaryZoneTargetHex,
  PILOT_DECOR_ZONES,
  type DecorLayerCatalog,
  type DecorLayerAsset,
} from './reception-decor-layers';
import { MOODBOARD_STYLE_FAMILIES, type MoodboardStyleFamily } from './moodboard-templates';
import type { PartId } from './reception-scene';

/**
 * Read moodboard_library_assets (+ its color ranges) for the pilot zones into
 * the shape `resolveDecorLayer` expects. Public data (no auth check beyond
 * the table's own RLS): moodboard_library_assets_public_read already requires
 * approved_at IS NOT NULL, and the 10 pilot rows are seeded with approved_at
 * = NULL on purpose (see migration 20271194970382's header — generation
 * happened, but the files were never uploaded to R2 from that session), so
 * this returns an EMPTY catalog in production until a human finishes the
 * upload + approval step. `resolveDecorLayer` already treats an empty
 * catalog as "fall back to the flat SVG" — the draft/published gate IS the
 * rollout mechanism, no separate feature flag needed.
 */
export async function fetchDecorLayerCatalog(
  supabase: SupabaseClient,
): Promise<DecorLayerCatalog> {
  const { data, error } = await supabase
    .from('moodboard_library_assets')
    .select(
      `asset_id, asset_subtype, storage_path, style_theme,
       moodboard_asset_color_ranges ( slot_id, sampled_hex, tolerance_de, region_label )`,
    )
    .eq('asset_type', 'venue_scene')
    .in('asset_subtype', PILOT_DECOR_ZONES as string[])
    .not('approved_at', 'is', null)
    .is('retired_at', null);
  if (error) throw new Error(error.message);

  const catalog: DecorLayerCatalog = {};
  for (const row of (data ?? []) as Array<{
    asset_id: string;
    asset_subtype: string;
    storage_path: string;
    style_theme: string | null;
    moodboard_asset_color_ranges:
      | { slot_id: number; sampled_hex: string; tolerance_de: number; region_label: string | null }[]
      | { slot_id: number; sampled_hex: string; tolerance_de: number; region_label: string | null }
      | null;
  }>) {
    if (!row.style_theme || !(MOODBOARD_STYLE_FAMILIES as readonly string[]).includes(row.style_theme)) {
      continue; // no style_family, or not one of the 5 known ones — skip rather than guess
    }
    const ranges = Array.isArray(row.moodboard_asset_color_ranges)
      ? row.moodboard_asset_color_ranges
      : row.moodboard_asset_color_ranges
        ? [row.moodboard_asset_color_ranges]
        : [];
    const slot1 = ranges.find((r) => r.slot_id === 1);
    if (!slot1) continue; // no tagged region — nothing to retint, skip rather than composite untinted

    const zone = row.asset_subtype as (typeof PILOT_DECOR_ZONES)[number];
    const style = row.style_theme as MoodboardStyleFamily;
    const asset: DecorLayerAsset = {
      assetId: row.asset_id,
      storagePath: row.storage_path,
      colorRange: {
        slotId: slot1.slot_id,
        sampledHex: slot1.sampled_hex,
        toleranceDe: slot1.tolerance_de,
        regionLabel: slot1.region_label ?? undefined,
      },
    };
    catalog[zone] = { ...catalog[zone], [style]: asset };
  }
  return catalog;
}

/**
 * Fetch, rasterize, and retint one zone's decor image server-side, returning
 * a data: URI ready to drop straight into an `<img src>` — or null when
 * anything along the way isn't available (no catalog match, fetch failure,
 * decode failure). Callers treat null exactly like "no AI layer for this
 * zone" and keep showing the flat SVG underneath; this function never throws.
 */
export async function renderDecorLayerDataUrl(
  zone: PartId,
  styleFamily: MoodboardStyleFamily | null,
  catalog: DecorLayerCatalog,
  palette: string[],
): Promise<string | null> {
  const resolved = resolveDecorLayer(zone, styleFamily, catalog);
  if (resolved.kind !== 'image') return null;

  const bytes = await safeFetchImageBytes(resolved.asset.storagePath, { maxBytes: 6_000_000 });
  if (!bytes) return null;

  try {
    const { data, info } = await sharp(Buffer.from(bytes))
      .resize(800, 800, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const targetHex = primaryZoneTargetHex(palette);
    const retinted = retintDecorLayerRGBA(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      resolved.asset.colorRange,
      targetHex,
    );

    const png = await sharp(Buffer.from(retinted), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null; // corrupt/unsupported source image — fall back to the flat SVG
  }
}
