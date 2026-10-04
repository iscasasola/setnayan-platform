import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ceremonyBlock } from '@/lib/print-pieces';
import { fromDatetimeLocalValue, shiftWallClockDays, toDatetimeLocalValue, wallClockDayShift } from '@/lib/schedule-datetime-local';

/**
 * 🕒 THE CEREMONY TIME TYPED UNDER THE DATE (owner 2026-10-04, "YES TO ALL" on
 * `prototypes/maker_venues_pin_and_time_2026-10-04_fable.html`, question 2):
 * *"On Apply, a 'Ceremony' block is made on the event date at that time if none
 * exists; if one exists, its time moves. If the date later moves, the ceremony
 * moves with it."*
 *
 * ONE SOURCE, TWO DOORS. The time is not stored anywhere new: it IS the start
 * of the Schedule's Ceremony block — the block the invitation prints
 * (`ceremonyBlock` · `blockTime`, lib/print-pieces.ts) and the Schedule shows.
 * The Maker drafts `ceremony_time` (`HUB_DRAFT_CEREMONY_TIME`); Apply calls
 * here. `start_at` holds the venue's WALL CLOCK in a UTC column, so every value
 * is built and read through `lib/schedule-datetime-local.ts` — never converted.
 *
 * Every write is the couple's OWN session (`event_schedule_blocks` RLS still
 * applies underneath), and every write asks for its rows back: a zero-row
 * UPDATE is success-shaped.
 */

type BlockRow = {
  block_id: string;
  block_type: string | null;
  start_at: string | null;
  end_at: string | null;
  parent_block_id: string | null;
};

const COLUMNS = 'block_id, block_type, start_at, end_at, parent_block_id';

async function readCeremonyBlocks(supabase: SupabaseClient, eventId: string) {
  return supabase.from('event_schedule_blocks').select(COLUMNS).eq('event_id', eventId).eq('block_type', 'ceremony');
}

/**
 * The live ceremony time, `HH:MM` (null = the Schedule has no ceremony). Throws
 * on a refused read — Apply must never compare a draft against a guess.
 */
export async function readLiveCeremonyTime(supabase: SupabaseClient, eventId: string): Promise<string | null> {
  const { data, error } = await readCeremonyBlocks(supabase, eventId);
  if (error) throw new Error(`Could not read the live ceremony time: ${error.message}`);
  const block = ceremonyBlock((data ?? []) as BlockRow[]);
  return block ? toDatetimeLocalValue(block.start_at).slice(11) || null : null;
}

/** `iso` moved by `ms`, kept on the wall clock (pure epoch arithmetic on a UTC-written value). */
function shifted(iso: string | null, ms: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + ms).toISOString() : iso;
}

/**
 * Put the Ceremony block at `day` `time` (both wall clock). `time` null = keep
 * the block's own time (the date moved, the time did not). Creates the block
 * when the Schedule has none and a time was given; otherwise moves the earliest
 * top-level ceremony — its end and its parts (the blocks inside it) by the same
 * amount, so its length and its order never change.
 *
 * Resolves `{ ok: true }` when the block stands where asked (or there was
 * nothing to move), else the reason.
 */
export async function placeCeremonyBlock({
  supabase,
  eventId,
  day,
  time,
  fromDay = null,
}: {
  supabase: SupabaseClient;
  eventId: string;
  /** YYYY-MM-DD — the event's day as it stands after Apply. */
  day: string;
  /** HH:MM, or null to keep the ceremony's own time. */
  time: string | null;
  /**
   * The day the event WAS on, when only the date moved: the ceremony follows
   * only if it stood on that day (a ceremony the couple put on another day —
   * a civil rite the week before — stays where they put it).
   */
  fromDay?: string | null;
}): Promise<{ ok: true; wrote: 'created' | 'moved' | 'none' } | { ok: false; error: string }> {
  const { data, error } = await readCeremonyBlocks(supabase, eventId);
  if (error) return { ok: false, error: error.message };
  const block = ceremonyBlock((data ?? []) as BlockRow[]);

  if (!block) {
    if (!time) return { ok: true, wrote: 'none' };
    const start = fromDatetimeLocalValue(`${day}T${time}`);
    if (!start) return { ok: false, error: 'bad-time' };
    const { data: rows, error: insErr } = await supabase
      .from('event_schedule_blocks')
      .insert({ event_id: eventId, label: 'Ceremony', block_type: 'ceremony', start_at: start, is_public: true })
      .select('block_id');
    if (insErr || !rows?.length) return { ok: false, error: insErr?.message ?? 'no-row' };
    return { ok: true, wrote: 'created' };
  }

  const current = toDatetimeLocalValue(block.start_at);
  if (!time && fromDay && current.slice(0, 10) !== fromDay) return { ok: true, wrote: 'none' };
  const next = fromDatetimeLocalValue(`${day}T${time ?? current.slice(11)}`);
  if (!next || !block.start_at) return { ok: false, error: 'bad-time' };
  const delta = Date.parse(next) - Date.parse(block.start_at);
  if (delta === 0) return { ok: true, wrote: 'none' };

  const { data: moved, error: upErr } = await supabase
    .from('event_schedule_blocks')
    .update({ start_at: next, end_at: shifted(block.end_at, delta), updated_at: new Date().toISOString() })
    .eq('block_id', block.block_id)
    .eq('event_id', eventId)
    .select('block_id');
  if (upErr || !moved?.length) return { ok: false, error: upErr?.message ?? 'no-row' };

  // Its parts walk with it.
  const { data: parts, error: partsErr } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, start_at, end_at')
    .eq('event_id', eventId)
    .eq('parent_block_id', block.block_id);
  if (partsErr) return { ok: false, error: partsErr.message };
  for (const p of (parts ?? []) as Array<{ block_id: string; start_at: string | null; end_at: string | null }>) {
    if (!p.start_at) continue;
    const { error: pErr } = await supabase
      .from('event_schedule_blocks')
      .update({ start_at: shifted(p.start_at, delta), end_at: shifted(p.end_at, delta), updated_at: new Date().toISOString() })
      .eq('block_id', p.block_id)
      .eq('event_id', eventId);
    if (pErr) return { ok: false, error: pErr.message };
  }
  return { ok: true, wrote: 'moved' };
}

/**
 * 📅 THE WHOLE SCHEDULE FOLLOWS THE DATE (owner 2026-10-04, DECISION_LOG
 * "CHANGING THE EVENT DATE MOVES THE WHOLE SCHEDULE", verbatim: *"Yes if
 * possible"*). When Apply moves the event from `fromDay` to `toDay`, EVERY
 * block of the event's Schedule — every type, parents and their parts alike —
 * moves by the same number of days, each keeping its own wall-clock time
 * (`shiftWallClockDays`, the round-trip rule of lib/schedule-datetime-local.ts).
 * Order, lengths and nesting are therefore unchanged.
 *
 * It never creates or deletes a block — placing the ceremony at a typed time
 * stays `placeCeremonyBlock`'s job, run AFTER this one.
 *
 * Only when both days are exact (`YYYY-MM-DD`) and differ: a date that was a
 * month or a year has no day to measure from, so nothing moves (`wrote: 'none'`).
 * The caller asks only when the date really moved in THIS Apply — the live date
 * is then the new one, so pressing Apply again finds no move and is a no-op.
 *
 * The couple's OWN session (RLS on `event_schedule_blocks` still applies), and
 * every write asks for its row back: a zero-row UPDATE is success-shaped.
 */
export async function moveScheduleWithDate({
  supabase,
  eventId,
  fromDay,
  toDay,
}: {
  supabase: SupabaseClient;
  eventId: string;
  /** YYYY-MM-DD the event was on before this Apply, or null when it was not one day. */
  fromDay: string | null;
  /** YYYY-MM-DD the event is on after this Apply, or null when it is not one day. */
  toDay: string | null;
}): Promise<{ ok: true; moved: number } | { ok: false; error: string; moved: number }> {
  const days = wallClockDayShift(fromDay, toDay);
  if (days === 0) return { ok: true, moved: 0 };
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, start_at, end_at')
    .eq('event_id', eventId);
  if (error) return { ok: false, error: error.message, moved: 0 };
  let moved = 0;
  for (const b of (data ?? []) as Array<{ block_id: string; start_at: string | null; end_at: string | null }>) {
    if (!b.start_at && !b.end_at) continue;
    const { data: rows, error: upErr } = await supabase
      .from('event_schedule_blocks')
      .update({
        start_at: shiftWallClockDays(b.start_at, days),
        end_at: shiftWallClockDays(b.end_at, days),
        updated_at: new Date().toISOString(),
      })
      .eq('block_id', b.block_id)
      .eq('event_id', eventId)
      .select('block_id');
    if (upErr || !rows?.length) return { ok: false, error: upErr?.message ?? 'no-row', moved };
    moved += 1;
  }
  return { ok: true, moved };
}
