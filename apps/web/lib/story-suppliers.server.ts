import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import type { StorySupplierCard, UltraAlbum, UltraAlbumItem } from '@/app/[slug]/_components/editorial/data';

/**
 * lib/story-suppliers.server.ts — the two reads the story's supplier list adds (owner 2026-11-13, specs DECISION_LOG
 * "every booked supplier is tappable … Supplier Pro / Ultra get a rich card" · "every Supplier Ultra gets its own
 * scene" · "Supplier Ultra shares its album").
 *
 *   · `readStorySupplierCards` — the rich card for each Supplier Pro / Ultra: the shop's own portfolio (cover + best
 *     work) and the SAME trusted rating the shop page shows (`vendor_trusted_review_stats`). Nothing typed.
 *   · `readUltraAlbums` — each Supplier Ultra whose album for THIS event is shared (`vendor_event_album_shares.shared`),
 *     its screened, unhidden items. The plan is checked HERE, at read time, against the shop's `tier_state`: a shop
 *     that moved down a plan stops showing with nobody touching its switch.
 *
 * 🔑 A FAILED READ IS NOT AN EMPTY ONE. Both return `null` when a read failed — the caller keeps its plain credits and
 * draws no Ultra scene, and the failure is logged; an Ultra's scene is never drawn empty (a scene with no items is not
 * drawn at all, the story's "never an empty scene" rule).
 */

type Admin = SupabaseClient;

/** How many items a scene receives — it shows four and "See all N" (N is counted separately). */
const ULTRA_SCENE_ITEMS = 40;

export type CardProfile = { vendorProfileId: string; portfolioKeys: readonly string[] };

export async function readStorySupplierCards(
  admin: Admin,
  profiles: readonly CardProfile[],
): Promise<Map<string, StorySupplierCard> | null> {
  const out = new Map<string, StorySupplierCard>();
  if (profiles.length === 0) return out;
  const { data, error } = await admin
    .from('vendor_trusted_review_stats')
    .select('vendor_profile_id, trusted_avg_rating, trusted_review_count')
    .in('vendor_profile_id', profiles.map((p) => p.vendorProfileId));
  if (error) {
    console.error('[supabase-error] lib/story-suppliers.server.ts · from:vendor_trusted_review_stats.select', error);
    return null;
  }
  const stats = new Map(
    ((data ?? []) as { vendor_profile_id: string; trusted_avg_rating: number | null; trusted_review_count: number | null }[]).map((r) => [
      r.vendor_profile_id,
      { avg: Number(r.trusted_avg_rating ?? 0), count: Number(r.trusted_review_count ?? 0) },
    ]),
  );
  await Promise.all(
    profiles.map(async (p) => {
      const urls = (await Promise.all(p.portfolioKeys.slice(0, 4).map((k) => displayUrlForStoredAsset(k).catch(() => null)))).filter(
        (u): u is string => Boolean(u),
      );
      const s = stats.get(p.vendorProfileId);
      out.set(p.vendorProfileId, {
        coverUrl: urls[0] ?? null,
        bestWork: urls.slice(1, 4),
        rating: s && s.count > 0 && s.avg > 0 ? Math.round(s.avg * 10) / 10 : null,
        reviews: s?.count ?? 0,
      });
    }),
  );
  return out;
}

export type UltraShop = {
  vendorProfileId: string;
  name: string;
  category: string | null;
  slug: string | null;
  logoUrl: string | null;
};

export async function readUltraAlbums(admin: Admin, eventId: string, ultras: readonly UltraShop[]): Promise<UltraAlbum[] | null> {
  if (ultras.length === 0) return [];
  const ids = ultras.map((u) => u.vendorProfileId);
  const shares = await admin
    .from('vendor_event_album_shares')
    .select('vendor_profile_id')
    .eq('event_id', eventId)
    .eq('shared', true)
    .in('vendor_profile_id', ids);
  if (shares.error) {
    console.error('[supabase-error] lib/story-suppliers.server.ts · from:vendor_event_album_shares.select', shares.error);
    return null;
  }
  const sharedIds = new Set(((shares.data ?? []) as { vendor_profile_id: string }[]).map((r) => r.vendor_profile_id));
  // The plan, read now — only a CURRENT Supplier Ultra's share is shown.
  const stillUltra = await admin.from('vendor_profiles').select('vendor_profile_id, tier_state').in('vendor_profile_id', [...sharedIds]);
  if (stillUltra.error) {
    console.error('[supabase-error] lib/story-suppliers.server.ts · from:vendor_profiles.select', stillUltra.error);
    return null;
  }
  const shown = ultras.filter((u) =>
    ((stillUltra.data ?? []) as { vendor_profile_id: string; tier_state: string | null }[]).some(
      (r) => r.vendor_profile_id === u.vendorProfileId && r.tier_state === 'enterprise',
    ),
  );
  const albums: UltraAlbum[] = [];
  for (const u of shown) {
    const rows = await admin
      .from('vendor_papic_portfolio_photos')
      .select('r2_object_key, video_r2_key, media_kind')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', u.vendorProfileId)
      .eq('nsfw_checked', true)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(ULTRA_SCENE_ITEMS);
    if (rows.error) {
      console.error('[supabase-error] lib/story-suppliers.server.ts · from:vendor_papic_portfolio_photos.select', rows.error);
      return null;
    }
    const counts = await Promise.all(
      (['photo', 'video'] as const).map((kind) =>
        admin
          .from('vendor_papic_portfolio_photos')
          .select('photo_id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('vendor_profile_id', u.vendorProfileId)
          .eq('nsfw_checked', true)
          .is('hidden_at', null)
          .eq('media_kind', kind),
      ),
    );
    if (counts.some((c) => c.error)) {
      console.error('[supabase-error] lib/story-suppliers.server.ts · from:vendor_papic_portfolio_photos.count', counts.find((c) => c.error)?.error);
      return null;
    }
    const items: UltraAlbumItem[] = [];
    for (const r of (rows.data ?? []) as { r2_object_key: string; video_r2_key: string | null; media_kind: string }[]) {
      const stillUrl = await displayUrlForStoredAsset(r.r2_object_key).catch(() => null);
      if (!stillUrl) continue;
      const videoUrl = r.media_kind === 'video' && r.video_r2_key ? await displayUrlForStoredAsset(r.video_r2_key).catch(() => null) : null;
      items.push({ stillUrl, videoUrl });
    }
    if (items.length === 0) continue; // never an empty scene
    albums.push({ ...u, items, photos: counts[0]!.count ?? 0, videos: counts[1]!.count ?? 0 });
  }
  return albums;
}
