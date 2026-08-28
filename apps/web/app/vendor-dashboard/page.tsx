import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, EyeOff, Info, PartyPopper } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  fetchVendorOverviewData,
  fetchVendorEarningsSummary,
  type VendorEarningsSummary,
} from '@/lib/vendor-overview';
import { ServerTimer } from '@/lib/server-timing';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import {
  vendorAcknowledgeDeposit,
  vendorRejectDeposit,
  vendorAgreeToLock,
  vendorDeclineLock,
  vendorAgreeToDeletion,
  vendorDeclineDeletion,
} from './clients/[eventId]/actions';
// The desk TAKES these two answers rather than linking away to them. Both are
// the shipped actions, unchanged in what they enforce: the reply action still
// posts one final public reply through the vendor's own session, and
// `respondAppointment` still refuses an answer from the side that proposed.
import { postVendorReply } from './reviews/actions';
import { respondAppointment } from '@/app/_components/appointments-actions';
import {
  VendorTodayFocal,
  VendorEnergyStats,
  WhatsNewFeed,
  OngoingTasks,
  UpcomingSchedules,
} from './_components/overview-sections';
import { SpotlightAwardBanner } from './_components/spotlight-award-banner';
import { VendorFirstSteps } from './_components/first-steps';
import { fetchVendorFirstStepsState } from '@/lib/vendor-first-steps.server';
import type { FirstStepsRail } from '@/lib/vendor-first-steps';
import { fetchVendorCurrentAwards } from '@/lib/spotlight-awards';
import { businessMilestone } from '@/lib/vendor-milestone';
import { fetchVendorBusinessStartDate } from '@/lib/vendor-profile';
import { manilaToday } from '@/lib/std-views';
import { formatPhp } from '@/lib/vendors';
import { PageMasthead } from '@/app/_components/page-masthead';
import {
  shopFindability,
  findabilityNotice,
} from '@/lib/vendor-shop-findable';

/**
 * /vendor-dashboard — the vendor Overview (finalized 6-menu-shell prototype).
 *
 * REBUILT 2026-07-01 to the finalized prototype (editorial `--m-*` palette).
 * ⚠ LABELLED "Today" SINCE 2026-08-26 (owner: "yes i agree"). The word was
 * always wrong for what this page does — the docblock below said so from the
 * first day — and the admin console took the same rename the same week. The
 * key stays `overview`; four systems read it and three fail silently.
 *
 * The Overview is a DECISION SURFACE — "what needs you today" — not a stat
 * board. Three live streams, all wired to real sources (never the mockup's
 * sample numbers), assembled in `fetchVendorOverviewData`:
 *
 *   1. "What's new"  — THE ANSWERS DESK: every answer this shop owes anybody,
 *      oldest waiting first, answered on the row wherever the answer works (new
 *      inquiries — answering couples is free · booking asks · unanswered
 *      reviews at any rating, with the reply box on the card · flagged delivery
 *      delays · replies owed in accepted conversations · meeting times the
 *      couple proposed · quotes and contracts never sent). Centrepiece.
 *   2. Amber note    — the "answering couples is free" explainer.
 *   3. "Ongoing"     — the vendor's open tasks with due chips.
 *   4. "Upcoming schedules" — the next 5 booked events by date.
 *
 * The previous stat-tile Overview (6 tiles + customer-mix + shortlist radar +
 * journal features) is superseded by this decision-first layout; those deeper
 * surfaces stay reachable from the 6-menu sidebar + /more.
 *
 * Role-aware: agent/viewer team members (who own no profile + have no scoped
 * data yet) see a team-member landing instead. Owner/admin get the full
 * Overview.
 */

export const metadata = { title: 'Today · Vendor' };

function AgentHome() {
  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        titleNode={
          <>
            You&apos;re on the team
          </>
        }
      />
      <div className="sn-tile p-5 text-sm text-ink/65">
        Need access to something now? Ask your vendor owner to assign you to the
        services you&apos;ll be managing.
      </div>
    </div>
  );
}

/** "What needs you today — Wednesday, July 1." */
function todayLabel(): string {
  return new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * The desk takes two answers that redirect back to it — the deposit refusal and
 * (via its own path) the review reply. A REFUSAL IN SILENCE IS INDISTINGUISHABLE
 * FROM ONE THAT NEVER HAPPENED: the row simply vanishes, so without this the
 * supplier who just said "it never arrived" has no way to know it was recorded
 * and the couple told. Four outcomes, each said plainly.
 */
const DEPOSIT_ANSWER_NOTICE: Record<string, string> = {
  ok: 'We told them it never reached you. Their record of paying is cleared, so they can send it again with the right receipt.',
  already: 'That was already answered — nothing changed.',
  already_confirmed:
    'You had already confirmed this payment, so it can no longer be marked as never received. Open the customer if that needs sorting out.',
  not_recorded: 'There was nothing to answer — they have no payment recorded here.',
  error: 'That did not go through. Nothing changed — please try again.',
};

export default async function VendorOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ deposit_answer?: string }>;
}) {
  const search = (await searchParams) ?? {};
  const depositAnswer = search.deposit_answer
    ? DEPOSIT_ANSWER_NOTICE[search.deposit_answer] ?? DEPOSIT_ANSWER_NOTICE.error
    : null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Role + profile have no dependency on each other — resolve them together.
  // Both are React-cache()-wrapped and were already read by the vendor layout
  // in this same request, so these calls hit the per-request cache rather than
  // re-querying (2026-07-01 perf).
  const [vendorRole, profile] = await Promise.all([
    resolveVendorRole(supabase, user.id),
    fetchOwnVendorProfile(supabase, user.id),
  ]);
  if (vendorRole && !canManageVendor(vendorRole)) {
    return <AgentHome />;
  }

  // No profile yet (fresh team-member without an owned shop) — a light landing
  // that routes them to create one. No feed to compute.
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-6 space-y-1.5">
          <h1 className="sn-h1">Today</h1>
          <p className="text-sm text-ink/60">
            What needs you today — {todayLabel()}.
          </p>
        </header>
        <div className="sn-tile p-6">
          <p className="sn-eye">Team access</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">You&rsquo;re on a vendor team.</h2>
          <p className="mt-2 text-sm text-ink/65">
            You don&rsquo;t own a vendor profile yet. Reach the team owner to be
            added to bookings + chats, or
            <Link
              href="/signup?as=vendor"
              className="ml-1 font-semibold underline"
              style={{ color: 'var(--sn-gold-700)' }}
            >
              create your own
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const timer = new ServerTimer('vendor-dashboard/overview');
  let data;
  let spotlightAwards;
  let earnings: VendorEarningsSummary | null;
  let firstSteps: FirstStepsRail | null;
  try {
    // The decision feed, Spotlight Award banner, and earnings summary all key
    // off the same vendor_profile_id and have no dependency on each other —
    // fetch them in parallel (2026-07-01 perf). Awards + earnings fail soft
    // (→ [] / null) so a failed read only hides that widget instead of tripping
    // the overview-unavailable page.
    [data, spotlightAwards, earnings, firstSteps] = await timer.track('overview-data', () => Promise.all([
      fetchVendorOverviewData(
        supabase,
        profile.vendor_profile_id,
        profile.services ?? [],
      ),
      fetchVendorCurrentAwards(supabase, profile.vendor_profile_id).catch(() => []),
      fetchVendorEarningsSummary(supabase, profile.vendor_profile_id).catch(() => null),
      // The order-of-operations rail. Null on a verified shop (it short-circuits
      // after one cheap read) and null on any failure — a nudge must never be
      // what takes the vendor's home page down.
      fetchVendorFirstStepsState(supabase, profile).catch(() => null),
    ]));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard overview] loader failed', err);
    return (
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-start gap-3">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-6 w-6 shrink-0"
            strokeWidth={1.75}
            style={{ color: 'var(--m-blush-deep)' }}
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              This page is temporarily unavailable.
            </h1>
            <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
              Refreshing usually clears this. Your data is safe.
            </p>
          </div>
        </header>
      </div>
    );
  }

  const { whatsNew, ongoing, upcoming } = data;

  // BUSINESS MILESTONE (owner 2026-07-13) — a monthsary while the shop is new
  // (its first year) and a yearly anniversary after. Prefers the precise
  // founding date (guarded read, so a not-yet-applied migration degrades to the
  // open-date + year fallback).
  //
  // ⚠ RETIRED 2026-08-05 (owner, looking at the live shop overview: "on vendor
  // why is there plan a celebration? there shouldn't be") — the pill shipped
  // 07-13 alongside a "Plan a celebration →" link into `/dashboard/create-event`.
  // That is the COUPLE doorway; a vendor's shop overview must not hand them a
  // plan-your-own-event flow. The badge stays (it was the ask); do NOT re-add
  // the CTA.
  const businessStartDate = await fetchVendorBusinessStartDate(
    supabase,
    profile.vendor_profile_id,
  );
  const milestone = businessMilestone(
    profile.created_at,
    manilaToday(),
    profile.in_business_since_year,
    businessStartDate,
  );

  timer.flush();

  // Hero metrics feed the focal tile below (the designed home for the
  // inquiries / next-booking / earned trio). The hero itself no longer restates
  // them as text — that was the same three numbers a few lines above the focal
  // (deduped 2026-07-16); the hero subline is now a plain orienting lead-in.
  const heroInquiries = whatsNew.filter((c) => c.kind === 'inquiry').length;
  const heroEarnedPhp = earnings?.earnedThisYearPhp ?? null;

  // WHY COUPLES CAN'T FIND YOU — decided once, in `lib/vendor-shop-findable.ts`,
  // from the `public_visibility` already on this row (no extra query) and from
  // whether the first-steps rail is on screen (so the two can never argue).
  // `notice` is null for a live shop and for a shop still working through
  // approval, where the rail says it better.
  const findability = shopFindability({
    publicVisibility: (profile as { public_visibility?: unknown }).public_visibility,
    railShowing: firstSteps != null,
  });
  const findabilityBanner = findabilityNotice(findability);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Hero — greeting eyebrow → `.sn-h1` statement → mono stat line (§ 3.3). */}
      <header className="sn-reveal space-y-1.5">
        <p className="text-[13px] text-ink/55">
          Kumusta, {profile.business_name} · {todayLabel()}
        </p>
        <h1 className="sn-h1">
          Your shop, today.
        </h1>
        <p className="max-w-[56ch] pt-0.5 text-[12.5px] text-ink/55">
          {heroInquiries > 0
            ? 'Here’s what needs you today.'
            : firstSteps
              ? // An unverified shop is invisible to every couple, so "you're all
                // caught up — new leads land here" was a promise that could not
                // come true: it told a vendor to wait for something that will
                // never arrive until they finish the steps below.
                'No couple can find you yet — your first steps are below.'
              : // ⚠ THE SAME PROMISE, ONE COLUMN OVER. The rail only knows about
                // `verification_state`; a shop can be approved and still not
                // listed, and telling that shop to sit tight and wait for leads
                // is telling it to wait for something that cannot arrive.
                !findability.findable
                ? 'No couple can find you yet — see the note below.'
                : "You're all caught up — new leads land here the moment a couple unlocks you."}
        </p>
        {milestone ? (
          <div className="pt-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-ink-900)' }}
            >
              <PartyPopper aria-hidden className="h-3.5 w-3.5" style={{ color: 'var(--sn-gold-700)' }} />
              {profile.business_name} — your {milestone.label}
              {/* A countdown only when it's near; a far-off anniversary reads as
                  a proud badge, not an early countdown. */}
              {milestone.daysUntil <= 92 ? (
                <span style={{ color: 'var(--sn-ink-400)' }}>
                  ·{' '}
                  {milestone.daysUntil <= 0
                    ? 'today'
                    : milestone.daysUntil === 1
                      ? 'tomorrow'
                      : `in ${milestone.daysUntil} days`}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </header>

      {/* Why couples can't find you. Mutually exclusive with the rail below by
          construction — `shopFindability` returns the silent state whenever the
          rail is showing — so this is never a second voice on the same subject.
          It sits FIRST because an invisible shop has nothing else worth reading
          on this page: every count below it is a count of people who could not
          reach it. */}
      {findabilityBanner ? (
        <div
          className="mt-6 flex items-start gap-3 rounded-xl border px-4 py-3.5"
          style={{
            borderColor: 'var(--m-orange-3)',
            background: 'var(--m-orange-4)',
            color: 'var(--m-orange-deep)',
          }}
        >
          <EyeOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <div className="min-w-0 text-sm leading-relaxed">
            <p className="font-semibold">{findabilityBanner.title}</p>
            <p className="mt-0.5">{findabilityBanner.body}</p>
            {findabilityBanner.cta ? (
              <Link
                href={findabilityBanner.cta.href}
                className="mt-2 inline-flex items-center gap-1 font-semibold underline"
              >
                {findabilityBanner.cta.label}
                <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* First steps — the order of operations, ABOVE the focal tile and the
          feed. For a shop that isn't approved yet those are all zeros and an
          empty feed, so the one useful thing on this page is what to do next.
          Renders nothing once the shop is verified (rail is null). */}
      {firstSteps ? <VendorFirstSteps rail={firstSteps} /> : null}

      {/* Focal — "Today at {shop}", the single obsidian tile (§ 1.3). Blooms
          last; its gold CTA anchors to the What's-new feed below. */}
      <VendorTodayFocal
        businessName={profile.business_name}
        inquiries={heroInquiries}
        nextBooking={upcoming[0] ?? null}
        earnedThisYearPhp={heroEarnedPhp}
      />

      {/* KPI bento — glass tiles, ring sweeps, Space-Mono numerals (real
          feed-derived counts + real earnings; earnings null → money tiles omitted). */}
      <div className="mt-6">
        <VendorEnergyStats
          whatsNew={whatsNew}
          ongoing={ongoing}
          upcoming={upcoming}
          earnings={earnings}
        />
      </div>

      {/* Spotlight Award — celebratory banner, shown only when this vendor holds
          at least one current-period award (empty list renders nothing). */}
      <SpotlightAwardBanner awards={spotlightAwards} />

      {/* The outcome of an answer given ON this page, said where it was given. */}
      {depositAnswer ? (
        <div
          role="status"
          className="sn-tile mb-6 flex items-start gap-3 p-4 text-sm text-ink/80"
        >
          <Info
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={1.75}
            style={{ color: 'var(--sn-gold-700)' }}
          />
          <p>{depositAnswer}</p>
        </div>
      ) : null}

      {/* 1 · What's new — the decision feed (centrepiece) */}
      <WhatsNewFeed
        cards={whatsNew}
        acceptInquiry={acceptInquiry}
        declineInquiry={declineInquiry}
        confirmLock={vendorAcknowledgeDeposit}
        rejectLock={vendorRejectDeposit}
        agreeLock={vendorAgreeToLock}
        declineLock={vendorDeclineLock}
        agreeDeletion={vendorAgreeToDeletion}
        declineDeletion={vendorDeclineDeletion}
        postReviewReply={postVendorReply}
        respondMeeting={respondAppointment}
      />

      {/* 2 · Token note — cost follows the customer's event location. A subtle
          glass tile with a gold info accent (not a loud banner). */}
      <div className="sn-tile mb-8 flex items-start gap-3 p-4 text-sm text-ink/75">
        <Info
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0"
          strokeWidth={1.75}
          style={{ color: 'var(--sn-gold-700)' }}
        />
        <p>
          Answering couples is free — reply to any lead at no cost, anywhere in
          the Philippines. Accept to see who they are and start the conversation.
        </p>
      </div>

      {/* 3 · Ongoing — open tasks */}
      <OngoingTasks tasks={ongoing} />

      {/* 4 · Upcoming schedules — next 5 booked events */}
      <UpcomingSchedules rows={upcoming} />
    </div>
  );
}
