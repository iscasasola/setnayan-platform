/**
 * ⏰ WHEN GUESTS ARRIVE — ONE MOMENT ON THE SCHEDULE, READ AND WRITTEN IN ONE PLACE.
 *
 * Owner, 2026-10-19 (DECISION_LOG "GUESTS GET A CALL TIME IN THE DRESS CODE — THE SAME FIELD AS 'GUESTS ARRIVE'"), on
 * Studio › Mood Board & Dress Code's Guests row, which had no call time: *"guest call time"*. The guests' arrival
 * already had a home — the programme's FIRST moment, which the invitation card reads as "Guests arrive 2:30 PM"
 * (`app/[slug]/_lib/invitation-card.ts`, `scheduleBlocks[0]`) and Event Details shows as its "Guests arrive" row. So
 * the Guests row's CALL TIME is that moment's start, saved once and shown everywhere — never a second guest time in
 * the dress code.
 *
 * THE TIME (`guestsArriveSource` → `guestsArriveTime`): the first moment a guest may see (public, for Everyone, not a
 * coordinator's unreleased prep — the three conditions of `onlyWhatGuestsMaySee`), in the programme's own order
 * (`sortScheduleBlocks`) — i.e. EXACTLY the invitation's first moment, the line its card prints. The ticket, the
 * checklist, the reminder, Me › Arrive by, Event Details and the Studio's Guests row all read this one.
 *
 * 🔴 IT IS THE FIRST MOMENT EVEN WHEN THAT IS THE CEREMONY (controller 2026-10-20, measured read-only on the owner's
 * live event: cale-ice's programme opens on Ceremony 2:30 PM with no arrival moment, its invitation cover prints that
 * time, and the invitations had gone out). A first cut read "no arrival moment" as "no time" — every plain guest's
 * ticket, checklist and reminder there would have lost the 2:30 PM their invitation states. So: the arrival moment
 * when there is one, else the invitation's first moment for everyone — said WITH its source in the Studio
 * ("2:30 PM · from Ceremony", `guestsArriveFrom`).
 *
 * THE ARRIVAL MOMENT (`guestsArriveMoment`) — what a WRITE retimes: that first moment only when it is an arrival of its
 * own (top-level, not the Ceremony or the Reception). Retiming the "guests' time" must never move the Ceremony; with no
 * arrival moment, setting a time ADDS one before the first moment.
 *
 * THE WRITE (`guestsArriveWrite`): the Schedule's own writers, with their own fields — `updateScheduleBlock` retimes
 * the moment (its day kept; its end kept while it is still after the new start, else carried by its length), and
 * `createScheduleBlock` adds a public "Guests arrive" moment (`pre_ceremony`, the type the Schedule's templates and
 * the setup step "When should guests arrive?" already give it) on the programme's first day. A time at or after the
 * next moment guests see is REFUSED in plain words — it would stop being the first moment, and the guests' time
 * would silently become something else.
 *
 * Pure and client-safe: the Studio, Event Details, the guest's Me and the guard all call these.
 * Held by `lib/guests-have-one-arrival-time.test.ts`.
 */
import { sortScheduleBlocks } from '@/lib/schedule';
import { formatWallClock, toDatetimeLocalValue } from '@/lib/schedule-datetime-local';

/** The columns this reads — a structural subset of `ScheduleBlockRow`, so a page's own rows and a fixture both fit. */
export type ArriveBlock = {
  block_id: string;
  label: string;
  block_type: string;
  start_at: string | null;
  end_at: string | null;
  is_public: boolean;
  sort_order: number;
  parent_block_id: string | null;
  audience?: string | null;
  visibility?: string | null;
};

/** The label and type a NEW arrival moment is given — the Schedule templates' own. */
export const GUESTS_ARRIVE_LABEL = 'Guests arrive';
export const GUESTS_ARRIVE_TYPE = 'pre_ceremony';
/** A new arrival moment's length when nothing follows it (the templates' 30 minutes). */
const NEW_ARRIVAL_MINUTES = 30;

/** What the Guests row says while the programme has no moment guests can see. */
export const GUESTS_ARRIVE_UNSET = 'Set when guests arrive';

/** The three conditions a guest's schedule asks (`onlyWhatGuestsMaySee`), asked of one row — and a start to read. */
function guestsSee(b: ArriveBlock): boolean {
  return b.is_public === true && (b.audience ?? null) === null && b.visibility !== 'coordinator_only' && Boolean(b.start_at);
}

/** The moments guests see, in the programme's order — `[0]` is the invitation's first moment. */
export function guestsMoments<T extends ArriveBlock>(blocks: readonly T[]): T[] {
  return sortScheduleBlocks(blocks.filter(guestsSee) as Array<T & { start_at: string }>);
}

/** ⏰ THE guests' arrival moment — the invitation's first moment, when it is an arrival of its own; else null. */
export function guestsArriveMoment<T extends ArriveBlock>(blocks: readonly T[]): T | null {
  const first = guestsMoments(blocks)[0] ?? null;
  if (!first || first.parent_block_id) return null;
  if (first.block_type === 'ceremony' || first.block_type === 'reception') return null;
  return first;
}

/**
 * The moment the guests' time is READ from — the invitation's first moment (`guestsMoments(blocks)[0]`), whatever it
 * is; `own` = it is an arrival moment of its own (`guestsArriveMoment`). Null only with nothing guests can see.
 */
export function guestsArriveSource<T extends ArriveBlock>(blocks: readonly T[]): { moment: T; own: boolean } | null {
  const first = guestsMoments(blocks)[0] ?? null;
  return first ? { moment: first, own: guestsArriveMoment(blocks) === first } : null;
}

/** "Ceremony" — the moment the time is borrowed from when there is no arrival moment of its own; else null. */
export function guestsArriveFrom(blocks: readonly ArriveBlock[]): string | null {
  const src = guestsArriveSource(blocks);
  return src && !src.own ? src.moment.label.trim() || 'the first moment' : null;
}

/** "2:30 PM" — when guests arrive, as a person reads it (the invitation's first moment); null with no moment at all. */
export function guestsArriveTime(blocks: readonly ArriveBlock[]): string | null {
  const m = guestsArriveSource(blocks)?.moment ?? null;
  return m ? formatWallClock(m.start_at) || null : null;
}

/** "14:30" — the same time as the time field holds it; null with no moment at all. */
export function guestsArriveHhmm(blocks: readonly ArriveBlock[]): string | null {
  const m = guestsArriveSource(blocks)?.moment ?? null;
  const v = m ? toDatetimeLocalValue(m.start_at) : '';
  return v ? v.slice(11, 16) : null;
}

export type GuestsArriveWrite =
  /** `updateScheduleBlock` — the fields it takes (`start_at` / `end_at` as datetime-local values). */
  | { kind: 'update'; fields: { block_id: string; start_at: string; end_at?: string } }
  /** `createScheduleBlock` — the fields it takes. */
  | { kind: 'create'; fields: { label: string; block_type: string; start_at: string; end_at: string; is_public: 'on' } }
  | { kind: 'refuse'; why: string };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "YYYY-MM-DDTHH:MM" plus `minutes`, by the calendar (no timezone — the value is a wall clock). */
function plusMinutes(local: string, minutes: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return local;
  const t = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]! + minutes));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

function minutesBetween(a: string, b: string): number {
  const pa = Date.parse(`${a}:00Z`);
  const pb = Date.parse(`${b}:00Z`);
  return Number.isFinite(pa) && Number.isFinite(pb) ? Math.round((pb - pa) / 60000) : 0;
}

function beforeLine(next: ArriveBlock): string {
  const at = formatWallClock(next.start_at);
  return `Guests arrive before ${next.label.trim() || 'the first moment'}${at ? ` (${at})` : ''} — pick an earlier time.`;
}

/**
 * The write that sets the guests' arrival to `hhmm` — through the Schedule's own writers — or a plain refusal.
 * `eventDate` (`YYYY-MM-DD`) names the day only when the programme has no moment guests see yet.
 */
export function guestsArriveWrite(input: { blocks: readonly ArriveBlock[]; hhmm: string; eventDate: string | null }): GuestsArriveWrite {
  if (!HHMM.test(input.hhmm)) return { kind: 'refuse', why: 'Pick a time.' };
  const seen = guestsMoments(input.blocks);
  const arrive = guestsArriveMoment(input.blocks);
  if (arrive) {
    const was = toDatetimeLocalValue(arrive.start_at);
    const start = `${was.slice(0, 10)}T${input.hhmm}`;
    const next = seen[1] ?? null;
    if (next && start >= toDatetimeLocalValue(next.start_at)) return { kind: 'refuse', why: beforeLine(next) };
    const fields: { block_id: string; start_at: string; end_at?: string } = { block_id: arrive.block_id, start_at: start };
    const end = toDatetimeLocalValue(arrive.end_at);
    if (end && end <= start) fields.end_at = plusMinutes(start, Math.max(1, minutesBetween(was, end)));
    return { kind: 'update', fields };
  }
  const first = seen[0] ?? null;
  const day = first ? toDatetimeLocalValue(first.start_at).slice(0, 10) : /^\d{4}-\d{2}-\d{2}/.test(input.eventDate ?? '') ? input.eventDate!.slice(0, 10) : null;
  if (!day) return { kind: 'refuse', why: 'Set the date of your event first.' };
  const start = `${day}T${input.hhmm}`;
  const firstAt = first ? toDatetimeLocalValue(first.start_at) : null;
  if (first && firstAt && start >= firstAt) return { kind: 'refuse', why: beforeLine(first) };
  const end = plusMinutes(start, NEW_ARRIVAL_MINUTES);
  return {
    kind: 'create',
    fields: { label: GUESTS_ARRIVE_LABEL, block_type: GUESTS_ARRIVE_TYPE, start_at: start, end_at: firstAt && end > firstAt ? firstAt : end, is_public: 'on' },
  };
}

/** The rows a write leaves behind — so the page shows the new time at once, before any read. */
export function afterGuestsArriveWrite(blocks: readonly ArriveBlock[], w: GuestsArriveWrite, newId: string): ArriveBlock[] {
  const stored = (local: string) => `${local}:00.000Z`;
  if (w.kind === 'update') {
    return blocks.map((b) =>
      b.block_id === w.fields.block_id ? { ...b, start_at: stored(w.fields.start_at), ...(w.fields.end_at ? { end_at: stored(w.fields.end_at) } : {}) } : b,
    );
  }
  if (w.kind === 'create') {
    return [
      ...blocks,
      {
        block_id: newId,
        label: w.fields.label,
        block_type: w.fields.block_type,
        start_at: stored(w.fields.start_at),
        end_at: stored(w.fields.end_at),
        is_public: true,
        sort_order: 0,
        parent_block_id: null,
        audience: null,
        visibility: null,
      },
    ];
  }
  return [...blocks];
}

/**
 * The form the Schedule's writer is sent — its own fields (`guestsArriveWrite`), the event, the new moment's id (a quiet
 * Maker write names it, as Studio › Schedule's "Add a moment" does), and the quiet-write field the caller names.
 */
export function guestsArriveForm(eventId: string, w: Exclude<GuestsArriveWrite, { kind: 'refuse' }>, newId: string, quietField: string): FormData {
  const fd = new FormData();
  fd.set('event_id', eventId);
  for (const [k, v] of Object.entries(w.fields)) if (typeof v === 'string') fd.set(k, v);
  if (w.kind === 'create') fd.set('block_id', newId);
  fd.set(quietField, '1');
  return fd;
}
