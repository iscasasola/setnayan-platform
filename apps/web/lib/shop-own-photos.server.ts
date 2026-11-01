import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset, parseStoredAsset } from '@/lib/uploads';
import { r2GetBytes } from '@/lib/r2';
import { safeFetchImageBytes } from '@/lib/safe-image-fetch';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { isFromAlbumPageRef } from '@/lib/put-photo-on-my-page';

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
    /* An event-album photo has people from somebody's event in it. It is on the page through their 7-day notice
       (owner 2026-10-03) and a takedown pulls it from there — a copy into the library or another couple's board would
       be out of reach of both, so it never travels on from the page. */
    if (isFromAlbumPageRef(ref)) return;
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

/**
 * The bytes of one of the shop's OWN photos — the library's "From your shop's photos" and a booked supplier's
 * "Choose from your shop's photos" on an event's board (2026-10-19). 🛑 The ref must be in the list
 * `shopOwnPhotoRefs` reads NOW, under the supplier's own session — a ref the browser made up (another shop's key, any
 * URL) is refused before anything is fetched. A list that could not be read refuses too: we cannot prove it is theirs.
 */
export async function readShopOwnPhotoBytes(
  supabase: SupabaseClient,
  profile: Pick<VendorProfileRow, 'vendor_profile_id' | 'portfolio_r2_keys'>,
  ref: string,
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const own = await shopOwnPhotoRefs(supabase, profile);
  if (own === null) throw new Error('We couldn’t read your shop’s photos just now — please try again in a moment.');
  if (!own.some((p) => p.ref === ref)) throw new Error('That photo isn’t one of your shop’s photos.');
  const parsed = parseStoredAsset(ref);
  if (!parsed) throw new Error('That photo could not be opened.');
  if (parsed.kind === 'r2') {
    const { bytes, contentType } = await r2GetBytes({ bucket: parsed.bucket, key: parsed.key });
    return { bytes, contentType };
  }
  const bytes = await safeFetchImageBytes(parsed.url);
  if (!bytes) throw new Error('That photo could not be opened.');
  return { bytes, contentType: null };
}

/** The shop's own logo bytes (the content screen's own-logo check), or null when it has none we can read — the check
 *  is then SKIPPED, never guessed at. */
export async function fetchShopLogoBytes(logoUrl: string | null): Promise<Uint8Array | null> {
  const parsed = parseStoredAsset(logoUrl);
  if (!parsed) return null;
  try {
    if (parsed.kind === 'r2') {
      const { bytes } = await r2GetBytes({ bucket: parsed.bucket, key: parsed.key });
      return bytes;
    }
    return await safeFetchImageBytes(parsed.url);
  } catch {
    return null;
  }
}
