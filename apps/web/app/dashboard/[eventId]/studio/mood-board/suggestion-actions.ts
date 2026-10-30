'use server';

/**
 * 🤝🖼 THE COUPLE ANSWERS A SUPPLIER'S PHOTO (owner 2026-10-19, option (b); prototype frames 3 · 3b · 5).
 *
 *   keepInspirationSuggestion     ✓ Keep — into the part's first free place; on a full part, ONLY into the photo named
 *   declineInspirationSuggestion  ✕ No thanks
 *   undoMoodBoardChange           the Keep toast's Undo — the photo it replaced comes back — AND an owner's Undo of a
 *                                 change a coordinator made (one dispatcher: the server-action budget is at its ceiling)
 *
 * 🔑 EACH IS ONE RPC (migrations 20271279311294 · 20271299051148) and every check is in SQL: the caller may change this
 * Mood Board (`can_change_mood_board_photos` — the hosts, and since 2026-10-30 whoever they set to Mood Board Edit:
 * owner, *"Coordinators can also approve the changes made by suppliers?"* → *"Yes"*), the suggestion is still waiting,
 * and a Keep on a part that holds three answers 'full' and changes NOTHING unless a position is named — "Keep all three
 * for now" sends nothing at all. A Keep by anyone but an owner is a recorded change: the owners are told and have 24
 * hours to Undo it. Undoing a change is the OWNERS' alone (`undo_mood_board_change`), the window on the server's clock.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { refuseLimitedHelper, refuseUnlessMoodBoardPhotos } from '@/lib/host-gate';
import { moodBoardUndoWords, type MoodBoardUndoStatus } from '@/lib/mood-board-changes';

export type KeepResult =
  | { status: 'ok'; slotPosition: number; replaced: boolean }
  | { status: 'full' }
  | { status: 'gone' }
  | { status: 'error' };

export async function keepInspirationSuggestion(eventId: string, suggestionId: string, replacePosition: number | null): Promise<KeepResult> {
  await refuseLimitedHelper(eventId, 'mood_board');
  await refuseUnlessMoodBoardPhotos(eventId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('couple_decide_inspiration_suggestion', {
    p_suggestion_id: suggestionId,
    p_keep: true,
    p_replace_position: replacePosition,
  });
  if (error) {
    logQueryError('keepInspirationSuggestion', error, { eventId, suggestionId });
    return { status: 'error' };
  }
  const r = (data ?? {}) as { status?: string; slot_position?: number; replaced?: boolean };
  if (r.status === 'full') return { status: 'full' };
  if (r.status === 'already') return { status: 'gone' };
  if (r.status !== 'ok' || typeof r.slot_position !== 'number') return { status: 'error' };
  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
  return { status: 'ok', slotPosition: r.slot_position, replaced: Boolean(r.replaced) };
}

export async function declineInspirationSuggestion(eventId: string, suggestionId: string): Promise<{ status: 'ok' | 'gone' | 'error' }> {
  await refuseLimitedHelper(eventId, 'mood_board');
  await refuseUnlessMoodBoardPhotos(eventId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('couple_decide_inspiration_suggestion', {
    p_suggestion_id: suggestionId,
    p_keep: false,
    p_replace_position: null,
  });
  if (error) {
    logQueryError('declineInspirationSuggestion', error, { eventId, suggestionId });
    return { status: 'error' };
  }
  const status = (data as { status?: string } | null)?.status;
  if (status === 'already') return { status: 'gone' };
  if (status !== 'ok') return { status: 'error' };
  revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
  return { status: 'ok' };
}

/** What to undo: the caller's own Keep (its toast), or — for an owner — a change somebody else made. */
export type MoodBoardUndoTarget = { suggestionId: string } | { changeId: string };
export type MoodBoardUndoResult = { status: 'ok' } | { status: MoodBoardUndoStatus; message: string };

export async function undoMoodBoardChange(eventId: string, target: MoodBoardUndoTarget): Promise<MoodBoardUndoResult> {
  await refuseLimitedHelper(eventId, 'mood_board');
  const supabase = await createClient();

  if ('changeId' in target) {
    // 🔑 No client-side gate to agree with: `undo_mood_board_change` refuses anyone but an owner of the change's event,
    // and checks the 24 hours itself. Its writes are the owner's own (SECURITY INVOKER — the board's RLS decides).
    const { data, error } = await supabase.rpc('undo_mood_board_change', { p_change_id: target.changeId });
    if (error) {
      logQueryError('undoMoodBoardChange', error, { eventId, changeId: target.changeId });
      const status: MoodBoardUndoStatus = /not_your_event/.test(error.message) ? 'not_yours' : 'error';
      return { status, message: moodBoardUndoWords(status) };
    }
    const status = (data as { status?: string } | null)?.status;
    if (status === 'ok') {
      revalidatePath(`/dashboard/${eventId}`);
      revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
      return { status: 'ok' };
    }
    const said: MoodBoardUndoStatus =
      status === 'moved_on' || status === 'expired' || status === 'already' || status === 'empty' ? status : 'error';
    return { status: said, message: moodBoardUndoWords(said) };
  }

  await refuseUnlessMoodBoardPhotos(eventId);
  const { data, error } = await supabase.rpc('couple_undo_kept_inspiration_suggestion', { p_suggestion_id: target.suggestionId });
  if (error) {
    logQueryError('undoMoodBoardChange.kept', error, { eventId, suggestionId: target.suggestionId });
    return { status: 'error', message: moodBoardUndoWords('error') };
  }
  if ((data as { status?: string } | null)?.status !== 'ok') return { status: 'error', message: moodBoardUndoWords('error') };
  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
  return { status: 'ok' };
}
