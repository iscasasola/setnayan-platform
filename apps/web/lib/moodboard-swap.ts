/**
 * Swap the photos in two Mood Board cells — the drag-reorder on the couple's
 * inspiration board (`reorderMoodboardSlot`, studio/mood-board/actions.ts).
 * Within one slot (cell 1 ↔ cell 2) or across slots; the destination may be
 * empty (a plain move).
 *
 * 🔑 WHY THE PHOTO IS PARKED BY `removed_at`, AND NEVER BY A POSITION.
 * `event_inspiration_assets_slot_unique` is UNIQUE(event_id, slot_key,
 * slot_position) WHERE removed_at IS NULL, and Postgres checks a non-deferrable
 * unique index row by row — so a swap cannot just write both rows; one of them
 * has to step out of the index first. This function used to step out by
 * parking the moving photo at `slot_position = -1`, which the table's own
 * CHECK (`event_inspiration_assets_slot_position_check_v2`: IN (1, 2, 3))
 * refuses for every caller. The park ran on every drag, so no drag-reorder
 * ever landed (onto a full cell or an empty one), and the board had already
 * painted the swap, so it looked done until the next reload put it back.
 *
 * Setting `removed_at` is the index's OWN way out (its WHERE clause): the row
 * leaves the index without leaving any constraint, and the landing write clears
 * it again. It is also one of the only three columns a host may UPDATE once
 * PR #7090 narrows the grants (removed_at, slot_key, slot_position) — so the
 * swap needs no migration, no new function and no widened CHECK.
 *
 * 🛑 THREE WRITES ARE NOT ONE TRANSACTION, so every write must be SEEN to land:
 * an UPDATE that RLS filters out is not an error, it is zero rows — success-
 * shaped. Each write asks for the row back and counts it, and a write that did
 * not land undoes the ones before it, so a failed move leaves the board as it
 * was (never a photo stranded as removed) and SAYS so.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMoodboardSlotPosition, type MoodboardSlotPosition } from '@/lib/moodboard-slots';

export type MoodboardCell = { slotKey: string; slotPosition: MoodboardSlotPosition };

export type MoodboardSwapResult =
  | { ok: true; changed: 'swapped' | 'moved' | 'nothing' }
  | { ok: false; message: string };

const TABLE = 'event_inspiration_assets';

export const SWAP_FAILED_MESSAGE = 'Could not move that photo — please try again.';
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

  const findActive = (cell: MoodboardCell) =>
    supabase
      .from(TABLE)
      .select('inspiration_id')
      .eq('event_id', eventId)
      .eq('slot_key', cell.slotKey)
      .eq('slot_position', cell.slotPosition)
      .is('removed_at', null)
      .maybeSingle();

  const [fromRead, toRead] = await Promise.all([findActive(from), findActive(to)]);
  if (fromRead.error || toRead.error) return { ok: false, message: SWAP_FAILED_MESSAGE };
  const fromId = (fromRead.data as { inspiration_id?: string } | null)?.inspiration_id ?? null;
  const toId = (toRead.data as { inspiration_id?: string } | null)?.inspiration_id ?? null;
  // The board showed a photo here and the table holds none — the page is stale.
  if (!fromId) return { ok: false, message: SWAP_STALE_MESSAGE };

  /** One UPDATE of one row, counted: true only when the row came back. */
  const write = async (id: string, patch: Record<string, unknown>): Promise<boolean> => {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('inspiration_id', id)
      .eq('event_id', eventId)
      .select('inspiration_id');
    return !error && Array.isArray(data) && data.length === 1;
  };

  // 1 · Park the moving photo OUTSIDE the partial unique index (its own WHERE clause).
  const parked = await write(fromId, { removed_at: new Date().toISOString() });
  if (!parked) return { ok: false, message: SWAP_FAILED_MESSAGE };

  // 2 · The destination's photo, if any, takes the cell the moving photo left.
  if (toId) {
    const shifted = await write(toId, { slot_key: from.slotKey, slot_position: from.slotPosition });
    if (!shifted) {
      await write(fromId, { removed_at: null });
      return { ok: false, message: SWAP_FAILED_MESSAGE };
    }
  }

  // 3 · Land the moving photo in the destination and bring it back onto the board.
  const landed = await write(fromId, {
    slot_key: to.slotKey,
    slot_position: to.slotPosition,
    removed_at: null,
  });
  if (!landed) {
    if (toId) await write(toId, { slot_key: to.slotKey, slot_position: to.slotPosition });
    await write(fromId, { removed_at: null });
    return { ok: false, message: SWAP_FAILED_MESSAGE };
  }

  return { ok: true, changed: toId ? 'swapped' : 'moved' };
}
