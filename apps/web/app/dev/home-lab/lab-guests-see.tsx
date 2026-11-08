/**
 * /dev/home-lab?view=guests-see[&page=save_the_date|rsvp|event|editorial] — 🗓 Home's "Parts of the page" switches
 * (the REAL `HubPartsSwitches`) over the REAL "What guests see" table (`buildGuestsSeeTable`) on fixture widget rows:
 * no sign-in, no database. Added 2026-11-06 for the "The day's program" row (`lib/the-days-program-is-the-hosts-call
 * .test.ts`) — its label and its note, the rule only the hosts and the coordinator decide. A press in the lab writes
 * nothing real (the draft action refuses a lab event).
 */
import { buildGuestsSeeTable } from '@/lib/guests-see-build';
import { WIDGET_CATALOG_BY_TYPE, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from '@/lib/invitation-widgets';
import { HubPartsSwitches } from '@/app/dashboard/[eventId]/_components/home-cards/hub-parts-switches';

const ROWS: readonly WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'rsvp', 'countdown', 'schedule', 'special_message', 'dress_code',
  'venue_map', 'what_to_bring', 'our_love_story', 'our_photos',
];

function labRows(): InvitationWidgetRow[] {
  return ROWS.map((type, i) => ({
    widget_id: `lab-${type}`,
    event_id: 'lab',
    widget_type: type,
    display_order: i,
    is_visible: true,
    is_always_on: WIDGET_CATALOG_BY_TYPE[type].is_always_on,
    tier: 'basic',
    config_json: {},
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  })) as InvitationWidgetRow[];
}

const PAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];

export function LabGuestsSee({ page, eventId }: { page?: string; eventId: string }) {
  const now = (PAGES as readonly string[]).includes(page ?? '') ? (page as LifecyclePhase) : 'rsvp';
  const table = buildGuestsSeeTable({ widgets: labRows(), hasEntourage: true, giftsOff: false });
  return (
    <div className="mx-auto w-full max-w-md px-4 py-4" data-lab-guests-see="">
      <HubPartsSwitches eventId={eventId} table={table} now={now} />
    </div>
  );
}
