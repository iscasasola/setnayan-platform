import type { Metadata } from 'next';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { PageMasthead } from '@/app/_components/page-masthead';
import { FLOOR_AREA_LABEL, summarizeDecisions, type AreaVerdict, type RequestOutcome } from '@/lib/floor-command';
import {
  DELEGATE_AREAS,
  resolveAreaLevel,
  type DelegateArea,
  type ModeratorPermissions,
} from '@/lib/event-moderators';
import { RequestCard, type PendingRequest } from './_components/request-card';
import { GrantedNow, type LiveGrant } from './_components/granted-now';

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

  // ── WHAT THEY HOLD NOW, asked of the grant itself ────────────────────────
  //
  // 🔑 NOT DERIVED FROM `decisions`. That column records what the host SAID;
  // `event_moderators.permissions_json` is what the coordinator can actually
  // open, and the two part company the moment anything is taken back. Reading
  // the answer would make a revoked area keep rendering as "shared" — the
  // couple pressing Take back and seeing no change.
  //
  // One query for every requester who was ever answered here, then resolved
  // per area through the same helper the server and the RLS mirror use.
  const answeredUserIds = [...new Set(answered.map((r) => r.requester_user_id).filter(Boolean))];
  const liveGrants: LiveGrant[] = [];
  if (answeredUserIds.length > 0) {
    const { data: mods, error: modsError } = await supabase
      .from('event_moderators')
      .select('user_id, permissions_json')
      .eq('event_id', eventId)
      .in('user_id', answeredUserIds)
      .is('removed_at', null);
    // ⚠ WHO CAN STILL OPEN THIS WEDDING. Refused, the section renders empty —
    // which reads as "you have shared nothing", the opposite of the truth. Log
    // loudly; never let it pass as a clean answer.
    if (modsError) {
      logQueryError('AccessRequestsPage.mods', modsError, { eventId }, 'graceful_degrade');
    }
    const nameFor = new Map<string, string>();
    for (const r of answered) {
      nameFor.set(
        r.requester_user_id,
        (r.vendor_profile_id && names.get(r.vendor_profile_id)) || 'Your coordinator',
      );
    }
    for (const m of (mods ?? []) as Array<{
      user_id: string;
      permissions_json: ModeratorPermissions | null;
    }>) {
      const areas = DELEGATE_AREAS.map((area) => ({
        area,
        level: resolveAreaLevel(m.permissions_json, area),
      })).filter((a) => a.level !== null);
      if (areas.length === 0) continue;
      liveGrants.push({
        moderatorUserId: m.user_id,
        holderName: nameFor.get(m.user_id) ?? 'Your coordinator',
        areas,
      });
    }
  }

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

      <GrantedNow eventId={eventId} grants={liveGrants} />

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
