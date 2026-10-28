'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { portfolioPhotoCap, portfolioOverCapMessage, PORTFOLIO_ALLOWANCE_UNREAD_SAVE } from '@/lib/vendor-tier-caps';
import { allowanceForCap, readPortfolioAllowance } from '@/lib/portfolio-allowance.server';
import { R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { parseClientRef, vendorOwnedMediaPolicy } from '@/lib/r2-client-ref';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';
import { addToPageGallery, pagePhotoKeyFor } from '@/lib/put-photo-on-my-page';
import {
  putOnPageQueuedText,
  supplierPageNoticeState,
  type SupplierPageNoticeRow,
  type SupplierPageNoticeState,
} from '@/lib/supplier-page-notice';

export type PutOnPageResult =
  | { ok: true; text: string; state: SupplierPageNoticeState; publicFrom: string | null }
  | { ok: false; error: string };

/** What a notice that already exists means for a second tap. */
function answerForExisting(row: SupplierPageNoticeRow): PutOnPageResult {
  const state = supplierPageNoticeState(row);
  if (state === 'removed_by_guest') return { ok: false, error: 'A guest asked to keep this one off your page.' };
  if (state === 'taken_down') return { ok: false, error: 'That photo can’t go on your page.' };
  if (state === 'on_page') return { ok: true, text: 'Already on your page', state, publicFrom: row.public_from };
  return { ok: true, text: putOnPageQueuedText(row.public_from), state, publicFrom: row.public_from };
}

const NOTICE_COLS = 'notice_id, page_ref, public_from, published_at, removed_at, removed_by';

/**
 * PUT THIS PHOTO ON MY PAGE (owner 2026-10-15, DECISION_LOG "SIX OWNER ANSWERS" (3)) — one tap from a photo in the
 * shop's private album (`vendor_papic_portfolio_photos`).
 *
 * ⏳ IT DOES NOT GO PUBLIC ON THE TAP ANY MORE (owner 2026-10-03, "A SUPPLIER'S OWN PAPIC PHOTOS GO ON ITS PORTFOLIO
 * AUTOMATICALLY AFTER A 7-DAY GUEST NOTICE"; built 2026-10-28, "OWNER: Agree to all" (1)). The tap files a
 * `supplier_page_photo_notices` row: the event's guests see it in their Event Hub with Remove, and only after 7 days
 * with nobody removing it does `publish_supplier_page_photo` copy it into the shop's folder and add it to the page
 * gallery (`vendor_profiles.portfolio_r2_keys`). Until then nothing is copied and nothing is public.
 *
 * Read AND written with the shop's OWN client: the album's RLS (`vendor_papic_portfolio_photos_vendor_read`) and the
 * notice's insert policy are the boundary, and the notice's trigger stamps the 7 days — a request cannot shorten them.
 * A photo taken down or not yet screened is refused. Owners and admins only — a page is an owner room. The plan's
 * photo cap counts the photos already waiting, so a slot is held for each.
 */
export async function putAlbumPhotoOnMyPage(_prev: PutOnPageResult | null, formData: FormData): Promise<PutOnPageResult> {
  const photoId = String(formData.get('photo_id') ?? '').trim();
  if (!photoId) return { ok: false, error: 'Pick a photo first.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id).catch(() => null);
  if (!profile?.vendor_profile_id) return { ok: false, error: 'No supplier profile found.' };
  const vendorId = profile.vendor_profile_id;
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorId);
  if (!canManageVendor(role)) return { ok: false, error: 'Only the owner or an admin can change your page.' };

  const [photoRes, rowRes, noticeRes, waitingRes] = await Promise.all([
    supabase
      .from('vendor_papic_portfolio_photos')
      .select('photo_id, vendor_profile_id, event_id, r2_object_key, hidden_at, nsfw_checked')
      .eq('photo_id', photoId)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle(),
    supabase.from('vendor_profiles').select('tier_state, portfolio_r2_keys').eq('vendor_profile_id', vendorId).maybeSingle(),
    supabase.from('supplier_page_photo_notices').select(NOTICE_COLS).eq('photo_id', photoId).eq('vendor_profile_id', vendorId).maybeSingle(),
    supabase
      .from('supplier_page_photo_notices')
      .select('page_ref')
      .eq('vendor_profile_id', vendorId)
      .is('published_at', null)
      .is('removed_at', null),
  ]);
  if (photoRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:vendor_papic_portfolio_photos.select', photoRes.error);
  if (rowRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:vendor_profiles.select', rowRes.error);
  if (noticeRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:supplier_page_photo_notices.select', noticeRes.error);
  if (waitingRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:supplier_page_photo_notices.select(waiting)', waitingRes.error);
  if (photoRes.error || rowRes.error || noticeRes.error || waitingRes.error || !rowRes.data) {
    return { ok: false, error: 'We couldn’t load that just now. Nothing was changed — please try again.' };
  }
  const photo = photoRes.data as
    | { r2_object_key: string | null; hidden_at: string | null; nsfw_checked: boolean | null }
    | null;
  if (!photo || !photo.r2_object_key) return { ok: false, error: 'That photo is not in your album.' };
  if (photo.hidden_at || photo.nsfw_checked !== true) return { ok: false, error: 'That photo can’t go on your page.' };
  // A second tap answers from the notice that already exists — never a second notice, never a reset of its 7 days.
  if (noticeRes.data) return answerForExisting(noticeRes.data as SupplierPageNoticeRow);

  const { bucket, key: albumKey } = parseR2Ref(photo.r2_object_key);
  const pageKey = bucket === R2_BUCKETS.media ? pagePhotoKeyFor(vendorId, albumKey) : null;
  const pageRef = pageKey ? `r2://${R2_BUCKETS.media}/${pageKey}` : null;
  // Defence in depth: the SAME tenancy pin the gallery save applies (SEC-1) — only this shop's own media folder.
  if (!pageKey || !pageRef || !parseClientRef(pageRef, vendorOwnedMediaPolicy(vendorId))) {
    return { ok: false, error: 'That photo is not in your album.' };
  }

  const row = rowRes.data as { tier_state?: string | null; portfolio_r2_keys?: string[] | null };
  const waiting = ((waitingRes.data ?? []) as { page_ref: string }[]).map((w) => w.page_ref);
  // 🎁 The shop's own allowance (a personal invite's 100, kept) lifts the base — `portfolioPhotoCap`.
  // Unread → the base, and a refusal that says it could not read (never "50 free").
  const allowanceRead = await readPortfolioAllowance(supabase, vendorId);
  const max = portfolioPhotoCap(row.tier_state ?? null, allowanceForCap(allowanceRead));
  // The photos already waiting hold their slots, so the day they go up the page is not over its cap.
  const next = addToPageGallery([...(row.portfolio_r2_keys ?? []), ...waiting], pageRef, max);
  if (next.kind === 'already') return { ok: true, text: 'Already on your page', state: 'on_page', publicFrom: null };
  if (next.kind === 'full') {
    // The free base (owner 2026-10-23) — a shop already past it keeps every photo; it just cannot add one more yet.
    return { ok: false, error: allowanceRead.ok ? portfolioOverCapMessage(max) : PORTFOLIO_ALLOWANCE_UNREAD_SAVE };
  }

  // The QR guard reads the ALBUM photo — the same bytes the page copy will carry — before anything is filed.
  if (await vendorQrGuardRejects([photo.r2_object_key])) return { ok: false, error: VENDOR_QR_MEDIA_ERROR };

  const { data: filed, error: fileErr } = await supabase
    .from('supplier_page_photo_notices')
    .insert({ photo_id: photoId, vendor_profile_id: vendorId, event_id: (photoRes.data as { event_id: string }).event_id, page_ref: pageRef })
    .select(NOTICE_COLS)
    .maybeSingle();
  if (fileErr) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:supplier_page_photo_notices.insert', fileErr);
  if (fileErr || !filed) {
    return { ok: false, error: 'Your page could not be updated just now. Nothing was changed — please try again.' };
  }

  revalidatePath('/vendor-dashboard/collections');
  revalidatePath(`/vendor-dashboard/on-the-day/live/${(photoRes.data as { event_id: string }).event_id}/papic`);
  return answerForExisting(filed as SupplierPageNoticeRow);
}
