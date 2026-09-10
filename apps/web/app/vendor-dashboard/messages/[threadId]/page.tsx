import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ServerTimer } from '@/lib/server-timing';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  fetchMessages,
  fetchReturningClientFlags,
  fetchLeadTrustActivePlanner,
  fetchThreadById,
  fetchVendorThreads,
  formatChatTimestamp,
} from '@/lib/chat';
import { leadTrustBadgeEnabled } from '@/lib/inquiry-gate';
import { eventHostHoldsFounderSeat } from '@/lib/entitlements';
import { FOUNDER_BADGE_LABEL, FOUNDER_INQUIRY_NOTE } from '@/lib/founder-seats';
import {
  fetchInquiryCustomerFacts,
  inquiryCityLabel,
} from '@/lib/inquiry-customer.server';
import { buildCustomerEventSummary } from '@/lib/customer-event-summary';
import {
  guestCountChip,
  guestCountLine,
  type GuestCounts,
} from '@/lib/guest-count-provenance';
import {
  fetchVendorDateDemand,
  vendorDateDemandLine,
  vendorDateDemandNote,
} from '@/lib/vendor-date-demand';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { displayServiceLabel } from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchOwnPaymentMethods } from '@/lib/vendor-payment-methods';
import { sendChatMessage, acceptInquiry, declineInquiry, markThreadRead } from '@/lib/chat-actions';
import { dayMonth, formatLongDate } from '@/lib/format-date';
import { fetchPipelinePressure } from '@/lib/vendor-pipeline-pressure';
import { PipelinePressureLine } from '../../_components/pipeline-pressure-line';
import { getThreadBlockState } from '@/lib/chat-block';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { fetchThreadLockHandshake } from '@/lib/thread-lock-handshake.server';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { NegotiationComposerMenu } from '@/app/_components/negotiation-composer-menu';
import { ThreadCallLauncher } from '@/app/_components/thread-call-launcher';
import { resolveThreadCallsEnabled } from '@/lib/thread-calls-gate';
import { ChatThreadMenu } from '@/app/_components/chat-thread-menu';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';
import { fetchThreadInterests } from '@/lib/thread-interests';
import { fetchVendorServices } from '@/lib/vendor-services';
import { isCanonicalService, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { resolveLivePax, fetchVendorPaxProposals } from '@/lib/pax';
import {
  fetchThreadPayments,
  paxProposalsToGuestCounts,
  fetchLiveQuoteTotalPhp,
} from '@/lib/thread-decision-sources.server';
import { buildSupplierStanding } from '@/lib/supplier-standing';
import {
  fetchPendingVendorPayments,
  fetchPlanProgressForVendor,
} from '@/lib/vendor-service-payment-schedules.server';
import { acceptPaxSurcharge, declinePaxSurcharge } from './pax-actions';
import { confirmVendorPayment } from './pay-confirm-actions';
import { parseThreadView } from '@/lib/thread-view';
import { VendorPaymentLive } from './_components/vendor-payment-live';
import {
  VendorOfferService,
  type VendorOfferOption,
} from './_components/vendor-offer-service';
import { SendProposalCard } from './_components/send-proposal-card';
import { ProposalMaker } from '@/app/_components/proposal-maker';
import { ChatInfoRailColumn, ChatInfoRailTrigger } from './_components/chat-info-rail';
import { ThreadToolHashReveal } from './_components/reveal-thread-tool';
import { ConversationColumn } from '@/app/_components/chat/conversation-column';
import {
  buildVendorConversationRows,
  initialsFor,
  isDateTagWorthShowing,
  serviceTagVaries,
} from '@/lib/conversation-list';
import { VENDOR_THREAD_PANELS } from '@/lib/vendor-thread-tools';
import { SubmitButton } from '@/app/_components/submit-button';
import { VendorEventDayPrepCta } from '@/app/_components/vendor-event-day-prep-cta';
import { interestChipLabel } from '@/lib/thread-interests';
import {
  deriveThreadStage,
  THREAD_STAGE_LABEL,
  THREAD_STAGE_TONE,
} from '@/lib/vendor-thread-stage';
import { fetchReasonCodes } from '@/lib/inquiry-outcomes';
import { regionLabel } from '@/lib/region-source';
import { eventTypeLabel } from '@/lib/demand-radar';
import {
  InquiryOutcomeCapture,
  type OutcomeReasonOption,
} from './_components/inquiry-outcome-capture';
import {
  inquirySourceLabel,
  RETURNING_CUSTOMER_LABEL,
} from '@/lib/inquiry-source';
import {
  fetchThreadAttribution,
  fetchInquirerCollabActive,
  type ThreadAttribution,
} from '@/lib/inquiry-attribution';
import { cardKindLabeller } from '@/lib/card-kind-labeller';

export const metadata = { title: 'Thread · Vendor' };

type Props = {
  params: Promise<{ threadId: string }>;
  searchParams?: Promise<{ notice?: string; view?: string | string[] }>;
};

const PROPOSAL_NOTICE: Record<string, string> = {
  proposal_sent: 'Proposal sent — it’s in the conversation below.',
  proposal_failed: 'Couldn’t send that proposal. Please try again.',
  proposal_needs_template: 'Pick a template to send a proposal.',
  proposal_tier_free: 'Get your account verified to send proposals to couples.',
  proposal_sent_no_card: 'Proposal sent — find it in your Proposals list (the in-chat card didn’t post).',
  proposal_thread_closed: 'You can only send a proposal on an open conversation.',
  // Won & Lost Reasons capture (Wave 6).
  outcome_saved: 'Outcome saved — thanks for logging it.',
  outcome_invalid: 'Pick won, lost, or no-response to log this inquiry.',
  outcome_bad_reason: 'That reason is no longer available — pick another.',
  outcome_failed: 'Couldn’t save that outcome. Please try again.',
};

export default async function VendorThreadPage({ params, searchParams }: Props) {
  const { threadId } = await params;
  const sp = await searchParams;
  const noticeKey = sp?.notice;
  // Read on the server so a Decisions link paints Decisions, not the chat.
  const initialView = parseThreadView(sp?.view);
  const proposalNotice = typeof noticeKey === 'string' ? PROPOSAL_NOTICE[noticeKey] : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) notFound();

  // Voice/video calling is a paid-vendor capability (gate-dark by default).
  // When it's locked for this vendor's tier the launcher shows an upgrade nudge.
  const callsEnabled = await resolveThreadCallsEnabled(thread.vendor_profile_id);

  // ── Concurrent fetch (2026-07-01 perf) ──────────────────────────────────
  // Every read below the ownership gate is independent — only paxProposals needs
  // livePax first — so they run in ONE parallel batch instead of the former
  // ~14-step serial waterfall. Best-effort loaders keep their graceful-degrade
  // contract via per-item .catch(). markThreadRead is a WRITE fired inside the
  // batch (last element, result ignored): it still clears unread on this load,
  // but concurrently, adding zero serial round-trips instead of blocking render.
  const msgTimer = new ServerTimer('vendor-dashboard/messages-thread');
  const paxAdmin = createAdminClient();
  const [
    blockState,
    { data: event },
    initialMessages,
    [existingInterests, ownServices],
    [tplRes, pkgRes],
    returningMap,
    livePax,
    pendingPayments,
    planProgress,
    reasonCodes,
    { data: existingOutcome },
    customerPlan,
    ownPaymentMethods,
  ] = await msgTimer.track('thread', () => Promise.all([
    // UGC block state (Apple 1.2) — drives the thread menu label + composer gating.
    getThreadBlockState(thread, user.id, 'vendor'),
    // WHO IS ASKING. Read with the ADMIN client, like the three sibling reads
    // below, because a vendor holds no `events` RLS — not even after accepting
    // (measured in prod 2026-09-08: an accepted thread's vendor still had
    // `vendor_is_event_member = 0`). With the vendor's own client this row came
    // back null on EVERY load, so the header fell back to "Couple" and the rail
    // read "Not set yet" against a real 2026-12-18 date. The ownership gate
    // above (`thread.vendor_profile_id !== profile.vendor_profile_id` →
    // notFound) is what authorises the bypass.
    paxAdmin
      .from('events')
      .select('display_name, event_date, event_type, region, setnayan_ai_active, created_at')
      .eq('event_id', thread.event_id)
      .maybeSingle(),
    // Server-rendered first batch (SSR + SEO). Realtime takes over from here.
    fetchMessages(supabase, threadId),
    // Inverse cross-sell (owner-locked 2026-06-12) — active services minus those
    // already recorded as thread interests.
    Promise.all([
      fetchThreadInterests(supabase, threadId),
      fetchVendorServices(supabase, profile.vendor_profile_id),
    ]),
    // In-chat proposals — the vendor's own templates + packages (RLS-scoped).
    Promise.all([
      supabase
        .from('vendor_proposal_templates')
        .select('template_id, template_name')
        .eq('vendor_profile_id', profile.vendor_profile_id),
      supabase
        .from('vendor_packages')
        .select('package_id, package_name')
        .eq('vendor_profile_id', profile.vendor_profile_id),
    ]),
    // Returning-client flag (owner-locked 2026-06-12) — only relevant while the
    // inquiry is pending. Graceful-degrades pre-migration.
    thread.inquiry_status === 'pending'
      ? fetchReturningClientFlags(supabase, profile.vendor_profile_id, [thread.event_id])
      : Promise.resolve(null),
    // Adaptive Pax Pricing Phase 5 — recompute live pax FRESH on view (admin
    // client, gated by the thread-ownership check above).
    resolveLivePax(paxAdmin, thread.event_id),
    // Phase 2 PR-C — couple-logged payments awaiting confirmation. Best-effort:
    // a failure degrades to no cards.
    fetchPendingVendorPayments({
      adminClient: paxAdmin,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }).catch((e): Awaited<ReturnType<typeof fetchPendingVendorPayments>> => {
      console.error('[vendor-thread] fetchPendingVendorPayments threw', e);
      return [];
    }),
    // Phase 2 PR-D — plan progress for this vendor's bookings. Best-effort.
    fetchPlanProgressForVendor({
      adminClient: paxAdmin,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }).catch((e): Awaited<ReturnType<typeof fetchPlanProgressForVendor>> => {
      console.error('[vendor-thread] fetchPlanProgressForVendor threw', e);
      return [];
    }),
    // Won & Lost Reasons (Wave 6) — live admin-managed reason taxonomy.
    fetchReasonCodes(supabase),
    // Any outcome already logged for THIS thread.
    supabase
      .from('inquiry_outcomes')
      .select('outcome, reason_code, free_text')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('chat_thread_id', threadId)
      .is('vendor_proposal_id', null)
      .maybeSingle(),
    // WHO STARTED THE EVENT, and HOW FAR ALONG the plan is — the two halves of
    // the owner's 2026-09-08 summary ("User name create a … event … with X
    // locked vendors"). Admin-scoped for the same reason as the `events` read
    // above: a vendor holds no RLS on either table. Best-effort — the summary
    // degrades field by field rather than costing the page.
    (async (): Promise<{
      hostName: string | null;
      locked: number | null;
      total: number | null;
      lockedCategories: string[];
    }> => {
      try {
        const [members, vendors] = await Promise.all([
          paxAdmin
            .from('event_members')
            .select('user_id')
            .eq('event_id', thread.event_id)
            .limit(1),
          paxAdmin
            // `category` rides along on a query this page already makes — the
            // locked-category chips cost no extra round trip. ⚠ `vendor_name`
            // is NOT selected: which SLOTS are taken is the owner's 2026-09-08
            // grant; WHO took them stays the booked-stage `vendor_roster`.
            .from('event_vendors')
            .select('status, category')
            .eq('event_id', thread.event_id),
        ]);
        const rows = (vendors.data ?? []) as Array<{
          status: string | null;
          category: string | null;
        }>;
        const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES);
        const lockedRows = rows.filter((r) => r.status && confirmed.has(r.status));
        const locked = lockedRows.length;
        // `displayServiceLabel`, not a raw `category`: the column holds canonical
        // enum keys AND custom free-text entries, and that resolver is the one
        // place that already handles both. Its docblock: "NEVER PRINT A DATABASE
        // KEY AT A COUPLE" — a supplier deserves the same.
        const lockedCategories = lockedRows
          .map((r) => (r.category ? displayServiceLabel(r.category) : null))
          .filter((c): c is string => !!c);
        const hostId = (members.data ?? [])[0]?.user_id as string | undefined;
        let hostName: string | null = null;
        if (hostId) {
          // ⚠ `display_name`, NOT `full_name` — public.users has no `full_name`.
          const { data: u } = await paxAdmin
            .from('users')
            .select('display_name')
            .eq('user_id', hostId)
            .maybeSingle();
          hostName = (u as { display_name: string | null } | null)?.display_name ?? null;
        }
        return { hostName, locked, total: rows.length, lockedCategories };
      } catch {
        return { hostName: null, locked: null, total: null, lockedCategories: [] };
      }
    })(),
    // Vendor Proposal Maker (§ 9) — the vendor's OWN published payment methods
    // for the in-thread quote's method picker (RLS-scoped). Best-effort: any
    // failure degrades to no picker (the couple falls back to all approved).
    fetchOwnPaymentMethods(supabase, profile.vendor_profile_id).catch(
      (): Awaited<ReturnType<typeof fetchOwnPaymentMethods>> => [],
    ),
    // Mark read (WRITE) — fired concurrently; result ignored. No-op + logged if
    // migration 20260728000000_chat_thread_reads.sql isn't pushed yet.
    markThreadRead(threadId).catch(() => undefined),
  ]));

  // WHO IS ASKING — one label, the same before and after accepting. The
  // anonymization-until-accept placeholder ("A couple planning a wedding in
  // Manila") is gone: it existed so that accepting, which cost a token, bought
  // something. The token wallet is retired, so it bought nothing and only
  // withheld a name from the one supplier this couple had already written to.
  // Owner ruling 2026-09-08: "we do not need to hide anything, since no more
  // tokens." 'Couple' remains only for a genuinely missing event row.
  const coupleLabel = event?.display_name ?? 'Couple';
  const headerLabel = coupleLabel;
  const inquiryCity = inquiryCityLabel(event?.region ?? null);

  const alreadyOnThread = new Set(
    existingInterests
      .map((r) => r.vendor_service_id)
      .filter((v): v is string => v !== null),
  );
  const kindLabel = await cardKindLabeller();
  const offerOptions: VendorOfferOption[] = ownServices
    .filter((s) => s.is_active && !alreadyOnThread.has(s.vendor_service_id))
    .map((s) => ({
      vendorServiceId: s.vendor_service_id,
      // A card's kind may be the shop's own coverage word; the shared labeller
      // owns the fallback chain so no screen can end it at the raw key.
      label: s.title?.trim() || kindLabel(s.category),
    }));

  const proposalTemplates = ((tplRes.data ?? []) as { template_id: string; template_name: string }[]).map(
    (t) => ({ id: t.template_id, name: t.template_name }),
  );
  const proposalPackages = ((pkgRes.data ?? []) as { package_id: string; package_name: string }[]).map(
    (p) => ({ id: p.package_id, name: p.package_name }),
  );
  // Vendor Proposal Maker (§ 9) — the vendor's payment rails for the quote's
  // method picker (default-selects the publishable ones).
  const proposalPaymentMethods = (ownPaymentMethods ?? []).map((m) => ({
    id: m.payment_method_id,
    label: m.label,
    methodType: m.method_type,
    provider: m.provider,
    publishable: m.is_shown && m.moderation_status === 'approved',
  }));

  const returning = returningMap ? returningMap.get(thread.event_id) : undefined;

  // ── Creator Economy PR-C · inquiry provenance (PRIVATE to the vendor) ──────
  // The source chip (owner's taxonomy; NULL = "Website Inquiry"), the returning
  // companion chip, the "Referred by [Storyteller] · via [chapter]" block with
  // the promised audience rate, and the "creator collab active" marker (the
  // INQUIRER holds an accepted collab with THIS vendor → agreed creator rate
  // applies). All fail-soft/pre-migration-safe.
  const sourceChipLabel = inquirySourceLabel(thread.inquiry_source ?? null);
  const [attribution, inquirerCollabActive] = await Promise.all([
    thread.referring_chapter_id
      ? fetchThreadAttribution(thread)
      : Promise.resolve<ThreadAttribution | null>(null),
    fetchInquirerCollabActive(
      profile.vendor_profile_id,
      thread.created_by_user_id ?? null,
    ),
  ]);

  // Phase D — lead trust badge (fake-inquiry protection · "informed accept").
  // Flag-gated + pending-only + fail-soft. "Active planner" is a purely positive
  // cue (real engagement) — a new couple simply has no badge, never a warning.
  const leadActivePlanner =
    leadTrustBadgeEnabled() && thread.inquiry_status === 'pending'
      ? await fetchLeadTrustActivePlanner(supabase, profile.vendor_profile_id, thread.event_id)
      : false;

  // Founder-seat inquiry — the explicit, server-asserted founder signal
  // (owner-locked 2026-07-16). Read from the founder_seats definer helper only
  // (never profile text — impersonation guard), shown pre- AND post-accept: the
  // vendor must know they're serving the people who built the app, and that
  // accepting was/is token-free. Unlike the trust badge this is NOT flag-gated —
  // pre-migration the RPC gracefully degrades to false.
  const founderInquiry = await eventHostHoldsFounderSeat(supabase, thread.event_id);

  // How full is this shop's pipeline for THIS couple's date — the number the
  // per-tier ceiling refuses on, said out loud BEFORE the refusal. Pending-only
  // (an accepted thread has already spent its slot) and read through the
  // supplier's OWN session, because the RPC is caller-scoped and answering with
  // the service role would answer for a thread they do not own. Returns null —
  // and the component draws nothing — whenever the ceilings are switched off,
  // the couple has no date yet, or the read fails.
  const pipelinePressure =
    thread.inquiry_status === 'pending'
      ? await fetchPipelinePressure(supabase, threadId)
      : null;

  const headerPax = livePax ?? thread.pax_current;

  /*
    THE TWO GUEST COUNTS, READ ONCE.

    A thread stores what the couple ASKED with (`pax_at_inquiry`) and what they
    are planning NOW (live pax). Both are true and they routinely differ. Every
    surface on this page that shows a headcount takes it from HERE and says
    which one it is — see lib/guest-count-provenance.ts for why that is a helper
    rather than four careful edits.

    ⚠ MONEY RIDES ON THE DIFFERENCE. A supplier quotes against one and is paid
    against the other; the "guest count changed — accept or hold your price"
    card below exists because of it. The accept card used to render a bare
    "150 pax" beside a header saying 170.
  */
  const guestCounts: GuestCounts = {
    live: headerPax ?? null,
    atInquiry: thread.pax_at_inquiry ?? null,
  };
  // paxProposals depends on livePax, so it's the one query that follows the batch.
  // The date-demand counts ride alongside it rather than adding a third round
  // trip: two `head: true` counts, batched, never one per row.
  const [paxProposals, dateDemand] = await Promise.all([
    fetchVendorPaxProposals(paxAdmin, {
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
      livePax,
      paxAtInquiry: thread.pax_at_inquiry,
    }),
    /*
      WHO ELSE WANTS THIS DATE (owner: *"Target date for vendors will show who
      are also inquiring for that day so they do not need to browse their
      calendar?"*).

      🔒 COUNTS, NEVER NAMES, AND SUPPLIER SIDE ONLY. See
      lib/vendor-date-demand.ts — including why the shipped
      `get_vendor_same_day_bookings` could not answer this (it refuses unless
      the caller is already BOOKED on the event on screen, which an inquiry by
      definition is not) and why this is not built on the pipeline-ceiling RPC
      whose line sits a few rows below.
    */
    fetchVendorDateDemand({
      adminClient: paxAdmin,
      vendorProfileId: profile.vendor_profile_id,
      eventDate: event?.event_date ?? null,
      excludeThreadId: threadId,
    }),
  ]);

  const peso = (n: number) =>
    `₱${Math.abs(Math.round(n)).toLocaleString('en-PH')}`;

  const reasonOptions: OutcomeReasonOption[] = reasonCodes.map((r) => ({
    reasonCode: r.reasonCode,
    label: r.label,
    appliesTo: r.appliesTo,
  }));
  const currentOutcome = existingOutcome
    ? {
        outcome: existingOutcome.outcome as 'won' | 'lost' | 'no_response',
        reasonCode: existingOutcome.reason_code as string | null,
        freeText: existingOutcome.free_text as string | null,
      }
    : null;
  const outcomeCapture = (
    <InquiryOutcomeCapture
      threadId={threadId}
      reasons={reasonOptions}
      current={currentOutcome}
    />
  );

  /**
   * THE TOOLS, MOUNTED ONCE AND CLOSED.
   *
   * ── WHY THIS EXISTS (owner, 2026-09-08: "still messy chatbox") ───────────
   * Six panels used to sit BETWEEN the last message and the text box — the
   * cross-sell picker, the proposal-template banner, Build a quote, "How did
   * this inquiry end?", the call launcher and Deal-or-meeting. The
   * conversation was left a sliver, and on a phone it was pushed off screen
   * entirely. Every one of them is still here and still works; each is now a
   * closed disclosure ABOVE the stream, opened from the customer rail's tool
   * list (the right column), which is where the owner asked the tools to live.
   *
   * 🔑 MOUNTED ONCE, NOT PER BREAKPOINT. The rail renders twice — a desktop
   * column and a mobile sheet — so putting these components inside it would
   * mount `ProposalMaker` and `SendProposalCard` twice, duplicate every form
   * and every anchor id. The rail carries LAUNCHERS (cheap, safe to duplicate);
   * the heavy tools live here, once, and the launchers open them by id.
   */
  const toolNodes: Record<string, React.ReactNode> = {
    'send-proposal': (
        <SendProposalCard
          threadId={threadId}
          templates={proposalTemplates}
          packages={proposalPackages}
        />
    ),
    /*
      THE QUOTE OPENS AT THE LIVE COUNT (owner, 2026-09-09).

      Both numbers go in and the builder seeds itself from `livePax`, falling
      back to the inquiry count when there is no live one. The binding
      prototype's booked frame shows that field pre-filled at the live figure,
      and the owner ruled for it.

      🔑 IT MOVES MONEY, WHICH IS WHY BOTH STILL RENDER. A quote opened at 170
      when the couple asked with 150 is a different price, so the builder's
      header names the seed AND the inquiry count in every state — the point of
      this whole area is that no headcount appears without saying which one it
      is.
    */
    'build-quote': (
        <ProposalMaker
          threadId={threadId}
          requestedPax={thread.pax_at_inquiry ?? headerPax ?? 100}
          livePax={headerPax ?? null}
          coupleName={coupleLabel}
          packages={proposalPackages}
          paymentMethods={proposalPaymentMethods}
          viewerPromo={
            attribution?.audienceRateTerms
              ? {
                  terms: attribution.audienceRateTerms,
                  creatorName: attribution.creatorName,
                }
              : null
          }
        />
    ),
    'offer-service': <VendorOfferService threadId={threadId} options={offerOptions} />,
    'thread-call': (
        <ThreadCallLauncher
          threadId={threadId}
          currentUserId={user.id}
          counterpartyLabel={coupleLabel}
          callsEnabled={callsEnabled}
          viewerRole="vendor"
          upgradeHref="/vendor-dashboard/subscription"
          // Gives the two Start buttons the ids `thread-call-voice` and
          // `thread-call-video`, which is what lets the rail offer "Voice call"
          // and "Video call" as two entries that open ONE panel and land on the
          // right button. Passed here only — the launcher is mounted on three
          // other screens and must not grow duplicate ids there.
          buttonIdPrefix="thread-call"
        />
    ),
    'deal-or-meeting': (
        <NegotiationComposerMenu
          threadId={threadId}
          returnPath={`/vendor-dashboard/messages/${threadId}`}
          eventDate={event?.event_date ?? null}
        />
    ),
    'log-outcome': outcomeCapture,
  };

  const toolsMounted = thread.inquiry_status === 'accepted';

  /* ⚠ CLOSED MEANS INVISIBLE, NOT "A ROW YOU CAN OPEN".
     The first cut of this rendered six collapsed strips above the stream, which
     is the SAME WALL the owner asked to be rid of, one row shorter — the
     conversation was still a sliver at the bottom of the screen. Owner, seeing
     it live: "This is so confusing."

     A closed tool now takes NO SPACE AT ALL (`[&:not([open])]:hidden`). The
     middle column is the conversation and the box you write in; a tool appears
     only when it is summoned from the list on the right, one at a time, with a
     way to put it away again. The components still mount ONCE, here, which is
     what keeps the rail cheap and every anchor id unique. */
  const vendorTools = toolsMounted ? (
      <div className="flex flex-col gap-2 empty:hidden">
        {VENDOR_THREAD_PANELS.map((t) => (
          <details
            key={t.id}
            id={t.id}
            data-thread-tool
            className="group scroll-mt-24 rounded-xl border border-mulberry/25 bg-cream [&:not([open])]:hidden"
          >
            <summary className="flex cursor-pointer items-center gap-2 border-b border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink marker:content-none">
              <span>{t.label}</span>
              <span className="truncate font-normal text-ink/45">{t.hint}</span>
              {/* The way OUT. A panel that can only be opened is a panel that
                  never goes away — and the six of them stacked is what this
                  change exists to undo. */}
              <span className="ml-auto shrink-0 rounded-full border border-ink/15 px-2 py-0.5 text-xs font-medium text-ink/55 group-hover:border-ink/30">
                Close
              </span>
            </summary>
            <div className="p-3">{toolNodes[t.id]}</div>
          </details>
        ))}
      </div>
    ) : null;

  // ── Customer info rail (Customer Card respine PR-3) ──────────────────────
  // The rail no longer hides anything (owner ruling 2026-09-08). This flag now
  // means ONLY what its name says: a pending inquiry sits at the 'inquiry'
  // stage by definition, so there is no pipeline to derive yet. It must never
  // regain an identity meaning — that was the token wallet's lock.
  const threadIsPendingInquiry = thread.inquiry_status === 'pending';
  // ⚠ ONE derivation of a couple's two letters, shared with the conversation
  // column. Two copies is how one screen comes to show `CI` beside another
  // showing `C`.
  const railInitials = initialsFor(coupleLabel);
  // Service/category of the inquiry — the first recorded interest chip (the
  // same source the interest chips + cross-sell already use on this page).
  const firstInterest = existingInterests[0];
  const railService = firstInterest ? interestChipLabel(firstInterest) : null;
  const railStage = threadIsPendingInquiry
    ? ('inquiry' as const)
    : await deriveThreadStage({
        supabase,
        adminClient: paxAdmin,
        eventId: thread.event_id,
        vendorProfileId: profile.vendor_profile_id,
        // Without this a declined, withdrawn, expired or displaced thread keeps
        // reading as a live `Inquiry` — the pill said the conversation was
        // still open long after it had ended.
        inquiryStatus: thread.inquiry_status,
      });
  // ── DECISIONS · the two sources that are not messages ─────────────────────
  // Payments and the guest-count change are page sections rendered around the
  // stream, so the Decisions view can only get them from here. Both reads are
  // graceful — a refusal costs those rows, never the conversation.
  const [decisionPayments, liveQuoteTotalPhp] = await Promise.all([
    fetchThreadPayments({
      adminClient: paxAdmin,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }),
    // Under the supplier's OWN session — they read their own proposals.
    fetchLiveQuoteTotalPhp({
      supabase,
      eventId: thread.event_id,
      vendorProfileId: profile.vendor_profile_id,
    }),
  ]);
  const decisionGuestCounts = paxProposalsToGuestCounts(paxProposals, Date.now());

  // PR-H · IS THE BOOKING BEHIND THIS THREAD BOOKED, OR MERELY ASKED?
  // A supplier CANNOT read `event_vendors` through their own session — all four
  // policies on that table are couple- or moderator-scoped — so this uses the
  // admin client already in scope, narrowed to (this event × THIS shop's own
  // profile), the same pair the thread-ownership check above already proved.
  // Three handshake columns; no money, no guest data, no schedule.
  const lockHandshake = await fetchThreadLockHandshake(paxAdmin, {
    eventId: thread.event_id,
    vendorProfileId: profile.vendor_profile_id,
  });

  /**
   * WHERE YOU STAND — the SAME derivation the couple's thread page and bench
   * card use (S6), read in the supplier's voice.
   *
   * Until 2026-09-10 this page had no standing line, because the sentence
   * spoke only in the couple's second person and would have told a supplier
   * "waiting on you" about a quote they were waiting on. The subject now turns
   * around inside `buildSupplierStanding` via `viewer`, so the two sides can
   * never be told different facts about one conversation — and there is still
   * exactly one sentence, not a supplier copy of it.
   *
   * The rung is `railStage`, the one the header pill already shows, so the
   * pill and this line cannot contradict each other.
   */
  const lastThreadMessage = initialMessages[initialMessages.length - 1];
  const threadStanding = buildSupplierStanding({
    viewer: 'vendor',
    stage: railStage,
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
    lastSaidAtMs: lastThreadMessage ? Date.parse(lastThreadMessage.created_at) || null : null,
    nowMs: Date.now(),
  });

  // THE CUSTOMER SUMMARY (owner 2026-09-08). One builder, so the sentence and
  // the rows cannot disagree with each other or with the header above them.
  const customerSummary = buildCustomerEventSummary({
    hostName: customerPlan.hostName,
    eventTypeLabel: event?.event_type ? eventTypeLabel(event.event_type) : null,
    eventName: event?.display_name ?? null,
    createdAt: event?.created_at ?? null,
    targetDate: event?.event_date ?? null,
    pax: headerPax ?? null,
    paxAtInquiry: thread.pax_at_inquiry ?? null,
    dateDemandNote: vendorDateDemandNote(dateDemand),
    location: inquiryCity,
    lockedVendors: customerPlan.locked,
    totalVendors: customerPlan.total,
    lockedCategoryLabels: customerPlan.lockedCategories,
  });

  const railProps = {
    displayName: coupleLabel,
    summary: customerSummary,
    initials: railInitials,
    stage: { label: THREAD_STAGE_LABEL[railStage], tone: THREAD_STAGE_TONE[railStage] },
    service: railService,
    threadId,
    eventId: thread.event_id,
    // The launchers are only honest while the panels they open are on the page.
    toolsMounted,
    templateCount: proposalTemplates.length,
  };

  /* ── THE LEFT COLUMN: every conversation, beside the one being read ────────
     Owner 2026-09-08: "list · conversation · context".

     ⚡ FOUR BATCHED READS FOR THE WHOLE LIST, not four per row. The stage
     probes live in buildVendorConversationRows; here we gather the three things
     a row shows that are not already on the thread row itself.

     ⚠ EVERY ONE FAILS QUIET. This column is navigation, not the page — a
     refused read must leave the conversation itself readable, so each degrades
     to an empty map and the row falls back to what it can still say. */
  const listThreads = await fetchVendorThreads(supabase, profile.vendor_profile_id).catch(
    (caught: unknown) => {
      logQueryError(
        'VendorThreadPage.conversationList',
        caught instanceof Error ? caught : new Error(String(caught)),
        { vendor_profile_id: profile.vendor_profile_id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchVendorThreads>>;
    },
  );
  const listThreadIds = listThreads.map((t) => t.thread_id);
  const listEventIds = [...new Set(listThreads.map((t) => t.event_id))];

  const [listCustomers, lastMessageRes, listInterestRes, listReadRes] = await Promise.all([
    // Who each couple is. A vendor's own RLS nulls `events` out on every thread,
    // so this is the admin-scoped helper the inbox already uses — the caller's
    // ownership proof is fetchVendorThreads above.
    fetchInquiryCustomerFacts(paxAdmin, listEventIds),
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
          .select('thread_id, category_key, created_at')
          .in('thread_id', listThreadIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    // When this viewer last opened each thread — the dot and the bold preview.
    // ⚠ The read markers are a LATER migration than the threads themselves, so
    // this degrades to "nothing is unread": a missing dot understates, an
    // invented one sends a supplier into a conversation with nothing in it.
    listThreadIds.length > 0
      ? supabase
          .from('chat_thread_reads')
          .select('thread_id, last_read_at')
          .eq('user_id', user.id)
          .in('thread_id', listThreadIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (lastMessageRes.error) {
    logQueryError(
      'VendorThreadPage.lastMessages',
      lastMessageRes.error,
      { vendor_profile_id: profile.vendor_profile_id },
      'graceful_degrade',
    );
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

  /* Unread = something was said after this viewer last opened the thread.
     ⚠ A THREAD WITH NO READ MARKER IS NOT UNREAD HERE. The marker is written on
     open, so "never opened" and "the marker table is not reachable" are the same
     absence — and a whole column of dots on a shop that has read everything is
     noise that trains the eye to ignore the one that matters. */
  if (listReadRes.error) {
    logQueryError(
      'VendorThreadPage.listReads',
      listReadRes.error,
      { vendor_profile_id: profile.vendor_profile_id },
      'graceful_degrade',
    );
  }
  const listUnread = new Set<string>();
  for (const r of (listReadRes.data ?? []) as Array<{
    thread_id: string;
    last_read_at: string | null;
  }>) {
    const said = lastMessageAt.get(r.thread_id);
    if (said && r.last_read_at && new Date(said) > new Date(r.last_read_at)) {
      listUnread.add(r.thread_id);
    }
  }

  if (listInterestRes.error) {
    logQueryError(
      'VendorThreadPage.listInterests',
      listInterestRes.error,
      { vendor_profile_id: profile.vendor_profile_id },
      'graceful_degrade',
    );
  }
  const interestByThread = new Map<string, string>();
  for (const i of (listInterestRes.data ?? []) as Array<{
    thread_id: string;
    category_key: string | null;
  }>) {
    // First interest wins — the same "what did they ask about" the rail shows.
    if (!interestByThread.has(i.thread_id) && i.category_key) {
      interestByThread.set(i.thread_id, interestChipLabel({ category_key: i.category_key }));
    }
  }

  // ⚠ A TAG THAT NEVER CHANGES SAYS NOTHING. If this shop's whole inbox is
  // one category, tagging every row with it (per `interestByThread` above)
  // repeats the same word down the column and costs a line for free — the
  // service tag earns its spot only once it actually distinguishes a row from
  // its neighbours.
  const showServiceTag = serviceTagVaries([...interestByThread.values()]);
  const nowMs = Date.now();

  const listDisplayNames = new Map<string, string | null>();
  const listLabels = new Map<string, string[]>();
  for (const t of listThreads) {
    const facts = listCustomers.get(t.event_id);
    listDisplayNames.set(t.event_id, facts?.displayName ?? null);
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
    listLabels.set(t.event_id, tags);
  }

  const conversationRows = await buildVendorConversationRows({
    supabase,
    adminClient: paxAdmin,
    vendorProfileId: profile.vendor_profile_id,
    threads: listThreads.map((t) => ({
      thread_id: t.thread_id,
      event_id: t.event_id,
      inquiry_status: t.inquiry_status ?? null,
      updated_at: t.updated_at,
    })),
    displayNames: listDisplayNames,
    labels: listLabels,
    lastMessages,
    unreadThreadIds: listUnread,
    formatTime: formatChatTimestamp,
  });

  msgTimer.flush();

  /* 🔴 A SHIPPED FEATURE NOBODY COULD REACH. `<VendorEventDayPrepCta>` — the
     supplier's "have the day ready offline" card — has existed since iteration
     0036 with ZERO mount sites: the couple's twin `<EventDayPrepCta>` is mounted
     on their event home, and the supplier's was never given a home at all. This
     thread page is the one screen that already holds every prop it needs.

     ⚖ GATED ON `booked`, deliberately. The component's own docblock scopes it to
     "a single upcoming event the vendor has a CONTRACTED relationship with", and
     an ASKED supplier must not be nudged to pull down a run-of-show they have
     not earned — the same boundary PR-H draws. Nothing is widened either way:
     the action runs on the RLS-bound user client, so a supplier can only cache
     what they could already read. The card also self-gates to the T-3 → T+1
     window, so on most days it renders nothing at all. */
  const showDayPrep = railStage === 'booked' && Boolean(event?.event_date);

  return (
    <div className="mx-auto flex h-[calc(100dvh-12rem)] w-full max-w-3xl gap-4 px-4 py-6 sm:px-6 lg:max-w-6xl lg:px-8 xl:max-w-[86rem]">
      {/* LIST · CONVERSATION · CONTEXT (owner 2026-09-08). The list appears at
          xl, where there is room for all three without squeezing the middle —
          the whole point was to give the conversation back its space. */}
      <ConversationColumn
        rows={conversationRows}
        activeThreadId={threadId}
        side="vendor"
        hrefBase="/vendor-dashboard/messages"
      />
      <section className="flex min-w-0 flex-1 flex-col gap-4">
      <header className="flex items-center justify-between gap-3 sn-row p-4">
        <div className="min-w-0 space-y-0.5">
          <Link
            href="/vendor-dashboard/messages"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta-700"
          >
            ‹ Messages
          </Link>
          <p className="truncate text-base font-semibold text-ink">
            {headerLabel}
            {founderInquiry ? (
              <span className="ml-2 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                {FOUNDER_BADGE_LABEL}
              </span>
            ) : null}
          </p>
          {/* Inquiry-source chip (PR-C · owner taxonomy) — PRIVATE to the
              vendor; NULL resolves to "Website Inquiry". The returning flag is
              a COMPANION chip: it combines with any origin, never replaces it. */}
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full bg-ink/[0.07] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/60">
              {sourceChipLabel}
            </span>
            {thread.is_returning ? (
              <span className="inline-block rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                {RETURNING_CUSTOMER_LABEL}
              </span>
            ) : null}
          </p>
          {event?.event_date ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {/* "December 18, 2026", not the raw ISO key. A supplier deciding
                  whether they are free that day should not be reading a
                  database value (owner 2026-09-08). */}
              {formatLongDate(event.event_date)}
            </p>
          ) : null}
          {/* Live pax — recomputed fresh on view (Phase 5); the count the couple
              is planning for, and the count at first inquiry once it grows. */}
          {guestCountLine(guestCounts) ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta-700">
              {/* ⚠ THE OLD LINE ONLY NAMED THE INQUIRY COUNT WHEN IT WAS
                  SMALLER (`pax_at_inquiry < headerPax`). A couple who SHRANK
                  their guest list therefore saw the second number vanish — the
                  direction that costs a supplier money, silently. The helper
                  names it whenever the two differ, either way. */}
              Planning for {guestCountLine(guestCounts)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Mobile: opens the customer info rail as a sheet. Desktop shows the
              rail as a docked column instead (see below). */}
          <ChatInfoRailTrigger {...railProps} />
          <ChatThreadMenu
            threadId={threadId}
            returnTo={`/vendor-dashboard/messages/${threadId}`}
            blockedByMe={blockState.blockedByMe}
          />
        </div>
      </header>

      {showDayPrep ? (
        <VendorEventDayPrepCta
          threadId={threadId}
          eventId={thread.event_id}
          eventDisplayName={coupleLabel}
          eventDate={event?.event_date ?? null}
        />
      ) : null}

      {/* Creator Economy PR-C — the influencer-referral context (vendor-private).
          Names the storyteller + chapter behind this inquiry and restates the
          audience rate the vendor promised, so the promo is honored at quote
          time. The collab-active marker below covers the OTHER money moment:
          the inquirer themself holds an accepted collab → creator rate. */}
      {attribution ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm text-ink">
          <p>
            <span className="mr-1.5 inline-block rounded-full bg-amber-200/70 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-amber-900">
              Influencer Recommendation
            </span>
            Referred by{' '}
            {attribution.creatorSlug ? (
              <Link
                href={`/u/${attribution.creatorSlug}`}
                className="font-semibold hover:underline"
              >
                {attribution.creatorName}
              </Link>
            ) : (
              <span className="font-semibold">{attribution.creatorName}</span>
            )}{' '}
            · via{' '}
            {attribution.creatorSlug ? (
              <Link
                href={`/u/${attribution.creatorSlug}/c/${attribution.chapterPublicId}`}
                className="italic hover:underline"
              >
                {attribution.chapterTitle}
              </Link>
            ) : (
              <span className="italic">{attribution.chapterTitle}</span>
            )}
          </p>
          {attribution.audienceRateTerms ? (
            <p className="mt-1 text-ink/75">
              You promised their viewers:{' '}
              <span className="font-medium text-ink">
                {attribution.audienceRateTerms}
              </span>{' '}
              — honor it when you quote. The discount settles off-platform;
              Setnayan never touches the money.
            </p>
          ) : null}
        </div>
      ) : null}
      {inquirerCollabActive ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm text-ink">
          <span className="mr-1.5 inline-block rounded-full bg-amber-200/70 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-amber-900">
            Creator collab active
          </span>
          This inquirer holds an accepted collab with you — your agreed creator
          rate applies.
        </div>
      ) : null}

      {/* Pending surcharge confirms (Adaptive Pax Pricing Phase 5) — the count
          moved a booked service's cost; nothing changes until the vendor taps
          Accept. Symmetric: a drop shows a credit. Owner-locked confirm flow. */}
      {paxProposals.map((p) => {
        const up = p.delta > 0;
        return (
          <div
            key={p.eventVendorId}
            className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4"
          >
            <p className="text-sm font-semibold text-ink">
              Guest count changed — {p.label}
            </p>
            <p className="mt-1 text-sm text-ink/70">
              Now planning for <span className="font-semibold">{p.livePax}</span> guests
              (you quoted ~{p.quoteBasePax}). At {peso(p.ratePhp)}/guest, your total
              would {up ? 'increase' : 'decrease'} by{' '}
              <span className="font-semibold text-terracotta-700">
                {up ? '+' : '−'}{peso(p.delta)}
              </span>
              .
            </p>
            <div className="mt-3 flex gap-2">
              <form action={acceptPaxSurcharge}>
                <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <SubmitButton
                  pendingLabel="Applying…"
                  className="inline-flex h-9 items-center rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
                >
                  {up ? `Apply +${peso(p.delta)}` : `Apply −${peso(p.delta)}`}
                </SubmitButton>
              </form>
              <form action={declinePaxSurcharge}>
                <input type="hidden" name="event_vendor_id" value={p.eventVendorId} />
                <input type="hidden" name="thread_id" value={threadId} />
                <SubmitButton
                  pendingLabel="Holding…"
                  className="inline-flex h-9 items-center rounded-lg border border-ink/15 bg-white/70 px-4 text-sm text-ink/70 hover:border-ink/40"
                >
                  Hold price
                </SubmitButton>
              </form>
            </div>
          </div>
        );
      })}

      {/* Scroll anchor for the rail's "Log payment" quick action — lands on the
          couple-logged-payment confirm cards (rendered below when any exist). */}
      <div id="pending-payments" className="scroll-mt-24" aria-hidden />

      {/* Pending payment confirms + per-booking plan progress — moved into a
          live client component so the vendor's payment cards update in real
          time (Realtime on the couple-RLS payment tables, gated by the
          vendor-read policy in 20270315091571). The server still computes the
          initial state above and passes it in. */}
      <VendorPaymentLive
        threadId={threadId}
        eventId={thread.event_id}
        initialPending={pendingPayments}
        initialPlans={planProgress}
      />

      <ChatPrivacyNotice />

      <ThreadInterestChips supabase={supabase} threadId={threadId} />

      {/* A deep link from the client brief (Quote / Call / Log payment) and the
          rail's own launchers both land on an id inside a CLOSED disclosure.
          This opens it; without it those four controls scroll to a collapsed
          strip and read as doing nothing. */}
      <ThreadToolHashReveal />

      {vendorTools}

      <ChatMessageStream
        threadId={threadId}
        initialMessages={initialMessages}
        currentUserId={user.id}
        viewerRole="vendor"
        counterpartyLabel={coupleLabel}
        eventDate={event?.event_date ?? null}
        standing={threadStanding}
        decisionPayments={decisionPayments}
        decisionGuestCounts={decisionGuestCounts}
        initialView={initialView}
        // The SAME three actions this page's own sections post to — the
        // payment-confirm row and the guest-count surcharge card below. One
        // way to answer each request; Decisions is a second door to it.
        supplierReplyActions={{
          confirmPayment: confirmVendorPayment,
          applySurcharge: acceptPaxSurcharge,
          holdPrice: declinePaxSurcharge,
        }}
        lockHandshake={lockHandshake}
      />

      {blockState.blockedByMe || blockState.blockedByThem ? (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4 text-sm text-ink/70">
          {blockState.blockedByMe
            ? 'You blocked this person. Unblock from the ⋯ menu to message again.'
            : 'You can no longer message in this conversation.'}
        </div>
      ) : thread.inquiry_status === 'accepted' ? (
        <div className="space-y-3">
          {proposalNotice ? (
            <p className="rounded-xl border border-mulberry/25 bg-mulberry/[0.06] px-4 py-2.5 text-sm text-ink">
              {proposalNotice}
            </p>
          ) : null}
          {/* NOTHING BETWEEN THE LAST MESSAGE AND THE BOX BUT THE BOX. The six
              panels that used to sit here are `vendorTools`, above the stream
              and closed, opened from the rail's tool list. */}
          <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
        </div>
      ) : thread.inquiry_status === 'pending' ? (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">New inquiry.</span> Accept to reply,
            or decline if you&rsquo;re not available for this date.
          </p>
          {/* The facts a supplier decides on. These came from the gated
              get_pending_inquiry_basics RPC, which returned four deliberately
              NON-IDENTIFYING fields for a masked lead; they now come from the
              same admin-scoped `events` read that feeds the header, so the name
              above and the chips here can no longer disagree. Null-safe. */}
          {event ? (
            <div className="flex flex-wrap gap-1.5">
              {event.event_date ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                  {/* The chip a supplier reads before Accept/Decline. It showed
                      the raw ISO key while the line below it said "18 Dec." and
                      the header said something else again — three renderings of
                      one wedding day on one screen (owner 2026-09-08). */}
                  {formatLongDate(event.event_date)}
                </span>
              ) : null}
              {(() => {
                /* THE CHIP A SUPPLIER ACCEPTS ON. It rendered a bare "150 pax"
                   while the header above it said "~170 guests" — two numbers,
                   one screen, and nothing saying which was which. It leads with
                   the INQUIRY count, because that is the request being accepted,
                   and it now says so out loud even when there is only one number
                   to show: a missing label and a missing second number are
                   indistinguishable to the person reading. */
                const chip = guestCountChip(guestCounts, 'at_inquiry', { unit: 'pax' });
                return chip ? (
                  <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                    {chip.label} <i className="not-italic opacity-70">· {chip.basisLabel}</i>
                  </span>
                ) : null;
              })()}
              {event.event_type ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                  {eventTypeLabel(event.event_type)}
                </span>
              ) : null}
              {inquiryCity ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-700">
                  {inquiryCity}
                </span>
              ) : null}
              {event.setnayan_ai_active ? (
                <span className="inline-flex items-center rounded-full bg-mulberry/10 px-2.5 py-1 text-xs font-semibold text-mulberry">
                  Setnayan AI · Active
                </span>
              ) : null}
            </div>
          ) : null}
          {/*
            WHO ELSE WANTS THIS DAY — the supplier's own diary, brought to the
            decision instead of left two screens away. Owner: *"Target date for
            vendors will show who are also inquiring for that day so they do not
            need to browse their calendar?"*

            🔒 COUNTS, NEVER NAMES, and never on the couple's side of this
            thread — see lib/vendor-date-demand.ts and
            lib/who-else-wants-this-date.test.ts.

            ⚠ "Accepting does not book it" is part of the line, not decoration.
            Told they already hold a booking that week, a supplier's next
            thought is whether accepting spends something; it does not.
          */}
          {vendorDateDemandLine(dateDemand) ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-ink/[0.04] px-2.5 py-2 text-xs text-ink/70">
              <CalendarDays aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/45" />
              <span>
                {vendorDateDemandLine(dateDemand)} Accepting does not book it.
              </span>
            </p>
          ) : null}
          {returning ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                Returning client
              </span>
              Booked you for{' '}
              {returning.prior_event_display_name ?? 'a previous event'}.
            </p>
          ) : null}
          {/* Phase D — lead trust badge. Positive-only; shown only when the couple
              is already actively planning. A new couple gets no chip (never a
              warning), and the couple never sees this. */}
          {leadActivePlanner ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-mulberry/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-mulberry">
                Active planner
              </span>
              An engaged couple who&rsquo;s already deep in planning.
            </p>
          ) : null}
          {/* Founder-seat signal — server-asserted (founder_seats definer helper),
              never profile-editable. The one badge that must be unmistakable:
              this is the founders needing service, not a test or fake inquiry —
              and accepting costs the vendor nothing. */}
          {founderInquiry ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                {FOUNDER_BADGE_LABEL}
              </span>
              {FOUNDER_INQUIRY_NOTE}
            </p>
          ) : null}
          <PipelinePressureLine pressure={pipelinePressure} />
          <div className="flex flex-wrap gap-2">
            <form action={acceptInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <SubmitButton
                pendingLabel="Accepting…"
                className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                Accept inquiry
              </SubmitButton>
            </form>
            <form action={declineInquiry}>
              <input type="hidden" name="thread_id" value={threadId} />
              <input
                type="hidden"
                name="return_to"
                value={`/vendor-dashboard/messages/${threadId}`}
              />
              <SubmitButton
                pendingLabel="Declining…"
                className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink hover:bg-ink/5"
              >
                Decline
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {proposalNotice ? (
            <p className="rounded-xl border border-mulberry/25 bg-mulberry/[0.06] px-4 py-2.5 text-sm text-ink">
              {proposalNotice}
            </p>
          ) : null}
          <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
            <p className="text-sm text-ink/70">
              You declined this inquiry. The couple has been notified and pointed to
              other vendors.
            </p>
          </div>
          {/* Won & Lost Reasons (Wave 6) — even on a decline, log WHY so your
              roll-up reflects it. */}
          {outcomeCapture}
        </div>
      )}
      </section>

      {/* Customer info rail — docked column on lg+ (mobile uses the header
          trigger + sheet above). Customer Card respine PR-3. */}
      <ChatInfoRailColumn {...railProps} />
    </div>
  );
}
