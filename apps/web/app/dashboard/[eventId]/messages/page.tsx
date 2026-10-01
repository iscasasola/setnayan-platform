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
 * Nothing new is stored or computed here: the rows are the SAME
 * `buildCoupleConversationRows` the thread page's left column builds (stage,
 * last line), the service tag is the same `interestLabeller`, and unread is
 * `lib/couple-inbox.ts` — the one rule the Suppliers header's badge also reads,
 * so the badge and the dots cannot disagree.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchCoupleThreads, formatChatTimestamp } from '@/lib/chat';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { ThreadListAvatar } from '@/app/_components/chat/thread-list-card';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import { resolveVendorDisplayName, isVendorNameRevealed } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { buildCoupleConversationRows, matchesSearch, type ConversationRow } from '@/lib/conversation-list';
import { interestLabeller } from '@/lib/thread-interest-labels.server';
import { coupleUnreadCount, isActiveInboxThread, readCoupleUnread } from '@/lib/couple-inbox';
import { startThreadByVendorEmail } from './actions';
import { PageMasthead } from '@/app/_components/page-masthead';
import { formatCount } from '@/lib/format-number';
import { teamPicksForMessages, type TeamProfile, type TeamRow } from '@/lib/messages-team-picker';
import { StartThreadPicker } from './_components/start-thread-picker';

export const metadata = { title: 'Chats' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    error?: string;
    prefill_vendor_email?: string;
    q?: string;
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
  const threadIds = threads.map((t) => t.thread_id);
  const returnTo = `/dashboard/${eventId}/messages`;

  // ── Who the couple can start a conversation with: the suppliers on Your
  // Team (the same `event_vendors` rows the Suppliers page reads). See
  // lib/messages-team-picker.ts for why this replaced the email box.
  // 🔴 AN UNREAD TEAM IS NOT AN EMPTY TEAM. A refused read must not tell a
  // couple with five suppliers to "add a supplier first" — `teamReadFailed`
  // reaches the render and says what actually happened.
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
  const team = teamPicksForMessages(teamRows, (profRes.data ?? []) as TeamProfile[]);

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
  // audit gap #6): one resolver for the label, the SAME reveal predicate for the
  // logo, so they can never drift. Pre-reveal the avatar is initials.
  const displayNames = new Map<string, string>();
  const logoByVendor = new Map<string, string | null>();
  for (const t of threads) {
    const v = t.vendor;
    const isPaidTier = isTrueNameTier(v?.tier_state ?? null);
    const isVerified = v?.verification_state === 'verified';
    displayNames.set(
      t.vendor_profile_id,
      v
        ? resolveVendorDisplayName({
            business_name: v.business_name ?? null,
            name_revealed_at: v.name_revealed_at ?? null,
            services: v.services ?? null,
            screen_name: v.screen_name ?? null,
            isPaidTier,
            is_verified: isVerified,
            primary_canonical_service: v.services?.[0] ?? null,
            location_city: v.location_city ?? null,
          })
        : 'Supplier',
    );
    const revealed = v
      ? isVendorNameRevealed({
          name_revealed_at: v.name_revealed_at ?? null,
          isPaidTier,
          is_verified: isVerified,
          services: v.services ?? null,
        })
      : false;
    logoByVendor.set(t.vendor_profile_id, revealed ? v?.logo_url ?? null : null);
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

  const q = (search.q ?? '').trim().slice(0, 80);
  const shown = (list: typeof threads) =>
    list
      .map((t) => rowById.get(t.thread_id))
      .filter((r): r is ConversationRow => r != null && matchesSearch(r, q));

  // The SAME count the Suppliers header's badge shows.
  const unreadCount = coupleUnreadCount(unread, threads);

  const renderRow = (r: ConversationRow, archived: boolean) => {
    const vendorId = vendorOf.get(r.threadId) ?? '';
    const booked = r.stage === 'booked' || r.stage === 'completed';
    return (
      <li key={r.threadId} className="flex items-center gap-1 border-t border-ink/10" data-inbox-row={r.unread ? 'unread' : 'read'}>
        <Link href={`/dashboard/${eventId}/messages/${r.threadId}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
          <ThreadListAvatar logoUrl={logoByVendor.get(vendorId) ?? null} name={r.displayName} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className={`min-w-0 flex-1 truncate text-[15px] text-ink ${r.unread ? 'font-semibold' : 'font-medium'}`}>
                {r.displayName}
              </span>
              <span className="shrink-0 text-[12px] text-ink/50">{r.timeLabel}</span>
            </span>
            <span className="flex items-center gap-2 text-[12.5px] text-ink/55">
              {r.labels[0] ? <span className="truncate">{r.labels[0]}</span> : null}
              {booked ? (
                <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/60">
                  Booked
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              <span className={`min-w-0 flex-1 truncate text-[13.5px] ${r.unread ? 'font-semibold text-ink' : 'text-ink/60'}`}>
                {r.preview}
              </span>
              {r.unread ? (
                <span aria-label="Unread" className="h-2.5 w-2.5 shrink-0 rounded-full bg-mulberry" />
              ) : null}
            </span>
          </span>
        </Link>
        <ThreadArchiveToggle threadId={r.threadId} returnTo={returnTo} archived={archived} />
      </li>
    );
  };

  const activeRows = shown(activeThreads);
  const archivedRows = shown(archivedThreads);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      <PageMasthead title="Chats" />
      <header>
        <h2 aria-hidden className="font-display text-[28px] leading-none text-ink">
          Chats
        </h2>
        {unreadCount ? (
          <p className="mt-1 text-[13px] text-ink/60" data-inbox-unread={unreadCount}>
            {formatCount(unreadCount)} unread
          </p>
        ) : null}
      </header>

      {search.error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {search.error}
        </p>
      ) : null}

      {threads.length > 0 ? (
        <form method="get" action={returnTo} role="search">
          <label className="flex items-center gap-2 rounded-md border border-ink/15 bg-paper px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink/45" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search a supplier or a message"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40"
            />
          </label>
        </form>
      ) : null}

      {threads.length === 0 ? (
        <div className="py-10 text-center">
          <MessageSquare aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink">No chats yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Pick one of your suppliers below, or tap Ask for a quote on a supplier&rsquo;s page.
          </p>
          <div className="mt-4">
            <Link href={`/dashboard/${eventId}/vendors/categories`} className="button-secondary">
              Find a supplier
            </Link>
          </div>
        </div>
      ) : (
        <>
          {activeRows.length > 0 ? (
            <ul>{activeRows.map((r) => renderRow(r, false))}</ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink/60">
              {q ? `No chat matches “${q}”.` : 'No active chats — everything’s in Archived below.'}
            </p>
          )}

          {archivedRows.length > 0 ? (
            <details>
              <summary className="cursor-pointer list-none py-3 text-[13px] font-medium text-ink/60 hover:text-ink">
                Archived · <span className="font-mono">{archivedRows.length}</span>
              </summary>
              <ul>{archivedRows.map((r) => renderRow(r, true))}</ul>
            </details>
          ) : null}
        </>
      )}

      {/* Start a conversation — from the suppliers on Your Team (#6179), folded
          to the bottom of the inbox (#6234). */}
      <section className="sn-tile p-5">
        <h2 className="sn-eye mb-3">Start a conversation</h2>
        {teamReadFailed ? (
          <p role="alert" className="text-sm text-ink/70">
            We couldn&rsquo;t load your suppliers just now &mdash; this does not mean it is
            empty. Reload in a moment.
          </p>
        ) : team.length > 0 ? (
          <StartThreadPicker eventId={eventId} team={team} />
        ) : (
          <p className="text-sm text-ink/70">
            None of your suppliers can be messaged yet. Add one from Setnayan to{' '}
            <Link
              href={`/dashboard/${eventId}/vendors`}
              className="font-medium text-mulberry underline underline-offset-2"
            >
              Suppliers
            </Link>{' '}
            and you can message them from here.
          </p>
        )}
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
