import type { SupabaseClient } from '@supabase/supabase-js';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { loadEntourage } from '@/app/[slug]/_lib/loaders';
import { baziBirthDataEnabled } from '@/lib/bazi-birthdata';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { peopleLabels, splitStoredName } from '@/lib/details-your-event';
import { loadVenueBookings, resolveEventVenues } from '@/lib/event-venues';
import { resolveProfile, resolveRoleSetForEvent } from '@/lib/event-type-profile';
import type { EventDatePrecision } from '@/lib/events';
import { logQueryError } from '@/lib/supabase/error-detect';
import { HUB_DRAFT_FACT_COLUMNS, HUB_DRAFT_VENUE_COLUMNS } from '@/lib/hub-draft';

/**
 * ⚡ THE FACTS, APART FROM THE PAGES THAT DRAW THEM. \`readYourEventFacts\` is read
 * by Home's "Round N · x of y" (\`details-guided-progress.ts\`) as well as by the
 * Maker. It used to live beside \`loadYourEvent\`, whose JSX imports the Guest
 * list's entourage panel — so Home's server graph reached that panel's client
 * pieces and made Home a parent of the Details chunk (every page's webpack
 * runtime, \`check-bundle-size.mjs\`). Data only here; the JSX stays in
 * \`details-your-event-load.tsx\`.
 */

/** The event columns the "Your event" items read — each the column its existing screen reads. */
const YOUR_EVENT_COLUMNS =
  'event_type, display_name, bride_name, groom_name, region, mood_feel_key, event_date, event_date_precision, ' +
  'ceremony_type, secondary_ceremony_type, std_invitation_launch_date, ' +
  'std_film_ceremony_name, std_film_venue_name, std_film_venue_city, ceremony_venue_address, ' +
  'ceremony_venue_latitude, ceremony_venue_longitude, ' +
  'venue_name, venue_address, venue_latitude, venue_longitude';

type Row = {
  event_type: string | null;
  display_name: string | null;
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
  ceremony_venue_address: string | null;
  ceremony_venue_latitude: number | string | null;
  ceremony_venue_longitude: number | string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | string | null;
  venue_longitude: number | string | null;
};

const coercePrecision = (v: unknown): EventDatePrecision | null =>
  v === 'year' || v === 'month' || v === 'day' ? v : null;

/**
 * The FACTS "Your event" is drawn from — the event row, its type, the booked
 * venues and the walking order — and whether each item is filled in. The
 * navigator reads them through `loadYourEvent`; the pages that decide before
 * Details draws (the Maker opening on the guided "What's left", Home's "Round N
 * · x of y") read them HERE, the same read, so "done" can never differ between
 * the two (Details part 5). Null when the event row cannot be read.
 *
 * Nothing slow: the date finder's matrix is `loadYourEvent`'s alone.
 */
export async function readYourEventFacts({
  admin,
  eventId,
  parentCount,
  hostCount,
  drafted,
  draftedVenue,
}: {
  admin: SupabaseClient;
  eventId: string;
  parentCount: number;
  hostCount: number;
  /**
   * ✍ The couple's drafted `events` columns (the Event Hub draft). The names and
   * the date typed in the Maker are drafted until Apply (owner 2026-10-01, "wait
   * for apply"), so the Maker shows them — and counts them done — as drafted.
   * Omitted = the live row (what a guest reads).
   */
  drafted?: Record<string, unknown>;
  /** 🏛 The draft's Venue-scene card choices (`widgets.venue_map.venue`) — shown as drafted. */
  draftedVenue?: unknown;
}) {
  const rowRes = await admin.from('events').select(YOUR_EVENT_COLUMNS).eq('event_id', eventId).maybeSingle();
  if (rowRes.error || !rowRes.data) {
    if (rowRes.error) logQueryError('LaunchPage.yourEvent', rowRes.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const row = { ...(rowRes.data as unknown as Row) };
  // 📍 …and the venues typed in the Maker (owner 2026-10-04: venues wait for Apply too).
  for (const c of [...HUB_DRAFT_FACT_COLUMNS, ...HUB_DRAFT_VENUE_COLUMNS]) {
    if (drafted && c in drafted) (row as Record<string, unknown>)[c] = drafted[c];
  }

  const [profile, roleSet, bookings, groups] = await Promise.all([
    resolveProfile(row.event_type ?? 'wedding'),
    resolveRoleSetForEvent(eventId),
    loadVenueBookings(admin, eventId, draftedVenue ?? undefined),
    loadEntourage(admin, eventId),
  ]);
  const words = eventWordsFromProfile(profile);
  const kind = { words, offeredRoles: roleSet.offeredRoles };

  const precision = row.event_date ? (coercePrecision(row.event_date_precision) ?? 'day') : null;
  const a = splitStoredName(row.bride_name);
  const b = splitStoredName(row.groom_name);
  const people = peopleLabels(profile.terminology.personA, profile.terminology.personB);
  const chinese = isChineseWedding(row);
  /* ⚠ Where the BaZi birth-data section is live, `updateEventMatchCriteria`
     purges birth data unless its consent box is posted — a names-only save
     would erase it. There the Names item is not offered (flag off in prod). */
  const namesWritable = people !== null && !(baziBirthDataEnabled() && chinese);
  /* A one-person event's Name is `display_name`, written alone through the
     same writer's `celebrant_name` door — no birth data near it — so it is
     always offered (owner 2026-09-29, "yes to all 4", item 3). */
  const nameWritable = people === null || namesWritable;
  const venues = resolveEventVenues(bookings, row);
  const marchLines = groups.reduce((n, g) => n + g.rows.length, 0);

  return {
    row,
    words,
    kind,
    precision,
    bookings,
    groups,
    venues,
    people,
    chinese,
    namesWritable: nameWritable,
    names: [a, b] as const,
    facts: {
      names: [a.first, b.first] as const,
      oneName: people ? null : (row.display_name ?? ''),
      date: { value: row.event_date, dayPrecise: precision === 'day' },
      venueCount: venues.length,
      parentCount,
      hostCount,
      marchLines,
    },
  };
}

