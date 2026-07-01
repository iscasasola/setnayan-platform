import Link from 'next/link';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { fetchVendorOverviewData } from '@/lib/vendor-overview';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import {
  asVendorTier,
  canSeeMarketIntel,
  canSeePerformanceTrends,
} from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';
import { regionLabel } from '@/lib/region-source';
import { getVendorDemandRadar, maybeRefreshDemandRadar } from '@/lib/demand-radar';
import { computeVendorFunnelView } from '@/lib/vendor-funnel';
import { vendorAcknowledgeDeposit } from './clients/[eventId]/actions';
import {
  WhatsNewFeed,
  OngoingTasks,
  UpcomingSchedules,
} from './_components/overview-sections';
import { DemandRadarPanel } from './_components/demand-radar-panel';
import { FunnelPanel } from './_components/funnel-panel';

/**
 * /vendor-dashboard — the vendor Overview (finalized 6-menu-shell prototype).
 *
 * REBUILT 2026-07-01 to the finalized prototype (editorial `--m-*` palette).
 * The Overview is a DECISION SURFACE — "what needs you today" — not a stat
 * board. Three live streams, all wired to real sources (never the mockup's
 * sample numbers), assembled in `fetchVendorOverviewData`:
 *
 *   1. "What's new"  — a decision feed of act-on-now cards (new inquiries with
 *      the region-banded ◎ token cost to Accept · lock requests · new 5-star
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
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
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

  const vendorRole = await resolveVendorRole(supabase, user.id);
  if (vendorRole && !canManageVendor(vendorRole)) {
    return <AgentHome />;
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);

  // No profile yet (fresh team-member without an owned shop) — a light landing
  // that routes them to create one. No feed to compute.
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
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

  let data;
  try {
    data = await fetchVendorOverviewData(
      supabase,
      profile.vendor_profile_id,
      profile.services ?? [],
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard overview] loader failed', err);
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
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

  // ── Market-intel analytics (same live sources + role-scoping the standalone
  // /demand + /funnel routes use) ─────────────────────────────────────────────
  // We're already past the owner/admin gate (agents got AgentHome above), which
  // mirrors /demand's canManageVendor() check. The tier gates below are the
  // same flag-dark ones the standalone routes apply: Demand Radar → Pro
  // (canSeeMarketIntel), Funnel → Solo (canSeePerformanceTrends). Both are
  // no-ops until VENDOR_TIER_FEATURE_GATE flips on, so today every vendor sees
  // both sections — matching the live standalone surfaces.
  const gateOn = isVendorFeatureGateEnabled();

  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('hq_region, tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const typedTierRow = tierRow as
    | { hq_region?: string | null; tier_state?: string | null }
    | null;
  const tier = asVendorTier(typedTierRow?.tier_state);
  const hqRegion = typedTierRow?.hq_region ?? null;
  const marketLabel = hqRegion ? regionLabel(hqRegion) ?? hqRegion : null;

  const showDemandRadar = !gateOn || canSeeMarketIntel(tier);
  const showFunnel = !gateOn || canSeePerformanceTrends(tier);

  // Fetch only what we'll render. Both reads degrade honestly (empty radar /
  // zeroed funnel) rather than throwing — analytics never breaks the Overview.
  const [demandRadar, funnelView] = await Promise.all([
    showDemandRadar
      ? getVendorDemandRadar(supabase, profile.vendor_profile_id)
      : Promise.resolve(null),
    showFunnel
      ? computeVendorFunnelView(supabase, profile.vendor_profile_id, 'month')
      : Promise.resolve(null),
  ]);

  // Cron-free, throttled opportunistic radar rebuild after the response flushes
  // (mirrors the standalone /demand route).
  if (showDemandRadar) {
    after(async () => {
      await maybeRefreshDemandRadar();
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Heading */}
      <header className="mb-8 space-y-1.5">
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
          Token cost per lead follows the customer&rsquo;s event location — nearer
          bands cost less (◎2 Batangas), NCR more (◎3). You only spend when you
          Accept.
        </p>
      </div>

      {/* 3 · Ongoing — open tasks */}
      <OngoingTasks tasks={ongoing} />

      {/* 4 · Upcoming schedules — next 5 booked events */}
      <UpcomingSchedules rows={upcoming} />

      {/* 5 · Demand Radar — full detail, shared with /vendor-dashboard/demand */}
      {demandRadar ? (
        <section className="mt-10">
          <DemandRadarPanel
            radar={demandRadar}
            marketLabel={marketLabel}
            scope="vendor"
            variant="section"
          />
          <Link
            href="/vendor-dashboard/demand"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--m-orange-2)' }}
          >
            Open Demand Radar
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </Link>
        </section>
      ) : null}

      {/* 6 · Quote-to-Booking Funnel — full detail, shared with /vendor-dashboard/funnel */}
      {funnelView ? (
        <section className="mt-10">
          <FunnelPanel
            steps={funnelView.steps}
            sourceSlices={funnelView.sourceSlices}
            viewSourceSlices={funnelView.viewSourceSlices}
            range={funnelView.range}
            sinceIso={funnelView.sinceIso}
            variant="section"
          />
          <Link
            href="/vendor-dashboard/funnel"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--m-orange-2)' }}
          >
            Open the full funnel — change the time range
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
