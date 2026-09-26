/**
 * lib/print-guest-registry.ts — THE GUEST LIST REGISTRY, the reception-desk list.
 *
 * Owner 2026-09-25 (DECISION_LOG "PRINTS & TICKETS HOLDS EVERY PRINT"), naming
 * the free prints: *"GuestList Registry 2D SeatPlan QR Codes"*. This is the
 * first of the three that did not exist: an A4 list the person at the
 * reception desk holds — every guest, alphabetical, with how many they bring,
 * their table, whether they replied, a box to tick on arrival and a line to
 * sign.
 *
 * Rows come from the Guest list (`fetchGuestsByEvent`, the route reads it);
 * the layout is `lib/print-report.ts`, so the Maker's thumbnail and the PDF are
 * the same drawing. FREE for every event, store shell included — it has no
 * themed version (`PRINT_PIECES['guest-registry'].kind === 'free'`).
 *
 * PURE — the Node test runner measures real rows, not flags.
 */
import { RSVP_LABELS, guestDisplayName, plusOneSeats, type GuestRow } from '@/lib/guests';
import { PLACEHOLDER_FIRST_NAME } from '@/lib/extra-seats';
import { layoutReport, type ReportColumn, type ReportRow } from '@/lib/print-report';
import type { PrintDoc } from '@/lib/print-layout';

/** What the registry reads of a guest — a subset of `GuestRow`, so a fixture can be small. */
export type RegistryGuest = Pick<
  GuestRow,
  'guest_id' | 'first_name' | 'last_name' | 'display_name' | 'name_suffix' | 'role' | 'rsvp_status' | 'plus_one_count' | 'plus_one_allowed' | 'plus_one_of_guest_id'
> & {
  /**
   * 🪝 THE "PASSED AWAY" HOOK. No such column exists yet (2026-09-25). When the
   * Guest list gains one, select it into this field and nothing else changes:
   * a guest marked here is LISTED — the family may want the name at the desk —
   * but NOT COUNTED: no party size, no RSVP, out of every total. Until then it
   * is always undefined and every guest counts.
   */
  passed_away?: boolean | null;
};

/** Listed but not counted — the one question the totals ask of a guest. */
export function listedNotCounted(g: Pick<RegistryGuest, 'passed_away'>): boolean {
  return g.passed_away === true;
}

export type RegistryRow = {
  guestId: string;
  /** "Cruz, Ana" — surname first, the way a desk list is searched. */
  name: string;
  /** Named companions who arrive with this guest ("with Ben Cruz"). */
  companions: string[];
  /** The guest + every seat they bring; null when listed-not-counted. */
  party: number | null;
  table: string | null;
  rsvp: string;
  counted: boolean;
};

/** The couple themselves never sign in at their own desk. */
const NOT_AT_THE_DESK = new Set(['bride', 'groom']);

function surnameFirst(g: RegistryGuest): { label: string; key: string } {
  const last = (g.last_name ?? '').trim();
  const first = (g.first_name ?? '').trim();
  const custom = g.display_name?.trim();
  // A custom display name ("Tita Baby") is how the couple knows them — print it
  // as written and file it under itself.
  if (custom && custom !== `${first} ${last}`.trim()) return { label: custom, key: custom };
  if (last && first) {
    const suffix = g.name_suffix?.trim();
    return { label: `${last}, ${first}${suffix ? ` ${suffix}` : ''}`, key: `${last} ${first}` };
  }
  const only = guestDisplayName(g) || 'Guest';
  return { label: only, key: only };
}

/**
 * The registry's rows, ALPHABETICAL by surname. One row per invited guest; an
 * extra-seat row (`plus_one_of_guest_id`) folds into its guest's party rather
 * than taking a line of its own — the party arrives together — unless its guest
 * is not on the list, in which case it stands alone rather than vanish.
 */
export function registryRows(guests: readonly RegistryGuest[], tableOf: ReadonlyMap<string, string>): RegistryRow[] {
  const byId = new Map(guests.map((g) => [g.guest_id, g]));
  const companions = new Map<string, string[]>();
  for (const g of guests) {
    if (!g.plus_one_of_guest_id || !byId.has(g.plus_one_of_guest_id)) continue;
    const name = guestDisplayName(g).trim();
    // Placeholder seats ("TBA", lib/extra-seats.ts) are a count, not a name.
    if (!name || (g.first_name ?? '').trim().toUpperCase() === PLACEHOLDER_FIRST_NAME) continue;
    const arr = companions.get(g.plus_one_of_guest_id) ?? [];
    arr.push(name);
    companions.set(g.plus_one_of_guest_id, arr);
  }
  const rows = guests
    .filter((g) => !NOT_AT_THE_DESK.has(g.role))
    .filter((g) => !g.plus_one_of_guest_id || !byId.has(g.plus_one_of_guest_id))
    .map((g) => {
      const n = surnameFirst(g);
      const counted = !listedNotCounted(g);
      return {
        row: {
          guestId: g.guest_id,
          name: n.label,
          companions: companions.get(g.guest_id) ?? [],
          party: counted ? 1 + plusOneSeats(g) : null,
          table: tableOf.get(g.guest_id) ?? null,
          rsvp: counted ? RSVP_LABELS[g.rsvp_status] ?? 'Pending' : 'In loving memory',
          counted,
        } satisfies RegistryRow,
        key: n.key,
      };
    });
  rows.sort((a, b) => a.key.localeCompare(b.key, 'en', { sensitivity: 'base', numeric: true }) || a.row.guestId.localeCompare(b.row.guestId));
  return rows.map((r) => r.row);
}

/** The totals line — counted guests only. */
export function registryTotals(rows: readonly RegistryRow[]): { guests: number; people: number; attendingPeople: number } {
  const counted = rows.filter((r) => r.counted);
  return {
    guests: counted.length,
    people: counted.reduce((a, r) => a + (r.party ?? 0), 0),
    attendingPeople: counted.filter((r) => r.rsvp === RSVP_LABELS.attending).reduce((a, r) => a + (r.party ?? 0), 0),
  };
}

/** "December 18, 2026" from an `events.event_date` (a calendar date — read in UTC so it never slips a day). */
export function registryDate(eventDate: string | null | undefined): string | null {
  if (!eventDate) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? `${eventDate}T00:00:00Z` : eventDate);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** The columns, in the order the brief names them: name · party · table · RSVP · check-in · signature. */
export const REGISTRY_COLUMNS: ReportColumn[] = [
  { label: 'Guest', width: 0.3 },
  { label: 'Party', width: 0.07, align: 'center' },
  { label: 'Table', width: 0.13 },
  { label: 'RSVP', width: 0.13 },
  { label: 'Arrived', width: 0.09, align: 'center', kind: 'box' },
  { label: 'Signature', width: 0.28, kind: 'line' },
];

export function layoutGuestRegistry(input: {
  title: string;
  dateLabel?: string | null;
  rows: readonly RegistryRow[];
}): PrintDoc[] {
  const t = registryTotals(input.rows);
  const rows: ReportRow[] = input.rows.map((r) => ({
    cells: [r.name, r.party === null ? '—' : String(r.party), r.table ?? '—', r.rsvp, '', ''],
    sub: r.companions.length ? `with ${r.companions.join(', ')}` : null,
    muted: !r.counted,
  }));
  return layoutReport({
    piece: 'guest-registry',
    title: input.title,
    subtitle: [input.dateLabel, 'Guest list registry · reception desk'].filter(Boolean).join(' · '),
    summary: `${t.guests} ${t.guests === 1 ? 'guest' : 'guests'} · ${t.people} ${t.people === 1 ? 'person' : 'people'} invited · ${t.attendingPeople} attending`,
    sections: [{ columns: REGISTRY_COLUMNS, rows, empty: 'No guests on the Guest list yet.' }],
    footnote: 'Party = the guest and every seat they bring. Tick "Arrived" as each party checks in.',
  });
}
