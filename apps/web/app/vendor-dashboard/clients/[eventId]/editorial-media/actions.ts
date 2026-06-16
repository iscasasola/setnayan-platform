'use server';

// ============================================================================
// Vendor "From Your Vendors" editorial-media submit (iteration 0046, Inc 2).
//
// A vendor who is the couple's RECOMMENDED / first-pick for a category on an
// event (event_vendors.selection_match_rank = 1) may submit up to 3 photos +
// up to 3 five-second clips of their day-of service. The media auto-shows on
// the couple's editorial once it clears the NSFW screen; the couple can hide
// any item. Clips arrive already baked to a forward+reverse boomerang.
//
// The eligibility gate + the 3-each cap are enforced HERE (not RLS): the
// recommended-pick link runs event_vendors(selection_match_rank=1).service_id
// → vendor_services.vendor_profile_id, which the vendor can't read under RLS,
// so the action resolves it with the admin client and inserts on their behalf.
// ============================================================================

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { screenEditorialVendorMedia } from '@/lib/nsfw-screen';
import {
  findRecommendedEventVendorId,
  MAX_PER_TYPE,
  type SubmitMediaItem,
} from '@/lib/editorial-vendor-media';

export async function submitVendorEditorialMedia(
  eventId: string,
  items: SubmitMediaItem[],
): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Nothing to submit.' };
  }
  // Validate shape early.
  for (const it of items) {
    if (it.type !== 'photo' && it.type !== 'clip') return { ok: false, error: 'Bad media type.' };
    if (typeof it.stillRef !== 'string' || !it.stillRef) return { ok: false, error: 'Missing image.' };
    if (it.type === 'clip' && !it.boomerangRef) return { ok: false, error: 'A clip needs its boomerang.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No vendor profile.' };

  const admin = createAdminClient();

  // 1. Eligibility gate — must be the couple's recommended pick.
  const eventVendorId = await findRecommendedEventVendorId(admin, eventId, profile.vendor_profile_id);
  if (!eventVendorId) {
    return {
      ok: false,
      error: 'Only the couple’s recommended vendor for a category can add editorial media.',
    };
  }

  // 2. Cap — at most 3 photos + 3 clips per vendor per event (existing + new).
  const { data: existing } = await admin
    .from('editorial_vendor_media')
    .select('media_type')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const counts = { photo: 0, clip: 0 };
  for (const r of (existing ?? []) as Array<{ media_type: 'photo' | 'clip' }>) {
    if (r.media_type === 'photo' || r.media_type === 'clip') counts[r.media_type] += 1;
  }
  for (const it of items) counts[it.type] += 1;
  if (counts.photo > MAX_PER_TYPE || counts.clip > MAX_PER_TYPE) {
    return {
      ok: false,
      error: `Up to ${MAX_PER_TYPE} photos and ${MAX_PER_TYPE} clips per event.`,
    };
  }

  // 3. Insert (admin — the recommended-pick gate above is the trust boundary).
  const baseSort = (existing ?? []).length;
  const payload = items.map((it, i) => ({
    event_id: eventId,
    vendor_profile_id: profile.vendor_profile_id,
    event_vendor_id: eventVendorId,
    media_type: it.type,
    boomerang_r2_key: it.type === 'clip' ? it.boomerangRef ?? null : null,
    still_r2_key: it.stillRef,
    caption: it.caption?.slice(0, 140) || null,
    sort_order: baseSort + i,
    created_by: user.id,
  }));
  const { data: inserted, error } = await admin
    .from('editorial_vendor_media')
    .insert(payload)
    .select('media_id, still_r2_key');
  if (error) return { ok: false, error: 'Could not save your media.' };

  // 4. NSFW screen each new row off the response (fire-and-forget). The public
  //    editorial fails closed (only 'clean' shows), so nothing surfaces until
  //    these settle.
  const rows = (inserted ?? []) as Array<{ media_id: string; still_r2_key: string }>;
  after(async () => {
    await Promise.allSettled(
      rows.map((r) =>
        screenEditorialVendorMedia({ mediaId: r.media_id, stillR2Key: r.still_r2_key }),
      ),
    );
  });

  revalidatePath(`/vendor-dashboard/clients/${eventId}/editorial-media`);
  return { ok: true, inserted: rows.length };
}

export async function deleteVendorEditorialMedia(
  eventId: string,
  mediaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No vendor profile.' };

  const admin = createAdminClient();
  // Scope the delete to THIS vendor's own row on THIS event — never another's.
  const { error } = await admin
    .from('editorial_vendor_media')
    .delete()
    .eq('media_id', mediaId)
    .eq('event_id', eventId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) return { ok: false, error: 'Could not remove that.' };
  revalidatePath(`/vendor-dashboard/clients/${eventId}/editorial-media`);
  return { ok: true };
}
