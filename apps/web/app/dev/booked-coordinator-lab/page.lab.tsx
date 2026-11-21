/**
 * /dev/booked-coordinator-lab — the booked coordinator's new parts, drawn from the REAL components on a fixture (no
 * database), for the 375 / 1280 screenshots of PR "booked coordinator" (owner 2026-11-21; drawing
 * `prototypes/their_event_door_2026-11-21/their_event_door_fable.html`, frames 1 · 3 · 4 · 5).
 *
 *   ?part=run       1 · Events you run — Dashboard · Chats · Hub
 *   ?part=budget    3 · Budget · view only — Payments due + Remind the hosts (the press calls the real RPC; here it
 *                   answers "That did not send" — there is no database)
 *   ?part=suppliers 4 · Suppliers — Find · Recommend a partner · Add to the shortlist · "The hosts keep this"
 *   ?part=memories  5 · Memories — "The hosts keep this"
 *   (none)          every part, one under the other
 */
import { notFound } from 'next/navigation';
import { EventsYouRunRows } from '@/app/vendor-dashboard/_components/events-you-run-rows';
import { PaymentsDue } from '@/app/dashboard/[eventId]/budget/_components/payments-due';
import { HelpTheHostsChoose } from '@/app/dashboard/[eventId]/vendors/_components/help-the-hosts-choose';
import { HostsKeepThis, MEMORIES_KEPT_WHY } from '@/app/dashboard/[eventId]/_components/hosts-keep-this';
import { COORDINATOR_AREAS } from '@/lib/delegate-areas';
import { eventsYouRun, type CoordinatorSeatRow } from '@/lib/events-you-run';

const seat = (id: string, name: string, date: string): CoordinatorSeatRow => ({
  event_id: id,
  role_subtype: 'wedding_planner_external',
  permissions_json: { edit_all: true, checkout: false, invite_hosts: true, remove_hosts: false, areas: { ...COORDINATOR_AREAS } },
  accepted_at: '2026-11-01T00:00:00Z',
  removed_at: null,
  events: { event_id: id, display_name: name, event_type: 'wedding', event_date: date, event_end_date: null, event_date_precision: 'day', venue_name: 'Seda Vertis North' },
});

export default async function BookedCoordinatorLab({ searchParams }: { searchParams: Promise<{ part?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { part } = await searchParams;
  const rows = [seat('lab-claire', 'Claire & Indalecio', '2026-12-12'), seat('lab-santos', 'Santos 50th', '2027-02-14')];
  const runs = eventsYouRun(rows, new Date('2026-11-21T02:00:00Z'), '2026-11-21', new Set(['lab-claire', 'lab-santos'])).map((e, i) => ({
    ...e,
    needs: i === 0 ? '3 things need you · 2 quotes to approve' : 'Nothing needs you right now',
  }));
  const show = (p: string) => !part || part === p;
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-6" data-booked-coordinator-lab="">
      {show('run') ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Events you run</p>
          <EventsYouRunRows events={runs} where="today" />
        </section>
      ) : null}
      {show('budget') ? (
        <section className="space-y-3">
          <h1 className="text-xl font-semibold text-ink">Budget · view only</h1>
          <PaymentsDue
            eventId="lab-claire"
            rows={[
              { vendorId: 'v-florist', name: 'Bloom & Vine', amountPhp: 59500, dueDate: '2026-12-01' },
              { vendorId: 'v-band', name: 'Manila Groove', amountPhp: 18000, dueDate: '2026-12-05' },
            ]}
          />
        </section>
      ) : null}
      {show('suppliers') ? <HelpTheHostsChoose eventId="lab-claire" /> : null}
      {show('memories') ? <HostsKeepThis title="Memories" kicker="Photos and videos" why={MEMORIES_KEPT_WHY} /> : null}
    </main>
  );
}
