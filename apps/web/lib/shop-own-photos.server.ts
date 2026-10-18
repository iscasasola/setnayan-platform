import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import type { VendorProfileRow } from '@/lib/vendor-profile';

/**
 * lib/shop-own-photos.server.ts — THE SHOP'S OWN PHOTOS, as the inspiration library's "From your shop's photos"
 * picker offers them (owner 2026-10-19, DECISION_LOG "SUPPLIERS FILL THE INSPIRATION LIBRARY WITHOUT AN EVENT":
 * *"add from the shop's own gallery photos as well as upload"*).
 *
 * 🔑 NOTHING NEW IS STORED — the two stores Your collections already counts (`collections-data.ts`) are read where
 * they live: the photos on the shop's page (`vendor_profiles.portfolio_r2_keys`) and the service cards' photos
 * (`vendor_services.primary_photo_r2_key` + `showcase_photo_r2_keys`). A photo picked here is COPIED into the
 * library by the SAME upload path a file takes (`uploadStylistAsset` → screen → watermark → theft scan → a draft
 * for Setnayan to approve) — the picker only chooses which bytes arrive, never which checks run.
 *
 * 🛑 THE SERVER RE-READS THE LIST; IT NEVER TRUSTS THE REF IT IS SENT. `shopOwnPhotoRefs` is what the action checks
 * a submitted ref against, so a browser cannot name another shop's photo (or any URL at all) and have Setnayan fetch
 * it. `null` means the list could not be read — the action then refuses rather than guessing.
 */

export type ShopOwnPhoto = {
  /** The stored ref (`r2://…` or a legacy URL) — what the upload sends back. */
  ref: string;
  /** A display URL for the thumbnail (presigned for R2). */
  url: string;
  /** Where it lives today, in Your collections' words. */
  from: 'page' | 'card';
};

/** Every stored ref the shop owns, de-duplicated, page photos first. `null` = the service cards could not be read. */
export async function shopOwnPhotoRefs(
  supabase: SupabaseClient,
  profile: Pick<VendorProfileRow, 'vendor_profile_id' | 'portfolio_r2_keys'>,
): Promise<{ ref: string; from: 'page' | 'card' }[] | null> {
  const out: { ref: string; from: 'page' | 'card' }[] = [];
  const seen = new Set<string>();
  const push = (ref: unknown, from: 'page' | 'card') => {
    if (typeof ref !== 'string' || !ref.trim() || seen.has(ref)) return;
    /* A clip is not an inspiration photo (the library takes stills only). */
    if (/\.(mp4|mov|m4v|webm|avi)(\?|$)/i.test(ref)) return;
    seen.add(ref);
    out.push({ ref, from });
  };
  for (const ref of profile.portfolio_r2_keys ?? []) push(ref, 'page');

  const { data, error } = await supabase
    .from('vendor_services')
    .select('primary_photo_r2_key, showcase_photo_r2_keys')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) {
    logQueryError('shopOwnPhotos.cards', error, { vendorId: profile.vendor_profile_id }, 'graceful_degrade');
    return null;
  }
  for (const row of (data ?? []) as { primary_photo_r2_key: string | null; showcase_photo_r2_keys: string[] | null }[]) {
    push(row.primary_photo_r2_key, 'card');
    for (const ref of row.showcase_photo_r2_keys ?? []) push(ref, 'card');
  }
  return out;
}

/** The picker's thumbnails. `failed` = the list could not be read, which is said — never drawn as "no photos". */
export async function listShopOwnPhotos(
  supabase: SupabaseClient,
  profile: Pick<VendorProfileRow, 'vendor_profile_id' | 'portfolio_r2_keys'>,
): Promise<{ photos: ShopOwnPhoto[]; failed: boolean }> {
  const refs = await shopOwnPhotoRefs(supabase, profile).catch((err) => {
    logQueryError('shopOwnPhotos.list', err, { vendorId: profile.vendor_profile_id });
    return null;
  });
  if (refs === null) return { photos: [], failed: true };
  const photos = await Promise.all(
    refs.map(async ({ ref, from }) => {
      try {
        const url = await displayUrlForStoredAsset(ref);
        return url ? { ref, url, from } : null;
      } catch {
        return null;
      }
    }),
  );
  return { photos: photos.filter((p): p is ShopOwnPhoto => p !== null), failed: false };
}
