import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { recordThreadInterests } from '@/lib/thread-interests';
import { displayServiceLabel } from '@/lib/vendors';
import { isShareableThread } from '@/lib/service-share-targets';

/**
 * Shared CORE for offerServiceInterest (vendor inverse cross-sell) — a vendor
 * offers one of THEIR OWN active services back to the couple in a thread,
 * recorded as a thread_service_interests row (source='vendor_offered'). Split
 * out of the collocated server action so the SAME ownership + active-service
 * gating runs under both the web action and the native endpoint
 * (api/vendor/chat/[threadId]/offer-service). Metadata only — never touches the
 * token/accept flow. The caller passes its OWN RLS-scoped client.
 *
 * ── 2026-09-09 · THE OFFER NOW POSTS THE SUPPLIER'S CARD ───────────────────
 * Owner: *"the service card of each service still needs that photo/image/video."*
 * Recording the interest row is no longer the whole job — it only ever produced
 * ONE WORD in the couple's "Inquiring about" chip row, and measured on
 * production the same day BOTH live services have a NULL `title`, so that word
 * was the bare category. The pitch is the photograph and the price. So the same
 * gate that records the interest also posts a chat_messages row carrying
 * `offered_service_id`, which the shared message stream renders as the card.
 *
 * 🔑 THE MESSAGE IS PART OF SUCCESS, NOT A BEST-EFFORT TAIL. If the insert
 * fails this returns an error and the vendor is told, because the alternative
 * is the exact defect this change exists to remove: the vendor reads "Offered",
 * the couple sees a word in a chip row, and nothing anywhere says the card
 * never arrived. Retrying is safe — `recordThreadInterests` is idempotent
 * (UNIQUE(thread_id, vendor_service_id) + ON CONFLICT DO NOTHING), so a second
 * attempt re-posts the message without stacking a duplicate interest.
 *
 * ⚠ The insert runs under the CALLER's RLS-scoped client, never the admin one,
 * so `tg_chat_messages_derive_sender` stamps sender_role='vendor' from
 * auth.uid(). A service-role insert would take the trigger's early return and
 * land a message attributed to nobody.
 */
/**
 * ── 2026-11-11 · SHARE FROM SHOP › SERVICES TELLS THE CLIENT IN THE APP ONLY ──
 * Owner, verbatim: *"Share does not share to anyone. It is share to an client
 * event. To enter to a chat. That is notified so the client can see."* The Share
 * icon under a card posts it through THIS function — the same gate, the same
 * card in the chat. Only the notice differs: `notice: 'shared'` sends
 * `service_card_shared`, which is NOT on the email allowlist (owner rule
 * 2026-10-11: no new emails without his word). The in-chat ＋ offer keeps the
 * default `chat_message`, exactly as before. A share also re-asks which chat it
 * is: an accepted conversation the couple has not removed (`isShareableThread`,
 * the picker's own predicate) — a stale sheet cannot post into a closed one.
 * 🔒 lib/a-shared-card-never-emails.test.ts
 */
export type OfferServiceNotice = 'chat' | 'shared';

/** Said when a share's chat is no longer one the supplier can write in. */
export const SHARE_CHAT_CLOSED = 'That chat is closed, so nothing was posted. Pick another client event.';

export type OfferServiceResult =
  /** `notified` = how many of the client's hosts were sent the notice. 0 is said as 0 (never "notified"). */
  | { status: 'ok'; notified: number }
  | { status: 'not_signed_in' }
  | { status: 'not_owner' }
  | { status: 'invalid_service' }
  | { status: 'error'; message: string };

export async function offerServiceCore(
  supabase: SupabaseClient,
  input: { threadId: string; vendorServiceId: string; notice?: OfferServiceNotice },
): Promise<OfferServiceResult> {
  const { threadId, vendorServiceId, notice = 'chat' } = input;
  if (!threadId || !vendorServiceId) {
    return { status: 'error', message: 'Invalid input' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { status: 'not_owner' };

  // The thread must belong to this vendor (defense-in-depth atop RLS).
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    return { status: 'not_owner' };
  }
  if (notice === 'shared' && !isShareableThread({ inquiry_status: thread.inquiry_status, archived_at: thread.archived_at ?? null })) {
    return { status: 'error', message: SHARE_CHAT_CLOSED };
  }

  // The offered service must be one of this vendor's own active services.
  const admin = createAdminClient();
  const { data: svc } = await admin
    .from('vendor_services')
    .select('vendor_service_id, category, title')
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!svc) return { status: 'invalid_service' };
  const service = svc as { category: string | null; title: string | null };

  await recordThreadInterests(supabase, {
    threadId,
    addedByRole: 'vendor',
    seeds: [
      {
        vendorServiceId,
        categoryKey: service.category ?? null,
        source: 'vendor_offered',
      },
    ],
  });

  // The card itself. The body is the readable fallback the stream shows until
  // the card resolves — and the whole of what a couple sees if the service is
  // later retired (the FK is ON DELETE SET NULL). It carries NO price: a number
  // typed into a message body is a second derivation of the money, frozen at
  // send time, that would drift from the card sitting beside it.
  const offeredName =
    service.title?.trim() ||
    (service.category ? displayServiceLabel(service.category) : 'a service');
  const { error: cardError } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: thread.event_id,
    vendor_profile_id: thread.vendor_profile_id,
    body: `Offered: ${offeredName}`,
    offered_service_id: vendorServiceId,
  });
  if (cardError) {
    console.error('[offerServiceCore] offer card insert failed:', cardError.message);
    return {
      status: 'error',
      message: 'Couldn’t post your service card. Please try again.',
    };
  }

  // Notify every couple member that the vendor offered one of their services
  // in-thread (best-effort — the interest row already landed; a failed notify
  // must not affect the offer). Fanned out over couple-type event_members via
  // the admin client, mirroring the vendor→couple chat_message path.
  let notified = 0;
  try {
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const vendorName = vendor?.business_name?.trim() || 'a supplier';
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', thread.event_id)
      .eq('member_type', 'couple');
    for (const m of members ?? []) {
      if (!m.user_id) continue;
      if (notice === 'shared') {
        await emitNotification({
          userId: m.user_id,
          type: 'service_card_shared',
          title: `${vendorName} shared a service card`,
          body: 'It is in your chat with them.',
          relatedUrl: `/dashboard/${thread.event_id}/messages/${threadId}`,
        });
      } else {
        await emitNotification({
          userId: m.user_id,
          type: 'chat_message',
          title: `${vendorName} offered a service`,
          body: 'They sent one of their service cards to your conversation.',
          relatedUrl: `/dashboard/${thread.event_id}/messages/${threadId}`,
        });
      }
      notified += 1;
    }
  } catch (e) {
    console.error('[offerServiceCore] couple notify failed:', e);
  }

  return { status: 'ok', notified };
}
