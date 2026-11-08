import type { Metadata } from 'next';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { PageMasthead } from '@/app/_components/page-masthead';
import { FLOOR_AREA_LABEL, summarizeDecisions, type AreaVerdict, type RequestOutcome } from '@/lib/floor-command';
import Link from 'next/link';
import type { DelegateArea } from '@/lib/event-moderators';
import { peopleWithAccessHref } from '@/lib/people-with-access-href';
import { RequestCard, type PendingRequest } from './_components/request-card';
import { ClaimAccessCard } from './_components/claim-access-card';
import { readClaimAccessAsks } from '@/lib/claim-access-asks.server';
import { isBookedCoordinator } from '@/lib/coordinator-trade';

export const metadata: Metadata = { title: 'Access requests' };

const OUTCOME_COPY: Record<RequestOutcome, string> = {
  all_granted: 'you shared everything they asked for',
  partly_granted: 'you shared some of it',
  all_declined: 'you declined',
  unanswered: 'no answer recorded',
};

/** "Seat plan: shared · Schedule: declined" — the host's answer, line by line. */
function lineByLine(
  asked: readonly DelegateArea[],
  decisions: Record<string, AreaVerdict> | null,
): string {
  return asked
    .map((a) => {
      const v = decisions?.[a];
      const said = v === 'granted' ? 'shared' : v === 'declined' ? 'declined' : '—';
      return `${FLOOR_AREA_LABEL[a]}: ${said}`;
    })
    .join(' · ');
}

/**
 * Where the host answers a supplier's ask (owner ruling 2026-07-27; widened 8 Nov 2026: *"only coordinator and hosts
 * has the final say"*).
 *
 * The hosts read every ask here (`event_access_requests_host_read`, couple-scoped). The BOOKED COORDINATOR answers a
 * non-coordinator supplier's ask from their own client page (`CoordinatorAnswers`), never here; a coordinator's own ask
 * is the hosts' alone — `answer_area_access_request` refuses anybody answering their own, so a coordinator can never
 * approve themselves. Whichever of them answers first, the ask leaves this list.
 */
export default async function AccessRequestsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error: dataError } = await supabase
    .from('event_access_requests')
    .select(
      'request_id, requester_user_id, vendor_profile_id, requested_areas, note, status, decisions, created_at',
    )
    .eq('event_id', eventId)
    // The coordinator's line-by-line asks. A supplier who joined from the
    // couple's link is the other kind, drawn by `ClaimAccessCard` below.
    .eq('kind', 'areas')
    .order('created_at', { ascending: false })
    .limit(50);
  const claimsRead = await readClaimAccessAsks(supabase, eventId);
  // ⚠ PEOPLE ASKING FOR ACCESS. Refused, the couple sees no requests — and somebody
  // ⚠ waiting to be let in is invisible, with no sign anything was asked.
  if (dataError) {
    logQueryError('AccessRequestsPage.data', dataError, { eventId }, 'graceful_degrade');
  }

  const rows = (data ?? []) as Array<{
    request_id: string;
    requester_user_id: string;
    vendor_profile_id: string | null;
    requested_areas: string[];
    note: string | null;
    status: string;
    decisions: Record<string, AreaVerdict> | null;
    created_at: string;
  }>;

  // Resolve business names in one round-trip rather than per row.
  const profileIds = [...new Set(rows.map((r) => r.vendor_profile_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  // 🧭 Which askers are the BOOKED COORDINATOR (owner 8 Nov 2026) — their share gives Edit, everyone else's gives
  // "see and propose". Their shop's services + its rows on this event (the couple reads its own event_vendors), in the
  // same round trip as the names: `isBookedCoordinator`, the mirror of `is_booked_coordinator`.
  const coordinators = new Set<string>();
  if (profileIds.length > 0) {
    const [{ data: profs, error: profsError }, { data: bookingRows, error: bookingError }] = await Promise.all([
      supabase.from('vendor_profiles').select('vendor_profile_id, business_name, services').in('vendor_profile_id', profileIds),
      supabase.from('event_vendors').select('marketplace_vendor_id, status').eq('event_id', eventId).in('marketplace_vendor_id', profileIds),
    ]);
    // ⚠ the requesters' shop names. Refused, a request shows without one.
    if (profsError) {
      logQueryError('AccessRequestsPage.profs', profsError, { eventId }, 'graceful_degrade');
    }
    // ⚠ Refused, nobody reads as the coordinator — every line is worded "see and propose", the narrower promise.
    if (bookingError) {
      logQueryError('AccessRequestsPage.bookings', bookingError, { eventId }, 'graceful_degrade');
    }
    const statuses = new Map<string, string[]>();
    for (const b of (bookingRows ?? []) as Array<{ marketplace_vendor_id: string | null; status: string | null }>) {
      if (!b.marketplace_vendor_id || !b.status) continue;
      statuses.set(b.marketplace_vendor_id, [...(statuses.get(b.marketplace_vendor_id) ?? []), b.status]);
    }
    for (const p of (profs ?? []) as Array<{ vendor_profile_id: string; business_name: string; services: string[] | null }>) {
      names.set(p.vendor_profile_id, p.business_name);
      if (isBookedCoordinator({ services: p.services, bookingStatuses: statuses.get(p.vendor_profile_id) ?? [] })) {
        coordinators.add(p.vendor_profile_id);
      }
    }
  }

  const pending: PendingRequest[] = rows
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      requestId: r.request_id,
      askerName: (r.vendor_profile_id && names.get(r.vendor_profile_id)) || 'A supplier',
      askerIsCoordinator: Boolean(r.vendor_profile_id && coordinators.has(r.vendor_profile_id)),
      requestedAreas: r.requested_areas as DelegateArea[],
      note: r.note,
      createdAt: r.created_at,
    }));

  const answered = rows.filter((r) => r.status === 'answered');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <PageMasthead
        title="Access requests"
      />

      {/* 🤝 Suppliers who joined from your link (owner 2026-10-20) — one
          Approve each; nothing is open to them before it. */}
      {!claimsRead.measured ? (
        <p className="mt-6 text-sm text-terracotta-700" data-claim-asks-refused="">
          We could not check for suppliers who joined from your link. Reload to try again.
        </p>
      ) : claimsRead.asks.length > 0 ? (
        <ul className="sn-tile mt-6 divide-y divide-ink/5 px-4 py-1" data-claim-asks="">
          {claimsRead.asks.map((a) => (
            <ClaimAccessCard key={a.requestId} eventId={eventId} ask={a} />
          ))}
        </ul>
      ) : null}

      {/* 🔌 A refused read is never "Nothing waiting on you." (reads-are-honest, 2026-11-02 audit #20). */}
      {dataError ? (
        <ReadRefusedNotice what="the access requests" className="mt-6" />
      ) : pending.length === 0 && !(claimsRead.measured && claimsRead.asks.length > 0) ? (
        <p className="sn-tile mt-6 p-6 text-center text-sm text-ink/55">
          Nothing waiting on you.
        </p>
      ) : pending.length === 0 ? null : (
        <ul className="mt-6 space-y-4">
          {pending.map((r) => (
            <RequestCard key={r.requestId} eventId={eventId} request={r} />
          ))}
        </ul>
      )}

      {/* What they can open NOW, and taking it back, live in ONE place —
          Event Details › People with access (owner 2026-10-03). This page
          answers asks; it no longer sets access (replace means remove: the
          "Granted now · Take back" list and `revokeArea` moved there). */}
      <p className="mt-6 text-sm text-ink/65">
        <Link href={peopleWithAccessHref(eventId)} className="underline underline-offset-2 hover:text-ink">
          See and change what each person can open
        </Link>
      </p>

      {answered.length > 0 ? (
        <section className="mt-10">
          <h2 className="sn-sec">Already answered</h2>
          <ul className="mt-3 space-y-2">
            {answered.map((r) => {
              const asked = r.requested_areas as DelegateArea[];
              const outcome = summarizeDecisions(asked, r.decisions ?? {});
              return (
                <li
                  key={r.request_id}
                  className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"
                >
                  <span className="font-medium text-ink">
                    {(r.vendor_profile_id && names.get(r.vendor_profile_id)) || 'A supplier'}
                  </span>
                  <span className="ml-2 text-ink/60">{OUTCOME_COPY[outcome]}</span>
                  <span className="mt-1 block text-xs text-ink/45">
                    {lineByLine(asked, r.decisions)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
