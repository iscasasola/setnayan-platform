'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { portfolioShortText } from '@/lib/shop-portfolio-credits';
import { formatCount } from '@/lib/format-number';
import { R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { parseClientRef, vendorOwnedMediaPolicy } from '@/lib/r2-client-ref';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';
import { pagePhotoKeyFor } from '@/lib/put-photo-on-my-page';
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
 * A photo taken down or not yet screened is refused. Owners only (the shop wallet pays past the free room — the same
 * rule as `shop_portfolio_commit`), and the photos already waiting count toward the free room.
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

  const [photoRes, noticeRes] = await Promise.all([
    supabase
      .from('vendor_papic_portfolio_photos')
      .select('photo_id, vendor_profile_id, event_id, r2_object_key, hidden_at, nsfw_checked')
      .eq('photo_id', photoId)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle(),
    supabase.from('supplier_page_photo_notices').select(NOTICE_COLS).eq('photo_id', photoId).eq('vendor_profile_id', vendorId).maybeSingle(),
  ]);
  if (photoRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:vendor_papic_portfolio_photos.select', photoRes.error);
  if (noticeRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:supplier_page_photo_notices.select', noticeRes.error);
  if (photoRes.error || noticeRes.error) {
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

  // The QR guard reads the ALBUM photo — the same bytes the page copy will carry — before anything is filed.
  if (await vendorQrGuardRejects([photo.r2_object_key])) return { ok: false, error: VENDOR_QR_MEDIA_ERROR };

  // 💳 FILED AND PRICED IN ONE STEP (`file_supplier_page_notice`, under the wallet's per-shop lock): the notice row
  // (its trigger stamps the 7 days) and, past the free room, the shop-wallet charge (owner 2026-10-23: 50 free, then
  // 1 credit a photo). Photos still WAITING count toward the free room, so the day they go up nothing is charged twice
  // and nothing goes up unpaid. A charge the wallet cannot cover files NOTHING and says so.
  const filed = await supabase.rpc('file_supplier_page_notice', { p_photo_id: photoId, p_page_ref: pageRef });
  const answer = (filed.data ?? null) as
    | (Partial<SupplierPageNoticeRow> & { status?: string; charged?: number; charge?: number; balance?: number | null })
    | null;
  if (filed.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · rpc:file_supplier_page_notice', filed.error);
  if (answer?.status === 'insufficient') {
    return { ok: false, error: portfolioShortText(Number(answer.charge ?? 0), Number(answer.balance ?? 0)) };
  }
  if (answer?.status === 'not_owner') return { ok: false, error: 'Only the shop owner can change the portfolio.' };
  if (answer?.status === 'refused') return { ok: false, error: 'That photo can’t go on your page.' };
  if (filed.error || (answer?.status !== 'ok' && answer?.status !== 'exists') || !answer?.public_from) {
    return { ok: false, error: 'Your page could not be updated just now. Nothing was changed — please try again.' };
  }
  const charged = Number(answer.charged ?? 0);
  const said = answerForExisting(answer as SupplierPageNoticeRow);

  revalidatePath('/vendor-dashboard/collections');
  revalidatePath(`/vendor-dashboard/on-the-day/live/${(photoRes.data as { event_id: string }).event_id}/papic`);
  if (said.ok && charged > 0) {
    return { ...said, text: `${said.text} · ${formatCount(charged)} ${charged === 1 ? 'credit' : 'credits'} from your shop wallet` };
  }
  return said;
}
