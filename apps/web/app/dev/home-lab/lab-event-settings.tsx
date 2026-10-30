import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { resolveRoleSet } from '@/lib/role-sets';
import { hasTwoNamedPeople } from '@/lib/two-named-people';
import { EventSettingsRows } from '@/app/dashboard/[eventId]/_components/event-settings-rows';
import type { YourEventInput } from '@/app/dashboard/[eventId]/launch/_components/details-your-event-parts';
import { HubDraftToolbar } from '@/app/dashboard/[eventId]/website/_components/hub-draft-bar';
import { ACCESS_LAB_ROWS } from '@/app/dev/details-lab/access-grant-lab';

/**
 * 🧪 THE HOME LAB'S EVENT SETTINGS (`/dev/home-lab`) — the SAME rows the ⚙ draws (`EventSettingsRows`), on a fixture
 * wedding (Claire & Indalecio, 18 Dec, one typed reception, two parents), drawn by the lab page and handed to the ⚙ as
 * its rows, with the Maker's Undo · Apply toolbar on a one-change summary (no server action of its own — the action budget, `lint-server-action-budget.mjs`). Reads no database. The
 * editors' own saves still go to their real doors, which refuse the lab's made-up event — the lab shows the sheet, its
 * rows and their editors, not a save.
 */
export function labEventSettingsRows(eventId: string) {
  const profile = WEDDING_PROFILE;
  const words = eventWordsFromProfile(profile);
  const input: YourEventInput = {
    kind: {
      words: { twoPeople: hasTwoNamedPeople(profile), solemn: words.solemn, eventWord: words.eventWord },
      offeredRoles: resolveRoleSet(profile.roleSetKey).offeredRoles,
    },
    facts: {
      names: ['Claire', 'Indalecio'],
      date: { value: '2026-12-18', dayPrecise: true },
      venueCount: 1,
      parentCount: 2,
      hostCount: 0,
      marchLines: 0,
    },
    names: {
      people: ['Bride', 'Groom'],
      initial: [
        { first: 'Claire', last: 'Buanhog' },
        { first: 'Indalecio', last: 'Casasola' },
      ],
      storedName: 'Claire & Indalecio',
      wholeForm: null,
    },
    oneName: null,
    date: {
      confirmedVendorCount: 0,
      dateDisplay: 'December 18, 2026',
      dateValue: '2026-12-18',
      label: 'Date',
      matrix: Promise.resolve(null),
      nudge: null,
    },
    venues: {
      resolved: [],
      slots: [
        {
          label: 'Reception',
          slot: 'reception',
          booked: null,
          columns: { name: 'std_film_venue_name', address: 'venue_address', lat: 'venue_latitude', lng: 'venue_longitude' },
          typed: 'The Garden at Tagaytay',
          address: '',
          pin: null,
          choice: { source: 'own' },
          photoUrls: {},
        },
      ],
      city: null,
    },
    march: { sections: [] },
  };
  return (
    <EventSettingsRows
      eventId={eventId}
      input={input}
      parents={[
        { guestId: null, name: 'Rosa Buanhog' },
        { guestId: null, name: 'Ramon Casasola' },
      ]}
      /* The Maker's own Undo · Apply — the client toolbar `HubDraftDock` mounts, on a one-change summary (the dock's
         server half reads the database, which the lab has none of). */
      dock={
        <HubDraftToolbar
          eventId={eventId}
          summary={{ hasChanges: true, changeCount: 1, proCount: 0, canUndo: true, changes: [] }}
          storeShell={false}
          priceLabel={null}
          proHref={null}
          ownsPro
        />
      }
      /* 👥 People with access — the details lab's fixture seats (a host, a Limited coordinator, a helper, a caterer). */
      access={{ measured: true, rows: ACCESS_LAB_ROWS, addable: [{ guestId: 'g-tito', name: 'Tito Ben' }], claims: null, flash: null }}
      /* The moved Event Details parts that need no database to draw: Plan it myself and Put this away (the kind · area ·
         guests editor and the one code read the event, so the lab leaves them out). */
      more={{ settings: null, planMyself: false, oneCode: false, putAway: { archived: false, eventName: 'Claire & Indalecio' } }}
    />
  );
}
