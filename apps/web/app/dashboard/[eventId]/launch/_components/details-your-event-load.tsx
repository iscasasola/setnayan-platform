import type { SupabaseClient } from '@supabase/supabase-js';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { loadEntourage } from '@/app/[slug]/_lib/loaders';
import { baziBirthDataEnabled } from '@/lib/bazi-birthdata';
import { isChineseWedding } from '@/lib/chinese-wedding';
import {
  dateDisplayOf,
  marchOffered,
  peopleLabels,
  splitStoredName,
  yourEventDateLabel,
} from '@/lib/details-your-event';
import { loadVenueBookings, resolveEventVenues, VENUE_ROLE_LABEL } from '@/lib/event-venues';
import { resolveProfile, resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { getConfirmedVendorCount, type EventDatePrecision } from '@/lib/events';
import { buildScheduleMatrix, schedulePicksFromVendors, type ScheduleMatrix } from '@/lib/schedule-matrix';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchEventVendors } from '@/lib/vendors';
import { ChineseSpecialistNudge } from '../../date-selection/_components/chinese-specialist-nudge';
import { EntourageOrderPanel } from '../../guests/_components/entourage-order-panel';
import type { YourEventInput } from './details-your-event-parts';
import type { VenueSlot } from './details-your-event';

/** The event columns the "Your event" items read — each the column its existing screen reads. */
const YOUR_EVENT_COLUMNS =
  'event_type, bride_name, groom_name, region, mood_feel_key, event_date, event_date_precision, ' +
  'ceremony_type, secondary_ceremony_type, std_invitation_launch_date, ' +
  'std_film_ceremony_name, std_film_venue_name, std_film_venue_city, ' +
  'venue_name, venue_address, venue_latitude, venue_longitude';

type Row = {
  event_type: string | null;
  bride_name: string | null;
  groom_name: string | null;
  region: string | null;
  mood_feel_key: string | null;
  event_date: string | null;
  event_date_precision: string | null;
  ceremony_type: string | null;
  secondary_ceremony_type: string | null;
  std_invitation_launch_date: string | null;
  std_film_ceremony_name: string | null;
  std_film_venue_name: string | null;
  std_film_venue_city: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | string | null;
  venue_longitude: number | string | null;
};

const coercePrecision = (v: unknown): EventDatePrecision | null =>
  v === 'year' || v === 'month' || v === 'day' ? v : null;

/**
 * Everything Details › Your event reads, for the couple's own Maker (Details
 * part 2a). Null — and the group is simply not drawn — when the event row
 * cannot be read: an item must never show an empty box over a name it failed
 * to read, which would then SAVE that emptiness.
 *
 * The date finder's matrix is handed on still LOADING (a promise the "Help me
 * choose" panel reads), so the suppliers' calendars never hold up the Maker.
 */
export async function loadYourEvent({
  supabase,
  admin,
  eventId,
  mayShowStdFilm,
  parentCount,
  hostCount,
}: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  eventId: string;
  /** The Save-the-Date applies to this event type (its city line is shown). */
  mayShowStdFilm: boolean;
  parentCount: number;
  hostCount: number;
}): Promise<YourEventInput | null> {
  const rowRes = await admin.from('events').select(YOUR_EVENT_COLUMNS).eq('event_id', eventId).maybeSingle();
  if (rowRes.error || !rowRes.data) {
    if (rowRes.error) logQueryError('LaunchPage.yourEvent', rowRes.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const row = rowRes.data as unknown as Row;

  const [profile, roleSet, confirmedVendorCount, bookings, groups] = await Promise.all([
    resolveProfile(row.event_type ?? 'wedding'),
    resolveRoleSetForEvent(eventId),
    getConfirmedVendorCount(supabase, eventId).catch(() => 0),
    loadVenueBookings(admin, eventId),
    loadEntourage(admin, eventId),
  ]);
  const words = eventWordsFromProfile(profile);
  const kind = { words, offeredRoles: roleSet.offeredRoles };

  const precision = row.event_date ? (coercePrecision(row.event_date_precision) ?? 'day') : null;
  // The shipped Find your date's own read — the couple's suppliers against the days considered.
  const matrix: Promise<ScheduleMatrix | null> = fetchEventVendors(supabase, eventId)
    .then((vendors) =>
      buildScheduleMatrix({ admin, eventDate: row.event_date, precision, picks: schedulePicksFromVendors(vendors) }),
    )
    .catch((e: unknown) => {
      console.error('[details] the date finder could not be built:', e instanceof Error ? e.message : e);
      return null;
    });

  const a = splitStoredName(row.bride_name);
  const b = splitStoredName(row.groom_name);
  const people = peopleLabels(profile.terminology.personA, profile.terminology.personB);
  const chinese = isChineseWedding(row);
  /* ⚠ Where the BaZi birth-data section is live, `updateEventMatchCriteria`
     purges birth data unless its consent box is posted — a names-only save
     would erase it. There the Names item is not offered (flag off in prod). */
  const namesWritable = people !== null && !(baziBirthDataEnabled() && chinese);

  const venues = resolveEventVenues(bookings, row);
  const slots: VenueSlot[] = words.twoPeople
    ? [
        { field: 'filmCeremonyName', label: VENUE_ROLE_LABEL.ceremony, booked: bookings.ceremony, typed: row.std_film_ceremony_name ?? '' },
        { field: 'filmVenueName', label: VENUE_ROLE_LABEL.reception, booked: bookings.reception, typed: row.std_film_venue_name ?? '' },
      ]
    : [{ field: 'filmVenueName', label: 'Venue', booked: bookings.reception, typed: row.std_film_venue_name ?? '' }];

  const marchLines = groups.reduce((n, g) => n + g.rows.length, 0);

  return {
    kind,
    facts: {
      names: [a.first, b.first],
      date: { value: row.event_date, dayPrecise: precision === 'day' },
      venueCount: venues.length,
      parentCount,
      hostCount,
      marchLines,
    },
    names:
      namesWritable && people
        ? { people, initial: [a, b], keep: { region: row.region ?? '', feel: row.mood_feel_key ?? '' }, wholeForm: null }
        : null,
    date: {
      confirmedVendorCount,
      dateDisplay: dateDisplayOf(row.event_date, precision),
      dateValue: row.event_date && precision === 'day' ? row.event_date : null,
      label: yourEventDateLabel(words),
      matrix,
      nudge: chinese ? <ChineseSpecialistNudge /> : null,
    },
    venues: {
      resolved: venues,
      slots,
      city: mayShowStdFilm ? (row.std_film_venue_city ?? '') : null,
      launchDate: row.std_invitation_launch_date,
    },
    march: {
      groups,
      panel: marchOffered(kind) ? <EntourageOrderPanel eventId={eventId} view="all" /> : null,
    },
  };
}
