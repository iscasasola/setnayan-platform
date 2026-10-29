import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { hubDayWords } from '@/lib/hub-events';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import { CREW_STATUS_WORDS, crewRequestStatusOf, crewRoleOf, crewRoleOpens, isCrewToken } from '@/lib/crew-pass';
import { crewPassAnonEnabled } from '@/lib/crew-pass-flag';
import { CrewEventHub, CrewNameForm, CrewSignIn, CrewStatus } from './_components/crew-screens';
import { CrewWaitingRefresh } from './_components/crew-waiting-refresh';
import { SeatScanner } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/seat-scanner';

export const metadata: Metadata = { title: 'Crew · Event Hub', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * /join/crew/[token] — 📱 WHERE A CREW QR LANDS (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB BY
 * QR — AND SEE ONLY THE EVENT HUB"). Outside the supplier dashboard on purpose: crew have no shop, and the dashboard's
 * frame (Today · Customers · Shop · Hub) is exactly what they must not see.
 *
 *   no session          → the name form (an anonymous account when that is switched on; else sign in, then back here);
 *   asked, waiting      → "Waiting for the Allow" — the page re-asks quietly every 15 s while it is looked at;
 *   allowed, in time    → THE CREW'S EVENT HUB: this event, the tools the role opens, nothing else;
 *   removed · over · dead QR · their own team · too many waiting → one sentence each.
 *
 * 🔒 WHAT IS READ, AND WHEN. Every rule is the database's: `crew_pass_request` says where the phone stands and
 * `current_vendor_crew_pass` whether its pass opens anything NOW (allowed, before its end, the shop still booked). Only
 * after that answers `effective` does this page read the event's name and — for a Member — its run of show, with the
 * admin client, scoped to that ONE event (the crew holds no RLS on `events` or the schedule, by design: no crew pass
 * is read by any other policy). The scanner asks the database itself (`crew_seat_by_guest_qr`).
 * 🔒 app/join/crew/the-crew-sees-only-the-event-hub.test.ts · tests/db/crew-pass-sees-only-its-event.db.test.ts
 */
export default async function CrewJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const [{ token }, { state }] = await Promise.all([params, searchParams]);
  if (!isCrewToken(token)) return <CrewStatus {...CREW_STATUS_WORDS.invalid} />;
  const problem =
    state === 'error'
      ? 'Something went wrong — try once more.'
      : state === 'verify'
        ? 'The quick check did not finish — tap Ask to join again.'
        : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return crewPassAnonEnabled() ? <CrewNameForm token={token} shopWords="The shop" problem={problem} /> : <CrewSignIn token={token} />;

  // Where this phone stands — asked with no name, so nothing is written by looking.
  const { data: asked, error: askedError } = await supabase.rpc('crew_pass_request', { p_token: token, p_name: '' });
  if (askedError) {
    logQueryError('CrewJoin.request', askedError, {}, 'graceful_degrade');
    return <CrewStatus title="Couldn’t reach Setnayan" line="Check the signal and open this page again — nothing was lost." />;
  }
  const answer = (asked ?? {}) as { status?: unknown; event_id?: string };
  const status = crewRequestStatusOf(answer.status);
  if (status === 'needs_name') return <CrewNameForm token={token} shopWords="The shop" problem={problem} />;
  if (status === 'waiting') {
    return (
      <CrewStatus {...CREW_STATUS_WORDS.waiting} waiting>
        <CrewWaitingRefresh />
      </CrewStatus>
    );
  }
  if (status !== 'allowed' || !answer.event_id) return <CrewStatus {...CREW_STATUS_WORDS[status === 'allowed' ? 'invalid' : status]} />;

  const eventId = answer.event_id;
  const { data: passRows, error: passError } = await supabase.rpc('current_vendor_crew_pass', { p_event_id: eventId });
  const pass = (Array.isArray(passRows) ? passRows[0] : null) as
    | { vendor_profile_id: string; display_name: string; crew_role: string; ends_at: string; effective: boolean }
    | null;
  if (passError) logQueryError('CrewJoin.pass', passError, { eventId }, 'graceful_degrade');
  if (passError || !pass) return <CrewStatus title="Couldn’t open the Event Hub" line="Open this page again in a moment — nothing was lost." />;
  if (!pass.effective) return <CrewStatus {...CREW_STATUS_WORDS.ended} />;

  // ── The pass is proven: ONE event's name and, for a Member, its run of show. ──
  const role = crewRoleOf(pass.crew_role);
  const admin = createAdminClient();
  const [eventRes, shopRes, blocksRes] = await Promise.all([
    admin.from('events').select('display_name, event_date, venue_name').eq('event_id', eventId).maybeSingle(),
    admin.from('vendor_profiles').select('business_name').eq('vendor_profile_id', pass.vendor_profile_id).maybeSingle(),
    crewRoleOpens(role).runOfShow
      ? admin
          .from('event_schedule_blocks')
          .select('block_id, label, start_at, end_at, location, run_state, actual_start_at')
          .eq('event_id', eventId)
          .order('start_at', { ascending: true })
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (blocksRes.error) logQueryError('CrewJoin.runOfShow', blocksRes.error, { eventId }, 'graceful_degrade');
  const ev = eventRes.data as { display_name: string | null; event_date: string | null; venue_name: string | null } | null;
  const ends = new Date(pass.ends_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <CrewEventHub
      scanner={<SeatScanner eventId={eventId} via="crew" />}
      eventName={ev?.display_name?.trim() || 'This event'}
      shopName={(shopRes.data as { business_name: string | null } | null)?.business_name ?? 'The shop'}
      dayWords={hubDayWords(ev?.event_date ?? null, true)}
      place={ev?.venue_name ?? null}
      name={pass.display_name}
      role={role}
      blocks={blocksRes.error ? null : ((blocksRes.data ?? []) as RunOfShowBlock[])}
      endsWords={`ends ${ends}`}
    />
  );
}
