'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { randomUUID } from 'node:crypto';
import { portfolioShortText } from '@/lib/shop-portfolio-credits';
import { R2_BUCKETS, r2Copy } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { parseClientRef, vendorOwnedMediaPolicy } from '@/lib/r2-client-ref';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';
import { hashAndScanVendorImages } from '@/lib/vendor-image-repost-watch';
import { addToPageGallery, pagePhotoKeyFor } from '@/lib/put-photo-on-my-page';

export type PutOnPageResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * PUT THIS PHOTO ON MY PAGE (owner 2026-10-15, DECISION_LOG "SIX OWNER ANSWERS" (3)) — one tap from a photo in the
 * shop's private album (`vendor_papic_portfolio_photos`). Copies the photo into the shop's own media folder and adds it
 * to the page gallery (`vendor_profiles.portfolio_r2_keys`) — the SAME column, price (the free room, then the shop wallet — `shop_portfolio_commit`), QR guard and repost watch the
 * gallery's own save (`updateVendorProfileField('portfolio')`) uses. It shows on the page while the page's Photos part is
 * on (Your page), like every gallery photo.
 *
 * Read with the shop's OWN client: the album's RLS (`vendor_papic_portfolio_photos_vendor_read`) is the boundary. A
 * photo taken down or not yet screened is refused. Owners and admins only — a page is an owner room.
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

  const [photoRes, rowRes] = await Promise.all([
    supabase
      .from('vendor_papic_portfolio_photos')
      .select('photo_id, vendor_profile_id, r2_object_key, hidden_at, nsfw_checked')
      .eq('photo_id', photoId)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle(),
    supabase.from('vendor_profiles').select('portfolio_r2_keys').eq('vendor_profile_id', vendorId).maybeSingle(),
  ]);
  if (photoRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:vendor_papic_portfolio_photos.select', photoRes.error);
  if (rowRes.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · from:vendor_profiles.select', rowRes.error);
  if (photoRes.error || rowRes.error || !rowRes.data) {
    return { ok: false, error: 'We couldn’t load that just now. Nothing was changed — please try again.' };
  }
  const photo = photoRes.data as
    | { r2_object_key: string | null; hidden_at: string | null; nsfw_checked: boolean | null }
    | null;
  if (!photo || !photo.r2_object_key) return { ok: false, error: 'That photo is not in your album.' };
  if (photo.hidden_at || photo.nsfw_checked !== true) return { ok: false, error: 'That photo can’t go on your page.' };

  const { bucket, key: albumKey } = parseR2Ref(photo.r2_object_key);
  const pageKey = bucket === R2_BUCKETS.media ? pagePhotoKeyFor(vendorId, albumKey) : null;
  const pageRef = pageKey ? `r2://${R2_BUCKETS.media}/${pageKey}` : null;
  // Defence in depth: the SAME tenancy pin the gallery save applies (SEC-1) — only this shop's own media folder.
  if (!pageKey || !pageRef || !parseClientRef(pageRef, vendorOwnedMediaPolicy(vendorId))) {
    return { ok: false, error: 'That photo is not in your album.' };
  }

  const row = rowRes.data as { portfolio_r2_keys?: string[] | null };
  // 💳 No cap here any more: past the free room the photo is paid from the shop wallet (owner 2026-10-23, option A)
  // by `shop_portfolio_commit` below — the same one step the gallery's own save takes.
  const next = addToPageGallery(row.portfolio_r2_keys ?? [], pageRef, Infinity);
  if (next.kind === 'already') return { ok: true, text: 'Already on your page' };
  if (next.kind === 'full') return { ok: false, error: 'Your page could not be updated just now. Nothing was changed — please try again.' };

  // The QR guard reads the ALBUM photo — the same bytes the copy will carry — BEFORE the copy, so a refused photo
  // leaves no orphan object in the shop's page folder (supplier batch walk, W3).
  if (await vendorQrGuardRejects([photo.r2_object_key])) return { ok: false, error: VENDOR_QR_MEDIA_ERROR };
  try {
    await r2Copy({ bucket: R2_BUCKETS.media, fromKey: albumKey, toKey: pageKey });
  } catch (err) {
    console.error('[put-on-my-page] copy failed', err);
    return { ok: false, error: 'The photo could not be copied just now. Nothing was changed — please try again.' };
  }

  // The list and its charge in ONE step (free room first, then the shop wallet) — never a bare column write.
  const commit = await supabase.rpc('shop_portfolio_commit', {
    p_vendor_profile_id: vendorId,
    p_refs: next.refs,
    p_spend_ref: `portfolio:${randomUUID()}`,
  });
  const answer = (commit.data ?? null) as { status?: string; charged?: number; balance?: number | null; charge?: number } | null;
  if (commit.error) console.error('[supabase-error] app/vendor-dashboard/collections/actions.ts · rpc:shop_portfolio_commit', commit.error);
  if (answer?.status === 'insufficient') {
    return { ok: false, error: portfolioShortText(Number(answer.charge ?? 0), Number(answer.balance ?? 0)) };
  }
  if (commit.error || (answer?.status !== 'ok' && answer?.status !== 'duplicate')) {
    return { ok: false, error: 'Your page could not be updated just now. Nothing was changed — please try again.' };
  }
  const charged = Number(answer?.charged ?? 0);

  after(() => hashAndScanVendorImages({ vendorProfileId: vendorId, refs: next.refs, surface: 'portfolio' }));
  revalidatePath('/vendor-dashboard/collections');
  revalidatePath('/vendor-dashboard/website');
  if (profile.business_slug) revalidatePath(`/v/${profile.business_slug}`);
  return { ok: true, text: charged > 0 ? `On your page · ${charged} ${charged === 1 ? 'credit' : 'credits'} from your shop wallet` : 'On your page' };
}
