import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ceremonyBlock } from '@/lib/print-pieces';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/schedule-datetime-local';

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
