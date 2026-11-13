/**
 * 🗓 SCHEDULES HAND IN HAND — part (b), the pure half (owner 2026-11-12, DECISION_LOG "SCHEDULES HAND-IN-HAND part (b)";
 * corpus `Build_Schedules_2026-11-12/schedules-hand-in-hand.html` + `SCHEDULES-AUDIT.md`).
 *
 * The four rules, owner-locked:
 *   1 · When the couple moves a chapter, a supplier's ARRIVE / DONE times STAY (`timesThatStay`). The supplier's
 *       schedule card says "Ceremony is now 30 min later than you planned" (`scheduleChangeLine` → the chat line).
 *   2 · A supplier's "done" time WARNS the couple before Save, never blocks: "<Shop> is done at 10:30 PM — ask them?"
 *       (`doneWarnings`). Lock my times still refuses, as shipped (`refuseLockedPart`).
 *   3 · The schedule card PINS in the supplier's chat until they press Seen (the shipped `supplier_mark_schedule`
 *       'seen' — `scheduleChangePinned`). A change the host applied needs no other answer.
 *   4 · A venue's booked row shows only the chapter held in THAT hall (`bookedRowHours`), from the hall↔chapter link
 *       the venue already sets (`hours_vendor_id`, the column `apply_venue_hours` writes — see `venueHoursRefusal`).
 *
 * A supplier's arrive / done are not a column: they are the two moments My times asks for (`timesRequests` in
 * `lib/supplier-schedule.ts`), "<shop> arrives" / "<shop> is done", tagged to their booking. This module reads them by
 * exactly those words — the ONE place both sides spell them is `TIMES_SUFFIX` below, which `timesRequests` writes with.
 *
 * Pure: no I/O, no React. The server and the sheets call it.
 */
import { clockWords, wallDay } from './schedule-chapters';

/** The words My times writes after the shop's name — read back here, never re-typed anywhere else. */
export const TIMES_SUFFIX = { arrive: ' arrives', done: ' is done' } as const;

export type SupplierTime = keyof typeof TIMES_SUFFIX;

type TaggedMoment = { label: string | null; responsible_vendor_ids?: readonly string[] | null };

/**
 * Each booking's shop name(s), by the booking row (`event_vendors.vendor_id`) — the name My times writes in front of its
 * words. A booking may carry two (the shop's own name and the name the host booked it under); either one counts.
 */
export type ShopNames = ReadonlyMap<string, readonly (string | null | undefined)[]>;

/** One booking → its names, from the rows a page already holds ({ id, name }). */
export function shopNamesOf(rows: readonly { id: string; name: string | null | undefined }[]): ShopNames {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const n = (r.name ?? '').trim();
    if (!n) continue;
    const list = out.get(r.id) ?? [];
    if (!list.includes(n)) list.push(n);
    out.set(r.id, list);
  }
  return out;
}

/**
 * Is this moment a supplier's own arrive / done? ALL THREE must hold: the words My times wrote, a booking tagged on it,
 * AND the label STARTS WITH that booking's shop name (ruling 5574 #7). "Bride arrives" with no supplier on it, and
 * "Bridal car arrives" with the car hire tagged on it, are the couple's moments — they move with their chapter like any
 * other. A booking whose name was not read keeps nothing (the moment moves, as shipped) rather than guessing.
 */
export function supplierTimeOf(m: TaggedMoment, shops: ShopNames): SupplierTime | null {
  if (!m.responsible_vendor_ids || m.responsible_vendor_ids.length === 0) return null;
  const label = (m.label ?? '').trim();
  const lower = label.toLowerCase();
  const named = m.responsible_vendor_ids.some((id) =>
    (shops.get(id) ?? []).some((n) => {
      const name = (n ?? '').trim().toLowerCase();
      return name.length > 0 && lower.startsWith(name);
    }),
  );
  if (!named) return null;
  for (const kind of ['arrive', 'done'] as const) {
    const suffix = TIMES_SUFFIX[kind];
    if (label.length > suffix.length && label.endsWith(suffix)) return kind;
  }
  return null;
}

/** "Rosa Lens Studio is done" → "Rosa Lens Studio" (the shop's name as My times wrote it). */
export function shopOfTime(label: string | null): string {
  const t = (label ?? '').trim();
  for (const suffix of Object.values(TIMES_SUFFIX)) if (t.endsWith(suffix)) return t.slice(0, -suffix.length).trim() || 'The supplier';
  return t || 'The supplier';
}

/**
 * 1 · The moments a chapter move must LEAVE where they are: every supplier arrive / done inside it. The chapter and
 * every other moment move together, as shipped (`move_schedule_chapter`).
 */
export function timesThatStay<M extends TaggedMoment & { block_id: string; parent_block_id: string | null }>(
  chapterId: string,
  moments: readonly M[],
  shops: ShopNames,
): string[] {
  return moments.filter((m) => m.parent_block_id === chapterId && supplierTimeOf(m, shops) !== null).map((m) => m.block_id);
}

/** Whole minutes as the card says them: "30 min" · "1 hr" · "1 hr 15 min" · "1 day 2 hr". */
export function durationWords(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mi = m % 60;
  const parts = [d ? `${d} day${d === 1 ? '' : 's'}` : '', h ? `${h} hr` : '', mi ? `${mi} min` : ''].filter(Boolean);
  return parts.join(' ') || '0 min';
}

/** "30 min later" · "1 hr earlier"; null when it did not move. */
export function shiftWords(minutes: number): string | null {
  const m = Math.round(minutes);
  if (!Number.isFinite(m) || m === 0) return null;
  return `${durationWords(m)} ${m > 0 ? 'later' : 'earlier'}`;
}

/**
 * The chat line a chapter move posts in each booked supplier's conversation (both sides read it; the stream draws it
 * as the schedule card — `scheduleChangeFromLine` in `lib/chat-card-lines.ts` reads these exact words back):
 *
 *     Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later
 *
 * Null when the chapter did not move or a time is unreadable — no line is better than a wrong one.
 */
export function scheduleChangeLine(args: { label: string | null; fromIso: string | null; toIso: string | null }): string | null {
  if (!args.fromIso || !args.toIso) return null;
  const a = Date.parse(args.fromIso);
  const b = Date.parse(args.toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const shift = shiftWords((b - a) / 60_000);
  if (!shift) return null;
  const label = (args.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'A chapter';
  return `Schedule changed · ${label} · ${clockWords(args.fromIso)} → ${clockWords(args.toIso)} · ${shift}`;
}

/** The card's headline, per reader: "Ceremony is now 30 min later than you planned" / "…than Rosa planned". */
export function scheduleChangeHeadline(chapter: string, shift: string, planner: string): string {
  return `${chapter} is now ${shift} than ${planner} planned`;
}

/**
 * 3 · The card pins on the supplier's side while the newest schedule line is newer than their Seen. Never seen = pinned.
 * An unreadable time is not "seen".
 */
export function scheduleChangePinned(lineAt: string | null | undefined, seenAt: string | null | undefined): boolean {
  if (!lineAt) return false;
  const line = Date.parse(lineAt);
  if (!Number.isFinite(line)) return false;
  const seen = seenAt ? Date.parse(seenAt) : NaN;
  return !Number.isFinite(seen) || line > seen;
}

/* ── 2 · the "done" warning ───────────────────────────────────────────────────────────────────────────────────── */

export type DoneWarning = { blockId: string; shop: string; at: string; line: string };

/**
 * The suppliers whose "is done" falls BEFORE the chapter, as it will be once saved, is over (its end, or its start
 * when it has none). Words only — Save still saves ("never blocks"); "ask them?" opens the shipped ask.
 */
export function doneWarnings(
  next: { start_at: string | null; end_at: string | null },
  chapterId: string,
  moments: ReadonlyArray<TaggedMoment & { block_id: string; parent_block_id: string | null; start_at: string | null }>,
  shops: ShopNames,
): DoneWarning[] {
  const last = Date.parse(next.end_at ?? next.start_at ?? '');
  if (!Number.isFinite(last)) return [];
  const out: DoneWarning[] = [];
  for (const m of moments) {
    if (m.parent_block_id !== chapterId || supplierTimeOf(m, shops) !== 'done' || !m.start_at) continue;
    const done = Date.parse(m.start_at);
    if (!Number.isFinite(done) || done >= last) continue;
    const shop = shopOfTime(m.label);
    out.push({ blockId: m.block_id, shop, at: m.start_at, line: `${shop} is done at ${clockWords(m.start_at)} — ask them?` });
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/**
 * The ONE gate both doors run before a chapter's new time saves — Chapter details' Starts / Ends / Date AND the desktop
 * board's drag (`moveChapter`): only a crossing that is NEW warns (one already true before this edit was already said).
 */
export function newDoneWarnings(
  was: { start_at: string | null; end_at: string | null },
  next: { start_at: string | null; end_at: string | null },
  chapterId: string,
  moments: ReadonlyArray<TaggedMoment & { block_id: string; parent_block_id: string | null; start_at: string | null }>,
  shops: ShopNames,
): DoneWarning[] {
  const already = new Set(doneWarnings(was, chapterId, moments, shops).map((w) => w.blockId));
  return doneWarnings(next, chapterId, moments, shops).filter((w) => !already.has(w.blockId));
}

/* ── 4 · the supplier's booked row ────────────────────────────────────────────────────────────────────────────── */

export type HoursChapter = {
  block_id: string;
  label: string;
  start_at: string | null;
  end_at: string | null;
  time_tba: boolean | null;
  responsible_vendor_ids: readonly string[] | null;
  /** 🏛 The venue booking that holds this chapter's hours (`apply_venue_hours`). */
  hours_vendor_id: string | null;
};

export type HoursMoment = { label: string | null; start_at: string | null; responsible_vendor_ids: readonly string[] | null; parent_block_id: string | null };

function span(cs: readonly HoursChapter[]): string | null {
  const timed = cs.filter((c) => c.start_at && c.time_tba !== true).sort((a, b) => Date.parse(a.start_at!) - Date.parse(b.start_at!));
  if (timed.length === 0) return null;
  const first = timed[0]!;
  const ends = timed.map((c) => c.end_at ?? c.start_at!).sort((a, b) => Date.parse(a) - Date.parse(b));
  const last = ends[ends.length - 1]!;
  return last === first.start_at ? `${clockWords(first.start_at)} onward` : `${clockWords(first.start_at)} – ${clockWords(last)}`;
}

/**
 * A booked day's second line: the event's hours (first chapter → last) and, once the host OK'd them, this booking's
 * own arrive · done. A HALL (one of a venue's halls, booked as its own calendar) reads only the chapter held in THAT
 * hall — `hours_vendor_id` is this booking — or, before the venue sent its hours, the chapter the booking is linked to
 * (Where). A hall with neither says no hours rather than the whole event's.
 */
export function bookedRowHours(args: {
  bookedDate: string;
  /** The booking row (`event_vendors.vendor_id`) this calendar holds. */
  bookingId: string;
  isHall: boolean;
  chapters: readonly HoursChapter[];
  moments: readonly HoursMoment[];
  /** This booking's shop name(s) — only a moment that starts with one is the shop's own time. */
  shops: ShopNames;
}): { hours: string | null; mine: string | null } {
  const onDay = args.chapters.filter((c) => wallDay(c.start_at) === args.bookedDate);
  let hours: string | null;
  if (args.isHall) {
    const held = onDay.filter((c) => c.hours_vendor_id === args.bookingId);
    const linked = held.length > 0 ? held : onDay.filter((c) => (c.responsible_vendor_ids ?? []).includes(args.bookingId));
    hours = linked.length > 0 ? `${linked.map((c) => c.label.trim() || 'A chapter').join(', ')} · ${span(linked) ?? 'Time TBA'}` : null;
  } else {
    // ⏰ A booked day whose chapters are all Time TBA says so (ruling 5606 #4) — never "Booked here" as if unknown.
    hours = onDay.length > 0 ? (span(onDay) ?? 'Time TBA') : null;
  }
  const dayIds = new Set(onDay.map((c) => c.block_id));
  const mineOf = (kind: SupplierTime) =>
    args.moments
      .filter(
        (m) =>
          m.start_at &&
          m.parent_block_id &&
          dayIds.has(m.parent_block_id) &&
          (m.responsible_vendor_ids ?? []).includes(args.bookingId) &&
          supplierTimeOf(m, args.shops) === kind,
      )
      .map((m) => m.start_at!)
      .sort((a, b) => Date.parse(a) - Date.parse(b));
  const arrive = mineOf('arrive')[0];
  const dones = mineOf('done');
  const done = dones[dones.length - 1];
  const mine = [arrive ? `you arrive ${clockWords(arrive)}` : '', done ? `done ${clockWords(done)}` : ''].filter(Boolean).join(' · ');
  return { hours, mine: mine || null };
}

/* ── Chapter details' Starts ▾ / Ends ▾ — the quarter-hour choices ─────────────────────────────────────────────── */

/** The same window the day's "Add a moment" Starts ▾ offers (`startOptions`, day-sheets): 5:00 AM to 11:45 PM. */
const FIRST_QUARTER = 5 * 60;
const LAST_QUARTER = 23 * 60 + 45;

const minutesOf = (hhmm: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hhmmOf = (mins: number): string => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
/** "14:30" → "2:30 PM". */
export function hhmmWords(hhmm: string): string {
  const m = minutesOf(hhmm);
  if (m === null) return '';
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * A ▾ that OPENS its choices (house rule — a dropdown never cycles): every quarter hour of the day, plus the time held
 * now when it sits off that grid, so the pill never reads blank. Each says what it does against the plan: "as planned",
 * "30 min later · ends 6:30 PM" (Starts — the end comes along), "1 hr later" (Ends). `none` puts a first choice that
 * clears it (Starts → Time TBA, Ends → no end).
 */
export function quarterHourChoices(args: {
  current: string;
  /** Starts only: the end as it stands ("22:00"), so each choice says where the end lands. */
  end?: string | null;
  none?: string | null;
}): Array<{ key: string; label: string; hint?: string }> {
  const now = minutesOf(args.current);
  const end = args.end ? minutesOf(args.end) : null;
  const mins: number[] = [];
  for (let m = FIRST_QUARTER; m <= LAST_QUARTER; m += 15) mins.push(m);
  if (now !== null && !mins.includes(now)) mins.push(now);
  mins.sort((a, b) => a - b);
  const out: Array<{ key: string; label: string; hint?: string }> = args.none ? [{ key: '', label: args.none }] : [];
  for (const m of mins) {
    const key = hhmmOf(m);
    let hint: string | undefined;
    if (now !== null) {
      const shift = shiftWords(m - now);
      if (!shift) hint = 'as planned';
      else if (end !== null) hint = `${shift} · ends ${hhmmWords(hhmmOf((((end + (m - now)) % 1440) + 1440) % 1440))}`;
      else hint = shift;
    }
    out.push({ key, label: hhmmWords(key), ...(hint ? { hint } : {}) });
  }
  return out;
}
