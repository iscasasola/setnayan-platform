import type { SupabaseClient } from '@supabase/supabase-js';
import { dateDisplayOf, marchOffered, yourEventDateLabel } from '@/lib/details-your-event';
import { VENUE_ROLE_LABEL, type VenueSlotKey } from '@/lib/event-venues';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { getConfirmedVendorCount } from '@/lib/events';
import { buildScheduleMatrix, schedulePicksFromVendors, type ScheduleMatrix } from '@/lib/schedule-matrix';
import { fetchEventVendors } from '@/lib/vendors';
import { ChineseSpecialistNudge } from '../../date-selection/_components/chinese-specialist-nudge';
import { EntourageOrderPanel } from '../../guests/_components/entourage-order-panel';
import type { YourEventInput } from './details-your-event-parts';
import type { VenueSlot } from './details-your-event';
import type { MarchSectionData, MarchSlotData } from './details-march';
import { roleLabel, type EntourageGroup } from '@/lib/entourage';
import { joinersFor, swapsFor } from '@/lib/march-moves';
import { readYourEventFacts } from './details-your-event-facts';
import { loadEventNameStyle } from '@/app/[slug]/_lib/loaders';

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
  helpFirst = false,
}: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  eventId: string;
  /** The Save-the-Date applies to this event type (its city line is shown). */
  mayShowStdFilm: boolean;
  parentCount: number;
  hostCount: number;
  /** Open Date on "Help me choose" (`?date=help` — where /find-date lands). */
  helpFirst?: boolean;
}): Promise<YourEventInput | null> {
  const [base, confirmedVendorCount, nameStyle] = await Promise.all([
    readYourEventFacts({ admin, eventId, parentCount, hostCount }),
    getConfirmedVendorCount(supabase, eventId).catch(() => 0),
    // 🔤 The Name style ▾ under the Names (owner 2026-09-30) — the same cached read the entourage uses.
    loadEventNameStyle(admin, eventId),
  ]);
  if (!base) return null;
  const { row, words, kind, precision, bookings, groups, venues, people, chinese, namesWritable } = base;
  const [a, b] = base.names;

  // The shipped Find your date's own read — the couple's suppliers against the days considered.
  const matrix: Promise<ScheduleMatrix | null> = fetchEventVendors(supabase, eventId)
    .then((vendors) =>
      buildScheduleMatrix({ admin, eventDate: row.event_date, precision, picks: schedulePicksFromVendors(vendors) }),
    )
    .catch((e: unknown) => {
      console.error('[details] the date finder could not be built:', e instanceof Error ? e.message : e);
      return null;
    });

  // 🏛📷 Each card's source and photo (owner 2026-09-30): the supplier AS
  // OFFERED (before an "Enter your own" choice), the couple's choice, and every
  // photo it can show, signed once here for the panel's thumbnails.
  const offered = bookings.offered ?? { ceremony: bookings.ceremony, reception: bookings.reception };
  const choices = bookings.choices ?? {};
  const sign = async (refs: readonly (string | null | undefined)[]) =>
    Object.fromEntries(
      (
        await Promise.all(
          [...new Set(refs.filter((r): r is string => Boolean(r)))].map(async (r) => [
            r,
            await displayUrlForStoredAsset(siteMediaServeRef(r)).catch(() => null),
          ]),
        )
      ).filter((e): e is [string, string] => Boolean(e[1])),
    );
  const slotFor = async (
    slot: VenueSlotKey,
    base: Omit<VenueSlot, 'slot' | 'booked' | 'choice' | 'photoUrls'>,
  ): Promise<VenueSlot> => {
    const b = offered[slot];
    const choice = choices[slot] ?? {};
    const photoUrls = await sign([...(b?.photos ?? []), choice.supplierPhoto, choice.ownPhoto]);
    return {
      ...base,
      slot,
      booked: b ? { name: b.name, address: b.address, photos: (b.photos ?? []).filter((r) => photoUrls[r]) } : null,
      choice,
      photoUrls,
    };
  };
  const slots: VenueSlot[] = words.twoPeople
    ? await Promise.all([
        slotFor('ceremony', {
          field: 'filmCeremonyName',
          label: VENUE_ROLE_LABEL.ceremony,
          typed: row.std_film_ceremony_name ?? '',
          addressField: 'ceremonyAddress',
          address: row.ceremony_venue_address ?? '',
        }),
        slotFor('reception', {
          field: 'filmVenueName',
          label: VENUE_ROLE_LABEL.reception,
          typed: row.std_film_venue_name ?? '',
          addressField: 'venueAddress',
          address: row.venue_address ?? '',
        }),
      ])
    : [
        await slotFor('reception', {
          field: 'filmVenueName',
          label: 'Venue',
          typed: row.std_film_venue_name ?? '',
          addressField: 'venueAddress',
          address: row.venue_address ?? '',
        }),
      ];

  return {
    kind,
    facts: base.facts,
    oneName: people
      ? null
      : {
          initial: row.display_name ?? '',
          // No person-noun: a wake's "celebrant" word is the family, not the
          // person the page is named for — so the hint names the places instead.
          hint: `Guests read it on your ${words.eventWord} page, on every print and on every pass.`,
        },
    nameStyle,
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
      helpFirst,
    },
    venues: {
      resolved: venues,
      slots,
      city: mayShowStdFilm ? (row.std_film_venue_city ?? '') : null,
      launchDate: row.std_invitation_launch_date,
    },
    march: {
      sections: marchSections(groups),
      panel: marchOffered(kind) ? <EntourageOrderPanel eventId={eventId} view="all" /> : null,
    },
  };
}

/**
 * The march as the three parts need it: every section and line in walking
 * order (`buildEntourage`'s — the invitation's), each cell's moves asked of
 * `lib/march-moves.ts` here on the server — the rule the actions ask again
 * before they write (as the Guest list panel's `slotFor` does).
 */
export function marchSections(groups: readonly EntourageGroup[]): MarchSectionData[] {
  let step = 0;
  return groups.map((g) => ({
    key: g.key,
    label: g.label,
    lines: g.rows.map((row, i) => {
      step += 1;
      const slot = (c: 0 | 1): MarchSlotData => {
        const half = row[c];
        if (half) {
          return {
            kind: 'name',
            id: half.id ?? '',
            name: half.name,
            role: roleLabel(half.role, g.names),
            swapWith: half.id ? swapsFor(g.rows, g.key, half.id) : [],
          };
        }
        const anchor = row[c === 0 ? 1 : 0];
        return {
          kind: 'empty',
          anchorId: anchor?.id ?? '',
          anchorName: anchor?.name ?? '',
          joiners: anchor?.id ? joinersFor(g.rows, g.key, anchor.id) : [],
        };
      };
      return {
        leadId: row[0]?.id ?? row[1]?.id ?? `${g.key}-${i}`,
        label: row.filter((p) => p !== null).map((p) => p!.name).join(' and '),
        step,
        slots: [slot(0), slot(1)] as [MarchSlotData, MarchSlotData],
      };
    }),
  }));
}
