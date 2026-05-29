import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Banknote, BadgeCheck, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PostGigDrawer } from './_components/post-gig-drawer';
import type { ManpowerGigRow, ManpowerGigStatus } from '@/app/vendor-dashboard/manpower/actions';
import { cancelGigFromHost } from './host-actions';

/**
 * V2 Phase F · Host-side manpower surface.
 *
 * WHY (canonical · CLAUDE.md 2026-05-28 third row § (a) Phase F):
 * the host posts a ₱15k day-of crew gig (e.g., "8-person setup crew for
 * 6 AM call time"). A nearby Setnayan-platform vendor sees the gig in
 * /vendor-dashboard/manpower and accepts via a 2-token handshake. The
 * cash itself NEVER flows through Setnayan — host pays vendor crew direct
 * (cash, GCash, bank). Per RR 16-2023 1% Intermediary Tax exemption,
 * Setnayan has zero BIR 2307 / EWT / OR obligation on this leg.
 *
 * Entry points (orphan-prevention):
 *   1. Tile in /dashboard/[eventId] TILES grid (added in this PR).
 *   2. Direct URL.
 */

type SearchParams = {
  posted?: string;
  cancelled?: string;
  error?: string;
};

const STATUS_LABEL: Record<ManpowerGigStatus, string> = {
  pending: 'Open for vendors',
  accepted: 'Crew assigned',
  completed: 'Wrapped',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<ManpowerGigStatus, string> = {
  pending: 'bg-amber-50 text-amber-900 ring-amber-300/40',
  accepted: 'bg-emerald-50 text-emerald-900 ring-emerald-300/40',
  completed: 'bg-slate-100 text-slate-800 ring-slate-300/40',
  cancelled: 'bg-rose-50 text-rose-900 ring-rose-300/40',
};

function formatPhp(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  })}`;
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function HostManpowerPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify host access via event_members. RLS on event_members will gate
  // this read · if it returns no rows, the user is not a couple/host.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();

  if (!membership) {
    redirect('/dashboard');
  }

  // Read gigs for this event. The host-reads-own-event RLS policy gates
  // SELECT visibility; the join to vendor_profiles for accepted gigs lets
  // us show the accepting vendor's business name to the host.
  const { data: gigsRaw } = await supabase
    .from('manpower_gigs')
    .select(
      'gig_id, event_id, posted_by_user_id, vendor_profile_id, gig_label, cash_amount_php_centavos, handshake_tokens_consumed, status, posted_at, accepted_at, completed_at, cancelled_at, cancellation_reason, notes, bir_exempt_note',
    )
    .eq('event_id', eventId)
    .order('posted_at', { ascending: false });

  const gigs = (gigsRaw ?? []) as ManpowerGigRow[];

  // Look up accepted vendors' business names (single batch read).
  const vendorIds = gigs
    .map((g) => g.vendor_profile_id)
    .filter((id): id is string => Boolean(id));
  const vendorNames = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorIds);
    for (const row of vendors ?? []) {
      vendorNames.set(row.vendor_profile_id, row.business_name);
    }
  }

  const pending = gigs.filter((g) => g.status === 'pending');
  const accepted = gigs.filter((g) => g.status === 'accepted');
  const wrapped = gigs.filter(
    (g) => g.status === 'completed' || g.status === 'cancelled',
  );

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--m-paper)', color: 'var(--m-ink)' }}
    >
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8 sm:px-6">
        <Link
          href={`/dashboard/${eventId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to event home
        </Link>

        <header className="mt-6">
          <p
            className="m-label-mono uppercase text-slate-500"
            style={{ letterSpacing: '0.2em', fontSize: '11px' }}
          >
            Phase F · ₱15K offline cash
          </p>
          <h1
            className="m-display-tight mt-2"
            style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}
          >
            Manpower
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Post a day-of crew gig. A Setnayan-platform vendor near you accepts,
            and you pay them direct on the day — cash, GCash, or bank transfer.
            Setnayan never touches the money.
          </p>
        </header>

        {sp.posted ? (
          <div
            role="status"
            className="mt-6 rounded-md border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            Gig posted. Vendors near your venue can now accept.
          </div>
        ) : null}
        {sp.cancelled ? (
          <div
            role="status"
            className="mt-6 rounded-md border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            Gig cancelled. The vendor (if assigned) has been notified.
          </div>
        ) : null}
        {sp.error ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          >
            {decodeURIComponent(sp.error)}
          </div>
        ) : null}

        <div className="mt-6">
          <PostGigDrawer eventId={eventId} />
        </div>

        {/* BIR posture callout — surfaced honestly so the host knows what
            Setnayan does and does not do. Brand voice, no legalese. */}
        <aside
          className="mt-6 rounded-lg border border-slate-200/60 bg-white p-4"
          style={{ boxShadow: 'var(--m-shadow-sm)' }}
        >
          <p
            className="m-eyebrow uppercase text-slate-500"
            style={{ letterSpacing: '0.2em', fontSize: '11px' }}
          >
            Setnayan note
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            The ₱15,000 (or whatever you adjust it to) flows directly from you
            to the vendor&apos;s crew. We don&apos;t process the payment, so
            there&apos;s no Setnayan receipt for this leg. The accepting vendor
            handles their own BIR Form 2307 as the income recipient.
          </p>
        </aside>

        {/* Gigs lists, grouped by status */}
        <section className="mt-10 space-y-10">
          <GigGroup
            title="Open for vendors"
            icon={<Clock className="h-4 w-4" strokeWidth={1.75} />}
            empty="No open gigs. Post one above to start."
            gigs={pending}
            vendorNames={vendorNames}
            allowCancel
            allowComplete={false}
          />
          <GigGroup
            title="Crew assigned"
            icon={<BadgeCheck className="h-4 w-4" strokeWidth={1.75} />}
            empty="No crews are confirmed yet."
            gigs={accepted}
            vendorNames={vendorNames}
            allowCancel
            allowComplete={false}
          />
          <GigGroup
            title="Wrapped"
            icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
            empty="Past gigs will appear here after the event."
            gigs={wrapped}
            vendorNames={vendorNames}
            allowCancel={false}
            allowComplete={false}
          />
        </section>
      </div>
    </main>
  );
}

function GigGroup({
  title,
  icon,
  empty,
  gigs,
  vendorNames,
  allowCancel,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  gigs: ManpowerGigRow[];
  vendorNames: Map<string, string>;
  allowCancel: boolean;
  allowComplete: boolean;
}) {
  return (
    <div>
      <h2 className="m-display-tight flex items-center gap-2 text-xl">
        {icon}
        {title}
      </h2>
      {gigs.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {gigs.map((gig) => (
            <li
              key={gig.gig_id}
              className="rounded-lg border border-slate-200/60 bg-white p-4"
              style={{ boxShadow: 'var(--m-shadow-sm)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {gig.gig_label}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <Banknote
                      className="-mt-0.5 mr-1 inline-block h-4 w-4 text-slate-500"
                      strokeWidth={1.75}
                    />
                    {formatPhp(gig.cash_amount_php_centavos)} · paid directly to
                    crew
                  </p>
                  {gig.vendor_profile_id ? (
                    <p className="mt-1 text-sm text-slate-700">
                      Accepted by{' '}
                      <span className="font-medium">
                        {vendorNames.get(gig.vendor_profile_id) ?? 'Vendor'}
                      </span>{' '}
                      · {formatRelative(gig.accepted_at)}
                    </p>
                  ) : null}
                  {gig.notes ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                      {gig.notes}
                    </p>
                  ) : null}
                  {gig.cancellation_reason ? (
                    <p className="mt-2 text-sm text-rose-700">
                      Cancellation reason: {gig.cancellation_reason}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs ring-1 ${STATUS_STYLE[gig.status]}`}
                >
                  {STATUS_LABEL[gig.status]}
                </span>
              </div>

              {allowCancel ? (
                <form action={cancelGigFromHost} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="gig_id" value={gig.gig_id} />
                  <input type="hidden" name="event_id" value={gig.event_id} />
                  <label className="flex-1 min-w-[180px]">
                    <span
                      className="m-label-mono mb-1 block uppercase text-slate-500"
                      style={{ letterSpacing: '0.2em', fontSize: '11px' }}
                    >
                      Reason
                    </span>
                    <input
                      type="text"
                      name="reason"
                      placeholder="Why are you cancelling?"
                      minLength={4}
                      maxLength={500}
                      required
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Cancel gig
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
