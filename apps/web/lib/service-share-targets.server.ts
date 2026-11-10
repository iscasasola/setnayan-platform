import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchInquiryCustomerFacts } from '@/lib/inquiry-customer.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { initialsFor } from '@/lib/conversation-list';
import { dayMonthYear } from '@/lib/service-open-bookings';
import {
  isShareableThread,
  SHARE_TARGET_UNNAMED,
  type ShareTargetsRead,
} from '@/lib/service-share-targets';

/**
 * 🔗 WHERE A SERVICE CARD CAN BE SHARED — this shop's CLIENT EVENTS (owner 2026-11-11, verbatim: *"Share does not
 * share to anyone. It is share to an client event. To enter to a chat. That is notified so the client can see."*;
 * the approved prototype's frame G, `prototypes/service_card_row_2026-11-11/`).
 *
 * A client event is an event that has a conversation with THIS shop that the shop can write in:
 *   · `inquiry_status = 'accepted'` — a supplier cannot reply before accepting (`acceptInquiry` in lib/chat-actions.ts
 *     is "the single enforcement point for can this vendor answer?"), so a pending ask is not a chat to post into;
 *   · `archived_at IS NULL` — the couple has not removed this supplier (the thread is kept as evidence, folded away).
 * Declined · withdrawn · expired · displaced threads are closed conversations and are not listed.
 *
 * The name and date are the event's own (`fetchInquiryCustomerFacts`, admin-scoped: a shop holds no `events` RLS).
 * The ownership proof that makes that read legitimate is the thread read above it, scoped to this shop.
 *
 * ⚠ A READ THAT FAILED IS `unreadable`, NEVER AN EMPTY LIST — "No client events yet" to a shop with twelve would be
 * the same lie the 2026-08-20 sweep removed everywhere else. The post re-checks the thread on the server
 * (`offerServiceCore` with `notice: 'shared'`), so this list only decides what is offered.
 *
 * 🔒 app/vendor-dashboard/services/share-posts-the-card-into-a-client-chat.test.ts
 */
export type { ShareTarget, ShareTargetsRead } from '@/lib/service-share-targets';


export async function readShareTargets(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<ShareTargetsRead> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select('thread_id, event_id, inquiry_status, archived_at, updated_at')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('inquiry_status', 'accepted')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) {
    logQueryError('readShareTargets', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unreadable' };
  }
  const rows = ((data ?? []) as Array<{
    thread_id: string;
    event_id: string | null;
    inquiry_status: string | null;
    archived_at: string | null;
  }>).filter((r): r is typeof r & { event_id: string } => !!r.event_id && isShareableThread(r));

  // One conversation per event (newest kept) — the picker lists events, not threads.
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.event_id) ? false : (seen.add(r.event_id), true)));

  const facts = await fetchInquiryCustomerFacts(admin, unique.map((r) => r.event_id));
  const targets = unique.map((r) => {
    const f = facts.get(r.event_id);
    const name = f?.displayName?.trim() || SHARE_TARGET_UNNAMED;
    const eventDate = f?.eventDate ?? null;
    return {
      threadId: r.thread_id,
      eventId: r.event_id,
      name,
      eventDate,
      dateLabel: dayMonthYear(eventDate),
      initials: initialsFor(name),
    };
  });
  // Soonest event first (the prototype's order); undated last.
  targets.sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
  return { status: 'ok', targets };
}
