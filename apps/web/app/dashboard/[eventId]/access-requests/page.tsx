import type { Metadata } from 'next';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { PageMasthead } from '@/app/_components/page-masthead';
import { FLOOR_AREA_LABEL, summarizeDecisions, type AreaVerdict, type RequestOutcome } from '@/lib/floor-command';
import type { DelegateArea } from '@/lib/event-moderators';
import { RequestCard, type PendingRequest } from './_components/request-card';

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
 * Where the host answers a coordinator's ask (owner ruling 2026-07-27).
 *
 * Host-only by RLS: `event_access_requests_host_read` is scoped to
 * `current_event_ids()`, so a delegate coordinator loading this URL sees an
 * empty list rather than other people's requests — and could not answer one
 * anyway, since the answer policy is host-scoped too. That matters: a
 * coordinator who could approve requests could approve their own.
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
    .order('created_at', { ascending: false })
    .limit(50);
  // ⚠ PEOPLE ASKING FOR ACCESS. Refused, the couple sees no requests — and somebody
  // ⚠ waiting to be let in is invisible, with no sign anything was asked.
  if (dataError) {
    logQueryError('AccessRequestsPage.data', dataError, { eventId }, 'graceful_degrade');
  }

  const rows = (data ?? []) as Array<{
    request_id: string;
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
  if (profileIds.length > 0) {
    const { data: profs, error: profsError } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', profileIds);
    // ⚠ the requesters' shop names. Refused, a request shows without one.
    if (profsError) {
      logQueryError('AccessRequestsPage.profs', profsError, { eventId }, 'graceful_degrade');
    }
    for (const p of (profs ?? []) as Array<{ vendor_profile_id: string; business_name: string }>) {
      names.set(p.vendor_profile_id, p.business_name);
    }
  }

  const pending: PendingRequest[] = rows
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      requestId: r.request_id,
      askerName: (r.vendor_profile_id && names.get(r.vendor_profile_id)) || 'Your coordinator',
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

      {pending.length === 0 ? (
        <p className="sn-tile mt-6 p-6 text-center text-sm text-ink/55">
          Nothing waiting on you.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {pending.map((r) => (
            <RequestCard key={r.requestId} eventId={eventId} request={r} />
          ))}
        </ul>
      )}

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
                    {(r.vendor_profile_id && names.get(r.vendor_profile_id)) || 'Your coordinator'}
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
