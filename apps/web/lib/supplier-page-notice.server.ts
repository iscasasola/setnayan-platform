import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isR2Configured, r2Copy, r2Delete, r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { SUPPLIER_PAGE_PUBLISH_GAP_MS } from '@/lib/periodic-job-registry';
import { groupGuestNotices, type GuestNoticeGroup } from '@/lib/supplier-page-notice';

/**
 * THE 7-DAY GUEST NOTICE — the server half (reads for the guest, the R2 copy's lifecycle, the publish job).
 *
 * The rule lives in SQL (migration `supplier_page_photo_notice`): the window is stamped on insert and CHECKed, the ref
 * reaches `vendor_profiles.portfolio_r2_keys` only through `publish_supplier_page_photo`, and ANY hide of the album row
 * pulls it back off (trigger `a_hidden_album_photo_leaves_the_page`). SQL cannot touch a file, so the FILE is handled
 * here: copied into the shop's page folder only once the window has passed, and deleted when a guest removes it or a
 * takedown is honoured. Words and grouping are pure, in `lib/supplier-page-notice.ts`.
 */

/** Delete the page copy of an album photo. Best-effort: the ref is already off the page; an orphan is unreachable. */
export async function deleteSupplierPageCopy(pageRef: string | null | undefined): Promise<void> {
  if (!pageRef || !isR2Configured()) return;
  const { bucket, key } = parseR2Ref(pageRef);
  if (bucket !== R2_BUCKETS.media || !key.includes('/portfolio/from-album/')) return;
  try {
    await r2Delete({ bucket: R2_BUCKETS.media, key });
  } catch (err) {
    console.error('[supplier-page-notice] could not delete the page copy', err);
  }
}

/**
 * After a takedown is honoured on an album photo: the trigger has already pulled its ref off the page; this deletes the
 * file. Fail-soft — the photo is already off every page by the time this runs.
 */
export async function deletePageCopyAfterTakedown(admin: SupabaseClient, photoId: string): Promise<void> {
  if (!photoId) return;
  const { data, error } = await admin
    .from('supplier_page_photo_notices')
    .select('page_ref')
    .eq('photo_id', photoId)
    .maybeSingle();
  if (error) {
    logQueryError('supplierPageNotice.afterTakedown', error, { photoId });
    return;
  }
  await deleteSupplierPageCopy((data as { page_ref?: string } | null)?.page_ref);
}

/**
 * Every open notice at this event, grouped by supplier, with a thumbnail — for the guest's Event Hub. Read on the
 * service role: the caller has ALREADY proved the guest-session cookie belongs to this event. `null` = the read failed
 * (the hub then draws nothing rather than "nobody will show your photos").
 */
export async function readGuestSupplierPageNotices(eventId: string): Promise<GuestNoticeGroup[] | null> {
  if (!eventId) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('supplier_page_photo_notices')
    .select('notice_id, photo_id, vendor_profile_id, public_from, published_at, removed_at, vendor_papic_portfolio_photos(r2_object_key, hidden_at), vendor_profiles(business_name)')
    .eq('event_id', eventId)
    .is('removed_at', null)
    .order('noticed_at', { ascending: true })
    .limit(60);
  if (error) {
    logQueryError('supplierPageNotice.guestRead', error, { eventId });
    return null;
  }
  type Row = {
    notice_id: string;
    photo_id: string;
    vendor_profile_id: string;
    public_from: string;
    published_at: string | null;
    removed_at: string | null;
    vendor_papic_portfolio_photos: { r2_object_key: string | null; hidden_at: string | null } | null;
    vendor_profiles: { business_name: string | null } | null;
  };
  const rows = await Promise.all(
    ((data ?? []) as unknown as Row[])
      .filter((r) => r.vendor_papic_portfolio_photos && !r.vendor_papic_portfolio_photos.hidden_at)
      .map(async (r) => {
        const ref = r.vendor_papic_portfolio_photos?.r2_object_key ?? '';
        const { key } = parseR2Ref(ref);
        const url = ref && isR2Configured()
          ? await r2SignedGet({ bucket: R2_BUCKETS.media, key, expiresIn: 3600 }).catch(() => null)
          : null;
        return {
          notice_id: r.notice_id,
          photo_id: r.photo_id,
          vendor_profile_id: r.vendor_profile_id,
          public_from: r.public_from,
          published_at: r.published_at,
          removed_at: r.removed_at,
          supplier_name: r.vendor_profiles?.business_name ?? null,
          url,
        };
      }),
  );
  return groupGuestNotices(rows);
}

/**
 * THE PUBLISH — every notice whose 7 days have passed and that nobody removed: copy the album photo into the shop's
 * page folder, THEN ask SQL to put the ref on the page. SQL says no (removed in between, hidden, not due) → the copy
 * is deleted again. Returns how many went up.
 */
export async function publishDueSupplierPagePhotos(limit = 50): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('supplier_page_photo_notices')
    .select('notice_id, page_ref, vendor_papic_portfolio_photos(r2_object_key, hidden_at)')
    .is('published_at', null)
    .is('removed_at', null)
    .lte('public_from', new Date().toISOString())
    .order('public_from', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`[supplier-page-publish] read: ${error.message}`);
  type Due = {
    notice_id: string;
    page_ref: string;
    vendor_papic_portfolio_photos: { r2_object_key: string | null; hidden_at: string | null } | null;
  };
  let published = 0;
  for (const n of (data ?? []) as unknown as Due[]) {
    const album = n.vendor_papic_portfolio_photos;
    if (!album?.r2_object_key || album.hidden_at) continue;
    const from = parseR2Ref(album.r2_object_key);
    const to = parseR2Ref(n.page_ref);
    if (from.bucket !== R2_BUCKETS.media || to.bucket !== R2_BUCKETS.media) continue;
    try {
      await r2Copy({ bucket: R2_BUCKETS.media, fromKey: from.key, toKey: to.key });
    } catch (err) {
      console.error('[supplier-page-publish] copy failed — stays waiting', err);
      continue;
    }
    const { data: ok, error: pubErr } = await admin.rpc('publish_supplier_page_photo', { p_notice_id: n.notice_id });
    if (pubErr) {
      logQueryError('supplierPageNotice.publish', pubErr, { noticeId: n.notice_id });
      continue;
    }
    if (ok === true) published += 1;
    else await deleteSupplierPageCopy(n.page_ref);
  }
  return published;
}

/** CRON-FREE: fired from the admin and supplier layouts' `after()`; one winner per window. */
export async function maybeRunSupplierPagePublish(): Promise<void> {
  if (!isR2Configured()) return;
  await runClaimedJob('supplier-page-photo-publish', SUPPLIER_PAGE_PUBLISH_GAP_MS, async () => publishDueSupplierPagePhotos());
}
