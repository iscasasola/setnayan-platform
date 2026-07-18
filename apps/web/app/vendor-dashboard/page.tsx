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
  VendorTodayFocal,
  VendorEnergyStats,
  WhatsNewFeed,
  OngoingTasks,
  UpcomingSchedules,
} from './_components/overview-sections';
import { SpotlightAwardBanner } from './_components/spotlight-award-banner';
import { fetchVendorCurrentAwards } from '@/lib/spotlight-awards';
import { businessMilestone } from '@/lib/vendor-milestone';
import { fetchVendorBusinessStartDate } from '@/lib/vendor-profile';
import { manilaToday } from '@/lib/std-views';
import { formatPhp } from '@/lib/vendors';

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
        <p className="sn-eye">Setnayan · Vendor</p>
        <h1 className="sn-h1">You&apos;re on the team</h1>
        <p className="max-w-prose text-base text-ink/65">
          Your account is set up as a team member. The services and customers your
          owner assigns to you will appear here — scoped access is rolling out
          shortly. There&apos;s nothing you need to do right now.
        </p>
      </header>
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
          <h1 className="sn-h1">Overview</h1>
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

  // BUSINESS MILESTONE (owner 2026-07-13) — a monthsary while the shop is new
  // (its first year) and a yearly anniversary after: "a reason to celebrate and
  // create events". Prefers the precise founding date (guarded read, so a
  // not-yet-applied migration degrades to the open-date + year fallback).
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
            : "You're all caught up — new leads land here the moment a couple unlocks you."}
        </p>
        {milestone ? (
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
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
            <Link
              href="/dashboard/create-event"
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--sn-gold-700)' }}
            >
              Plan a celebration →
            </Link>
          </div>
        ) : null}
      </header>

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

      {/* 1 · What's new — the decision feed (centrepiece) */}
      <WhatsNewFeed
        cards={whatsNew}
        acceptInquiry={acceptInquiry}
        declineInquiry={declineInquiry}
        confirmLock={vendorAcknowledgeDeposit}
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
