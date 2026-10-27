/**
 * /dev/supplier-lab?s=coord-… — 🗂 THE COORDINATOR'S DOOR on the prototype's own people (owner "approved",
 * 2026-10-28; `Setnayan/prototypes/coordinator_door_2026-10-28/`, lab today = Wed 14 Oct 2026). DEV-ONLY.
 *
 *   ?s=coord-today      frame A — Today (event day) + "Events you run" + the bar with Events
 *   ?s=coord-events     frame B — the Events tab's list (the REAL `EventsYouRunScreen`) + the bar
 *   ?s=coord-customer   frame C — the customer card's header for a couple they run: the Coordinator pill and the REAL
 *                       `OpenTheirEvent` beside the shipped "Open chat" (the card itself is a database page; its header
 *                       here is a faithful stand-in of the shipped identity block + action row)
 *   &none=1             the no-access case: every seat Off / expired / removed → no rows, no tab, no button
 *   frame D (inside the event) is `/dev/home-lab?coord=1&shell=1` — the REAL `CoordinatingLine` over the couple's Home.
 *
 * The seats run through the SHIPPED rule (`eventsYouRun`), so `&none=1` is the rule saying no — not the lab hiding.
 */
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { BottomDock, BottomNav } from '@/app/_components/nav/bottom-nav';
import { Badge } from '@/app/_components/badge';
import { vendorBarItems } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';
import { EventsYouRunScreen } from '@/app/vendor-dashboard/_components/events-you-run-screen';
import { OpenTheirEvent } from '@/app/vendor-dashboard/clients/[eventId]/_components/open-their-event';
import type { TodayActions } from '@/app/vendor-dashboard/_components/supplier-today-screen';
import { COORDINATOR_AREAS, type ModeratorPermissions } from '@/lib/delegate-areas';
import { COORDINATOR_SEAT_ROLE, eventsYouRun, type CoordinatorSeatRow } from '@/lib/events-you-run';
import { TodayEasyLab } from './today-easy-lab';

export const COORD_STATES = ['coord-today', 'coord-events', 'coord-customer'] as const;
export type CoordState = (typeof COORD_STATES)[number];

const LAB_TODAY = '2026-10-14';
const LAB_NOW = new Date('2026-10-14T02:00:00Z');

const ON: ModeratorPermissions = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { ...COORDINATOR_AREAS } };
const OFF: ModeratorPermissions = { ...ON, areas: { guest_list: null, seat_plan: null, schedule: null, vendors: null, invitations: null } };

const seat = (id: string, name: string, type: string, date: string, venue: string, perms: ModeratorPermissions, removed = false): CoordinatorSeatRow => ({
  event_id: id,
  role_subtype: COORDINATOR_SEAT_ROLE,
  permissions_json: perms,
  accepted_at: '2026-09-01T00:00:00Z',
  removed_at: removed ? '2026-10-10T00:00:00Z' : null,
  events: { event_id: id, display_name: name, event_type: type, event_date: date, event_end_date: null, event_date_precision: 'day', venue_name: venue },
});

/** The prototype's three, live — plus a seat the hosts switched Off, one removed, one past its window. */
function labSeats(none: boolean): CoordinatorSeatRow[] {
  const live = none ? OFF : ON;
  return [
    seat('lab-claire', 'Claire & Indalecio', 'wedding', '2026-12-12', 'Seda Vertis North', live),
    seat('lab-reyes', 'Reyes debut', 'debut', '2026-10-17', 'Tagaytay', live),
    seat('lab-santos', 'Santos 50th', 'anniversary', '2027-02-14', 'Taal Vista', live, none),
    seat('lab-off', 'Dizon wedding', 'wedding', '2026-11-21', 'Manila', OFF),
    seat('lab-past', 'Lim & Tan', 'wedding', '2026-09-30', 'Makati', ON),
  ];
}

export function CoordLab({ state, none, actions }: { state: CoordState; none: boolean; actions: TodayActions }) {
  const runs = eventsYouRun(labSeats(none), LAB_NOW, LAB_TODAY);
  const bar = (
    <BottomDock boundary="tab">
      {/* The supplier bar's OWN resolver (what `VendorBottomNav` renders) — the lab sits outside the app tree, where
          the bar component itself may not mount (`seam-invariants.test.ts`). */}
      <BottomNav items={vendorBarItems({ role: 'owner', runsEvents: runs.length > 0 })} />
    </BottomDock>
  );
  if (state === 'coord-today') {
    return (
      <div data-coord-lab="today" data-runs={runs.length}>
        <TodayEasyLab sup="studio" moment="eventday" actions={actions} eventsYouRun={runs} />
        {bar}
      </div>
    );
  }
  if (state === 'coord-events') {
    return (
      <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-coord-lab="events" data-runs={runs.length}>
        <EventsYouRunScreen events={runs} measured />
        {bar}
      </div>
    );
  }
  const claire = runs.find((e) => e.eventId === 'lab-claire') ?? null;
  return (
    <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-coord-lab="customer" data-runs={runs.length}>
      {/* The shipped identity block + action row of `clients/[eventId]/page.tsx` (flag-off shell), on fixture words. */}
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-ink/5 text-sm font-bold text-ink/70">CI</span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink">Claire &amp; Indalecio</h1>
          <p className="mt-0.5 truncate text-sm text-ink/55">Sat, Dec 12 · Seda Vertis North</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {claire ? <Badge tone="quiet" data="coordinator">Coordinator</Badge> : null}
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">Booked</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {claire ? <OpenTheirEvent eventId={claire.eventId} /> : null}
        <Link href="/vendor-dashboard/messages/t-lab-claire" className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-cream">
          <MessageSquare aria-hidden className="h-3.5 w-3.5" /> Open chat
        </Link>
      </div>
      {bar}
    </div>
  );
}
