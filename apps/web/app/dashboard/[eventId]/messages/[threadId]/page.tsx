import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchCoupleThreads, fetchMessages, fetchThreadById, formatChatTimestamp } from '@/lib/chat';
import { ConversationColumn } from '@/app/_components/chat/conversation-column';
import { buildCoupleConversationRows } from '@/lib/conversation-list';
import { interestChipLabel } from '@/lib/thread-interests';
import { sendChatMessage, markThreadRead } from '@/lib/chat-actions';
import { getThreadBlockState } from '@/lib/chat-block';
import { withdrawInquiry } from '@/app/dashboard/[eventId]/messages/actions';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { canonicalServiceToPlanGroupId } from '@/lib/wedding-plan-groups';
import { resolveLivePax } from '@/lib/pax';
import { parseThreadView } from '@/lib/thread-view';
import { createAdminClient } from '@/lib/supabase/admin';
import { deriveThreadStage } from '@/lib/vendor-thread-stage';
import { buildSupplierStanding } from '@/lib/supplier-standing';
import {
  fetchThreadPayments,
  fetchLiveQuoteTotalPhp,
} from '@/lib/thread-decision-sources.server';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { fetchThreadLockHandshake } from '@/lib/thread-lock-handshake.server';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { NegotiationComposerMenu } from '@/app/_components/negotiation-composer-menu';
import { ThreadCallLauncher } from '@/app/_components/thread-call-launcher';
import { resolveThreadCallsEnabled } from '@/lib/thread-calls-gate';
import { ChatThreadMenu } from '@/app/_components/chat-thread-menu';
import { ChatSafetyBanner } from '@/app/_components/chat-privacy-notice';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';
import { ThreadQuotationsCard } from './_components/thread-quotations-card';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Thread' };

type Props = {
  params: Promise<{ eventId: string; threadId: string }>;
  /** `?view=decisions|files` — see lib/thread-view.ts. */
  searchParams?: Promise<{ view?: string | string[] }>;
};

export default async function CoupleThreadPage({ params, searchParams }: Props) {
  // Read on the server so a Decisions link paints Decisions, not the chat.
  const initialView = parseThreadView((await searchParams)?.view);
  const { eventId, threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.event_id !== eventId) notFound();

  // Event date bounds the meeting-request picker (today → day before the event).
  const { data: eventRow, error: eventRowError } = await supabase
    .from('events')
    .select('event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventRowError) {
    logQueryError(
      'CoupleThreadPage.event',
      eventRowError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const eventDate = (eventRow as { event_date?: string | null } | null)?.event_date ?? null;

  // UGC block state (Apple 1.2) — drives the thread menu label + composer gating.
  const blockState = await getThreadBlockState(thread, user.id, 'couple');

  // Is voice/video calling unlocked for this vendor's tier? (paid capability,
  // gate-dark by default). The couple sees the call UI only when it's on.
  const callsEnabled = await resolveThreadCallsEnabled(thread.vendor_profile_id);

  // Mark this thread read for the couple viewer so the Messages-icon unread
  // badge clears (migration 20260728000000_chat_thread_reads.sql). No-op +
  // logged if the read-marker table isn't pushed yet — opening the thread is
  // never blocked by this.
  await markThreadRead(threadId);

  // Anonymity surface per CLAUDE.md 2026-05-30 row — pull screen_name +
  // name_revealed_at + services + location_city so the header label and
  // the <ChatMessageStream> counterpartyLabel render through the canonical
  // `resolveVendorDisplayName` helper. Free/Verified vendors pre-first-reply
  // surface as their Bark screen_name; Pro/Enterprise + revealed + venue
  // vendors surface as business_name. Single resolver call drives both
  // surfaces so the header pill and the in-thread sender attribution stay
  // in lock-step.
  const { data: vendor, error: vendorError } = await supabase
    .from('vendor_profiles')
    .select(
      'business_name, logo_url, tagline, screen_name, name_revealed_at, services, location_city, tier_state, verification_state',
    )
    .eq('vendor_profile_id', thread.vendor_profile_id)
    .maybeSingle();
  if (vendorError) {
    logQueryError(
      'CoupleThreadPage.vendor',
      vendorError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  // Server-render the first batch so the page is useful on first paint and
  // remains SEO-friendly. The <ChatMessageStream> client component takes
  // over from here, subscribing to Supabase Realtime for new inserts/updates.
  const initialMessages = await fetchMessages(supabase, threadId);

  // PR-H · the frozen-price line in this thread must not claim a booking that
  // does not exist yet. The COUPLE reads `event_vendors` through their own
  // session — RLS is the boundary here, and it is sufficient.
  const lockHandshake = await fetchThreadLockHandshake(supabase, {
    eventId: thread.event_id,
    vendorProfileId: thread.vendor_profile_id,
  });

  /**
   * ── DECISIONS · the couple's side of "where are we with this supplier?" ────
   *
   * The same view the supplier has, from this side. The standing sentence is
   * rendered HERE and not on the supplier's page, because
   * `buildSupplierStanding` speaks in the couple's second person — "waiting on
   * you" means the couple owes the answer. It is the S6 derivation verbatim;
   * the bench card draws the same string, which is what makes showing it twice
   * safe.
   *
   * ⚠ There is no guest-count source on this side. The surcharge proposal is
   * the SUPPLIER's to act on (`fetchVendorPaxProposals` is scoped to their
   * bookings and their pricing), so the couple's Decisions list carries the
   * payments and the message cards. Showing the couple a decision only the
   * supplier can take would be a to-do they cannot do.
   */
  const decisionAdmin = createAdminClient();
  const [threadStage, liveQuoteTotalPhp, decisionPayments] = await Promise.all([
    deriveThreadStage({
      supabase,
      adminClient: decisionAdmin,
      eventId,
      vendorProfileId: thread.vendor_profile_id,
      inquiryStatus: thread.inquiry_status,
    }),
    fetchLiveQuoteTotalPhp({
      supabase,
      eventId,
      vendorProfileId: thread.vendor_profile_id,
    }),
    fetchThreadPayments({
      adminClient: decisionAdmin,
      eventId,
      vendorProfileId: thread.vendor_profile_id,
    }),
  ]);

  const lastThreadMessage = initialMessages[initialMessages.length - 1];
  const threadStanding = buildSupplierStanding({
    stage: threadStage,
    // The couple is reading the conversation, so there is one by definition —
    // this is the branch that keeps an invented grievance off a stranger's
    // bench card, and it cannot apply here.
    hasThread: true,
    quotedAmountPhp: liveQuoteTotalPhp,
    lastSpeaker:
      lastThreadMessage == null
        ? null
        : lastThreadMessage.sender_role === 'vendor'
          ? 'vendor'
          : lastThreadMessage.sender_role === 'couple'
            ? 'couple'
            : null,
    lastSaidAtMs: lastThreadMessage
      ? Date.parse(lastThreadMessage.created_at) || null
      : null,
    nowMs: Date.now(),
  });
  const vendorLabel = vendor
    ? resolveVendorDisplayName({
        business_name: vendor.business_name ?? null,
        name_revealed_at: vendor.name_revealed_at ?? null,
        services: vendor.services ?? null,
        screen_name: vendor.screen_name ?? null,
        // Phase C: Pro/Enterprise reveal real business_name day-1. Open-it-up
        // lock: a VERIFIED vendor's name is never gated (any tier).
        isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
        is_verified: vendor.verification_state === 'verified',
        primary_canonical_service: vendor.services?.[0] ?? null,
        location_city: vendor.location_city ?? null,
      })
    : 'Vendor';

  // Fresh live pax (Phase 5) — the couple's own client can read their guests,
  // so show the current count, matching what the vendor now sees.
  const livePax = await resolveLivePax(supabase, thread.event_id);
  const headerPax = livePax ?? thread.pax_current;

  // One-follow-up gate (inquiry-followthrough 2026-06-16). Count only
  // COUPLE-authored rows. A `pending` thread is NOT couple-only: the Vendor
  // Auto-Reply Assistant posts into it as `sender_role='vendor', is_bot=true`
  // (lib/vendor-autoreply/inbox-hook.ts) and `'system'` notes exist in the enum
  // too — so `couple count == total messages` is FALSE, and counting every row
  // let the bot's own reply eat one of the couple's two allowed pre-accept
  // messages. Allow the composer for the inquiry itself (0 couple messages) and
  // exactly ONE follow-up nudge (1); past that the form re-disables until the
  // vendor accepts. Mirrors `countCoupleMessages` (lib/chat.ts) behind the
  // server gate in sendChatMessage so the UI and the no-JS form path agree.
  const coupleMsgCount = initialMessages.filter(
    (m) => m.sender_role === 'couple',
  ).length;
  const canFollowUpWhilePending = coupleMsgCount <= 1;

  // Decline reason (already on the thread row) — surfaced verbatim in the
  // declined-state copy when the vendor left one. Anonymity is preserved: the
  // resolved label is the vendor's screen_name pre-reveal, never a name leak.
  const declineReason = thread.decline_reason?.trim() || null;

  // "See similar vendors" hand-off (inquiry-followthrough 2026-06-16): deep-link
  // to the matching plan group on the Services surface so the couple lands in
  // the right category, not a generic list. The accordion already opens the
  // folder + leaf for a `#group-<id>` hash (plan-budget-accordion useEffect).
  // Fail-soft: unknown / unmappable canonical service → plain link, never a
  // broken anchor.
  const primaryCanonicalService = vendor?.services?.[0] ?? null;
  const similarGroupId = primaryCanonicalService
    ? canonicalServiceToPlanGroupId(primaryCanonicalService)
    : null;
  const similarVendorsHref = `/dashboard/${eventId}/vendors${
    similarGroupId ? `#group-${similarGroupId}` : ''
  }`;

  /* ── THE LEFT COLUMN: every supplier they are talking to, beside this one ──
     Owner 2026-09-08: "list · conversation · context". The couple's chips are
     their own words — All · Has a quote · Booked · Waiting · Closed.

     ⚡ FOUR BATCHED READS FOR THE WHOLE COLUMN, plus the three stage probes
     inside the builder. Never one per row.

     ⚠ EVERY ONE FAILS QUIET. This column is navigation, not the page — a
     refused read must leave the conversation itself readable. */
  const listThreads = await fetchCoupleThreads(supabase, eventId).catch((caught: unknown) => {
    logQueryError(
      'CoupleThreadPage.conversationList',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
    return [] as Awaited<ReturnType<typeof fetchCoupleThreads>>;
  });
  /* A removed or displaced conversation is folded away on the couple's own
     Messages page; the column beside a thread keeps the same shape rather than
     inventing a second idea of which conversations exist. The one being READ
     always survives the filter — a column that omits the open thread is a
     column that cannot show you where you are. */
  const listVisible = listThreads.filter(
    (t) => t.thread_id === threadId || (!t.archived && t.archived_at == null),
  );
  const listThreadIds = listVisible.map((t) => t.thread_id);

  const [listLastRes, listInterestRes, listReadRes] = await Promise.all([
    listThreadIds.length > 0
      ? supabase
          .from('chat_messages')
          .select('thread_id, sender_role, body, created_at')
          .in('thread_id', listThreadIds)
          .order('created_at', { ascending: false })
          .limit(600)
      : Promise.resolve({ data: [], error: null }),
    listThreadIds.length > 0
      ? supabase
          .from('thread_service_interests')
          .select('thread_id, category_key, created_at')
          .in('thread_id', listThreadIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    listThreadIds.length > 0
      ? supabase
          .from('chat_thread_reads')
          .select('thread_id, last_read_at')
          .eq('user_id', user.id)
          .in('thread_id', listThreadIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (listLastRes.error) {
    logQueryError('CoupleThreadPage.lastMessages', listLastRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const listLast = new Map<string, { sender_role: string; body: string | null }>();
  const listLastAt = new Map<string, string>();
  for (const m of (listLastRes.data ?? []) as Array<{
    thread_id: string;
    sender_role: string;
    body: string | null;
    created_at: string;
  }>) {
    if (!listLast.has(m.thread_id)) {
      listLast.set(m.thread_id, { sender_role: m.sender_role, body: m.body });
      listLastAt.set(m.thread_id, m.created_at);
    }
  }

  if (listInterestRes.error) {
    logQueryError('CoupleThreadPage.listInterests', listInterestRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  /* ⚠ ONE TAG, AND IT IS THE SERVICE — NOT THE DATE. The supplier's column tags
     each row with a date because every row there is a different wedding. Here
     every row is the SAME wedding, so a date would print the couple's own date
     six times and say nothing. */
  const listLabels = new Map<string, string[]>();
  for (const i of (listInterestRes.data ?? []) as Array<{
    thread_id: string;
    category_key: string | null;
  }>) {
    if (!listLabels.has(i.thread_id) && i.category_key) {
      listLabels.set(i.thread_id, [interestChipLabel({ category_key: i.category_key })]);
    }
  }

  if (listReadRes.error) {
    logQueryError('CoupleThreadPage.listReads', listReadRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const listUnread = new Set<string>();
  for (const r of (listReadRes.data ?? []) as Array<{ thread_id: string; last_read_at: string | null }>) {
    const said = listLastAt.get(r.thread_id);
    if (said && r.last_read_at && new Date(said) > new Date(r.last_read_at)) {
      listUnread.add(r.thread_id);
    }
  }

  /* 🔒 THE NAME IS RESOLVED HERE, NOT IN THE COLUMN. A free or unverified
     supplier's real business name stays behind their screen name until the
     reveal predicate says otherwise — the same `resolveVendorDisplayName` the
     header above and the Messages list already run. The column receives a name
     that is already safe to print, and the avatar is its INITIALS, never the
     logo: a logo is exactly as identifying as the name it stands for. */
  const listDisplayNames = new Map<string, string>();
  for (const t of listVisible) {
    const v = t.vendor;
    listDisplayNames.set(
      t.vendor_profile_id,
      v
        ? resolveVendorDisplayName({
            business_name: v.business_name ?? null,
            name_revealed_at: v.name_revealed_at ?? null,
            services: v.services ?? null,
            screen_name: v.screen_name ?? null,
            isPaidTier: isTrueNameTier(v.tier_state ?? null),
            is_verified: v.verification_state === 'verified',
            primary_canonical_service: v.services?.[0] ?? null,
            location_city: v.location_city ?? null,
          })
        : 'Supplier',
    );
  }

  const conversationRows = await buildCoupleConversationRows({
    supabase,
    eventId,
    threads: listVisible.map((t) => ({
      thread_id: t.thread_id,
      vendor_profile_id: t.vendor_profile_id,
      inquiry_status: t.inquiry_status ?? null,
      updated_at: t.updated_at,
    })),
    displayNames: listDisplayNames,
    labels: listLabels,
    lastMessages: listLast,
    unreadThreadIds: listUnread,
    formatTime: formatChatTimestamp,
  });

  return (
    <div className="flex h-[calc(100dvh-12rem)] gap-4">
      {/* LIST · CONVERSATION · CONTEXT (owner 2026-09-08). The list appears at
          xl, where there is room for it without squeezing the conversation —
          giving the conversation back its space was the whole point. */}
      <ConversationColumn
        rows={conversationRows}
        activeThreadId={threadId}
        side="couple"
        hrefBase={`/dashboard/${eventId}/messages`}
        heading="Suppliers you’re talking to"
        backHref={`/dashboard/${eventId}/vendors`}
        backLabel="‹ Bench"
      />
    <section className="flex min-w-0 flex-1 flex-col gap-4">
      <header className="sn-tile flex items-center justify-between gap-3 p-4">
        <div className="min-w-0 space-y-0.5">
          <Link
            href={`/dashboard/${eventId}/messages`}
            className="sn-eye hover:text-terracotta"
          >
            ‹ Messages
          </Link>
          <p className="truncate text-base font-semibold text-ink">{vendorLabel}</p>
          {vendor?.tagline ? (
            <p className="truncate text-xs text-ink/60">{vendor.tagline}</p>
          ) : null}
          {/* The pax this vendor is quoting against (Adaptive Pax Pricing) —
              fresh on view (Phase 5); so the couple sees what the vendor sees. */}
          {headerPax ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta">
              Planning for ~{headerPax} guests
              {thread.pax_at_inquiry && thread.pax_at_inquiry < headerPax
                ? ` · was ${thread.pax_at_inquiry} at inquiry`
                : ''}
            </p>
          ) : null}
        </div>
        <ChatThreadMenu
          threadId={threadId}
          returnTo={`/dashboard/${eventId}/messages/${threadId}`}
          blockedByMe={blockState.blockedByMe}
        />
      </header>

      <ChatSafetyBanner />

      <ThreadQuotationsCard
        supabase={supabase}
        eventId={eventId}
        vendorProfileId={thread.vendor_profile_id}
        vendorLabel={vendorLabel}
      />

      <ThreadInterestChips supabase={supabase} threadId={threadId} />

      <ChatMessageStream
        threadId={threadId}
        initialMessages={initialMessages}
        currentUserId={user.id}
        viewerRole="couple"
        counterpartyLabel={vendorLabel}
        eventDate={eventDate}
        standing={threadStanding}
        decisionPayments={decisionPayments}
        initialView={initialView}
        lockHandshake={lockHandshake}
      />

      {blockState.blockedByMe || blockState.blockedByThem ? (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4 text-sm text-ink/70">
          {blockState.blockedByMe
            ? 'You blocked this person. Unblock from the ⋯ menu to message again.'
            : 'You can no longer message in this conversation.'}
        </div>
      ) : thread.inquiry_status === 'accepted' ||
      (thread.inquiry_status === 'pending' && canFollowUpWhilePending) ? (
        <div className="space-y-2">
          {/* Free 1:1 voice/video call — accepted threads only (PR 10). */}
          {thread.inquiry_status === 'accepted' ? (
            <ThreadCallLauncher
              threadId={threadId}
              currentUserId={user.id}
              counterpartyLabel={vendorLabel}
              callsEnabled={callsEnabled}
              viewerRole="couple"
            />
          ) : null}
          {thread.inquiry_status === 'pending' && coupleMsgCount > 0 ? (
            <p className="text-xs text-ink/55">
              You can send one follow-up while you wait for {vendorLabel} to
              accept.
            </p>
          ) : null}
          <NegotiationComposerMenu
            threadId={threadId}
            returnPath={`/dashboard/${eventId}/messages/${threadId}`}
            eventDate={eventDate}
          />
          <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
        </div>
      ) : thread.inquiry_status === 'pending' ? (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">Follow-up sent.</span> Waiting for{' '}
            {vendorLabel} to accept before your chat opens. We&rsquo;ll notify you
            the moment they reply.
          </p>
          <form action={withdrawInquiry}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="thread_id" value={threadId} />
            <SubmitButton pendingLabel="Withdrawing…" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 underline-offset-2 hover:text-terracotta hover:underline">Withdraw inquiry</SubmitButton>
          </form>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
          <p className="text-sm text-ink">
            {declineReason ? (
              <>
                {vendorLabel} declined this inquiry.{' '}
                <span className="font-semibold">Why:</span> &ldquo;{declineReason}
                &rdquo; Browse similar vendors to keep your options open.
              </>
            ) : (
              <>
                {vendorLabel} isn&rsquo;t available for your date. Browse similar
                vendors to keep your options open.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={similarVendorsHref}
              className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              See similar vendors
            </Link>
            <form action={withdrawInquiry}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="thread_id" value={threadId} />
              <SubmitButton pendingLabel="Withdrawing…" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 underline-offset-2 hover:text-terracotta hover:underline">
                Withdraw inquiry
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </section>
    </div>
  );
}
