import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { isShareableThread } from '@/lib/service-share-targets';
import { sendChatMessageCore } from '@/lib/chat-send';
import { SHARE_CHAT_CLOSED, type OfferServiceResult } from '@/lib/offer-service-core';

/**
 * 💬 SEND A PORTFOLIO PHOTO TO A CHAT (ruling 5951; owner 9 Nov, approved Portfolio v3: *"Share will go to their
 * picked chatbox. they search for it or find it manually"*).
 *
 * The SAME gate as the service-card share (`offerServiceCore` with `notice: 'shared'`), in the same order:
 *   1. signed in, and the caller has a shop;
 *   2. the thread is THIS shop's (defense-in-depth atop RLS);
 *   3. the chat is one the shop can write in RIGHT NOW — `isShareableThread`, the picker's own predicate — so a stale
 *      picker can never post into a declined, expired or removed conversation;
 * and only then the post: the SHIPPED chat send (`sendChatMessageCore`, the composer's own core) with the photo as an
 * ordinary attachment and the optional note as its words, spoken as the shop (`asSide: 'vendor'`). That core judges
 * the file (type, size), stores it in the private thread-files bucket and tells the other party exactly as any chat
 * photo does — this file adds no second notice and no new email.
 *
 * 🔑 `notified` IS ALWAYS 0 HERE, ON PURPOSE: the chat's own notice goes out through `notifyOtherParty`, which reports
 * nothing back, so this function has no evidence of who was told — and the toast must never say "notified" on no
 * evidence (`sharedToast(name, 0)` = "Posted in <name>’s chat").
 * 🔒 app/_components/gallery/a-photo-goes-to-a-picked-chat.test.ts
 */
export async function sharePhotoCore(
  supabase: SupabaseClient,
  input: { threadId: string; photo: File | null; note?: string },
): Promise<OfferServiceResult> {
  const { threadId, photo } = input;
  if (!threadId || !(photo instanceof File) || photo.size === 0) {
    return { status: 'error', message: 'We couldn’t get the photo — nothing was sent.' };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { status: 'not_owner' };

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) return { status: 'not_owner' };
  if (!isShareableThread({ inquiry_status: thread.inquiry_status, archived_at: thread.archived_at ?? null })) {
    return { status: 'error', message: SHARE_CHAT_CLOSED };
  }

  const sent = await sendChatMessageCore(supabase, {
    threadId,
    body: (input.note ?? '').slice(0, 4000),
    attachment: photo,
    asSide: 'vendor',
  });
  if (!sent.ok) {
    // The core's own words (a file it refused, a blocked note) — never raw database text.
    return { status: 'error', message: sent.message };
  }
  return { status: 'ok', notified: 0 };
}
