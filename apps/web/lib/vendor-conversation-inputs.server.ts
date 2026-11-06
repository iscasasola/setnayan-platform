import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchInquiryCustomerFacts, type InquiryCustomerFacts } from '@/lib/inquiry-customer.server';
import { interestLabeller } from '@/lib/thread-interest-labels.server';
import { dayMonth } from '@/lib/format-date';
import { isDateTagWorthShowing, serviceTagVaries } from '@/lib/conversation-list';

/**
 * THE SUPPLIER'S CONVERSATION ROWS — WHAT EACH ROW SAYS, READ ONCE, FOR EVERY LIST THAT DRAWS THEM.
 *
 * Two pages draw a supplier's conversations as rows: the column beside an open thread
 * (`vendor-dashboard/messages/[threadId]`, owner 2026-09-08 "list · conversation · context") and the full-screen Chats
 * inbox (`vendor-dashboard/messages`, owner 2026-11-06: *"The chat page is a full screen page, correct? Independent of
 * any other menus?"*). Both hand the SAME inputs to the SAME builder (`buildVendorConversationRows`); this is where the
 * inputs are read, so the two lists cannot come to disagree about who a couple is, what they last said, or what they
 * asked about. (The thread page's block was lifted here verbatim on 2026-11-06 when the inbox became its second reader.)
 *
 * ⚡ THREE BATCHED READS FOR THE WHOLE LIST, not three per row — who each couple is, the last line of each
 * conversation, and the service each couple asked about.
 *
 * ⚠ EVERY ONE FAILS QUIET, AND SAYS SO TO THE LOG. These are a row's words, not the list itself: a refused read leaves
 * the row with what it can still say ("A Setnayan event", no preview), never a missing row. Whether the LIST was read
 * is the caller's question (`fetchVendorThreadsDetailed`), and the Chats page answers it on screen.
 *
 * Unread is NOT read here — each caller states its own rule beside its own read of `chat_thread_reads`. `lastMessageAt`
 * is returned so the column can compare the last word against the marker without a second read.
 */
export type VendorConversationThread = {
  thread_id: string;
  event_id: string;
};

export type VendorConversationInputs = {
  /** event_id → who the couple is (title, date, kind, city). Missing = not known. */
  customers: Map<string, InquiryCustomerFacts>;
  /** event_id → what the couple calls their celebration — the builder's `displayNames`. */
  displayNames: Map<string, string | null>;
  /** event_id → the small grey tags (the service asked about when it varies, the date when it is close). */
  labels: Map<string, string[]>;
  /** thread_id → the last message in it. */
  lastMessages: Map<string, { sender_role: string; body: string | null }>;
  /** thread_id → when that last message was said. */
  lastMessageAt: Map<string, string>;
};

export async function readVendorConversationInputs({
  supabase,
  adminClient,
  vendorProfileId,
  threads,
  nowMs,
  logAs,
}: {
  supabase: SupabaseClient;
  /** A vendor's own RLS nulls `events` on every thread — the customer facts need service role. The caller's ownership
   *  proof is the thread read it passes in (`fetchVendorThreads*`, scoped to its own shop). */
  adminClient: SupabaseClient;
  vendorProfileId: string;
  threads: ReadonlyArray<VendorConversationThread>;
  nowMs: number;
  /** The log's name for the page asking ("VendorThreadPage", "SupplierChats"). */
  logAs: string;
}): Promise<VendorConversationInputs> {
  const listThreadIds = threads.map((t) => t.thread_id);
  const listEventIds = [...new Set(threads.map((t) => t.event_id))];

  const [listCustomers, lastMessageRes, listInterestRes] = await Promise.all([
    // Who each couple is. A vendor's own RLS nulls `events` out on every thread,
    // so this is the admin-scoped helper the inbox already uses — the caller's
    // ownership proof is fetchVendorThreads.
    fetchInquiryCustomerFacts(adminClient, listEventIds),
    // The last line of each conversation. Ordered newest-first and capped: the
    // reducer keeps the FIRST row it sees per thread, which is that thread's
    // latest. The cap is a ceiling on work, not on correctness — a shop past it
    // loses the preview on its oldest conversations, never the conversation.
    listThreadIds.length > 0
      ? supabase
          .from('chat_messages')
          .select('thread_id, sender_role, body, created_at')
          .in('thread_id', listThreadIds)
          .order('created_at', { ascending: false })
          .limit(600)
      : Promise.resolve({ data: [], error: null }),
    // The service each couple asked about — one grey tag on the row.
    listThreadIds.length > 0
      ? supabase
          .from('thread_service_interests')
          .select('thread_id, category_key, vendor_service_id, created_at')
          .in('thread_id', listThreadIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (lastMessageRes.error) {
    logQueryError(`${logAs}.lastMessages`, lastMessageRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
  }
  const lastMessages = new Map<string, { sender_role: string; body: string | null }>();
  const lastMessageAt = new Map<string, string>();
  for (const m of (lastMessageRes.data ?? []) as Array<{
    thread_id: string;
    sender_role: string;
    body: string | null;
    created_at: string;
  }>) {
    if (!lastMessages.has(m.thread_id)) {
      lastMessages.set(m.thread_id, { sender_role: m.sender_role, body: m.body });
      lastMessageAt.set(m.thread_id, m.created_at);
    }
  }

  if (listInterestRes.error) {
    logQueryError(`${logAs}.listInterests`, listInterestRes.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
  }
  const interestByThread = new Map<string, string>();
  const listInterests = (listInterestRes.data ?? []) as Array<{
    thread_id: string;
    category_key: string | null;
    vendor_service_id: string | null;
  }>;
  const labelListInterest = await interestLabeller(adminClient, listInterests);
  for (const i of listInterests) {
    // First interest wins — the same "what did they ask about" the rail shows.
    if (!interestByThread.has(i.thread_id) && (i.category_key || i.vendor_service_id)) {
      interestByThread.set(i.thread_id, labelListInterest(i));
    }
  }

  // ⚠ A TAG THAT NEVER CHANGES SAYS NOTHING. If this shop's whole inbox is
  // one category, tagging every row with it (per `interestByThread` above)
  // repeats the same word down the column and costs a line for free — the
  // service tag earns its spot only once it actually distinguishes a row from
  // its neighbours.
  const showServiceTag = serviceTagVaries([...interestByThread.values()]);

  const displayNames = new Map<string, string | null>();
  const labels = new Map<string, string[]>();
  for (const t of threads) {
    const facts = listCustomers.get(t.event_id);
    displayNames.set(t.event_id, facts?.displayName ?? null);
    const tags: string[] = [];
    const service = interestByThread.get(t.thread_id);
    if (service && showServiceTag) tags.push(service);
    // ⚠ `event_date` is a DATE column, so it goes through the repo's own
    // formatter — `new Date('2026-12-18')` is the 17th west of Greenwich.
    // And only close to the day: a wedding sixteen months out is not live
    // context on who this row is, it's noise repeated down the column.
    if (isDateTagWorthShowing(facts?.eventDate, nowMs)) {
      const day = dayMonth(facts?.eventDate);
      if (day) tags.push(day);
    }
    labels.set(t.event_id, tags);
  }

  return { customers: listCustomers, displayNames, labels, lastMessages, lastMessageAt };
}
