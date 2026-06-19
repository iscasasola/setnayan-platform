import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HardHat, Clock, BadgeCheck, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { GigCard } from './_components/gig-card';
import type { ManpowerGigRow, ManpowerGigStatus } from './actions';

/**
 * V2 Phase F · Vendor-side manpower surface.
 *
 * WHY (canonical · CLAUDE.md 2026-05-28 third row § (a) Phase F):
 * vendors browse open manpower gigs posted by hosts on events the vendor
 * is involved with (any event_vendors link to the same event_id). Accept
 * spends 2 tokens (earned-first FIFO via consume_vendor_assets). The cash
 * ₱15k flows directly from host to vendor crew off-platform; Setnayan
 * never touches the money so we issue no BIR receipt on this leg.
 *
 * Eligibility for "Open gigs":
 *   • Vendor must have at least one event_vendors row tied to that event_id.
 *   • The event must have a posted gig in status='pending'.
 *
 * Once accepted, gigs surface under "My accepted" + "Completed". Vendor
 * can complete the gig (vendor-only) or cancel with reason (vendor or
 * host can cancel; no token refund on cancel).
 *
 * Entry points (orphan-prevention):
 *   1. Forward-reference Link in vendor-dashboard layout subnav (added
 *      in this PR alongside existing tab pattern).
 *   2. Direct URL.
 */

const STATUS_LABEL: Record<ManpowerGigStatus, string> = {
  pending: 'Open',
  accepted: 'Accepted',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<ManpowerGigStatus, string> = {
  pending: 'bg-warn-50 text-warn-900 ring-warn-300/40',
  accepted: 'bg-success-50 text-success-900 ring-success-300/40',
  completed: 'bg-slate-100 text-slate-800 ring-slate-300/40',
  cancelled: 'bg-danger-50 text-danger-900 ring-danger-300/40',
};

export default async function VendorManpowerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/manpower');

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vendor) {
    redirect('/vendor-dashboard/verify');
  }

  // Wallet balance + this vendor's gigs + the events they're linked to all key
  // off the same vendor id and don't consume each other — one parallel batch
  // instead of three serial round-trips (owner perf pass 2026-06-03). The
  // open-gigs read below stays sequential (it needs eligibleEventIds).
  const [{ data: wallet }, { data: myGigs }, { data: eventLinks }] =
    await Promise.all([
      // Wallet balance — surfaces the "token balance" reassurance.
      supabase
        .from('vendor_wallets')
        .select('purchased_tokens, earned_tokens')
        .eq('vendor_id', vendor.vendor_profile_id)
        .maybeSingle(),
      // 1. Vendor's accepted/completed/cancelled gigs (vendor_profile_id match).
      supabase
        .from('manpower_gigs')
        .select(
          'gig_id, event_id, posted_by_user_id, vendor_profile_id, gig_label, cash_amount_php_centavos, handshake_tokens_consumed, status, posted_at, accepted_at, completed_at, cancelled_at, cancellation_reason, notes, bir_exempt_note',
        )
        .eq('vendor_profile_id', vendor.vendor_profile_id)
        .order('posted_at', { ascending: false }),
      // 2. Events the vendor is involved with (→ open gigs below).
      supabase
        .from('event_vendors')
        .select('event_id')
        .eq('marketplace_vendor_id', vendor.vendor_profile_id),
    ]);

  const totalTokens =
    (wallet?.earned_tokens ?? 0) + (wallet?.purchased_tokens ?? 0);

  const eligibleEventIds = Array.from(
    new Set((eventLinks ?? []).map((row) => row.event_id)),
  );

  let openGigs: ManpowerGigRow[] = [];
  if (eligibleEventIds.length > 0) {
    const { data: openGigsRaw } = await supabase
      .from('manpower_gigs')
      .select(
        'gig_id, event_id, posted_by_user_id, vendor_profile_id, gig_label, cash_amount_php_centavos, handshake_tokens_consumed, status, posted_at, accepted_at, completed_at, cancelled_at, cancellation_reason, notes, bir_exempt_note',
      )
      .eq('status', 'pending')
      .in('event_id', eligibleEventIds)
      .order('posted_at', { ascending: false });
    openGigs = (openGigsRaw ?? []) as ManpowerGigRow[];
  }

  const accepted = (myGigs ?? []).filter(
    (g) => g.status === 'accepted',
  ) as ManpowerGigRow[];
  const wrapped = (myGigs ?? []).filter(
    (g) => g.status === 'completed' || g.status === 'cancelled',
  ) as ManpowerGigRow[];

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--m-paper)', color: 'var(--m-ink)' }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <header>
          <p
            className="m-label-mono uppercase text-slate-500"
            style={{ letterSpacing: '0.2em', fontSize: '11px' }}
          >
            Phase F · ₱15K OFFLINE
          </p>
          <h1
            className="m-display-tight mt-2"
            style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}
          >
            Manpower gigs
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Pick up day-of crew gigs from hosts you&apos;re already serving. 2
            tokens to accept · cash flows direct from the host to your crew.
          </p>
        </header>

        {/* Token-balance reassurance — pulls actual wallet state */}
        <div
          className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200/60 bg-white px-4 py-3"
          style={{ boxShadow: 'var(--m-shadow-sm)' }}
        >
          <Wallet className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
          <span className="text-sm text-slate-700">
            <span className="font-medium">{totalTokens}</span> tokens available
            ({wallet?.earned_tokens ?? 0} earned + {wallet?.purchased_tokens ?? 0}{' '}
            purchased)
          </span>
          {totalTokens < 2 ? (
            <Link
              href="/vendor-dashboard/redeem-code"
              className="text-xs font-medium text-orange-700 underline"
            >
              Redeem a code →
            </Link>
          ) : null}
        </div>

        {/* BIR-exempt note · surfaced prominently per spec */}
        <aside
          className="mt-4 rounded-lg border border-slate-200/60 bg-white p-4"
          style={{ boxShadow: 'var(--m-shadow-sm)' }}
        >
          <p
            className="m-eyebrow uppercase text-slate-500"
            style={{ letterSpacing: '0.2em', fontSize: '11px' }}
          >
            Setnayan note
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            Setnayan doesn&apos;t touch the ₱15,000 — it flows direct from the
            host to your crew. You handle your own Form 2307 on this. The
            2-token handshake stamps your business as the gig owner for event
            rewards.
          </p>
        </aside>

        <section className="mt-10 space-y-10">
          <Group
            title="Open gigs · ready to claim"
            icon={<Clock className="h-4 w-4" strokeWidth={1.75} />}
            empty={
              eligibleEventIds.length === 0
                ? 'No gigs yet · open gigs appear here once a host you serve posts one.'
                : 'No open gigs right now. Check back later.'
            }
            gigs={openGigs}
          >
            {openGigs.map((gig) => (
              <li key={gig.gig_id}>
                <GigCard
                  gig={gig}
                  mode="open"
                  statusLabel={STATUS_LABEL[gig.status]}
                  statusStyle={STATUS_STYLE[gig.status]}
                  insufficientTokens={totalTokens < 2}
                />
              </li>
            ))}
          </Group>

          <Group
            title="Accepted"
            icon={<BadgeCheck className="h-4 w-4" strokeWidth={1.75} />}
            empty="You haven't accepted any gigs yet."
            gigs={accepted}
          >
            {accepted.map((gig) => (
              <li key={gig.gig_id}>
                <GigCard
                  gig={gig}
                  mode="accepted"
                  statusLabel={STATUS_LABEL[gig.status]}
                  statusStyle={STATUS_STYLE[gig.status]}
                />
              </li>
            ))}
          </Group>

          <Group
            title="Wrapped"
            icon={<HardHat className="h-4 w-4" strokeWidth={1.75} />}
            empty="Completed + cancelled gigs will show here."
            gigs={wrapped}
          >
            {wrapped.map((gig) => (
              <li key={gig.gig_id}>
                <GigCard
                  gig={gig}
                  mode="wrapped"
                  statusLabel={STATUS_LABEL[gig.status]}
                  statusStyle={STATUS_STYLE[gig.status]}
                />
              </li>
            ))}
          </Group>
        </section>
      </div>
    </div>
  );
}

function Group({
  title,
  icon,
  empty,
  gigs,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  gigs: ManpowerGigRow[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="m-display-tight flex items-center gap-2 text-xl">
        {icon}
        {title}
      </h2>
      <div className="mt-3">
        {gigs.length > 0 ? (
          <ul className="space-y-3">{children}</ul>
        ) : (
          <p className="text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </div>
  );
}
