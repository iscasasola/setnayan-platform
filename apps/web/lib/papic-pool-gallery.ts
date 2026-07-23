/**
 * lib/papic-pool-gallery.ts — the guest-facing WHOLE-pool browse read
 * (Shared Pool Gallery, OnTheDay build ⑥).
 *
 * Thin server-side wrapper over the SECURITY DEFINER guest_pool_gallery RPC
 * (service_role-only — every caller here is a cookie-validated route/page that
 * already resolved guest_id from the signed setnayan_guest_session cookie).
 * The RPC owns ALL the gates: the per-event couple toggle
 * (events.pool_gallery_open), the strict 'clean' allowlist, hidden_at,
 * the FaceBlock baked-blur rule, the photo_consent veto, and — critically —
 * it returns WEB-COPY derivative keys only, never the geo-bearing
 * r2_object_key. This module only presigns what the RPC hands back.
 *
 * Keyset pagination on captured_at DESC (the RPC caps 60/page); the cursor is
 * the last tile's captured_at, fed back as p_before.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';

const URL_TTL_SECONDS = 60 * 60;
export const POOL_PAGE_SIZE = 60;

type PoolRpcRow = {
  source_table: 'papic_photos' | 'papic_guest_captures';
  source_id: string;
  media_type: 'photo' | 'clip';
  display_r2_key: string | null;
  thumb_r2_key: string | null;
  poster_r2_key: string | null;
  clip_web_r2_key: string | null;
  captured_at: string;
  linked: boolean;
};

export type PoolTile = {
  id: string;
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  mediaType: 'photo' | 'clip';
  /** Presigned tile image (thumb → display → poster). */
  thumbUrl: string;
  /** Presigned clip playback URL (web copy) — clips only. */
  clipUrl: string | null;
  capturedAt: string;
  /** This guest already has a live tag on this capture. */
  linked: boolean;
};

export type PoolPage = {
  tiles: PoolTile[];
  /** Feed the last tile's capturedAt back as `before` for the next page; null = no more. */
  nextCursor: string | null;
};

export async function getPoolGalleryPage(
  guestId: string,
  before?: string | null,
): Promise<PoolPage> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('guest_pool_gallery', {
    p_guest_id: guestId,
    p_before: before && !Number.isNaN(Date.parse(before)) ? before : 'infinity',
    p_limit: POOL_PAGE_SIZE,
  });
  // Missing RPC (pre-migration · 42883) or any read trouble → empty pool, never
  // a crash on a guest surface.
  if (error || !Array.isArray(data)) return { tiles: [], nextCursor: null };

  const rows = data as PoolRpcRow[];
  const tiles = (
    await Promise.all(
      rows.map(async (r): Promise<PoolTile | null> => {
        // Tile image: cheapest web derivative first. The RPC guarantees these
        // are derivative keys only (and on FaceBlock events, ONLY the baked
        // blur in display_r2_key) — never the geo-bearing original.
        const thumbKey = r.thumb_r2_key ?? r.display_r2_key ?? r.poster_r2_key; // gitleaks:allow — R2 object-key fields, not secrets
        const thumbUrl = thumbKey
          ? await displayUrlForStoredAsset(thumbKey, { ttlSeconds: URL_TTL_SECONDS })
          : null;
        const clipUrl =
          r.media_type === 'clip' && r.clip_web_r2_key
            ? await displayUrlForStoredAsset(r.clip_web_r2_key, { ttlSeconds: URL_TTL_SECONDS })
            : null;
        // A clip with a playable web copy but no poster still renders (video
        // element shows its first frame); a photo with no presignable key is
        // dropped rather than served broken.
        if (!thumbUrl && !clipUrl) return null;
        return {
          id: r.source_id,
          sourceTable: r.source_table,
          mediaType: r.media_type,
          thumbUrl: thumbUrl ?? '',
          clipUrl,
          capturedAt: r.captured_at,
          linked: r.linked,
        };
      }),
    )
  ).filter((t): t is PoolTile => t !== null);

  return {
    tiles,
    nextCursor: rows.length === POOL_PAGE_SIZE ? (rows[rows.length - 1]?.captured_at ?? null) : null,
  };
}
