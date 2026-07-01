import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, Info, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { fetchVendorOverviewData } from '@/lib/vendor-overview';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import { vendorAcknowledgeDeposit } from './clients/[eventId]/actions';
import {
  WhatsNewFeed,
  OngoingTasks,
  UpcomingSchedules,
} from './_components/overview-sections';

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
          <h1 className="m-display text-4xl sm:text-5xl">Overview</h1>
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Heading */}
      <header className="mb-8 space-y-1.5">
        <h1 className="m-display text-4xl sm:text-5xl">Overview</h1>
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

      {/* Invite-a-couple — free onboarding QR (kept from the prior Overview;
          routed exit so a quiet day still has a clear next action). */}
      <Link
        href="/vendor-dashboard/invite"
        className="mt-8 flex items-center gap-4 rounded-xl border p-4 transition-colors"
        style={{ background: '#fff', borderColor: 'var(--m-line)' }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--m-orange-4)' }}
        >
          <UserPlus
            className="h-5 w-5"
            strokeWidth={1.75}
            style={{ color: 'var(--m-orange-2)' }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            Invite a couple — free
          </span>
          <span className="block text-xs" style={{ color: 'var(--m-slate)' }}>
            Share your QR. They set up their plan and you land on their shortlist.
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0"
          strokeWidth={1.75}
          style={{ color: 'var(--m-slate-3)' }}
        />
      </Link>
    </div>
  );
}
