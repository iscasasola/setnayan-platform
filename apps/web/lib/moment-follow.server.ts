import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { momentAbove } from '@/lib/moment-order';

/**
 * ⏭ WHERE AN UNTIMED MOMENT GOES (owner 2026-11-02, "4 ADDITIONS" (1); migration 20271302727358).
 *
 * A moment saved "right after the one above" stores no clock: `time_tba` is set, `follows_block_id` names the moment it
 * follows, and `start_at` takes THAT moment's start — an order key, never a guessed time (and never a midnight). The
 * database moves it whenever its anchor moves.
 *
 * Which moment is "the one above": the one the host named (`follows_block_id`, a moment of the same chapter), else
 * the one directly above it in run order — for a new moment, the last one in the chapter. The first moment of a
 * chapter follows nothing and takes the chapter's own start as its key ("right after the chapter begins").
 *
 * Returns null when `blockId` is a CHAPTER (a chapter's TBA is "Time TBA", handled by the caller as before). Reads on
 * the caller's own session — RLS decides what it may see, exactly as for the write that follows.
 */
export type RightAfterPlace = { start_at: string; follows_block_id: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Sibling = {
  block_id: string;
  start_at: string;
  sort_order: number | null;
  time_tba: boolean | null;
  follows_block_id: string | null;
};

export async function rightAfterPlace(
  supabase: SupabaseClient,
  input: { eventId: string; blockId: string | null; parentBlockId: string | null; followsRaw: unknown },
): Promise<RightAfterPlace | null> {
  let parent = input.parentBlockId;
  if (input.blockId) {
    const { data: row, error } = await supabase
      .from('event_schedule_blocks')
      .select('parent_block_id')
      .eq('block_id', input.blockId)
      .eq('event_id', input.eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    parent = ((row ?? null) as { parent_block_id: string | null } | null)?.parent_block_id ?? null;
  }
  if (!parent) return null;

  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, start_at, sort_order, time_tba, follows_block_id')
    .eq('event_id', input.eventId)
    .eq('parent_block_id', parent);
  if (error) throw new Error(error.message);
  const siblings = (data ?? []) as Sibling[];

  const named = typeof input.followsRaw === 'string' && UUID.test(input.followsRaw) ? input.followsRaw : null;
  let anchor: Sibling | null = named && named !== input.blockId ? (siblings.find((s) => s.block_id === named) ?? null) : null;
  if (named && !anchor) throw new Error('That moment is not in this chapter.');
  anchor ??= momentAbove(siblings, input.blockId);

  // Never a loop: the anchor must not itself (through its own anchors) follow this moment.
  if (anchor && input.blockId) {
    const byId = new Map(siblings.map((s) => [s.block_id, s]));
    let at: Sibling | undefined = anchor;
    for (let i = 0; at && i < siblings.length + 1; i++) {
      if (at.block_id === input.blockId) throw new Error('A moment cannot come right after one that comes after it.');
      at = at.follows_block_id ? byId.get(at.follows_block_id) : undefined;
    }
  }
  if (anchor) return { start_at: anchor.start_at, follows_block_id: anchor.block_id };

  const { data: chapter, error: chapterError } = await supabase
    .from('event_schedule_blocks')
    .select('start_at, time_tba')
    .eq('block_id', parent)
    .eq('event_id', input.eventId)
    .maybeSingle();
  if (chapterError) throw new Error(chapterError.message);
  const start = ((chapter ?? null) as { start_at: string | null } | null)?.start_at;
  if (!start) throw new Error('That chapter is not on this event.');
  return { start_at: start, follows_block_id: null };
}
