import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ServerTimer } from '@/lib/server-timing';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchMessages,
  fetchReturningClientFlags,
  fetchLeadTrustActivePlanner,
  fetchThreadById,
} from '@/lib/chat';
import { leadTrustBadgeEnabled } from '@/lib/inquiry-gate';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchOwnPaymentMethods } from '@/lib/vendor-payment-methods';
import { sendChatMessage, acceptInquiry, declineInquiry, markThreadRead } from '@/lib/chat-actions';
import { getThreadBlockState } from '@/lib/chat-block';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
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
  fetchPendingVendorPayments,
  fetchPlanProgressForVendor,
} from '@/lib/vendor-service-payment-schedules.server';
import { acceptPaxSurcharge, declinePaxSurcharge } from './pax-actions';
import { VendorPaymentLive } from './_components/vendor-payment-live';
import {
  VendorOfferService,
  type VendorOfferOption,
} from './_components/vendor-offer-service';
import { SendProposalCard } from './_components/send-proposal-card';
import { ProposalMaker } from '@/app/_components/proposal-maker';
import { ChatInfoRailColumn, ChatInfoRailTrigger } from './_components/chat-info-rail';
import { SubmitButton } from '@/app/_components/submit-button';
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

export const metadata = { title: 'Thread · Vendor' };

type Props = {
  params: Promise<{ threadId: string }>;
  searchParams?: Promise<{ notice?: string }>;
};

// Masked-lead inquiry basics (PR 1) — the 4 non-identifying fields the gated
// get_pending_inquiry_basics RPC returns for a PENDING lead. NEVER carries the
// couple's name/contact/venue.
type InquiryBasics = {
  event_date: string | null;
  region: string | null;
  event_type: string | null;
  setnayan_ai_active: boolean | null;
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
  const noticeKey = (await searchParams)?.notice;
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
    inquiryBasics,
    ownPaymentMethods,
  ] = await msgTimer.track('thread', () => Promise.all([
    // UGC block state (Apple 1.2) — drives the thread menu label + composer gating.
    getThreadBlockState(thread, user.id, 'vendor'),
    // Identity-masking source of truth: never expose the couple's email or
    // personal name; show only the event's display_name + date.
    supabase
      .from('events')
      .select('display_name, event_date')
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
    // Masked-lead inquiry basics (PR 1 · owner-approved 2026-07-11). A vendor is
    // NOT an event_members row while the inquiry is pending, so a direct read on
    // `events` returns NULL under their RLS. This gated SECURITY DEFINER RPC
    // returns ONLY 4 non-identifying fields (date / region / event_type /
    // AI-status) for a PENDING thread the caller's vendor org owns — never
    // name/contact/venue. FAIL-SOFT: any error (e.g. the function isn't in prod
    // yet) degrades to null so the masked lead still renders.
    thread.inquiry_status === 'pending'
      ? (async (): Promise<InquiryBasics | null> => {
          try {
            const { data, error } = await supabase.rpc(
              'get_pending_inquiry_basics',
              { p_thread_id: thread.thread_id },
            );
            if (error || !Array.isArray(data)) return null;
            return (data[0] as InquiryBasics | undefined) ?? null;
          } catch {
            return null;
          }
        })()
      : Promise.resolve<InquiryBasics | null>(null),
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

  const coupleLabel = event?.display_name ?? 'Couple';

  const alreadyOnThread = new Set(
    existingInterests
      .map((r) => r.vendor_service_id)
      .filter((v): v is string => v !== null),
  );
  const offerOptions: VendorOfferOption[] = ownServices
    .filter((s) => s.is_active && !alreadyOnThread.has(s.vendor_service_id))
    .map((s) => ({
      vendorServiceId: s.vendor_service_id,
      label:
        s.title?.trim() ||
        (isCanonicalService(s.category)
          ? VENDOR_CATEGORY_LABEL[s.category as VendorCategory]
          : s.category),
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

  // Phase D — lead trust badge (fake-inquiry protection · "informed accept").
  // Flag-gated + pending-only + fail-soft. "Active planner" is a purely positive
  // cue (real engagement) — a new couple simply has no badge, never a warning.
  const leadActivePlanner =
    leadTrustBadgeEnabled() && thread.inquiry_status === 'pending'
      ? await fetchLeadTrustActivePlanner(supabase, profile.vendor_profile_id, thread.event_id)
      : false;

  const headerPax = livePax ?? thread.pax_current;
  // paxProposals depends on livePax, so it's the one query that follows the batch.
  const paxProposals = await fetchVendorPaxProposals(paxAdmin, {
    eventId: thread.event_id,
    vendorProfileId: profile.vendor_profile_id,
    livePax,
    paxAtInquiry: thread.pax_at_inquiry,
  });

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

  // ── Customer info rail (Customer Card respine PR-3) ──────────────────────
  // Masked = the inquiry is still pending; the rail reveals nothing beyond the
  // placeholder (vendor hybrid-anonymity — mirrors the accept-gate on the
  // conversation below). Only derive the stage/snapshot when unmasked.
  const railMasked = thread.inquiry_status === 'pending';
  const railInitials =
    coupleLabel
      .split(/[\s&·]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? '')
      .join('') || 'C';
  // Service/category of the inquiry — the first recorded interest chip (the
  // same source the interest chips + cross-sell already use on this page).
  const firstInterest = existingInterests[0];
  const railService = firstInterest ? interestChipLabel(firstInterest) : null;
  const railPaxLabel = !railMasked && headerPax ? `~${headerPax} planning` : null;
  const railStage = railMasked
    ? ('inquiry' as const)
    : await deriveThreadStage({
        supabase,
        adminClient: paxAdmin,
        eventId: thread.event_id,
        vendorProfileId: profile.vendor_profile_id,
      });
  const railProps = {
    displayName: railMasked ? 'New Customer' : coupleLabel,
    initials: railInitials,
    masked: railMasked,
    stage: { label: THREAD_STAGE_LABEL[railStage], tone: THREAD_STAGE_TONE[railStage] },
    eventDate: event?.event_date ?? null,
    service: railMasked ? null : railService,
    paxLabel: railPaxLabel,
    threadId,
    eventId: thread.event_id,
  };

  msgTimer.flush();

  return (
    <div className="mx-auto flex h-[calc(100dvh-12rem)] w-full max-w-3xl gap-4 px-4 py-6 sm:px-6 lg:max-w-6xl lg:px-8">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
      <header className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4">
        <div className="min-w-0 space-y-0.5">
          <Link
            href="/vendor-dashboard/messages"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
          >
            ‹ Messages
          </Link>
          <p className="truncate text-base font-semibold text-ink">{coupleLabel}</p>
          {event?.event_date ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {event.event_date}
            </p>
          ) : null}
          {/* Live pax — recomputed fresh on view (Phase 5); the count the couple
              is planning for, and the count at first inquiry once it grows. */}
          {headerPax ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta">
              Planning for ~{headerPax} guests
              {thread.pax_at_inquiry && thread.pax_at_inquiry < headerPax
                ? ` · was ${thread.pax_at_inquiry} at inquiry`
                : ''}
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
                  className="inline-flex h-9 items-center rounded-lg border border-ink/15 bg-cream px-4 text-sm text-ink/70 hover:border-ink/40"
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

      {thread.inquiry_status === 'accepted' ? (
        <VendorOfferService threadId={threadId} options={offerOptions} />
      ) : null}

      <ChatMessageStream
        threadId={threadId}
        initialMessages={initialMessages}
        currentUserId={user.id}
        viewerRole="vendor"
        counterpartyLabel={coupleLabel}
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
          <div id="send-proposal" className="scroll-mt-24">
            <SendProposalCard
              threadId={threadId}
              templates={proposalTemplates}
              packages={proposalPackages}
            />
          </div>
          {/* Proposal Maker (PR 3) — compose a custom priced quote (pricing
              bases + freebies + crew/transport) right in the thread. Seeded
              from the couple's requested pax. Additive to the template-based
              SendProposalCard above. */}
          <div id="build-quote" className="scroll-mt-24">
            <ProposalMaker
              threadId={threadId}
              requestedPax={thread.pax_at_inquiry ?? headerPax ?? 100}
              coupleName={coupleLabel}
              packages={proposalPackages}
              paymentMethods={proposalPaymentMethods}
            />
          </div>
          {/* Won & Lost Reasons (Wave 6) — log the outcome of this booked/active
              inquiry. Self-reported; "Won" is off-platform, not a payment. */}
          {outcomeCapture}
          {/* Free 1:1 voice/video call — accepted threads only (PR 10). */}
          <ThreadCallLauncher
            threadId={threadId}
            currentUserId={user.id}
            counterpartyLabel={coupleLabel}
            callsEnabled={callsEnabled}
            viewerRole="vendor"
            upgradeHref="/vendor-dashboard/subscription"
          />
          <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
        </div>
      ) : thread.inquiry_status === 'pending' ? (
        <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">New inquiry.</span> Accept to open the
            chat and reply, or decline if you&rsquo;re not available for this date.
          </p>
          {/* Inquiry basics (PR 1 · owner-approved 2026-07-11) — decision-useful,
              non-identifying facts surfaced on the MASKED lead. The couple's name
              stays hidden; these come from the gated get_pending_inquiry_basics
              RPC and are null-safe (RPC absent / pre-migration → no chips). */}
          {inquiryBasics ? (
            <div className="flex flex-wrap gap-1.5">
              {inquiryBasics.event_date ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta">
                  {inquiryBasics.event_date}
                </span>
              ) : null}
              {(() => {
                const pax = thread.pax_at_inquiry ?? thread.pax_current;
                return pax ? (
                  <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta">
                    {pax} pax
                  </span>
                ) : null;
              })()}
              {inquiryBasics.event_type ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta">
                  {eventTypeLabel(inquiryBasics.event_type)}
                </span>
              ) : null}
              {regionLabel(inquiryBasics.region) ? (
                <span className="inline-flex items-center rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta">
                  {regionLabel(inquiryBasics.region)}
                </span>
              ) : null}
              {inquiryBasics.setnayan_ai_active ? (
                <span className="inline-flex items-center rounded-full bg-mulberry/10 px-2.5 py-1 text-xs font-semibold text-mulberry">
                  Setnayan AI · Active
                </span>
              ) : null}
            </div>
          ) : null}
          {returning ? (
            <p className="text-sm text-ink">
              <span className="mr-1.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta">
                Returning client
              </span>
              Booked you for{' '}
              {returning.prior_event_display_name ?? 'a previous event'}
              {returning.resync_flat ? ' — accepting costs just 1 token.' : '.'}
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
