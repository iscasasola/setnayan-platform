import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readMoodBoardHomeAsks, type MoodBoardHomeAsks } from '@/lib/mood-board-changes';
import { HomeTodayItem } from './home-parts';
import { MoodBoardAsks } from './mood-board-asks';

/**
 * 🖼⏱ THE MOOD BOARD'S LINES OF HOME'S TODAY LIST (owner 2026-10-30: *"So the changes made will show on home and the
 * hosts need to approve it"*): suppliers' photos waiting for Keep · Decline, and the last 24 hours of changes by
 * someone who is not an owner, each with its Undo. See `mood-board-asks.tsx`.
 *
 * ONE read — `mood_board_home_asks` (migration 20271299051148) — for both lists and every viewer: the database decides
 * who sees which (the suggestions for whoever may answer them, the changes for the owners), so there is no read per
 * row and no second membership read. Self-hiding, like `AccessRequestsDoorway` beside it.
 *
 * ⛔ A REFUSED READ IS SAID: the line then says it could not check — never a quiet nothing that reads as "nothing to
 * approve".
 */
/** The Mood Board asks' one read: `ok: false` = refused (said, never "nothing to approve"). */
export type MoodBoardAsksRead = { ok: false } | { ok: true; asks: MoodBoardHomeAsks };

/** ONE read — Home's first screen runs it once for its Today list's rows; the doorway below takes it or reads itself. */
export async function readMoodBoardAsks(eventId: string): Promise<MoodBoardAsksRead> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mood_board_home_asks', { p_event_id: eventId });
  const asks = error ? null : readMoodBoardHomeAsks(data);
  if (!asks) {
    if (error) logQueryError('MoodBoardAsksDoorway.read', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }
  return { ok: true, asks };
}

export async function MoodBoardAsksDoorway({ eventId, read }: { eventId: string; read?: MoodBoardAsksRead }) {
  const got = read ?? (await readMoodBoardAsks(eventId));
  const asks = got.ok ? got.asks : null;
  if (!asks) {
    return (
      <HomeTodayItem
        reload
        tone="warn"
        words="We couldn’t check the Mood Board for changes"
        tail="Try again"
        dataAttr={['data-mood-board-asks', 'unread']}
      />
    );
  }
  if (asks.suggestions.length === 0 && asks.changes.length === 0) return null;
  return <MoodBoardAsks eventId={eventId} suggestions={asks.suggestions} changes={asks.changes} />;
}
