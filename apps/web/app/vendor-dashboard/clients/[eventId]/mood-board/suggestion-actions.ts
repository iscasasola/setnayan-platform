'use server';

/**
 * 🤝🖼 A BOOKED SUPPLIER SUGGESTS A PHOTO TO ONE OF ITS OWN PARTS (owner 2026-10-19, DECISION_LOG "SUPPLIERS ADD
 * INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE INCLUDED" + "FIVE CONTROLLER RECOMMENDATIONS APPROVED" item 4:
 * option (b) "+ pick from the shop's own gallery"; prototype frames 1–2).
 *
 *   suggestInspirationPhoto       a photo (a file, or one of the shop's own photos) → screened → waiting for the couple
 *   withdrawInspirationSuggestion  the supplier takes one back (the sent toast's Undo; a tap on its waiting photo)
 *
 * ── THE GATE IS IN SQL ───────────────────────────────────────────────────────
 * 🔑 `vendor_begin_inspiration_suggestion` (migration 20271279311294) decides, under the supplier's OWN session, that
 * the shop is BOOKED on this event (the relationship `get_vendor_mood_board` checks), that the booking fee has unlocked
 * it, that the shop's services dress THIS part (the one slot→trade map, mirrored in SQL) and that fewer than three of
 * its photos wait there. It opens an EMPTY row. Nothing a browser sends can make that row visible to the couple.
 *
 * ── THE PHOTO GOES THROUGH THE SHIPPED CONTENT SCREEN FIRST ─────────────────
 * The same `screenGalleryImage` every inspiration-library upload passes (a QR code, the shop's own contact details or
 * logo refuses it, with words naming what was found). Only then does the server (service role) attach the photo and
 * its six colours and move the row to 'waiting' — the one write the supplier's session cannot make.
 *
 * In-app only: the couple meets it at the top of their Palette. No email (owner rule).
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadPublicAsset } from '@/lib/storage';
import { screenGalleryImage } from '@/lib/moodboard-gallery-screen.server';
import { extractPaletteFromBytes } from '@/lib/extract-palette.server';
import { fetchShopLogoBytes, listShopOwnPhotos, readShopOwnPhotoBytes, type ShopOwnPhoto } from '@/lib/shop-own-photos.server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { libraryPhotoParts } from '@/lib/inspiration-slots';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SUGGEST_REFUSAL } from '@/lib/inspiration-suggestions';
import type { VendorProfileRow } from '@/lib/vendor-profile';

export type SuggestResult =
  | { status: 'ok'; suggestion: { id: string; slotKey: string; url: string } }
  | { status: 'refused'; message: string };

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

type ShopForScreen = Pick<VendorProfileRow, 'vendor_profile_id' | 'portfolio_r2_keys' | 'business_name' | 'contact_phone' | 'contact_email' | 'website' | 'logo_url'>;

export async function suggestInspirationPhoto(formData: FormData): Promise<SuggestResult> {
  const eventId = String(formData.get('eventId') ?? '');
  const slotKey = String(formData.get('slotKey') ?? '');
  const picked = formData.get('file');
  const file = picked instanceof File && picked.size > 0 ? picked : null;
  const shopPhotoRef = String(formData.get('shopPhotoRef') ?? '').trim() || null;

  if (!eventId || !libraryPhotoParts().some((p) => p.key === slotKey)) {
    return { status: 'refused', message: 'Pick which part this photo is for.' };
  }
  if (!file && !shopPhotoRef) return { status: 'refused', message: 'Pick a photo — a file, or one from your shop.' };
  if (file && shopPhotoRef) return { status: 'refused', message: 'Pick one photo at a time.' };
  if (file && !ACCEPTED.includes(file.type)) return { status: 'refused', message: 'Use a PNG, JPG or WebP photo.' };
  if (file && file.size > MAX_BYTES) return { status: 'refused', message: 'The photo must be 5 MB or smaller.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'refused', message: 'Please sign in again.' };

  /* 1 · THE DOOR — booking, fee, trade, three waiting — in SQL, under the supplier's own session. */
  const { data: opened, error: openErr } = await supabase.rpc('vendor_begin_inspiration_suggestion', {
    p_event_id: eventId,
    p_slot_key: slotKey,
  });
  if (openErr) {
    const m = openErr.message ?? '';
    if (/not_booked/.test(m)) return { status: 'refused', message: SUGGEST_REFUSAL.not_booked };
    if (/fee_unsettled/.test(m)) return { status: 'refused', message: SUGGEST_REFUSAL.fee_unsettled };
    logQueryError('suggestInspirationPhoto.begin', openErr, { eventId, slotKey });
    return { status: 'refused', message: SUGGEST_REFUSAL.failed };
  }
  const door = (opened ?? {}) as { status?: string; suggestion_id?: string; vendor_profile_id?: string };
  if (door.status === 'wrong_trade') return { status: 'refused', message: SUGGEST_REFUSAL.wrong_trade };
  if (door.status === 'full') return { status: 'refused', message: SUGGEST_REFUSAL.full };
  if (door.status !== 'ok' || !door.suggestion_id || !door.vendor_profile_id) return { status: 'refused', message: SUGGEST_REFUSAL.failed };
  const suggestionId = door.suggestion_id;

  const admin = createAdminClient();
  const refuse = async (message: string): Promise<SuggestResult> => {
    await admin.from('event_inspiration_suggestions').update({ state: 'refused' }).eq('suggestion_id', suggestionId).eq('state', 'screening');
    return { status: 'refused', message };
  };

  try {
    /* The shop the SQL door chose (one person may run more than one), read under the supplier's own session. */
    const { data: shopRow, error: shopErr } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, portfolio_r2_keys, business_name, contact_phone, contact_email, website, logo_url')
      .eq('vendor_profile_id', door.vendor_profile_id)
      .maybeSingle();
    if (shopErr || !shopRow) {
      if (shopErr) logQueryError('suggestInspirationPhoto.shop', shopErr, { eventId });
      return await refuse(SUGGEST_REFUSAL.failed);
    }
    const shop = shopRow as ShopForScreen;

    /* 2 · THE BYTES — a file off the supplier's phone, or one of the shop's own photos (checked against its own list). */
    const photo = file
      ? { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type }
      : await readShopOwnPhotoBytes(supabase, shop, shopPhotoRef!);

    /* 3 · THE SHIPPED CONTENT SCREEN, on the original bytes. */
    const screen = await screenGalleryImage({
      bytes: photo.bytes,
      profile: { business_name: shop.business_name, contact_phone: shop.contact_phone, contact_email: shop.contact_email, website: shop.website },
      logoBytes: await fetchShopLogoBytes(shop.logo_url),
    });
    if (screen.blocked) return await refuse(screen.message);

    /* 4 · ITS SIX COLOURS, read off its own pixels (what a Keep writes to the board). None read = refused, never invented. */
    const read = await extractPaletteFromBytes(photo.bytes);
    if (read.length === 0) return await refuse('We couldn’t read this photo’s colours — please try another photo.');
    const hexes = Array.from({ length: 6 }, (_, i) => read[i % read.length]!.toUpperCase());

    /* 5 · STORED where the couple's own board photos live, under this event. */
    const type = photo.contentType && ACCEPTED.includes(photo.contentType) ? photo.contentType : 'image/jpeg';
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const upload = await uploadPublicAsset({
      pathPrefix: `inspiration/${eventId}/suggestions/${slotKey}`,
      file: new File([photo.bytes as BlobPart], `suggestion.${ext}`, { type }),
    });
    if (!upload.ok) return await refuse(SUGGEST_REFUSAL.failed);

    /* 6 · NOW, AND ONLY NOW, THE COUPLE CAN SEE IT — the one write the supplier's session cannot make. */
    const { error: doneErr } = await admin
      .from('event_inspiration_suggestions')
      .update({
        state: 'waiting',
        image_url: upload.publicUrl,
        r2_key: upload.key,
        screened_at: new Date().toISOString(),
        screen_findings: screen.findings,
        sampled_hex_1: hexes[0],
        sampled_hex_2: hexes[1],
        sampled_hex_3: hexes[2],
        sampled_hex_4: hexes[3],
        sampled_hex_5: hexes[4],
        sampled_hex_6: hexes[5],
      })
      .eq('suggestion_id', suggestionId)
      .eq('state', 'screening');
    if (doneErr) {
      logQueryError('suggestInspirationPhoto.screened', doneErr, { eventId, suggestionId });
      return await refuse(SUGGEST_REFUSAL.failed);
    }

    revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
    revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
    return { status: 'ok', suggestion: { id: suggestionId, slotKey, url: upload.publicUrl } };
  } catch (err) {
    return await refuse(err instanceof Error && err.message ? err.message : SUGGEST_REFUSAL.failed);
  }
}

export async function withdrawInspirationSuggestion(eventId: string, suggestionId: string): Promise<{ status: 'ok' | 'refused'; message?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('vendor_withdraw_inspiration_suggestion', { p_suggestion_id: suggestionId });
  if (error) {
    logQueryError('withdrawInspirationSuggestion', error, { eventId, suggestionId });
    return { status: 'refused', message: 'That photo couldn’t be taken back just now. Please try again.' };
  }
  const status = (data as { status?: string } | null)?.status;
  if (status === 'decided') return { status: 'refused', message: 'The couple has already answered that photo.' };
  if (status !== 'ok' && status !== 'already') return { status: 'refused', message: 'That photo couldn’t be taken back just now. Please try again.' };
  revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  return { status: 'ok' };
}

/**
 * "Choose from your shop's photos" (owner 2026-10-19, "+ pick from the shop's own gallery") — the photos on the shop's
 * page and its service cards, read where they live (`listShopOwnPhotos`, #6655). `failed` = the list could not be read,
 * which the sheet says — never drawn as "no photos".
 */
export async function listShopPhotosForSuggestion(): Promise<{ photos: Pick<ShopOwnPhoto, 'ref' | 'url'>[]; failed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { photos: [], failed: true };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { photos: [], failed: true };
  const { photos, failed } = await listShopOwnPhotos(supabase, profile);
  return { photos: photos.map((p) => ({ ref: p.ref, url: p.url })), failed };
}
