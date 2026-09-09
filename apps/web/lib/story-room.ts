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

/**
 * The room, as the story reads it.
 *
 * ── ⏳ IT IS READ LIVE, AND THAT IS A DEFECT WITH A DATE ON IT ─────────────
 * Raised by the Story Maker session (S6) 2026-09-09 and VERIFIED HERE against
 * production rather than taken on report:
 *
 *   • `event_tables` has NO soft-delete column — measured, 0 of
 *     `deleted_at` / `archived_at` / `soft_deleted_at`. Every removal is a hard
 *     delete.
 *   • `event_seat_assignments` has none either, and the arranger wipes and
 *     re-solves assignments on every run.
 *
 * So a published story's floor plan is not a record of the night — it is a live
 * view of a working document. The host tidies up after the wedding, re-runs the
 * seating, or reuses the room for the next event, and **the story silently
 * redraws itself or empties**. Nobody is told; the page just quietly stops
 * being true.
 *
 * 🔒 THE FIX THE OWNER AGREED TO: FREEZE THE ROOM AT PUBLISH — write the labels,
 * the positions, the shapes and the per-table counts into the story at the
 * moment it is told, and stop reading the live plan from then on. It is the
 * house pattern already (`moodboard_part_finalizations.design_snapshot`,
 * `event_renders.design_snapshot` — both verified to exist; ⚠ `03` cites
 * `event_moodboard_saves.palette_snapshot` as the precedent and THAT TABLE DOES
 * NOT EXIST in production).
 *
 * ✅ **AND IT IS NOW DONE — in S8's PR, the publish ladder, exactly where this
 * paragraph said it belonged.** `event_editorial.room_snapshot` is written on
 * the first transition to `published`, and `loadStoryRoom` prefers it over the
 * live plan from then on. See `readRoomSnapshot` at the foot of this file for
 * what is frozen, what deliberately is not (the heat), and the one window that
 * is still live (guests-only).
 *
 * 🔑 THE EXPOSURE WAS ZERO WHEN IT WAS CLOSED. Measured 2026-09-09: the one
 * published story owns no room at all, and production held 13 tables across 2
 * events — both drafts. Nothing had silently redrawn yet, and now nothing can.
 */
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

/**
 * The fewest photographs a table may show a reader anything for.
 *
 * ⚖ OWNER RULING 2026-09-09 (put to him by the Story Maker session, S6, and
 * relayed here — surfaced to him again from this side rather than taken as
 * settled). He was asked whether a table with one or two photographs should
 * show its count at all. He said no, withhold it, and HIS REASON WAS NOT THE
 * ONE HE WAS ASKED ABOUT.
 *
 * It was put to him as privacy — a low count, plus what a guest already knows
 * about the seating, can point at one person. His answer:
 *
 *     "this will subconsciously tell them they did not create enough
 *      memories for the story"
 *
 * 🔑 SO THIS IS NOT A PRIVACY FLOOR. It is the rule that THE STORY NEVER PASSES
 * JUDGEMENT ON THE DAY IT IS TELLING, and it generalises well past the floor
 * plan: any small number anywhere in this story reads to the host as a verdict
 * on their wedding. Treat a withheld small count as the house style, not as a
 * seating special case. The reason is the load-bearing half and it is the half
 * that gets lost — which is why it is written here in his words.
 *
 * (It happens to satisfy the privacy question too, which is why one number can
 * serve both. If it is ever raised, raise it for the reason above.)
 */
export const SMALL_COUNTS_ARE_A_VERDICT = 3;

/**
 * The heat a reader may actually be shown — small counts taken out.
 *
 * ⚠ TAKEN OUT, NOT ROUNDED DOWN OR SHOWN AS "a few". A table drawn faintly with
 * its number suppressed still says "this table barely shot anything", which is
 * the verdict the ruling exists to prevent. It leaves the room entirely.
 */
export function heatWorthShowing(heat: readonly TableHeat[]): TableHeat[] {
  return heat.filter((h) => h.captures >= SMALL_COUNTS_ARE_A_VERDICT);
}

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
export function heatClassOf(tableId: string, heat: readonly TableHeat[]): 'hot' | 'warm' | 'cold' {
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
  /**
   * True when photographs came from seats but none of the tables cleared
   * `SMALL_COUNTS_ARE_A_VERDICT`. Keeps the lens from claiming the room was
   * empty when it was only quiet.
   */
  sawSomething?: boolean;
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
        /*
          Two different silences, and saying the wrong one is the whole point of
          the ruling above. `sawSomething` means photographs DID come from
          seats — there were simply too few for the story to make a claim about
          which table was loudest. Telling a host "no photograph of this minute
          came from a seat" when three of them did is both untrue and exactly
          the verdict they must never be handed.
        */
        return args.sawSomething
          ? 'The room, at this minute.'
          : 'The room, at this minute. No photograph of this minute came from a seat.';
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

/* ══════════════════════════════════════════════════════════════════════════
   THE ROOM IS FROZEN AT PUBLISH
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ✅ BUILT — 08 step 1.6 / S8, the publish ladder's own PR. The docblock on
 * `StoryRoom` above records why the live read was a defect; this is the fix it
 * named, in the session it named.
 *
 * At the first transition of a story to `published`, the room as it stood is
 * written into `event_editorial.room_snapshot`, and `loadStoryRoom` reads that
 * instead of the live plan from then on. A host who tidies up, re-runs the
 * seating or reuses the room for the next celebration no longer redraws a story
 * that was already told.
 *
 * 🔒 THE SNAPSHOT CANNOT CARRY A NAME, AND NOT BECAUSE IT IS FILTERED. It is a
 * `StoryRoom`, whose whole field list is the privacy boundary — a label, two
 * percentages and a shape. There is nowhere in this shape to put a person, so
 * freezing it cannot leak one even if the writer is careless.
 *
 * ⚠ WHAT IS *NOT* FROZEN, ON PURPOSE: the HEAT (how many photographs came from
 * each table). That is drawn from captures and rides the consent veto — a guest
 * who withdraws after publish must still come off the plan, so freezing the heat
 * would freeze a withdrawal out. Geometry is a record of the night; the heat is
 * live data about people, and the two must not be stored the same way.
 *
 * ⏭ AND THE GUESTS-ONLY WINDOW IS STILL LIVE, SAID OUT LOUD RATHER THAN LEFT
 * UNSAID: a story sitting at `event` (guests only) is already being read, and
 * its room is still the live plan. `03` §2.8 ties the freeze to PUBLISH and this
 * build does exactly that; widening it to the first guests-only share is a real
 * decision and would be a quiet scope change made in a session that was not
 * asked for one.
 */

/**
 * JSON-safe shape of a frozen room. The stored document, versioned.
 *
 * 🔴 `seats` EXISTS BECAUSE FREEZING THE GEOMETRY ALONE MADE THINGS WORSE, NOT
 * BETTER — raised by S10 against the first cut of this freeze and verified in
 * `loadTableHeat` before it was believed.
 *
 * The heat resolves a photograph to a table through `event_seat_assignments`,
 * LIVE — the same table the seat arranger wipes and re-solves on every run,
 * which is the exact fact that made the geometry worth freezing. Freeze one and
 * not the other and they disagree:
 *
 *   · a guest re-seated at a DIFFERENT table that the frozen plan still draws
 *     lights the WRONG table — on a plan that is otherwise a true record of the
 *     night, so it looks right;
 *   · a guest re-seated at a table created AFTER the freeze is dropped by
 *     `known.has(table)`, and **the night reads quieter than it was** — which
 *     lands on the nerve owner ruling `04` rule 11 exists for.
 *
 * ⚠ AND THE HALF-FREEZE IS WORSE THAN NO FREEZE, which is why this shipped in
 * the same PR rather than after it. Before the freeze, geometry and attribution
 * moved TOGETHER: the plan could be wrong, but it was wrong consistently.
 * Freezing only the geometry is what introduces "looks right and is not".
 *
 * 🔑 GEOMETRY FROZEN · ATTRIBUTION FROZEN · CONSENT LIVE. The counts are still
 * NOT stored — `publicKeyForCapture` subtracts vetoed captures from the frozen
 * buckets at read time, so a guest who withdraws after publish still comes off
 * the plan (`04` rules 6 and 9).
 *
 * 🔒 `seats` IS A SIBLING OF `room`, NEVER A FIELD ON IT. It maps `guest_id` →
 * `event_tables.public_id`, so it carries guest ids — and `StoryRoom` is handed
 * straight to the components that draw the plan. Its field list is the privacy
 * boundary (`04` rule 2, a review blocker); putting the map inside it would
 * hand every renderer a guest roster. `readRoomSnapshot` returns the room and
 * cannot return this; only `readFrozenSeats` can, and only the heat loader
 * calls it.
 */
export type RoomSnapshot = {
  v: 1;
  room: StoryRoom;
  /** `guest_id` → `event_tables.public_id`, as the night was actually seated. */
  seats?: Record<string, string>;
};

const TABLE_SHAPES: ReadonlySet<string> = new Set([
  'round',
  'long_banquet',
  'family_head',
  'sweetheart',
  'serpentine',
]);

export function roomSnapshotOf(
  room: StoryRoom,
  seats?: ReadonlyMap<string, string> | null,
): RoomSnapshot {
  const doc: RoomSnapshot = { v: 1, room };
  if (seats && seats.size > 0) doc.seats = Object.fromEntries(seats);
  return doc;
}

function box(v: unknown): StoryRoom['stage'] {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const nums = [r.xPct, r.yPct, r.wPct, r.hPct].map(Number);
  if (!nums.every((n) => Number.isFinite(n))) return null;
  const [xPct, yPct, wPct, hPct] = nums as [number, number, number, number];
  if (wPct <= 0 || hPct <= 0) return null;
  return { xPct, yPct, wPct, hPct };
}

/**
 * Read a stored snapshot back, or `null`.
 *
 * ⚖ TOTAL AND SUSPICIOUS, like every other reader on this path. A snapshot
 * written by an older build, truncated, or edited by hand must not put the lens
 * into a state it cannot draw — so every field is re-validated with the same
 * rules `loadStoryRoom` applies to the live rows (a table with no position is
 * dropped rather than parked at the origin, where it would sit on the stage and
 * read as a table that was really there).
 *
 * 🔑 `null` MEANS "NOT FROZEN", WHICH FALLS BACK TO THE LIVE PLAN — the same
 * behaviour every story has today. An unreadable snapshot therefore costs the
 * freeze, not the lens; it can never blank a room that exists.
 */
export function readRoomSnapshot(value: unknown): StoryRoom | null {
  if (!value || typeof value !== 'object') return null;
  const doc = value as Record<string, unknown>;
  if (doc.v !== 1) return null;
  const raw = doc.room;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const tables: RoomTable[] = [];
  if (Array.isArray(r.tables)) {
    for (const t of r.tables) {
      if (!t || typeof t !== 'object') continue;
      const row = t as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      const x = Number(row.xPct);
      const y = Number(row.yPct);
      const shape = typeof row.shape === 'string' ? row.shape : '';
      if (!id || !label || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!TABLE_SHAPES.has(shape)) continue;
      tables.push({
        id,
        label,
        xPct: Math.max(0, Math.min(100, x)),
        yPct: Math.max(0, Math.min(100, y)),
        shape: shape as RoomTable['shape'],
      });
    }
  }

  const drawnAt = Number(r.drawnAtMs);
  return {
    seatingSurface: r.seatingSurface === true,
    roaming: r.roaming === true,
    tables,
    seatsAssigned: r.seatsAssigned === true,
    drawnAtMs: Number.isFinite(drawnAt) ? drawnAt : null,
    dance: box(r.dance),
    stage: box(r.stage),
  };
}

/**
 * The frozen seating, or `null` when this story was never frozen.
 *
 * ⛔ WHEN A FREEZE EXISTS IT IS THE ONLY SOURCE — the heat must NOT fall back to
 * the live assignments for a guest the freeze does not name. A guest seated
 * after publish was not seated on the night, and the frozen record is the
 * record; falling back would reintroduce, one guest at a time, exactly the
 * drift the freeze exists to stop. Monotone by construction, like every other
 * gate on this path: it can only ever attribute FEWER photographs, never more.
 *
 * 🔒 THIS IS THE ONLY WAY GUEST IDS LEAVE THE STORED DOCUMENT, and it is why
 * they are not on `StoryRoom`. Its one caller is the heat loader, which turns
 * them into per-table COUNTS and never renders one.
 */
export function readFrozenSeats(value: unknown): ReadonlyMap<string, string> | null {
  if (!value || typeof value !== 'object') return null;
  const doc = value as Record<string, unknown>;
  if (doc.v !== 1) return null;
  const raw = doc.seats;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = new Map<string, string>();
  for (const [guestId, tableId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof guestId !== 'string' || !guestId.trim()) continue;
    if (typeof tableId !== 'string' || !tableId.trim()) continue;
    out.set(guestId, tableId);
  }
  return out.size > 0 ? out : null;
}
