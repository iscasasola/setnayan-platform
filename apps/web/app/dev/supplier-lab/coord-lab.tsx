/**
 * /dev/supplier-lab?s=coord-… — 🗂 THE COORDINATOR'S DOOR on the prototype's own people (owner "approved",
 * 2026-10-28; `Setnayan/prototypes/coordinator_door_2026-10-28/`, lab today = Wed 14 Oct 2026). DEV-ONLY.
 *
 *   ?s=coord-today      frame A — Today (event day) + "Events you run" + the bar with Events
 *   ?s=coord-events     frame B — the Events tab's list (the REAL `EventsYouRunScreen`) + the bar
 *   ?s=coord-customer   frame C — the customer card's header for a couple they run: the Coordinator pill and the REAL
 *                       `OpenTheirEvent` beside the shipped "Open chat" (the card itself is a database page; its header
 *                       here is a faithful stand-in of the shipped identity block + action row)
 *   ?s=coord-hub        the supplier Hub's Check-in desk rows (owner 2026-10-28, "coordinators can also scan qr codes")
 *   &unread=1           the attention read refused — every row says it could not load
 *   ?s=coord-hold&at=/vendor-dashboard/shop   🧰 the REAL `BasicSetupHold` (owner 2026-10-29, "basic setup first") for
 *                       a coordinator whose admin-made shop is not set up yet, judged at `at` (default Shop): a held
 *                       page draws "Finish your basic setup first"; an open one (`at=/vendor-dashboard/events`,
 *                       `/vendor-dashboard/customers`) draws its stand-in body, as it would ship
 *   ?s=coord-badges     🏅 Shop › How it is going's "Your badges" (owner 2026-10-29) — the REAL `YourBadges` over
 *                       `badgeShelf`; `&unread=1` = the read refused ("Couldn’t load" · "—")
 *   &none=1             the no-access case: every seat Off / expired / removed → no rows, no tab, no button
 *   &cohost=1           👥 a supplier who is ONLY a co-host (owner 2026-10-29): every coordinator seat Off, one live
 *                       co-host seat → the tab, the row ("· Co-host") and the card's Co-host pill, from the same rule
 *   frame D (inside the event) is `/dev/home-lab?coord=1&shell=1` — the REAL `CoordinatingLine` over the couple's Home.
 *
 * The seats run through the SHIPPED rule (`eventsYouRun`), so `&none=1` is the rule saying no — not the lab hiding.
 */
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { CoordLabBar } from './coord-lab-bar';
import { Badge } from '@/app/_components/badge';
import { EventsYouRunScreen } from '@/app/vendor-dashboard/_components/events-you-run-screen';
import { OpenTheirEvent } from '@/app/vendor-dashboard/clients/[eventId]/_components/open-their-event';
import type { TodayActions } from '@/app/vendor-dashboard/_components/supplier-today-screen';
import { COORDINATOR_AREAS, type ModeratorPermissions } from '@/lib/delegate-areas';
import { COORDINATOR_SEAT_ROLE, eventsYouRun, withNeeds, type CoordinatorSeatRow } from '@/lib/events-you-run';
import { summarizeEventDecisions, type EventDecisionSummary } from '@/lib/event-decisions';
import { CheckinDeskRows, MessageEveryoneRows, SeatFinderRow } from '@/app/vendor-dashboard/_components/events-you-run-rows';
import { TodayEasyLab } from './today-easy-lab';
import { BasicSetupHold } from '@/app/vendor-dashboard/_components/basic-setup-hold';
import { YourBadges } from '@/app/vendor-dashboard/performance/_components/your-badges';
import { badgeShelf } from '@/lib/shop-badges';
import { basicSetupHoldOf } from '@/lib/basic-setup-gate';
import type { BusinessProfileItem } from '@/lib/vendor-profile';

export const COORD_STATES = ['coord-today', 'coord-events', 'coord-customer', 'coord-hub', 'coord-hold', 'coord-badges'] as const;
export type CoordState = (typeof COORD_STATES)[number];

const LAB_TODAY = '2026-10-14';
const LAB_NOW = new Date('2026-10-14T02:00:00Z');

const ON: ModeratorPermissions = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { ...COORDINATOR_AREAS } };
const OFF: ModeratorPermissions = { ...ON, areas: { guest_list: null, seat_plan: null, schedule: null, vendors: null, invitations: null } };

const seat = (id: string, name: string, type: string, date: string, venue: string, perms: ModeratorPermissions, removed = false, role: string = COORDINATOR_SEAT_ROLE): CoordinatorSeatRow => ({
  event_id: id,
  role_subtype: role,
  permissions_json: perms,
  accepted_at: '2026-09-01T00:00:00Z',
  removed_at: removed ? '2026-10-10T00:00:00Z' : null,
  events: { event_id: id, display_name: name, event_type: type, event_date: date, event_end_date: null, event_date_precision: 'day', venue_name: venue },
});

/** The prototype's three, live — plus a seat the hosts switched Off, one removed, one past its window. */
function labSeats(none: boolean, cohost = false): CoordinatorSeatRow[] {
  if (cohost) {
    // 👥 Only a co-host: the coordinator seats Off, one full co-host seat live, one co-host seat removed.
    return [
      seat('lab-claire', 'Claire & Indalecio', 'wedding', '2026-12-12', 'Seda Vertis North', OFF, false, 'co_host'),
      seat('lab-off', 'Dizon wedding', 'wedding', '2026-11-21', 'Manila', OFF),
      seat('lab-gone', 'Lim & Tan', 'wedding', '2026-11-28', 'Makati', OFF, true, 'co_host'),
    ];
  }
  const live = none ? OFF : ON;
  return [
    seat('lab-claire', 'Claire & Indalecio', 'wedding', '2026-12-12', 'Seda Vertis North', live),
    seat('lab-reyes', 'Reyes debut', 'debut', '2026-10-17', 'Tagaytay', live),
    seat('lab-santos', 'Santos 50th', 'anniversary', '2027-02-14', 'Taal Vista', live, none),
    seat('lab-off', 'Dizon wedding', 'wedding', '2026-11-21', 'Manila', OFF),
    seat('lab-past', 'Lim & Tan', 'wedding', '2026-09-30', 'Makati', ON),
  ];
}

/** What needs them, per event — through the board's own fold (`summarizeEventDecisions`); `&unread=1` = refused. */
function labNeeds(unread: boolean): Map<string, EventDecisionSummary | null> {
  if (unread) return new Map();
  return new Map([
    ['lab-claire', summarizeEventDecisions({ pay: 0, approve: 2, message: 1, overdue: 0 })],
    ['lab-reyes', summarizeEventDecisions({ pay: 0, approve: 0, message: 0, overdue: 0 })],
    ['lab-santos', summarizeEventDecisions({ pay: 0, approve: 0, message: 0, overdue: 1 })],
  ]);
}

/** 🧰 The coordinator's admin-made shop, not set up yet: name in (wrong — she asks to change it), the rest to do. */
const LAB_HOLD_CHECKLIST: BusinessProfileItem[] = [
  { key: 'logo', label: 'Logo', surface: 'profile', ok: false },
  { key: 'business_name', label: 'Shop name', surface: 'profile', ok: true },
  { key: 'business_owner_name', label: 'Business owner', surface: 'profile', ok: true },
  { key: 'maps_pin', label: 'Company address', surface: 'profile', ok: false },
  { key: 'contact_phone', label: 'Contact number', surface: 'profile', ok: true },
  { key: 'contact_email', label: 'Company email', surface: 'profile', ok: true },
  { key: 'in_business_since_year', label: 'EST', surface: 'profile', ok: false },
  { key: 'services', label: 'Services covered', surface: 'profile', ok: true },
];

export function CoordLab({ state, none, unread = false, cohost = false, at, actions }: { state: CoordState; none: boolean; unread?: boolean; cohost?: boolean; at?: string; actions: TodayActions }) {
  const runs = withNeeds(eventsYouRun(labSeats(none, cohost), LAB_NOW, LAB_TODAY), labNeeds(unread));
  const bar = (
    <BottomDock boundary="tab">
      <CoordLabBar runsEvents={runs.length > 0} />
    </BottomDock>
  );
  if (state === 'coord-badges') {
    const shelf = badgeShelf(
      unread
        ? null
        : { verified: true, completedEvents: 46, trusted: { trusted_avg_rating: 4.8, trusted_review_count: 12 }, inBusinessSinceYear: 2019, awards: [], nowYear: 2026 },
    );
    return (
      <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-coord-lab="badges">
        <h1 className="sn-h1">How is my business doing</h1>
        <div className="mt-8">
          <YourBadges shelf={shelf} />
        </div>
        {bar}
      </div>
    );
  }
  if (state === 'coord-hold') {
    const hold = basicSetupHoldOf({ measured: true, canManage: true, verified: false, checklist: { items: LAB_HOLD_CHECKLIST, complete: false } });
    const where = at && at.startsWith('/vendor-dashboard') ? at : '/vendor-dashboard/shop';
    return (
      <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-coord-lab="hold" data-at={where}>
        <BasicSetupHold hold={hold} at={where}>
          {where.startsWith('/vendor-dashboard/events') ? (
            <EventsYouRunScreen events={runs} measured />
          ) : (
            <p className="text-[15px] text-ink/70" data-lab-stand-in="open-page">
              {where} — open while the shop is being set up (the shipped page draws here).
            </p>
          )}
        </BasicSetupHold>
        {bar}
      </div>
    );
  }
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
        {/* 📣 S9 — the REAL Message everyone rows, as the Events page mounts them (flag on in the lab). */}
        <MessageEveryoneRows events={runs} enabled />
        {bar}
      </div>
    );
  }
  if (state === 'coord-hub') {
    /* The supplier Hub's new top section — the REAL `CheckinDeskRows` the Hub page mounts (the Hub itself is a
       database page; this is its first block). */
    return (
      <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-coord-lab="hub" data-runs={runs.length}>
        <h1 className="sr-only">Event Hub</h1>
        <CheckinDeskRows events={runs} />
        {/* 🪑 S9 — the REAL seat-finder row the Hub draws for today's booked event. */}
        {runs[0] ? <SeatFinderRow eventId={runs[0].eventId} name={runs[0].name} /> : null}
        {runs.length === 0 ? <p className="text-[15px] text-ink/70">No event today</p> : null}
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
            {claire ? <Badge tone="quiet" data="coordinator">{claire.seatWord}</Badge> : null}
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
