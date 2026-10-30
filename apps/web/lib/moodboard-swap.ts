/**
 * Swap the photos in two Mood Board cells — the drag-reorder on the couple's
 * inspiration board (`reorderMoodboardSlot`, studio/mood-board/actions.ts).
 * Within one slot (cell 1 ↔ cell 2) or across slots; the destination may be
 * empty (a plain move, one write).
 *
 * 🔑 WHY THE MOVING PHOTO IS PARKED ON A FREE REAL CELL.
 * `event_inspiration_assets_slot_unique` is UNIQUE(event_id, slot_key,
 * slot_position) WHERE removed_at IS NULL, and Postgres checks a non-deferrable
 * unique index row by row — so a swap cannot just write both rows; the moving
 * photo has to step aside first. Where it steps is fenced on every side:
 *   · NOT `slot_position = -1` (what this used to do): the CHECK
 *     `event_inspiration_assets_slot_position_check_v2` allows only 1, 2, 3, so
 *     every drag was refused for every caller and no reorder ever landed;
 *   · NOT a made-up `slot_key`: `event_inspiration_assets_slot_key_is_a_part`
 *     is a FOREIGN KEY to `inspiration_parts`;
 *   · NOT `removed_at`: a change to it is a REMOVAL to the rest of the system —
 *     #7089's `couple_photo_shares_follow_the_board` trigger withdraws a photo's
 *     supplier share on it, so a reorder would silently pull a shared photo off
 *     the supplier's card.
 * So it parks on an EMPTY real cell of the same event — the same slot first,
 * then the destination's slot, then any part — writing only `slot_key` and
 * `slot_position`. Those are two of the three columns a host may UPDATE once
 * #7090 narrows the grants, and neither is watched by that trigger. With no
 * empty cell anywhere the move is refused honestly ("make room first").
 *
 * 🛑 THREE WRITES ARE NOT ONE TRANSACTION, so every write must be SEEN to land:
 * an UPDATE that RLS filters out is not an error, it is zero rows — success-
 * shaped. Each write asks for the row back and counts it, and a write that did
 * not land undoes the ones before it, so a failed move leaves the board as it
 * was and SAYS so.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MOODBOARD_SLOT_POSITIONS,
  isMoodboardSlotPosition,
  type MoodboardSlotPosition,
} from '@/lib/moodboard-slots';

export type MoodboardCell = { slotKey: string; slotPosition: MoodboardSlotPosition };

export type MoodboardSwapResult =
  | { ok: true; changed: 'swapped' | 'moved' | 'nothing' }
  | { ok: false; message: string };

const TABLE = 'event_inspiration_assets';

export const SWAP_FAILED_MESSAGE = 'Could not move that photo — please try again.';
export const SWAP_FULL_MESSAGE = 'Make room first — every cell is full.';
export const SWAP_STALE_MESSAGE = 'This board changed since it opened — refresh the page.';

function isCell(value: unknown): value is MoodboardCell {
  if (!value || typeof value !== 'object') return false;
  const v = value as { slotKey?: unknown; slotPosition?: unknown };
  return typeof v.slotKey === 'string' && v.slotKey.length > 0 && isMoodboardSlotPosition(v.slotPosition);
}

export async function swapMoodboardCells(
  supabase: SupabaseClient,
  eventId: string,
  from: MoodboardCell,
  to: MoodboardCell,
): Promise<MoodboardSwapResult> {
  if (typeof eventId !== 'string' || !eventId || !isCell(from) || !isCell(to)) {
    return { ok: false, message: SWAP_FAILED_MESSAGE };
  }
  if (from.slotKey === to.slotKey && from.slotPosition === to.slotPosition) {
    return { ok: true, changed: 'nothing' };
  }

  // ONE read of the board: both cells, and every cell that is free to park on.
  const { data: boardRows, error: boardErr } = await supabase
    .from(TABLE)
    .select('inspiration_id, slot_key, slot_position')
    .eq('event_id', eventId)
    .is('removed_at', null);
  if (boardErr || !Array.isArray(boardRows)) return { ok: false, message: SWAP_FAILED_MESSAGE };
  const cellKey = (slotKey: string, slotPosition: number) => `${slotKey}:${slotPosition}`;
  const held = new Map<string, string>();
  for (const r of boardRows as Array<{ inspiration_id: string; slot_key: string; slot_position: number }>) {
    held.set(cellKey(r.slot_key, r.slot_position), r.inspiration_id);
  }
  const fromId = held.get(cellKey(from.slotKey, from.slotPosition)) ?? null;
  const toId = held.get(cellKey(to.slotKey, to.slotPosition)) ?? null;
  // The board showed a photo here and the table holds none — the page is stale.
  if (!fromId) return { ok: false, message: SWAP_STALE_MESSAGE };

  /** One UPDATE of one row's cell, counted: true only when the row came back. */
  const place = async (id: string, cell: { slotKey: string; slotPosition: number }): Promise<boolean> => {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ slot_key: cell.slotKey, slot_position: cell.slotPosition })
      .eq('inspiration_id', id)
      .eq('event_id', eventId)
      .is('removed_at', null)
      .select('inspiration_id');
    return !error && Array.isArray(data) && data.length === 1;
  };

  // An empty destination needs no parking: one write.
  if (!toId) {
    return (await place(fromId, to))
      ? { ok: true, changed: 'moved' }
      : { ok: false, message: SWAP_FAILED_MESSAGE };
  }

  const park = await findFreeCell(supabase, [from.slotKey, to.slotKey], (k, p) => !held.has(cellKey(k, p)));
  if (park === 'error') return { ok: false, message: SWAP_FAILED_MESSAGE };
  if (!park) return { ok: false, message: SWAP_FULL_MESSAGE };

  // 1 · Step the moving photo aside onto the free cell.
  if (!(await place(fromId, park))) return { ok: false, message: SWAP_FAILED_MESSAGE };

  // 2 · The destination's photo takes the cell the moving photo left.
  if (!(await place(toId, from))) {
    await place(fromId, from);
    return { ok: false, message: SWAP_FAILED_MESSAGE };
  }

  // 3 · The moving photo lands in the destination.
  if (!(await place(fromId, to))) {
    await place(toId, to);
    await place(fromId, from);
    return { ok: false, message: SWAP_FAILED_MESSAGE };
  }

  return { ok: true, changed: 'swapped' };
}

/**
 * A free cell to park on: the preferred slots first (the photo's own, then the
 * destination's), then every other part in the taxonomy's order. Only real
 * `inspiration_parts` keys — the FK refuses anything else. `null` = the board
 * is full everywhere; `'error'` = the parts could not be read.
 */
async function findFreeCell(
  supabase: SupabaseClient,
  preferred: string[],
  isFree: (slotKey: string, slotPosition: number) => boolean,
): Promise<{ slotKey: string; slotPosition: MoodboardSlotPosition } | null | 'error'> {
  const firstFree = (slotKey: string) => {
    const pos = MOODBOARD_SLOT_POSITIONS.find((p) => isFree(slotKey, p));
    return pos ? { slotKey, slotPosition: pos } : null;
  };
  for (const k of preferred) {
    const cell = firstFree(k);
    if (cell) return cell;
  }
  const { data, error } = await supabase
    .from('inspiration_parts')
    .select('slot_key')
    .order('sort_order', { ascending: true })
    .order('slot_key', { ascending: true });
  if (error || !Array.isArray(data)) return 'error';
  for (const { slot_key } of data as Array<{ slot_key: string }>) {
    const cell = firstFree(slot_key);
    if (cell) return cell;
  }
  return null;
}
