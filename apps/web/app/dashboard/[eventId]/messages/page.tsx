/**
 * Chats — the couple's inbox, one thread per supplier, Messenger-style
 * (owner-approved 2026-10-01 — DECISION_LOG "SUPPLIER INBOX + FIND-A-SUPPLIER
 * DESIGN — APPROVED, WITH BOTH RECOMMENDATIONS"; prototype
 * `supplier_inbox_and_find_2026-10-01_fable.html` frame 2).
 *
 * Rows: logo · supplier name · service · last line · time · unread dot · a quiet
 * Booked pill; newest first; one search on top; a tap opens the One Chat Box
 * (`messages/[threadId]`, untouched). Archived stays folded below.
 *
 * 2026-10-28 · MESSENGER-SHAPED (chat prototype frame A; owner "look and feel like Messenger", "thumb bar",
 * "search will always be the same", "i want isolation per event", "users can only chat a supplier inside an
 * event"): the list is `ChatInbox` — big title, All · Unread · Suppliers, frameless rows that each carry their event
 * line, and the ONE search in the frosted thumb row with ✎ beside it. ✎ opens "Message a supplier": THIS event's
 * suppliers only (`StartThreadPicker` rows → the shipped `contactShortlistVendor`). The `?q=` server search is gone —
 * the field filters the rows already here (`lib/chat-inbox-search.ts`, the seam message-text search will use).
 *
 * Nothing new is stored or computed here: the rows are the SAME
 * `buildCoupleConversationRows` the thread page's left column builds (stage,
 * last line), the service tag is the same `interestLabeller`, and unread is
 * `lib/couple-inbox.ts` — the one rule the Suppliers header's badge also reads,
 * so the badge and the dots cannot disagree.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchCoupleThreads, formatChatTimestamp } from '@/lib/chat';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { ThreadListAvatar } from '@/app/_components/chat/thread-list-card';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import { nameForThread, readCoupleThreadSupplierNames } from '@/lib/chat-supplier-names';
import { buildCoupleConversationRows, type ConversationRow } from '@/lib/conversation-list';
import { interestLabeller } from '@/lib/thread-interest-labels.server';
import { coupleUnreadCount, isActiveInboxThread, readCoupleUnread } from '@/lib/couple-inbox';
import { startThreadByVendorEmail } from './actions';
import { PageMasthead } from '@/app/_components/page-masthead';
import { formatCount } from '@/lib/format-number';
import { findDoorHref } from '@/lib/suppliers-shell';
import { teamPicksForMessages, type TeamProfile, type TeamRow } from '@/lib/messages-team-picker';
import { StartThreadPicker } from './_components/start-thread-picker';
import { ChatInbox, type InboxRow } from './_components/chat-inbox';
import { formatLongDate } from '@/lib/format-date';

export const metadata = { title: 'Chats' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    error?: string;
    prefill_vendor_email?: string;
  }>;
};

export default async function CoupleMessagesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Newest first — `fetchCoupleThreads` orders by updated_at desc.
  const threads = await fetchCoupleThreads(supabase, eventId);
  const namesRead = readCoupleThreadSupplierNames(supabase, eventId);
  const threadIds = threads.map((t) => t.thread_id);
  const returnTo = `/dashboard/${eventId}/messages`;

  // ── Who the couple can start a conversation with: the suppliers on Your
  // Team (the same `event_vendors` rows the Suppliers page reads). See
  // lib/messages-team-picker.ts for why this replaced the email box.
  // 🔴 AN UNREAD TEAM IS NOT AN EMPTY TEAM. A refused read must not tell a
  // couple with five suppliers to "add a supplier first" — `teamReadFailed`
  // reaches the render and says what actually happened.
  // The event line every row carries (owner 2026-10-28, "i want isolation per event") — its name and date.
  const eventRowRead = supabase.from('events').select('display_name, event_date').eq('event_id', eventId).maybeSingle();
  const teamRes = await supabase
    .from('event_vendors')
    .select('vendor_id, marketplace_vendor_id')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (teamRes.error) {
    logQueryError('CoupleMessagesPage.team', teamRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const teamRows = (teamRes.data ?? []) as TeamRow[];
  const shopIds = [
    ...new Set(teamRows.map((r) => r.marketplace_vendor_id).filter((v): v is string => Boolean(v))),
  ];
  // Same columns the thread list's vendor embed reads (lib/chat.ts
  // COUPLE_VENDOR_EMBED), under the couple's own session — the anonymity
  // resolver needs them. A failed read shows no names, never real ones.
  const profRes = shopIds.length
    ? await supabase
        .from('vendor_profiles')
        .select(
          'vendor_profile_id, business_name, screen_name, name_revealed_at, services, location_city, tier_state, verification_state',
        )
        .in('vendor_profile_id', shopIds)
    : { data: [] as TeamProfile[], error: null };
  if (profRes.error) {
    logQueryError('CoupleMessagesPage.teamNames', profRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const teamReadFailed = Boolean(teamRes.error);
  const team = teamPicksForMessages(teamRows, (profRes.data ?? []) as TeamProfile[], (await namesRead).byShop);

  // Viber-style archive split (Data Retention Schedule 2026-07-11). Archiving
  // deletes nothing; displaced and removed threads fold into Archived too.
  // `isActiveInboxThread` is the SAME predicate the header badge counts over.
  const activeThreads = threads.filter(isActiveInboxThread);
  const archivedThreads = threads.filter((t) => !isActiveInboxThread(t));

  const [unread, lastRes, interestRes] = await Promise.all([
    readCoupleUnread(supabase, user.id, threadIds),
    threadIds.length > 0
      ? supabase
          .from('chat_messages')
          .select('thread_id, sender_role, body, created_at')
          .in('thread_id', threadIds)
          .order('created_at', { ascending: false })
          .limit(600)
      : Promise.resolve({ data: [], error: null }),
    threadIds.length > 0
      ? supabase
          .from('thread_service_interests')
          .select('thread_id, category_key, vendor_service_id, created_at')
          .in('thread_id', threadIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (lastRes.error) {
    logQueryError('CoupleMessagesPage.lastMessages', lastRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const lastMessages = new Map<string, { sender_role: string; body: string | null }>();
  for (const m of (lastRes.data ?? []) as Array<{ thread_id: string; sender_role: string; body: string | null }>) {
    if (!lastMessages.has(m.thread_id)) lastMessages.set(m.thread_id, { sender_role: m.sender_role, body: m.body });
  }

  if (interestRes.error) {
    logQueryError('CoupleMessagesPage.interests', interestRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const interests = (interestRes.data ?? []) as Array<{
    thread_id: string;
    category_key: string | null;
    vendor_service_id: string | null;
  }>;
  const labelInterest = await interestLabeller(createAdminClient(), interests);
  const labels = new Map<string, string[]>();
  for (const i of interests) {
    if (!labels.has(i.thread_id) && (i.category_key || i.vendor_service_id)) {
      labels.set(i.thread_id, [labelInterest(i)]);
    }
  }

  // 🔒 Anonymity-aware name AND logo (CLAUDE.md 2026-05-30 row · Data Flow Map
  // audit gap #6) — read through `couple_thread_supplier_names`, NOT the thread's
  // `vendor_profiles` embed. The embed is a read under the couple's RLS, which
  // refuses every shop that is not public + verified; the page then printed
  // 'Supplier' for that NULL (owner, live, 2026-10-28: "the 1 supplier is not
  // named on chat"). The function answers for every thread, sends the real name
  // and logo only once revealed, and the label is the same
  // `resolveVendorDisplayName` (lib/chat-supplier-names.ts). A failed read says so.
  const supplierNames = await namesRead;
  const displayNames = new Map<string, string>();
  const logoByVendor = new Map<string, string | null>();
  for (const t of threads) {
    const label = nameForThread(supplierNames, t.thread_id);
    displayNames.set(t.vendor_profile_id, label.name);
    logoByVendor.set(t.vendor_profile_id, label.logoUrl);
  }

  const rows = await buildCoupleConversationRows({
    supabase,
    eventId,
    threads: threads.map((t) => ({
      thread_id: t.thread_id,
      vendor_profile_id: t.vendor_profile_id,
      inquiry_status: t.inquiry_status ?? null,
      updated_at: t.updated_at,
    })),
    displayNames,
    labels,
    lastMessages,
    unreadThreadIds: new Set(unread.threadIds),
    formatTime: formatChatTimestamp,
  });
  const rowById = new Map(rows.map((r) => [r.threadId, r]));
  const vendorOf = new Map(threads.map((t) => [t.thread_id, t.vendor_profile_id]));

  // The SAME count the Suppliers header's badge shows.
  const unreadCount = coupleUnreadCount(unread, threads);

  const eventRes = await eventRowRead;
  if (eventRes.error) {
    logQueryError('CoupleMessagesPage.event', eventRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const ev = (eventRes.data ?? null) as { display_name?: string | null; event_date?: string | null } | null;
  // Short, beside the supplier's name (frame L): "Dec 18 · Ana & Miguel". The sheet's scope line uses the long date.
  const eventLine = [
    ev?.event_date
      ? new Date(`${ev.event_date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : null,
    ev?.display_name?.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');
  const eventLineLong = [ev?.event_date ? formatLongDate(ev.event_date) : null, ev?.display_name?.trim() || null]
    .filter(Boolean)
    .join(' · ');

  const archivedIds = new Set(archivedThreads.map((t) => t.thread_id));
  const toInboxRow = (r: ConversationRow): InboxRow => {
    const vendorId = vendorOf.get(r.threadId) ?? '';
    const archivedRow = archivedIds.has(r.threadId);
    return {
      threadId: r.threadId,
      href: `/dashboard/${eventId}/messages/${r.threadId}`,
      name: r.displayName,
      logoUrl: logoByVendor.get(vendorId) ?? null,
      preview: r.preview,
      timeLabel: r.timeLabel,
      unread: r.unread,
      eventLine,
      archived: archivedRow,
      archive: <ThreadArchiveToggle threadId={r.threadId} returnTo={returnTo} archived={archivedRow} />,
    };
  };
  const inboxRows = [...activeThreads, ...archivedThreads]
    .map((t) => rowById.get(t.thread_id))
    .filter((r): r is ConversationRow => r != null)
    .map(toInboxRow);

  return (
    <section className="mx-auto w-full max-w-2xl">
      <PageMasthead title="Chats" />
      <header className="mb-1">
        <h2 aria-hidden className="font-display text-[30px] font-semibold leading-tight text-ink">
          Chats
        </h2>
        {unreadCount ? (
          <p className="sr-only" data-inbox-unread={unreadCount}>
            {formatCount(unreadCount)} unread
          </p>
        ) : null}
      </header>

      {search.error ? (
        <p role="alert" className="mb-3 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {search.error}
        </p>
      ) : null}

      <ChatInbox
        rows={inboxRows}
        viewerId={user.id}
        empty={
          <div className="py-10 text-center">
            <MessageSquare aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink">No chats yet.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
              Tap ✎ to message one of this event&rsquo;s suppliers, or Ask for a quote on a supplier&rsquo;s page.
            </p>
            <div className="mt-4">
              <Link href={findDoorHref(eventId)} className="button-secondary">
                Find a supplier
              </Link>
            </div>
          </div>
        }
        newMessage={
          <>
            <p className="mb-2 mt-1 text-[13px] text-ink/60" data-new-message-scope="">
              {eventLineLong ? `${eventLineLong} — ` : ''}this event&rsquo;s suppliers only
            </p>
            {teamReadFailed ? (
              <p role="alert" className="text-sm text-ink/70">
                We couldn&rsquo;t load your suppliers just now &mdash; this does not mean it is
                empty. Reload in a moment.
              </p>
            ) : team.length > 0 ? (
              <StartThreadPicker eventId={eventId} team={team} variant="rows" />
            ) : (
              <p className="text-sm text-ink/70">
                None of your suppliers can be messaged yet. Add one from Setnayan to{' '}
                <Link
                  href={`/dashboard/${eventId}/vendors`}
                  className="font-medium text-sn-accent underline underline-offset-2"
                >
                  Suppliers
                </Link>{' '}
                and you can message them from here.
              </p>
            )}
          </>
        }
      />

      {/* ✎ "Message a supplier" (the thumb row) replaced the "Start a conversation" tile (#6179/#6234). */}
      <section>
        {/* The old email box, kept for ONE arrival only: the budget card's
            Message link for a supplier the couple typed in by hand carries the
            address THEY typed (`prefill_vendor_email` — never a Setnayan shop's,
            see vendor-itemization-card.tsx). If that address belongs to a shop,
            this opens it; otherwise the action says so. No arrival → no box. */}
        {search.prefill_vendor_email ? (
          <form action={startThreadByVendorEmail} className="mt-3">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_email" value={search.prefill_vendor_email} />
            <SubmitButton
              className="button-secondary inline-flex items-center justify-center gap-2"
              pendingLabel="Looking…"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Look for {search.prefill_vendor_email} on Setnayan
            </SubmitButton>
          </form>
        ) : null}
      </section>
    </section>
  );
}
