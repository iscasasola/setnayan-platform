import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorThreadsDetailed, formatChatTimestamp } from '@/lib/chat';
import { logQueryError } from '@/lib/supabase/error-detect';
import { buildVendorConversationRows, type ConversationRow } from '@/lib/conversation-list';
import { readVendorConversationInputs } from '@/lib/vendor-conversation-inputs.server';
import { isActiveInboxThread, readCoupleUnread } from '@/lib/couple-inbox';
import { eventChatTitle } from '@/lib/event-chat-title';
import { eventTypeLabel } from '@/lib/demand-radar';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import type { InboxRow } from '@/app/dashboard/[eventId]/messages/_components/chat-inbox';
import { SUPPLIER_CHATS_HREF } from '../customers/anchors';
import { foldByEvent } from '@/lib/chats-by-event';
import { SupplierChats, type SupplierChatsRead } from './_components/supplier-chats';

/**
 * /vendor-dashboard/messages — THE SUPPLIER'S CHATS, a full-screen page of its own (owner 2026-11-06: *"The chat page
 * is a full screen page, correct? Independent of any other menus? Why is it still jumping to customer events"*).
 *
 * It was a redirect stub into Customers › Events (2026-07-12 → 2026-11-06). It is now the page the envelope opens, and
 * every old link, email and notification that names `/vendor-dashboard/messages` lands here instead of on a roster.
 * Customers › Events is unchanged — each of its rows still opens that event's chat. The look and every rule are in
 * `./_components/supplier-chats.tsx`.
 */
export const metadata = { title: 'Chats' };

export default async function SupplierChatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const read = await readSupplierChats(supabase, profile.vendor_profile_id, user.id);
  return <SupplierChats read={read} viewerId={user.id} />;
}

/**
 * ✉️ ONE ROW PER EVENT, AND IT OPENS THE PICKED CLIENT ON CHAT (Supplier Build 3 · Lane A, 9 Nov 2026 — DECISION_LOG
 * ✉️: *"that will just list all the events (no dupes)"*). The threads fold by event (`foldByEvent`, the event's newest
 * thread speaks for the row; unread if any is; archived only if all are), and a row's door is the picked client —
 * `/vendor-dashboard/clients/<event>?tab=chat` — drawn OVER this list by `./@client` (the same intercept Clients uses),
 * rising from the tapped row (`opensPicked`). The order (unread pinned, then most recent) is `ChatInbox`'s.
 *
 * The supplier's threads as inbox rows — newest first, active then archived. A refused THREAD read is `refused` (the
 * page says it could not load); a refused row-words read degrades the row, never the list
 * (`readVendorConversationInputs`); a refused unread read is `unreadMeasured: false`, never "nothing unread".
 */
async function readSupplierChats(
  supabase: SupabaseClient,
  vendorProfileId: string,
  userId: string,
): Promise<SupplierChatsRead> {
  let listed: Awaited<ReturnType<typeof fetchVendorThreadsDetailed>>;
  try {
    listed = await fetchVendorThreadsDetailed(supabase, vendorProfileId);
  } catch (caught) {
    logQueryError(
      'SupplierChats.threads',
      caught instanceof Error ? caught : new Error(String(caught)),
      { vendor_profile_id: vendorProfileId },
      'graceful_degrade',
    );
    return { kind: 'refused' };
  }
  const { threads, complete } = listed;
  const admin = createAdminClient();
  const nowMs = Date.now();

  const [inputs, unread] = await Promise.all([
    readVendorConversationInputs({
      supabase,
      adminClient: admin,
      vendorProfileId,
      threads,
      nowMs,
      logAs: 'SupplierChats',
    }),
    // The ✉ badge's own rule (`count_unread_message_threads()`), per thread — so the dots and the number agree.
    readCoupleUnread(
      supabase,
      userId,
      threads.map((t) => t.thread_id),
    ),
  ]);

  const rows = await buildVendorConversationRows({
    supabase,
    adminClient: admin,
    vendorProfileId,
    threads: threads.map((t) => ({
      thread_id: t.thread_id,
      event_id: t.event_id,
      inquiry_status: t.inquiry_status ?? null,
      updated_at: t.updated_at,
    })),
    displayNames: inputs.displayNames,
    labels: inputs.labels,
    lastMessages: inputs.lastMessages,
    unreadThreadIds: new Set(unread.threadIds),
    formatTime: formatChatTimestamp,
  });
  const rowById = new Map(rows.map((r) => [r.threadId, r]));

  // ✉️ One row per EVENT — the event's newest thread leads (lib/chats-by-event.ts).
  const unreadIds = new Set(unread.threadIds);
  const folds = foldByEvent(
    threads.map((t) => ({
      threadId: t.thread_id,
      eventId: t.event_id,
      lastAt: t.updated_at,
      unread: rowById.get(t.thread_id)?.unread ?? unreadIds.has(t.thread_id),
      archived: !isActiveInboxThread(t),
    })),
  );

  const toInboxRow = (r: ConversationRow, isArchived: boolean, unreadOnEvent: boolean): InboxRow => {
    const facts = inputs.customers.get(r.eventId);
    const kind = facts?.eventType && facts.eventType !== 'unspecified' ? eventTypeLabel(facts.eventType) : null;
    // ONE EVENT, ONE CHAT TITLE — the same words the thread head prints. With no facts read, the builder's own honest
    // fallback ("A Setnayan event"), never an invented "(date not set)".
    const name = facts ? eventChatTitle({ name: facts.displayName, kind, date: facts.eventDate, nowMs }) : r.displayName;
    return {
      threadId: r.threadId,
      // ✉️ The picked client, already on its Chat page — drawn over this list (`./@client`).
      href: `/vendor-dashboard/clients/${r.eventId}?tab=chat`,
      opensPicked: true,
      name,
      logoUrl: null,
      preview: r.preview,
      timeLabel: r.timeLabel,
      unread: unreadOnEvent,
      // The chat title IS this row's event line — whose event, which kind, which day ("Ana's Wedding (Dec 12)"), so two
      // events of one customer never read as one. Nothing beside it: at 390 a second line there cut the title's date.
      eventLine: '',
      archived: isArchived,
      archive: <ThreadArchiveToggle threadId={r.threadId} returnTo={SUPPLIER_CHATS_HREF} archived={isArchived} />,
      // 🚦 TODO(Build 3 · Lane B): `needsYou: needsYouLevel(...)` — the one rule; no row guesses a level meanwhile.
    };
  };

  // Viber-style archive split, the couple's own predicate: an event whose every thread is archived, displaced or
  // removed folds below; the rest stay newest first (`ChatInbox` pins the unread ones on top).
  const rowsFor = (archived: boolean) =>
    folds
      .filter((f) => f.archived === archived)
      .map((f) => {
        const r = rowById.get(f.lead.threadId);
        return r ? toInboxRow(r, archived, f.unread) : null;
      })
      .filter((r): r is InboxRow => r != null);

  return {
    kind: 'read',
    rows: [...rowsFor(false), ...rowsFor(true)],
    unreadMeasured: unread.measured,
    complete,
  };
}
