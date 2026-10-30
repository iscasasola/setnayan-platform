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
import { getInspirationParts } from '@/lib/inspiration-parts-db';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SUGGEST_REFUSAL } from '@/lib/inspiration-suggestions';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import { verifyCardForPart } from '@/lib/inspiration-card-link.server';
import { importEditorialMediaToGallery } from '@/app/vendor-dashboard/moodboard-library/actions';
import { stylistAssetObjectKey } from '@/lib/moodboard-library-key';
import type { SuggestionPoolResult } from '@/lib/inspiration-suggestions';

export type SuggestResult =
  | { status: 'ok'; suggestion: { id: string; slotKey: string; url: string }; pool?: SuggestionPoolResult }
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
  // 🔗 THE CARD + THE POOL (owner 2026-10-30, "CONNECTED FOUR WAYS"): which of the shop's cards this is (optional,
  // re-checked below against the shop the SQL door proves), and the rights tick that also offers it to the library.
  const requestedCard = String(formData.get('vendorServiceId') ?? '').trim() || null;
  const rightsWarranted = String(formData.get('rightsWarranted') ?? '') === '1';

  if (!eventId || !libraryPhotoParts(await getInspirationParts()).some((p) => p.key === slotKey)) {
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
    /* A row left 'screening' never reaches the couple and stops counting toward the cap in ten minutes — so a failed
       mark is logged, never a reason to hide the refusal from the supplier. */
    const { error: markErr } = await admin.from('event_inspiration_suggestions').update({ state: 'refused' }).eq('suggestion_id', suggestionId).eq('state', 'screening');
    if (markErr) logQueryError('suggestInspirationPhoto.refused', markErr, { eventId, suggestionId }, 'graceful_degrade');
    return { status: 'refused', message };
  };

  try {
    /* The shop the SQL door chose (one person may run more than one). Its contact columns are not session-readable
       (20271221366210), so it is read on the service role — scoped by the id the SQL door PROVED is the caller's own
       booked shop, never by anything the browser sent. */
    const { data: shopRow, error: shopErr } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, portfolio_r2_keys, business_name, contact_phone, contact_email, website, logo_url')
      .eq('vendor_profile_id', door.vendor_profile_id)
      .maybeSingle();
    if (shopErr || !shopRow) {
      if (shopErr) logQueryError('suggestInspirationPhoto.shop', shopErr, { eventId });
      return await refuse(SUGGEST_REFUSAL.failed);
    }
    const shop = shopRow as ShopForScreen;

    /* 1b · THE CARD — one of THIS shop's live cards whose Service links this part (never trusted as sent). */
    const card = await verifyCardForPart(admin, {
      vendorProfileId: door.vendor_profile_id,
      slotKey,
      requested: requestedCard,
      parts: await getInspirationParts(),
    });
    if (!card.ok) return await refuse(card.message);

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
        vendor_service_id: card.vendorServiceId,
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
    /* 7 · 🔗🖼 ALSO OFFERED TO THE INSPIRATION POOL — pending until Setnayan approves (owner 2026-10-30). Through the
       library's own door (`importEditorialMediaToGallery` → `importSuggestionToGallery` → storeScreenedAsset: rights ·
       screen · watermark · theft scan · quota), never a second insert here. Its refusal never undoes the suggestion:
       the couple already has the photo; the supplier is told, in words, why the library did not take it. */
    const pool = await offerSuggestionToPool({ suggestionId, rightsWarranted, vendorServiceId: card.vendorServiceId, sourceRef: shopPhotoRef });
    return { status: 'ok', suggestion: { id: suggestionId, slotKey, url: upload.publicUrl }, pool };
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
  // 🔗 Its pool copy goes too while still PENDING (an approved one is a library photo by then, managed there).
  await removePendingPoolCopy(suggestionId);
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

/** The pool half of a suggestion. No rights tick = not offered (said); a refusal from the library = its own words. */
async function offerSuggestionToPool(input: {
  suggestionId: string;
  rightsWarranted: boolean;
  vendorServiceId: string | null;
  sourceRef: string | null;
}): Promise<SuggestionPoolResult> {
  if (!input.rightsWarranted) return { status: 'not_offered' };
  try {
    await importEditorialMediaToGallery({
      suggestionId: input.suggestionId,
      rightsWarranted: true,
      vendorServiceId: input.vendorServiceId,
      sourceRef: input.sourceRef,
    });
    return { status: 'pending' };
  } catch (err) {
    return { status: 'skipped', message: err instanceof Error && err.message ? err.message : 'The inspiration library couldn’t take this photo just now.' };
  }
}

/**
 * A taken-back suggestion's pool copy, removed while it is still PENDING — the row and its stored object, scoped to the
 * caller (uploaded_by) and to not-yet-approved. Best-effort: the take-back already happened; a failure is logged.
 */
async function removePendingPoolCopy(suggestionId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('moodboard_library_assets')
    .select('asset_id, storage_path, uploaded_by')
    .eq('source_suggestion_id', suggestionId)
    .eq('uploaded_by', user.id)
    .is('approved_at', null)
    .maybeSingle();
  if (error) {
    logQueryError('withdrawInspirationSuggestion.poolCopy', error, { suggestionId }, 'graceful_degrade');
    return;
  }
  const row = data as { asset_id: string; storage_path: string | null; uploaded_by: string } | null;
  if (!row) return;
  const { error: delErr } = await admin.from('moodboard_library_assets').delete().eq('asset_id', row.asset_id).is('approved_at', null);
  if (delErr) {
    logQueryError('withdrawInspirationSuggestion.poolCopyDelete', delErr, { suggestionId }, 'graceful_degrade');
    return;
  }
  /* 🔒 Only an object in THIS supplier's own folder (lib/moodboard-library-key.ts), as deleteStylistAsset does. */
  const key = row.storage_path ? stylistAssetObjectKey(row.storage_path, row.uploaded_by) : null;
  if (key) await admin.storage.from('moodboard-library').remove([key]);
}
