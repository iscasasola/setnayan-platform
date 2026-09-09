/**
 * story-room.ts — the lens: what the room was, at the minute you are reading.
 *
 * `01_The_Story.md` §3.4 (The lens) + §5 (Seating) · `04` rules 2 and 7 ·
 * `05` §4 (roaming and no-venue) · `08` step 2.3.
 *
 * A sticky top-down plan beside the story. Five states, and every one of them
 * is DERIVED — from the couple's own run of show and from whether a room was
 * ever drawn — never from a clock threshold:
 *
 *   not_built  the room had not been drawn yet at this point in the story
 *   designed   the plan exists; nobody is seated at this minute
 *   ceremony   rows facing the arch, tables hidden
 *   reception  the tables, lit by the photographs that came from them
 *   no_venue   a roaming celebration, or a kind of day that has no seating
 *
 * ── 🔒 OWNER LOCK 6 · ASSIGNED SEATS EXIST ONLY WHILE THE RECEPTION VENUE IS
 *      IN USE ──────────────────────────────────────────────────────────────
 * The owner caught this himself: the design had been lighting tables during the
 * ceremony. Before the reception a photograph belongs to a PERSON, not to a
 * table, and drawing them at one puts a guest somewhere they had not sat down
 * yet. `seatsAreShown` is the single answer to "may a table appear at all", and
 * it consults `venueStateAt` — the shipped derivation over
 * `event_schedule_blocks` — never a time of day.
 *
 * ── 🔒 REVIEW BLOCKER · THE PUBLIC PLAN NEVER CARRIES A NAME ───────────────
 * An earlier design published 108 first names on a seating chart. This module
 * has no field for a name, cannot be given one, and the only per-table string
 * it will emit is `event_tables.table_label`. `04` rule 7 goes further and this
 * follows it: nobody is ever named as the one who shot a photograph, so heat is
 * reported per TABLE and the copy says "Table 7", never a person. A guest's own
 * table and their tablemates are a different surface, on their own account
 * (`public_venue_scene`'s token arm), and are not this.
 *
 * PURE — no React, no DOM, no I/O. `story-room.test.ts` runs the real states.
 */

import { venueStateAt, type VenueBlock } from './story-spine';

/* ══════════════════════════════════════════════════════════════════════════
   THE ROOM AS THE STORY NEEDS IT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * One table on the public plan.
 *
 * 🔑 THE FIELD LIST IS THE PRIVACY BOUNDARY. It is a label and a position and
 * nothing else — there is deliberately no seat roster, no guest id and no
 * capacity-filled figure, because a shape that can hold a name eventually does.
 */
export type RoomTable = {
  /** `event_tables.public_id` — a key, never shown. */
  id: string;
  /** `event_tables.table_label` — "7", "Long table", "Crew". The only string. */
  label: string;
  /** Percent across / down the venue, as the couple placed it. */
  xPct: number;
  yPct: number;
  /** The shape hint from the shipped catalogue — round, long, sweetheart… */
  shape: 'round' | 'long_banquet' | 'family_head' | 'sweetheart' | 'serpentine';
};

/** The room, as the story reads it. */
export type StoryRoom = {
  /**
   * Does this KIND of day have seating at all?
   * `event_type_profiles.enabled_surfaces` includes `'seating'` — measured, not
   * assumed: a date, a hangout and travel do not, and travel is `roaming`.
   */
  seatingSurface: boolean;
  /** True for a celebration that moves — a trip, a reunion across towns. */
  roaming: boolean;
  tables: RoomTable[];
  /** Anybody actually seated? A drawn room with no assignments is `designed`. */
  seatsAssigned: boolean;
  /**
   * When the room was first drawn — the earliest `event_tables.created_at`.
   * Before it, the lens says so instead of showing a plan that did not exist.
   * Null when nothing was drawn.
   */
  drawnAtMs: number | null;
  /** The dance floor, if the couple placed one. Percent of the venue. */
  dance: { xPct: number; yPct: number; wPct: number; hPct: number } | null;
  /** The stage / head table area. Percent of the venue. */
  stage: { xPct: number; yPct: number; wPct: number; hPct: number } | null;
};

export const EMPTY_ROOM: StoryRoom = {
  seatingSurface: false,
  roaming: false,
  tables: [],
  seatsAssigned: false,
  drawnAtMs: null,
  dance: null,
  stage: null,
};

/* ══════════════════════════════════════════════════════════════════════════
   THE FIVE STATES
   ══════════════════════════════════════════════════════════════════════════ */

export type LensState = 'no_venue' | 'not_built' | 'designed' | 'ceremony' | 'reception';

/**
 * Which of the five the lens is in, at this instant.
 *
 * The order of the tests is the meaning. A kind of day with no seating is never
 * "not built yet" — nothing was ever going to be built. A room nobody drew is
 * never "designed". And the reception only opens when the couple's own run of
 * show says a seated block is running.
 */
export function lensStateAt(
  atMs: number,
  blocks: readonly VenueBlock[],
  room: StoryRoom,
): LensState {
  if (!room.seatingSurface || room.roaming) return 'no_venue';
  if (room.tables.length === 0) return 'not_built';
  if (room.drawnAtMs != null && atMs < room.drawnAtMs) return 'not_built';

  const venue = venueStateAt(atMs, blocks);
  if (venue === 'ceremony') return 'ceremony';
  if (venue === 'seated') return room.seatsAssigned ? 'reception' : 'designed';
  // 'before', 'unseated' and 'no_venue' all mean the same thing to the lens:
  // the room exists and nobody is sitting in it at this minute.
  return 'designed';
}

/** Owner lock 6, as one question with one answer. */
export function seatsAreShown(state: LensState): boolean {
  return state === 'reception';
}

/* ══════════════════════════════════════════════════════════════════════════
   THE HEAT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Which tables were shooting at a minute, loudest first.
 *
 * 🔒 THIS IS THE GUESTS' LAYER. A count of photographs per table describes what
 * the guests did exactly as a photograph does — Q1, ruled 2026-09-09: a
 * stranger before publish gets no counts. The resolver that fills this is the
 * one place that decides, and it hands back an EMPTY list rather than a
 * zeroed one when the layer is withheld, so a withheld minute has no heat to
 * draw rather than a plan of cold tables that looks like a measurement.
 */
export type TableHeat = {
  /** `RoomTable.id`. */
  tableId: string;
  /** How many of that minute's photographs came from this table. */
  captures: number;
};

/** The loudest table of a minute, or null when nothing was shot from a seat. */
export function loudestTable(heat: readonly TableHeat[]): string | null {
  let best: TableHeat | null = null;
  for (const h of heat) {
    if (h.captures <= 0) continue;
    if (!best || h.captures > best.captures) best = h;
  }
  return best ? best.tableId : null;
}

/**
 * How brightly one table burns at this minute — `hot` is the loudest, `warm`
 * anything else that was shooting, `cold` the rest of the room.
 *
 * A share of the loudest rather than an absolute, so a quiet minute still shows
 * its own shape instead of a dark room.
 */
export function heatClassOf(
  tableId: string,
  heat: readonly TableHeat[],
): 'hot' | 'warm' | 'cold' {
  const loudest = loudestTable(heat);
  if (loudest === tableId) return 'hot';
  const mine = heat.find((h) => h.tableId === tableId);
  return mine && mine.captures > 0 ? 'warm' : 'cold';
}

/* ══════════════════════════════════════════════════════════════════════════
   WHAT THE LENS SAYS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The line under the plan.
 *
 * Every branch names a table by its own label and nobody by name. `opensAt` is
 * rendered from the seated block's own start (`event_schedule_blocks.start_at`)
 * by the caller — never written here as a literal "5:30 PM", which is the
 * mistake `05` §4 calls out by name.
 */
export function lensNote(args: {
  state: LensState;
  /** The seated block's start, already formatted — "5:30 PM". Null if none. */
  opensAt: string | null;
  /** The loudest table's LABEL, for the reception line. */
  loudestLabel: string | null;
  /** How many other tables were shooting at this minute. */
  alsoShooting: number;
  /** True when this reader may not have the guests' layer at all. */
  heatWithheld: boolean;
}): string {
  switch (args.state) {
    case 'no_venue':
      return 'No seating plan for this day — the plan belongs to the reception venue, on the day it is used. A celebration that moves never gets one at all.';
    case 'not_built':
      return 'The room had not been drawn yet. The seating plan is a different thing again, and appears only when the reception opens.';
    case 'ceremony':
      return args.opensAt
        ? `The ceremony — the room is in rows facing the front, with no tables. Assigned seats begin when the reception opens, ${args.opensAt}; until then a photograph belongs to a person, not to a table.`
        : 'The ceremony — the room is in rows facing the front, with no tables. Assigned seats begin when the reception opens; until then a photograph belongs to a person, not to a table.';
    case 'designed':
      return args.opensAt
        ? `The room, as it was designed. The seating plan opens with the reception, ${args.opensAt}.`
        : 'The room, as it was designed. The seating plan opens with the reception.';
    case 'reception':
      if (args.heatWithheld) {
        return 'The room, at this minute. Which tables the photographs came from is the guests’ to share, and this story has not been published yet.';
      }
      if (!args.loudestLabel) {
        return 'The room, at this minute. No photograph of this minute came from a seat.';
      }
      return args.alsoShooting > 0
        ? `Most photographs of this minute came from Table ${args.loudestLabel}. ${args.alsoShooting} other ${args.alsoShooting === 1 ? 'table was' : 'tables were'} shooting too.`
        : `Most photographs of this minute came from Table ${args.loudestLabel}.`;
    default:
      return '';
  }
}

/** The small label beside "THE ROOM" in the lens header. */
export function lensStateLabel(state: LensState): string {
  switch (state) {
    case 'no_venue':
      return 'no venue';
    case 'not_built':
      return 'not built yet';
    case 'designed':
      return 'designed';
    case 'ceremony':
      return 'in rows';
    case 'reception':
      return 'the reception';
    default:
      return '';
  }
}
