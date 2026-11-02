/**
 * apps/web/lib/sample-event/hub.ts
 *
 * 🎭 THE SAMPLE'S ROWS → THE SHIPPED EVENT HUB'S PROPS (slice S2, corpus
 * SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md items 1–6).
 *
 * `./snapshot.ts` holds the fixtures and imports nothing. This file hands them
 * to the SAME pure builders a real event's page uses — never a look-alike:
 *
 *   · the entourage and the Wedding March → `buildEntourage` (lib/entourage.ts),
 *     the builder `loadEntourage` calls, with the couple's section order;
 *   · where a walker walks → `marchPlaceOf` (lib/march-place.ts);
 *   · the day → `ScheduleBlockRow`s (chapters + their moments) and
 *     `invitationChapters` (lib/invitation-chapters.ts) — every time a
 *     wall-clock on the DERIVED day (`./date.ts`);
 *   · the seat → `seatPlanPreviewSvg` (lib/seat-plan-preview-svg.ts), the plan
 *     `YourSeatBlock` draws, with the guest's table marked YOU;
 *   · the look → `paletteColourVars` (lib/theme-colours.ts), the vars the guest
 *     tree's layout wears for a Mood Board palette.
 *
 * 🔒 NO TABLE. Nothing here, and nothing it imports, reaches a Supabase client
 * (`app/sample/the-sample-hub-reaches-no-table.test.ts` walks the graph).
 * 🔒 NO ID OF A REAL ROW. Every id is `sample:<key>` — never a uuid.
 */
import { buildEntourage, type EntourageGroup, type EntourageGuestRow } from '@/lib/entourage';
import { marchPlaceOf, type MarchPlace } from '@/lib/march-place';
import { DEFAULT_NAME_STYLE } from '@/lib/name-style';
import { invitationChapters, type InvitationChapter } from '@/lib/invitation-chapters';
import type { ScheduleBlockRow } from '@/lib/schedule';
import { DEFAULT_FLOOR_PLAN, type EventTableRow, type FloorPlanRow } from '@/lib/seating';
import { seatPlanPreviewSvg } from '@/lib/seat-plan-preview-svg';
import { paletteColourVars } from '@/lib/theme-colours';
import { guestArriveBy } from '@/lib/role-group-dress-code';
import { HUB_PARTS } from '@/lib/hub-parts';
import type { EventWords } from '@/app/[slug]/_lib/event-words';

import { SAMPLE_EVENT_ID, readSampleEvent, type SampleEventSnapshot, type SampleGuest, type SampleTable } from './snapshot';
import { SAMPLE_EVENT_TZ, sampleDayPlus, sampleEventDate, sampleToday, sampleWallClock } from './date';

const SAMPLE = readSampleEvent(SAMPLE_EVENT_ID)!;

/** The snapshot itself — for callers that need its raw facts (names, colours). */
export function sampleSnapshot(): SampleEventSnapshot {
  return SAMPLE;
}

/** Every sample guest, in cast order. */
export function sampleGuests(): SampleGuest[] {
  return Object.values(SAMPLE.guests);
}

/** "Maria Santos" — a guest's name as the ticket and the hub print it. */
export function sampleGuestName(g: Pick<SampleGuest, 'first_name' | 'last_name'>): string {
  return `${g.first_name} ${g.last_name}`.trim();
}

// ─── The day ────────────────────────────────────────────────────────────────

export type SampleDay = {
  /** The wedding, `YYYY-MM-DD` — always after `today`. */
  date: string;
  /** Today on the venue's clock. */
  today: string;
  /** "Saturday, February 6, 2027". */
  label: string;
  /** Days from today to the wedding (≥ 90). */
  daysToGo: number;
  /** Reply by — four weeks before the day. */
  replyBy: string;
  tz: string;
};

export function sampleDay(now: Date): SampleDay {
  const date = sampleEventDate(now);
  const today = sampleToday(now);
  const daysToGo = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return { date, today, label, daysToGo, replyBy: sampleDayPlus(date, -28), tz: SAMPLE_EVENT_TZ };
}

/**
 * The run of show as `schedule_blocks` rows: each chapter a top-level block on
 * the invitation, each moment a public part under it. The ids are `sample:` ids.
 */
export function sampleScheduleBlocks(now: Date): ScheduleBlockRow[] {
  const { date } = sampleDay(now);
  const rows: ScheduleBlockRow[] = [];
  let order = 0;
  for (const c of SAMPLE.chapters) {
    const chapterId = `sample:block-${c.key}`;
    rows.push(blockRow(chapterId, c.label, sampleWallClock(date, c.at), sampleWallClock(date, c.until), c.location, null, order++));
    for (const m of c.moments) {
      rows.push(
        blockRow(`sample:block-${c.key}-${m.key}`, m.label, sampleWallClock(date, m.at), m.until ? sampleWallClock(date, m.until) : null, m.spot, chapterId, order++),
      );
    }
  }
  return rows;
}

function blockRow(id: string, label: string, start: string, end: string | null, location: string | null, parent: string | null, sort: number): ScheduleBlockRow {
  return {
    block_id: id,
    public_id: id,
    event_id: SAMPLE_EVENT_ID,
    label,
    block_type: 'custom' as ScheduleBlockRow['block_type'],
    start_at: start,
    end_at: end,
    location,
    notes: null,
    is_public: true,
    sort_order: sort,
    parent_block_id: parent,
    created_at: start,
    run_state: 'upcoming',
    actual_start_at: null,
    actual_end_at: null,
    audience: null,
    time_tba: false,
  };
}

/** The invitation's chapters — the shipped reader over the chapter rows (`on_invitation` on, top level). */
export function sampleChapters(now: Date): InvitationChapter[] {
  const { date } = sampleDay(now);
  return invitationChapters(
    SAMPLE.chapters.map((c, i) => ({
      block_id: `sample:block-${c.key}`,
      parent_block_id: null,
      label: c.label,
      start_at: sampleWallClock(date, c.at),
      end_at: sampleWallClock(date, c.until),
      location: c.location,
      spot: c.spot,
      time_tba: false,
      on_invitation: true,
      sort_order: i,
    })),
  );
}

/** When guests arrive, as the programme writes it ("2:30 PM") — a role's own call time wins over it. */
export function sampleGuestsArrive(): string {
  return formatHhmm(SAMPLE.guestsArrive);
}

/** "2:30 PM". */
function formatHhmm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** This guest's own call time — their role's, else the doors' (`guestArriveBy`, the ticket's own resolver). */
export function sampleArriveBy(g: SampleGuest): string | null {
  return guestArriveBy({ role: g.role, config: SAMPLE.dressCode, general: sampleGuestsArrive() });
}

// ─── The entourage and the Wedding March ────────────────────────────────────

function entourageRows(): EntourageGuestRow[] {
  return sampleGuests()
    .filter((g) => g.role !== 'guest')
    .map((g) => ({
      guest_id: g.guest_id,
      name_prefix: g.name_prefix,
      first_name: g.first_name,
      last_name: g.last_name,
      display_name: null,
      role: g.role,
      extra_roles: [],
      march: g.walk ? { walk_no: g.walk.no, place_in_walk: g.walk.place } : null,
      couple_with_guest_id: g.couple_with_guest_id,
      plus_one_of_guest_id: g.plus_one_of_guest_id,
      attire: g.attire,
      gender: g.gender,
      side: g.side,
    }));
}

/** The entourage as the invitation prints it — the couple's section order, the event's default Name style. */
export function sampleEntourage(): EntourageGroup[] {
  return buildEntourage(entourageRows(), SAMPLE.entourageSectionOrder, null, DEFAULT_NAME_STYLE);
}

/** The Wedding March — the same rows, built as the march (`{ march: true }`), in walking order. */
export function sampleMarch(): EntourageGroup[] {
  return buildEntourage(entourageRows(), SAMPLE.entourageSectionOrder, null, DEFAULT_NAME_STYLE, { march: true });
}

/** Where this guest walks in the march ("You walk 4th, …"), or null — they do not walk. */
export function sampleMarchPlace(g: SampleGuest): MarchPlace | null {
  return marchPlaceOf(sampleMarch(), g.guest_id);
}

// ─── Seats ──────────────────────────────────────────────────────────────────

const tableId = (t: Pick<SampleTable, 'key'>) => `sample:table-${t.key}`;

export function sampleTables(): EventTableRow[] {
  return SAMPLE.tables.map((t, i) => ({
    table_id: tableId(t),
    public_id: tableId(t),
    event_id: SAMPLE_EVENT_ID,
    table_label: t.label,
    table_type: t.tableType,
    capacity: t.capacity,
    sort_order: i,
    x_pos: t.x,
    y_pos: t.y,
    rotation_deg: 0,
    removed_seats: [],
  }));
}

/** The room: a stage up front, a dance floor between the tables, the door at the back. */
export const SAMPLE_FLOOR_PLAN: FloorPlanRow = {
  ...DEFAULT_FLOOR_PLAN,
  stage_x: 50,
  stage_y: 7,
  entrance_enabled: true,
  entrance_x: 50,
  entrance_y: 95,
  dance_enabled: true,
  dance_x: 50,
  dance_y: 52,
  dance_w: 30,
  dance_h: 16,
};

export type SampleSeat = {
  table: SampleTable;
  /** "VIP Table". */
  tableLabel: string;
  /** "6". */
  seatNumber: string;
  /** The room drawn by the seat plan's own renderer, this guest's table marked YOU. */
  plan: string;
  /** Who else sits there (names), the reader excluded. */
  tablemates: string[];
};

/**
 * The guest's seat — shown because the sample's seats are PUBLISHED
 * (`seatsPublished`, the sample override), never because a date was faked.
 * Null if the override is ever turned off: a real event shows seats on the day.
 */
export function sampleSeat(g: SampleGuest): SampleSeat | null {
  if (!SAMPLE.seatsPublished) return null;
  const table = SAMPLE.tables.find((t) => t.key === g.table)!;
  const seated = new Map<string, number>();
  for (const x of sampleGuests()) seated.set(`sample:table-${x.table}`, (seated.get(`sample:table-${x.table}`) ?? 0) + 1);
  const plan = seatPlanPreviewSvg({
    tables: sampleTables(),
    floorPlan: SAMPLE_FLOOR_PLAN,
    seatedByTable: seated,
    mode: 'moodboard',
    palette: [SAMPLE.colours.plum, SAMPLE.colours.gold, SAMPLE.colours.blush],
    youTableId: tableId(table),
    fluid: true,
  });
  return {
    table,
    tableLabel: table.label,
    seatNumber: String(g.seat),
    plan,
    tablemates: sampleGuests()
      .filter((x) => x.table === g.table && x.guestKey !== g.guestKey)
      .sort((a, b) => a.seat - b.seat)
      .map(sampleGuestName),
  };
}

// ─── The look ───────────────────────────────────────────────────────────────

/** The guest tree's colour vars for the couple's Mood Board on the free Classic look (`paletteColourVars`). */
export function sampleLookVars(): Record<string, string> | null {
  return paletteColourVars(SAMPLE.rolePalette, SAMPLE.theme);
}

// ─── Words and the day-only doors ───────────────────────────────────────────

/**
 * A wedding's words (`EventWords`) — the value `eventWordsFromProfile(WEDDING_PROFILE)`
 * returns, held as a literal because that module also opens the profile READ
 * (an admin client) and the sample reaches no table. `sample-content.test.ts`
 * holds it equal to the shipped derivation, so it cannot drift.
 */
export const SAMPLE_WORDS: EventWords = Object.freeze({
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  occasion: 'celebration',
  solemn: false,
  organizerIsHonoree: false,
  twoPeople: true,
  host: 'couple',
  theHost: 'the couple',
  TheHost: 'The couple',
  theHostPossessive: 'the couple’s',
  TheHostPossessive: 'The couple’s',
  celebrant: 'couple',
  theCelebrant: 'the couple',
  TheCelebrant: 'The couple',
  theCelebrantPossessive: 'the couple’s',
  TheCelebrantPossessive: 'The couple’s',
  celebrantShape: 'couple',
}) as EventWords;

export type SampleDayOnly = {
  key: 'check-in' | 'live-watch' | 'papic' | 'reveal';
  label: string;
  line: string;
  /** The Event Hub Pro part's name when this door is Pro (◆), from `HUB_PARTS` — never typed here. */
  pro: string | null;
};

const REVEAL_PART = HUB_PARTS.find((p) => p.id === 'reveal')!;

/**
 * 🔒 THE DAY-ONLY DOORS (brief item 10) — the sample is never on the day, so each
 * says "Opens on your wedding day" and opens nothing. Pro is marked only where a
 * shipped table says so (the Reveal is an Event Hub Pro part, `HUB_PARTS`).
 */
export const SAMPLE_DAY_ONLY: readonly SampleDayOnly[] = Object.freeze([
  { key: 'check-in', label: 'Check-in', line: 'Your ticket is scanned once at the door.', pro: null },
  { key: 'live-watch', label: 'Live Watch', line: 'Follow the ceremony live if you cannot be there.', pro: null },
  { key: 'papic', label: 'Papic camera', line: 'Your photos go straight into the couple’s album.', pro: null },
  { key: 'reveal', label: 'The reveal', line: 'The couple’s opening, the moment the day begins.', pro: REVEAL_PART.name },
]);
