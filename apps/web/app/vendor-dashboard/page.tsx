import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Info, PartyPopper } from 'lucide-react';
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
import { vendorAcknowledgeDeposit } from './clients/[eventId]/actions';
import {
  VendorEnergyStats,
  WhatsNewFeed,
  OngoingTasks,
  UpcomingSchedules,
} from './_components/overview-sections';
import { SpotlightAwardBanner } from './_components/spotlight-award-banner';
import { fetchVendorCurrentAwards } from '@/lib/spotlight-awards';
import { nextBusinessMonthsary } from '@/lib/vendor-milestone';
import { manilaToday } from '@/lib/std-views';

/**
 * /vendor-dashboard — the vendor Overview (finalized 6-menu-shell prototype).
 *
 * REBUILT 2026-07-01 to the finalized prototype (editorial `--m-*` palette).
 * The Overview is a DECISION SURFACE — "what needs you today" — not a stat
 * board. Three live streams, all wired to real sources (never the mockup's
 * sample numbers), assembled in `fetchVendorOverviewData`:
 *
 *   1. "What's new"  — a decision feed of act-on-now cards (new inquiries with
 *      the flat 1-token (₱200) cost to Accept · lock requests · new 5-star
 *      reviews awaiting a reply · flagged delivery delays). Centrepiece.
 *   2. Amber note    — the token-cost-follows-event-location explainer.
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

export const metadata = { title: 'Overview · Vendor' };

function AgentHome() {
  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
          Setnayan · Vendor
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          You&apos;re on the team
        </h1>
        <p className="max-w-prose text-base" style={{ color: 'var(--m-slate)' }}>
          Your account is set up as a team member. The services and customers your
          owner assigns to you will appear here — scoped access is rolling out
          shortly. There&apos;s nothing you need to do right now.
        </p>
      </header>
      <div
        className="rounded-xl border p-5 text-sm"
        style={{ background: '#fff', borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
      >
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

export default async function VendorOverviewPage() {
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
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--m-ink)' }}
          >
            Overview
          </h1>
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            What needs you today — {todayLabel()}.
          </p>
        </header>
        <div
          className="rounded-xl border p-6"
          style={{ background: '#fff', borderColor: 'var(--m-line)' }}
        >
          <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
            Team access
          </p>
          <h2 className="mt-2 text-xl font-semibold">You&rsquo;re on a vendor team.</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--m-slate)' }}>
            You don&rsquo;t own a vendor profile yet. Reach the team owner to be
            added to bookings + chats, or
            <Link
              href="/signup?as=vendor"
              className="ml-1 font-medium underline"
              style={{ color: 'var(--m-orange-2)' }}
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
  try {
    // The decision feed, Spotlight Award banner, and earnings summary all key
    // off the same vendor_profile_id and have no dependency on each other —
    // fetch them in parallel (2026-07-01 perf). Awards + earnings fail soft
    // (→ [] / null) so a failed read only hides that widget instead of tripping
    // the overview-unavailable page.
    [data, spotlightAwards, earnings] = await timer.track('overview-data', () => Promise.all([
      fetchVendorOverviewData(
        supabase,
        profile.vendor_profile_id,
        profile.services ?? [],
      ),
      fetchVendorCurrentAwards(supabase, profile.vendor_profile_id).catch(() => []),
      fetchVendorEarningsSummary(supabase, profile.vendor_profile_id).catch(() => null),
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
              Overview is temporarily unavailable.
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

  // NEW BUSINESS monthsary — a newly-opened shop's monthly celebration through
  // year one (owner 2026-07-13: "monthsary for … new business"), anchored to the
  // shop's open date. One quiet line; null past year one or for an established
  // shop that just joined.
  const businessMonthsary = nextBusinessMonthsary(
    profile.created_at,
    manilaToday(),
    profile.in_business_since_year,
  );

  timer.flush();

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Heading */}
      <header className="mb-8 space-y-1.5">
        <h1
          className="m-serif text-4xl tracking-tight sm:text-5xl"
          style={{ color: 'var(--m-ink)' }}
        >
          Overview
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          What needs you today — {todayLabel()}.
        </p>
        {businessMonthsary ? (
          <p
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: 'var(--m-orange-4)',
              color: 'var(--m-ink)',
            }}
          >
            <PartyPopper aria-hidden className="h-3.5 w-3.5" style={{ color: 'var(--m-orange-2)' }} />
            {profile.business_name} — your {businessMonthsary.label}
            <span style={{ color: 'var(--m-slate)' }}>
              · {businessMonthsary.daysUntil === 0
                ? 'today'
                : businessMonthsary.daysUntil === 1
                  ? 'tomorrow'
                  : `in ${businessMonthsary.daysUntil} days`}
            </span>
          </p>
        ) : null}
      </header>

      {/* 0 · Energy stats — the databerry stat bento (real feed-derived counts
          + real booked-revenue tiles; earnings null → tiles omitted) */}
      <VendorEnergyStats
        whatsNew={whatsNew}
        ongoing={ongoing}
        upcoming={upcoming}
        earnings={earnings}
      />

      {/* Spotlight Award — celebratory banner, shown only when this vendor holds
          at least one current-period award (empty list renders nothing). */}
      <SpotlightAwardBanner awards={spotlightAwards} />

      {/* 1 · What's new — the decision feed (centrepiece) */}
      <WhatsNewFeed
        cards={whatsNew}
        acceptInquiry={acceptInquiry}
        declineInquiry={declineInquiry}
        confirmLock={vendorAcknowledgeDeposit}
      />

      {/* 2 · Amber note — token cost follows the customer's event location */}
      <div
        className="mb-8 flex items-start gap-3 rounded-xl border p-4 text-sm"
        style={{
          background: 'var(--m-orange-4)',
          borderColor: 'var(--m-orange-3)',
          color: 'var(--m-ink)',
        }}
      >
        <Info
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0"
          strokeWidth={1.75}
          style={{ color: 'var(--m-orange-2)' }}
        />
        <p>
          Answering a lead costs a flat 1 token (₱200), anywhere in the
          Philippines. You only spend when you Accept.
        </p>
      </div>

      {/* 3 · Ongoing — open tasks */}
      <OngoingTasks tasks={ongoing} />

      {/* 4 · Upcoming schedules — next 5 booked events */}
      <UpcomingSchedules rows={upcoming} />
    </div>
  );
}
