/**
 * hub-tool-entries.ts — the rows behind the hub tools drawn with the Checklist, Per-person, Counter, Ordered list, Live
 * timeline and (dated) Plan templates (DECISION_LOG 2026-11-23 "THE TEN MOST-SHARED UNBUILT HUB TOOLS" + "Seven open calls settled" item 3, the
 * free rest; drawing `prototypes/hub_tools_working_2026-10-28/`).
 *
 * A tool is a RECORD (`lib/hub-tools.ts`: key · name · template); its rows live in ONE table, `vendor_hub_tool_entries`,
 * keyed by `tool_key` (an FK to `hub_tools`). The ONE home for every hub tool's rows (controller, DECISION_LOG 23 Nov
 * 2026): Tech rider, Paperwork checklist, Load-in & venue access, Delivery & drop-off (checklist), Personalisation list
 * (per_person), Quantity vs guests and the Queue counter (counter) are keys, not tables, and a later tool on these
 * templates needs no schema. 24 Nov: Ceremony details · Proofs & approval · Safety permit & cue (checklist), Fittings &
 * measurements · Looks per person · Crew roster · Room list (per_person), Chair schedule · Reservation slots · Brackets &
 * scoring (ordered_list — `position` is the order, ▲ ▼ swap it; Brackets keeps a score in `qty`). 24 Nov, part 2:
 * Pick-up times & routes · Itinerary · Serving times · Remembrance schedule · March cue sheet · Rehearsal & cues · Reveal
 * cue (live_timeline — `qty` is the minute of the day, the time as typed; "Next ›" ticks the NOW row) and the Wellness
 * plan (plan — `qty` is the session's calendar day; dates and plain activity words only, no health field). `qty` is
 * read as a time or a day ONLY through `rowMinute` / `rowDay` below (controller, 24 Nov). The Shot list keeps its own couple-read table (`event_shot_list_items`) and nothing else
 * writes there (🔒 lib/no-hub-tool-borrows-the-shot-list.test.ts).
 * Dietary & allergies reads the RSVPs (`vendor_event_dietary_list`), never this table; Set list is Song Desk's own sets
 * (`lib/vendor-sets.ts`).
 *
 * Pure: no React, no database. The server read is `hub-tool-entries.server.ts`; the one writer is `hubToolEntry` in
 * `app/vendor-dashboard/on-the-day/actions.ts`, whose whole decision is `parseHubToolEntryOp` below so a test can call it.
 * 🔒 lib/hub-tool-entries.test.ts
 */
import { HUB_TOOL_LIBRARY, type HubToolTemplate } from '@/lib/hub-tools';

/** The templates whose rows this table holds. */
export const ENTRY_TEMPLATES = ['checklist', 'per_person', 'counter', 'ordered_list', 'live_timeline', 'plan'] as const satisfies readonly HubToolTemplate[];
export type EntryTemplate = (typeof ENTRY_TEMPLATES)[number];

export const ENTRY_LABEL_MAX = 140;
export const ENTRY_NOTE_MAX = 280;
export const ENTRY_QTY_MAX = 100_000;
/** A supplier's list is a working list, not a database: a sane cap per tool per event. */
export const ENTRY_ROWS_MAX = 200;

/**
 * Tools drawn with one of these templates whose rows are READ from elsewhere, never typed into this table — so the one
 * writer refuses them and the reader never asks for them: Dietary & allergies (the RSVP answers,
 * `vendor_event_dietary_list`), Entourage (the couple's own entourage, `loadMarch` → `entourageSheet`), and the two
 * ordered lists Song Desk keeps in its own tables — Set list (`vendor_event_sets`) and Song Desk (the couple's picks) —
 * and the Shot list, whose rows are its own couple-read table (`event_shot_list_items`), shipped or not. The live
 * timelines that run on the couple's own program are read too, never typed here: Run of show, Floor Command, the March
 * and the Emcee script.
 */
export const READ_ONLY_TOOLS = [
  'dietary_and_allergies',
  'entourage',
  'set_list',
  'song_desk',
  'shot_list',
  'run_of_show',
  'floor_command',
  'march',
  'emcee_script',
] as const;

/**
 * Plan tools whose rows are DATED SESSIONS kept here — the Wellness plan: a day and the activity in plain words
 * (controller, 24 Nov: no health or medical field). Every other Plan tool (Floor plan, Tables & seating) draws the
 * couple's own seat plan and keeps no rows here.
 */
export const DATED_TOOLS = ['wellness_plan'] as const;
export function isDatedTool(toolKey: string): boolean {
  return (DATED_TOOLS as readonly string[]).includes(toolKey);
}

/**
 * Ordered-list tools whose rows also keep a SCORE (the row's `qty`, 0 to start): Brackets & scoring — teams in order,
 * each with its points. Every other ordered list is order and words only (`qty` stays NULL).
 */
export const SCORED_TOOLS = ['brackets_and_scoring'] as const;
export function isScoredTool(toolKey: string): boolean {
  return (SCORED_TOOLS as readonly string[]).includes(toolKey);
}

/**
 * The tool's template, when it is one this table serves; null for any other key (or an unknown one). Only a SHIPPED
 * tool keeps rows: a held tool (the privacy pick Insured people list, the owner's call) is refused by the one writer
 * even though its template is served (controller, 24 Nov).
 */
export function entryTemplateOf(toolKey: string): EntryTemplate | null {
  if ((READ_ONLY_TOOLS as readonly string[]).includes(toolKey)) return null;
  const t = HUB_TOOL_LIBRARY.find((x) => x.key === toolKey);
  if (!t || !t.shipped) return null;
  if (t.template === 'plan' && !isDatedTool(toolKey)) return null;
  return (ENTRY_TEMPLATES as readonly string[]).includes(t.template) ? (t.template as EntryTemplate) : null;
}

/** One row as stored. */
export type HubToolEntryRow = {
  entry_id: string;
  tool_key: string;
  label: string;
  note: string | null;
  position: number;
  done_at: string | null;
  qty: number | null;
};

/** One row as a tool draws it. */
export type HubToolEntry = {
  id: string;
  label: string;
  note: string;
  done: boolean;
  qty: number;
};

export function entryFromRow(r: HubToolEntryRow): HubToolEntry {
  return { id: r.entry_id, label: r.label, note: r.note ?? '', done: r.done_at != null, qty: r.qty ?? 0 };
}

/** A tool's rows, honestly: `unread` is never an empty list. */
export type EntriesRead = { state: 'ok'; entries: HubToolEntry[] } | { state: 'unread' };

/** Group a read of several tools' rows by tool, in position order. Unknown keys are dropped. */
export function groupEntries(rows: readonly HubToolEntryRow[], toolKeys: readonly string[]): Map<string, HubToolEntry[]> {
  const out = new Map<string, HubToolEntry[]>(toolKeys.map((k) => [k, []]));
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  for (const r of sorted) out.get(r.tool_key)?.push(entryFromRow(r));
  return out;
}

// ── WHEN A ROW HAPPENS — the ONE reading of `qty` as a time or a day (controller, 24 Nov) ──────────────────────
// A live-timeline row keeps its time as the MINUTE OF THE DAY, the clock as typed (Manila wall time — no zone is
// applied, so 2:00 PM stays 2:00 PM); a Wellness plan row keeps its CALENDAR DAY as days since 1970-01-01. Nothing
// else reads `qty` as either: a screen asks these four.

export const DAY_MINUTES = 24 * 60;

/** A live-timeline row's minute of the day (0–1439); null when the number is not one (never read as midnight). */
export function rowMinute(qty: number | null | undefined): number | null {
  return typeof qty === 'number' && Number.isInteger(qty) && qty >= 0 && qty < DAY_MINUTES ? qty : null;
}

/** "14:05" → 845, to store; null for anything that is not a time. */
export function minuteQty(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** 845 → "14:05" (what the time picker holds); '' when the row has no time. */
export function hhmmOf(qty: number | null | undefined): string {
  const at = rowMinute(qty);
  return at === null ? '' : `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}

const DAY_MS = 86_400_000;

/** A Wellness plan row's calendar day ("2026-11-28"); null when the number is not one. */
export function rowDay(qty: number | null | undefined): string | null {
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 0 || qty > ENTRY_QTY_MAX) return null;
  return new Date(qty * DAY_MS).toISOString().slice(0, 10);
}

/** "2026-11-28" → its day number, to store; null for a date that does not exist. */
export function dayQty(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return null;
  const at = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const n = at / DAY_MS;
  // A day that rolled over (Feb 30 → Mar 2) is not the day typed.
  if (!Number.isInteger(n) || rowDay(n) !== day.trim()) return null;
  return n;
}

/** Trim and collapse a typed line; '' when nothing is left. */
export function cleanLine(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').trim().slice(0, max);
}

// ── THE ONE WRITER'S DECISION ──────────────────────────────────────────────

export type HubToolEntryOp =
  | { op: 'add'; toolKey: string; label: string; note: string | null; qty: number | null }
  | { op: 'edit'; entryId: string; label: string; note: string | null }
  | { op: 'tick'; entryId: string; done: boolean }
  | { op: 'count'; entryId: string; qty: number }
  | { op: 'move'; entryId: string; dir: 'up' | 'down' }
  | { op: 'remove'; entryId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function qtyOf(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > ENTRY_QTY_MAX) return null;
  return v;
}

/**
 * The dispatcher's input, validated. Refuses (an error a person can read) an unknown op, a tool this table does not
 * serve, an empty label, a bad id, a count out of range or a move with no direction. A counter row starts at its given
 * count (0 when none); a scored ordered-list row starts at 0; every other row has no count.
 */
export function parseHubToolEntryOp(input: unknown): { ok: true; op: HubToolEntryOp } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Nothing to save.' };
  const o = input as Record<string, unknown>;
  const id = typeof o.entryId === 'string' && UUID.test(o.entryId) ? o.entryId : null;
  switch (o.op) {
    case 'add': {
      const toolKey = typeof o.toolKey === 'string' ? o.toolKey : '';
      const template = entryTemplateOf(toolKey);
      if (!template) return { ok: false, error: 'That tool can’t hold rows.' };
      const label = cleanLine(o.label, ENTRY_LABEL_MAX);
      if (!label) return { ok: false, error: template === 'per_person' ? 'Type a name first.' : 'Type something first.' };
      const note = cleanLine(o.note, ENTRY_NOTE_MAX) || null;
      if (template === 'live_timeline') {
        const at = rowMinute(typeof o.qty === 'number' ? o.qty : null);
        if (at === null) return { ok: false, error: 'Pick a time first.' };
        return { ok: true, op: { op: 'add', toolKey, label, note, qty: at } };
      }
      if (template === 'plan') {
        const day = typeof o.qty === 'number' && rowDay(o.qty) ? o.qty : null;
        if (day === null) return { ok: false, error: 'Pick a date first.' };
        // Dates and plain activity words only — a Wellness plan row keeps no note (no health field).
        return { ok: true, op: { op: 'add', toolKey, label, note: null, qty: day } };
      }
      if (template === 'counter') {
        const qty = o.qty === undefined || o.qty === null ? 0 : qtyOf(o.qty);
        if (qty === null) return { ok: false, error: 'That number is out of range.' };
        return { ok: true, op: { op: 'add', toolKey, label, note: null, qty } };
      }
      return { ok: true, op: { op: 'add', toolKey, label, note, qty: template === 'ordered_list' && isScoredTool(toolKey) ? 0 : null } };
    }
    case 'edit': {
      if (!id) return { ok: false, error: 'That row is gone — refresh.' };
      const label = cleanLine(o.label, ENTRY_LABEL_MAX);
      if (!label) return { ok: false, error: 'A row needs words.' };
      return { ok: true, op: { op: 'edit', entryId: id, label, note: cleanLine(o.note, ENTRY_NOTE_MAX) || null } };
    }
    case 'tick':
      if (!id) return { ok: false, error: 'That row is gone — refresh.' };
      if (typeof o.done !== 'boolean') return { ok: false, error: 'Nothing to save.' };
      return { ok: true, op: { op: 'tick', entryId: id, done: o.done } };
    case 'count': {
      if (!id) return { ok: false, error: 'That row is gone — refresh.' };
      const qty = qtyOf(o.qty);
      if (qty === null) return { ok: false, error: 'That number is out of range.' };
      return { ok: true, op: { op: 'count', entryId: id, qty } };
    }
    case 'move':
      if (!id) return { ok: false, error: 'That row is gone — refresh.' };
      if (o.dir !== 'up' && o.dir !== 'down') return { ok: false, error: 'Nothing to move.' };
      return { ok: true, op: { op: 'move', entryId: id, dir: o.dir } };
    case 'remove':
      if (!id) return { ok: false, error: 'That row is gone — refresh.' };
      return { ok: true, op: { op: 'remove', entryId: id } };
    default:
      return { ok: false, error: 'Nothing to save.' };
  }
}

/** The position after the last row — gap 100, the playlist's idiom, so a later insert needs no renumber. */
export function nextPosition(positions: readonly number[]): number {
  return (positions.length ? Math.max(...positions) : 0) + 100;
}

/**
 * Swap a row with its neighbour (the Set list's ▲ ▼ — `updateVendorEventSet` `moveSong`). Returns the two rows' new positions, or null at the end of the list (nothing to do).
 * Positions are swapped, never renumbered, so two writes are the whole move.
 */
export function swapWithNeighbour(
  rows: readonly { id: string; position: number }[],
  id: string,
  dir: 'up' | 'down',
): { a: { id: string; position: number }; b: { id: string; position: number } } | null {
  const sorted = [...rows].sort((x, y) => x.position - y.position);
  const i = sorted.findIndex((r) => r.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= sorted.length) return null;
  const me = sorted[i]!;
  const them = sorted[j]!;
  // Equal positions (rows added at once) would swap to the same order — nudge so the move is visible.
  const myNew = them.position === me.position ? me.position + (dir === 'up' ? -1 : 1) : them.position;
  return { a: { id: me.id, position: myNew }, b: { id: them.id, position: me.position } };
}

// ── THE TEMPLATES' READ MODELS ─────────────────────────────────────────────

/**
 * Live timeline (and the dated Plan): the rows in the order they happen — by time (or day), a tie keeping the order
 * they were added, a row with none last — and the NOW row, the first not yet done (the drawing: "Next ›" ticks it and
 * the next one is now). `whenOf` is `rowMinute` or `rowDay`'s day number.
 */
export function runningOrder(
  entries: readonly HubToolEntry[],
  whenOf: (qty: number) => number | null,
): { rows: { entry: HubToolEntry; when: number | null; now: boolean }[]; nowId: string | null; done: number; total: number } {
  const timed = entries.map((entry, i) => ({ entry, when: whenOf(entry.qty), i }));
  timed.sort((a, b) => {
    if (a.when === null || b.when === null) return a.when === b.when ? a.i - b.i : a.when === null ? 1 : -1;
    return a.when - b.when || a.i - b.i;
  });
  const nowId = timed.find((t) => !t.entry.done)?.entry.id ?? null;
  return {
    rows: timed.map((t) => ({ entry: t.entry, when: t.when, now: t.entry.id === nowId })),
    nowId,
    done: entries.filter((e) => e.done).length,
    total: entries.length,
  };
}

/** The dated Plan's day number for `runningOrder` (a row's day, as a number to sort by). */
export function rowDayNumber(qty: number): number | null {
  return rowDay(qty) === null ? null : qty;
}

/** Checklist: ticked of total ("3 of 7 ready"). */
export function checklistProgress(entries: readonly HubToolEntry[]): { done: number; total: number } {
  return { done: entries.filter((e) => e.done).length, total: entries.length };
}

/**
 * Counter against the guests (Quantity vs guests): the count beside the headcount the page already read
 * (`get_vendor_event_brief` pax.attending — the same number the Headcount row shows; never re-counted here).
 * `base` null = the headcount could not be read: the bar and the gap are not drawn, never "of 0".
 */
export type CounterModel = {
  qty: number;
  base: number | null;
  /** 0–100, for the bar; null when there is no base. */
  pct: number | null;
  /** How far the count is from the guests: short (fewer than coming) · even · over; null without a base. */
  gap: { kind: 'short' | 'even' | 'over'; by: number } | null;
};

export function counterModel(qty: number, attending: number | null): CounterModel {
  if (attending == null || !Number.isFinite(attending) || attending < 0) return { qty, base: null, pct: null, gap: null };
  const base = Math.floor(attending);
  if (base === 0) return { qty, base, pct: qty > 0 ? 100 : 0, gap: qty > 0 ? { kind: 'over', by: qty } : { kind: 'even', by: 0 } };
  const pct = Math.min(100, Math.round((qty / base) * 100));
  const diff = qty - base;
  return { qty, base, pct, gap: diff === 0 ? { kind: 'even', by: 0 } : diff < 0 ? { kind: 'short', by: -diff } : { kind: 'over', by: diff } };
}

/** The two letters on a per-person row ("Maria Reyes" → "MR"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

// ── DIETARY & ALLERGIES — the RSVP answers, read through `vendor_event_dietary_list` ──

export type DietaryGuest = { id: string; name: string; meal: string | null; dietary: string | null; table: string | null };

/**
 * unread      — the read failed: say so, never an empty list;
 * not_food    — this supplier is not booked under a food category (DECISION_LOG 2026-10-28: "shown to the booked caterer
 *               only"): say who the list is for;
 * ok          — the coming guests who wrote a note or picked a meal.
 */
export type DietaryRead =
  | { state: 'unread' }
  | { state: 'not_food' }
  | { state: 'ok'; guests: DietaryGuest[]; withNote: number; meals: { meal: string; count: number }[] };

/** The RPC's answer, parsed defensively. Anything that is not the shape is `unread`, never `ok` with nobody. */
export function dietaryFromRpc(data: unknown, error: unknown): DietaryRead {
  if (error || !data || typeof data !== 'object') return { state: 'unread' };
  const d = data as { allowed?: unknown; guests?: unknown };
  if (d.allowed === false) return { state: 'not_food' };
  if (d.allowed !== true || !Array.isArray(d.guests)) return { state: 'unread' };
  const guests: DietaryGuest[] = [];
  for (const g of d.guests as unknown[]) {
    if (!g || typeof g !== 'object') continue;
    const r = g as Record<string, unknown>;
    if (typeof r.guest_id !== 'string') continue;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    guests.push({ id: r.guest_id, name: str(r.name) ?? 'Guest', meal: str(r.meal), dietary: str(r.dietary), table: str(r.table) });
  }
  const byMeal = new Map<string, number>();
  for (const g of guests) if (g.meal) byMeal.set(g.meal, (byMeal.get(g.meal) ?? 0) + 1);
  const meals = [...byMeal.entries()].map(([meal, count]) => ({ meal, count })).sort((a, b) => b.count - a.count || a.meal.localeCompare(b.meal));
  return { state: 'ok', guests, withNote: guests.filter((g) => g.dietary).length, meals };
}

/** The RSVP's meal keys, said as the RSVP says them (rsvp-widget's options). An unknown key reads as itself. */
const MEAL_WORDS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids',
};
export function mealWord(meal: string): string {
  return MEAL_WORDS[meal] ?? meal.charAt(0).toUpperCase() + meal.slice(1).replace(/_/g, ' ');
}
