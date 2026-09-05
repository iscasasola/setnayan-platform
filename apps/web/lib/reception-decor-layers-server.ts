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
 * file's Node-only bits (`sharp`, `node:fs`, DB reads, `safeFetchImageBytes`)
 * never leak into a client bundle.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeFetchImageBytes } from './safe-image-fetch';
import { isCompositableDecorHref } from './reception-scene';
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
 * approved_at IS NOT NULL.
 *
 * ✅ THIS RETURNS A REAL CATALOG AS OF MB14b (2026-09-05). It returned EMPTY
 * for two days: the 10 pilot rows were seeded `approved_at = NULL` because the
 * generating session had no R2 credentials, and MB26 then retired them when
 * the owner ruled `media.setnayan.com` was not being set up. Migration
 * 20271207934361 repoints all ten at `/moodboard-seed/venue_scene/...` — files
 * this app serves itself — and publishes them. `resolveDecorLayer` still
 * treats an empty catalog as "fall back to the flat SVG", which is what every
 * (zone, style) outside the ten gets.
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

/** apps/web/public/ — what actually serves a `/moodboard-seed/...` path. */
const PUBLIC_ROOT = path.join(process.cwd(), 'public');

/**
 * MB14b · 🔑 AN APP-SERVED PATH IS NOT A URL, AND `safeFetchImageBytes` SAYS SO.
 *
 * This function used to be one call to `safeFetchImageBytes`, which is correct
 * for the `https://…` storage_paths every library asset carried when it was
 * written. MB14b repoints the ten decor rows at `/moodboard-seed/…` — the same
 * app-served shape MB24 and MB25 introduced — and `new URL('/moodboard-seed/…')`
 * THROWS, so that helper returns null.
 *
 * ⚠ MEASURED, NOT REASONED: `safeFetchImageBytes('/moodboard-seed/venue_scene/
 * backdrop/editorial-cream.svg')` returns `null`. Without this branch the
 * migration would publish ten perfectly good rows and every zone would keep
 * falling back to the flat SVG FOREVER, silently, with every test green —
 * because "no bytes" and "no asset" are the same `null` to the caller. That is
 * the whole pilot terminating in nothing for a third time.
 *
 * Reading it off disk is the honest fetch for a file we ship: it is in our own
 * `public/` directory, so there is no network, no host, and no SSRF surface to
 * guard. What there IS is path traversal, and `isCompositableDecorHref` — the
 * same predicate `renderVenueSvg` uses before it writes an href into markup —
 * is what refuses it. A containment check follows it; see the note inline for
 * what each of the two actually catches, measured by deleting them one at a
 * time rather than asserted.
 */
async function decorSourceBytes(storagePath: string): Promise<Uint8Array | null> {
  if (storagePath.startsWith('/')) {
    if (!isCompositableDecorHref(storagePath)) return null;
    // 🪤 SABOTAGED BOTH WAYS, AND THE RESULT IS REPORTED HONESTLY.
    // Deleting the predicate above turns the traversal test RED — only it
    // refuses a `..` that stays INSIDE public/ and still names a real file
    // (`…/backdrop/../backdrop/editorial-cream.svg`), which `path.resolve` +
    // `startsWith` are both perfectly happy with.
    //
    // Deleting the containment check below turns NOTHING red. It is redundant
    // TODAY, given a predicate that already pins the `/moodboard-seed/` prefix.
    // It is kept anyway, and labelled as what it is: the thing that still holds
    // if someone widens that prefix later — a loosened predicate is a one-line
    // edit, and this is the line that keeps it inside public/. No test can show
    // it red, and pretending otherwise would be the "guard that guards a copy"
    // mistake in reverse.
    // (`path.resolve` normalises, so a separate `normalize` comparison would be
    // a check that can never fire. It is deliberately not written here.)
    const abs = path.resolve(PUBLIC_ROOT, `.${storagePath}`);
    if (!abs.startsWith(PUBLIC_ROOT + path.sep)) return null;
    try {
      return await readFile(abs);
    } catch {
      return null; // not committed, or renamed — fall back to the flat SVG
    }
  }
  return safeFetchImageBytes(storagePath, { maxBytes: 6_000_000 });
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

  const bytes = await decorSourceBytes(resolved.asset.storagePath);
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
