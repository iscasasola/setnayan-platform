import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchCoupleThreads, fetchMessages, fetchThreadById, formatChatTimestamp } from '@/lib/chat';
import { ConversationColumn } from '@/app/_components/chat/conversation-column';
import { buildCoupleConversationRows } from '@/lib/conversation-list';
import { interestLabeller } from '@/lib/thread-interest-labels.server';
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
import { SubmitButton } from '@/app/_components/submit-button';
import { ChevronLeft } from 'lucide-react';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ThreadToolPanel } from '@/app/_components/chat/thread-tool-panel';
import { RevealToolButton } from '@/app/_components/chat/reveal-tool-button';
import { ThreadToolHashReveal } from '@/app/_components/chat/reveal-thread-tool';
import { COUPLE_THREAD_PANELS, affordancePanelId } from '@/lib/chat-box-tools';
import { chatNegotiationEnabled } from '@/lib/chat-negotiation-flag';
import { formatLongDate } from '@/lib/format-date';
import { initialsFor } from '@/lib/conversation-list';

export const metadata = { title: 'Thread' };

type Props = {
  params: Promise<{ eventId: string; threadId: string }>;
  /** `?view=decisions|files` — see lib/thread-view.ts. */
  searchParams?: Promise<{ view?: string | string[]; compose?: string }>;
};

export default async function CoupleThreadPage({ params, searchParams }: Props) {
  // Read on the server so a Decisions link paints Decisions, not the chat.
  const sp = await searchParams;
  const initialView = parseThreadView(sp?.view);
  // `?compose=deal` — the Counter-offer button on a quote card links here, so
  // the amendment builder opens where the composer already lives. A URL rather
  // than shared state: this page is a server component and cannot hand a
  // callback to the client stream.
  const composeMode = sp?.compose === 'deal' ? 'deal' : null;
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
   * S5 · WHERE AN ACCEPTED QUOTE'S "ASK THEM TO LOCK" GOES. Accepting only
   * shortlists the shop at a price; the couple's one booking action is Lock on
   * that shop's workspace page (the same next step `/proposals/[publicId]`
   * shows). Resolved the way accept wrote the row — (event_id,
   * marketplace_vendor_id) — under the couple's own RLS. Null when there is no
   * row yet or the read fails: the card then shows the accepted note and no
   * button, never a guessed route.
   */
  let quoteLockHref: string | null = null;
  if (thread.vendor_profile_id) {
    const { data: pick, error: pickErr } = await supabase
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', thread.event_id)
      .eq('marketplace_vendor_id', thread.vendor_profile_id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pickErr) {
      console.error('[couple thread] lock workspace read refused', pickErr);
    } else if (pick?.vendor_id) {
      quoteLockHref = `/dashboard/${eventId}/vendors/${pick.vendor_id}/workspace`;
    }
  }

  /**
   * ── DECISIONS · the couple's side of "where are we with this supplier?" ────
   *
   * The same view the supplier has, from this side. The standing sentence is
   * the S6 derivation verbatim, read in the couple's voice (the default); the
   * bench card draws the same string, which is what makes showing it twice
   * safe. The supplier's page calls the same function with `viewer: 'vendor'`
   * (since 2026-09-10), so the two sides are told one set of facts, each
   * with the subject turned the right way round.
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
          .select('thread_id, category_key, vendor_service_id, created_at')
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
  const listInterests = (listInterestRes.data ?? []) as Array<{
    thread_id: string;
    category_key: string | null;
    vendor_service_id: string | null;
  }>;
  const labelListInterest = await interestLabeller(decisionAdmin, listInterests);
  for (const i of listInterests) {
    if (!listLabels.has(i.thread_id) && (i.category_key || i.vendor_service_id)) {
      listLabels.set(i.thread_id, [labelListInterest(i)]);
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

  /*
    ── ONE CHAT BOX (owner-approved layout, 2026-09-18) ─────────────────────
    Seven separate cards used to stack down this column — header tile, safety
    panel, pinned quote, "Inquiring about" row, the conversation, the call row,
    the "+ Deal or meeting" pill, then the composer — and the conversation got
    whatever the others left: measured on production at 32px of visible height
    against 498px of content on a 390px phone.

    Now there is ONE bordered frame (`ChatBox`): header · one-line safety note
    · Chat / Decisions / Files · the conversation (the only thing that scrolls)
    · the composer row with the deal and call icons on it · and, below, the two
    closed tool panels those icons open. Every component that rendered before
    still renders here — as a slot of the frame, not a card of its own.

    🔴 THE COLUMN IS BOUNDED AGAIN, AND THIS TIME THAT IS SAFE. `h-[calc(100dvh
    -12rem)]` is what pins the composer and lets the conversation scroll inside
    the frame (the thing the page-scrolling `min-h` column could not do: the
    list's own scroll-to-bottom scrolled nothing). It could crush the list when
    six siblings shared the height; now the siblings are a ~60px header, a
    ~40px note, a 44px switch and a ~60px composer, and TWO floors stand under
    the conversation — the list's own `min-h-[14rem]`, and `min-h-[27rem]` on
    this row, so on a 320px phone the row outgrows the viewport and the PAGE
    scrolls rather than the frame clipping its own composer. Measured with a quote in the thread (the real
    frame components, the repo's Tailwind, a real browser): 320 → 224px of
    conversation (the list's floor; the page scrolls 56px), 360 → 224px,
    390 → 391px, 1440 → 453px — against 32px at every width before #5584.
  */
  const blocked = blockState.blockedByMe || blockState.blockedByThem;
  const composerOpen =
    !blocked &&
    (thread.inquiry_status === 'accepted' ||
      (thread.inquiry_status === 'pending' && canFollowUpWhilePending));
  // Which of the two tools this box carries. Neither is mounted when it would
  // open onto nothing: the call launcher renders null for a couple whose
  // supplier's plan has calling locked, and the deal menu renders null while
  // the negotiation flag is off — an icon that opens an empty panel is worse
  // than no icon.
  const callsOpen = !blocked && thread.inquiry_status === 'accepted' && callsEnabled;
  const dealOpen = composerOpen && chatNegotiationEnabled();
  const openPanelIds = new Set<string>(
    [callsOpen ? affordancePanelId('call') : null, dealOpen ? affordancePanelId('deal') : null].filter(
      (id): id is string => id !== null,
    ),
  );
  const couplePanels = COUPLE_THREAD_PANELS.filter((p) => openPanelIds.has(p.id));
  const toolNodes: Record<string, React.ReactNode> = {
    // Free 1:1 voice/video call — accepted threads only (PR 10). The ids the
    // composer's 📞 reveals (`thread-call-voice`) exist because of the prefix.
    'thread-call': (
      <ThreadCallLauncher
        threadId={threadId}
        currentUserId={user.id}
        counterpartyLabel={vendorLabel}
        callsEnabled={callsEnabled}
        viewerRole="couple"
        buttonIdPrefix="thread-call"
      />
    ),
    'deal-or-meeting': (
      <NegotiationComposerMenu
        embedded
        initialMode={composeMode}
        threadId={threadId}
        returnPath={`/dashboard/${eventId}/messages/${threadId}`}
        eventDate={eventDate}
      />
    ),
  };

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[27rem] gap-4">
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
      {/* Honours `#deal-or-meeting` / `#thread-call` on arrival and on change. */}
      <ThreadToolHashReveal />
      {/* The column scrolls ITSELF when the frame outgrows it (a tool open on a
          short phone) — the frame never clips its own composer. */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <ChatBox
          header={
            <>
              <Link
                href={`/dashboard/${eventId}/messages`}
                aria-label="Back to Messages"
                className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
              >
                <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
              </Link>
              {/* Initials, never the logo — a logo is exactly as identifying as
                  the name it stands for, and the name here is already the
                  reveal-safe one. */}
              <span
                aria-hidden
                className="hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-xs font-semibold text-ink/70 sm:grid"
              >
                {initialsFor(vendorLabel)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{vendorLabel}</p>
                {/* ONE muted line: what they asked about · the date · the count
                    this vendor is quoting against (Adaptive Pax Pricing, fresh
                    on view — the couple sees what the vendor sees). */}
                <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55 [&>*+*]:before:mr-1.5 [&>*+*]:before:content-['·']">
                  <ThreadInterestChips supabase={supabase} threadId={threadId} compact />
                  {eventDate ? <span>{formatLongDate(eventDate)}</span> : null}
                  {headerPax ? (
                    <span className="text-terracotta">
                      ~{headerPax} guests
                      {thread.pax_at_inquiry && thread.pax_at_inquiry < headerPax
                        ? ` · was ${thread.pax_at_inquiry} at inquiry`
                        : ''}
                    </span>
                  ) : null}
                </p>
              </div>
              <ChatThreadMenu
                threadId={threadId}
                returnTo={`/dashboard/${eventId}/messages/${threadId}`}
                blockedByMe={blockState.blockedByMe}
              />
            </>
          }
          notice={<ChatSafetyBanner inBox />}
          composer={
            blocked ? (
              <div className="px-2 py-1 text-sm text-ink/70">
                {blockState.blockedByMe
                  ? 'You blocked this person. Unblock from the ⋯ menu to message again.'
                  : 'You can no longer message in this conversation.'}
              </div>
            ) : composerOpen ? (
              <div className="space-y-1.5">
                {thread.inquiry_status === 'pending' && coupleMsgCount > 0 ? (
                  <p className="px-1 text-xs text-ink/55">
                    You can send one follow-up while you wait for {vendorLabel} to
                    accept.
                  </p>
                ) : null}
                {/* attach · message · 🧾 deal · 📞 call · send. The two icons
                    open the panels in the tray below; neither dials or sends. */}
                <ChatSendForm
                  threadId={threadId}
                  sendAction={sendChatMessage}
                  accessories={
                    <>
                      {dealOpen ? <RevealToolButton affordance="deal" /> : null}
                      {callsOpen ? (
                        <RevealToolButton affordance="call" label={`Call ${vendorLabel}`} />
                      ) : null}
                    </>
                  }
                />
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
            )
          }
          tray={
            couplePanels.length > 0 ? (
              <div>
                {couplePanels.map((t) => (
                  <ThreadToolPanel
                    key={t.id}
                    id={t.id}
                    label={t.label}
                    hint={t.hint}
                    // `?compose=deal` (the Counter-offer link on a quote card)
                    // paints the amendment builder open, on the server.
                    open={t.id === affordancePanelId('deal') && composeMode === 'deal'}
                  >
                    {toolNodes[t.id]}
                  </ThreadToolPanel>
                ))}
              </div>
            ) : null
          }
        >
          {/*
            The quote lives HERE, in the conversation (owner, 2026-09-18: "i
            think it is better to place the quotation inside the chat box"),
            with its line items, Review & accept and Counter-offer; the two jump
            pills sit OVER the scroller and cost no height. The pinned
            `ThreadQuotationsCard` that used to sit above the stream was deleted
            on 2026-09-18 (S36) — unmounted since #5584, an orphan in the
            both-ends baseline; lib/a-quote-card-does-not-crush-the-conversation
            still asserts it is never mounted again.
          */}
          <ChatMessageStream
            flush
            counterHref={`?compose=deal`}
            // S5 · an accepted quote points at the ONE action that books.
            lockHref={quoteLockHref}
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
        </ChatBox>
      </section>
    </div>
  );
}
