'use server';

/**
 * 🤝🖼 THE COUPLE ANSWERS A SUPPLIER'S PHOTO (owner 2026-10-19, option (b); prototype frames 3 · 3b · 5).
 *
 *   keepInspirationSuggestion     ✓ Keep — into the part's first free place; on a full part, ONLY into the photo named
 *   declineInspirationSuggestion  ✕ No thanks
 *   undoKeptInspirationSuggestion the Keep toast's Undo — the photo it replaced comes back
 *
 * 🔑 EACH IS ONE RPC (migration 20271279311294) and every check is in SQL: the caller is the couple
 * (`colour_access_caller_is_couple`), the suggestion is still waiting, and a Keep on a part that holds three answers
 * 'full' and changes NOTHING unless a position is named — "Keep all three for now" sends nothing at all.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { refuseLimitedHelper } from '@/lib/host-gate';

export type KeepResult =
  | { status: 'ok'; slotPosition: number; replaced: boolean }
  | { status: 'full' }
  | { status: 'gone' }
  | { status: 'error' };

export async function keepInspirationSuggestion(eventId: string, suggestionId: string, replacePosition: number | null): Promise<KeepResult> {
  await refuseLimitedHelper(eventId, 'mood_board');
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

export async function undoKeptInspirationSuggestion(eventId: string, suggestionId: string): Promise<{ status: 'ok' | 'error' }> {
  await refuseLimitedHelper(eventId, 'mood_board');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('couple_undo_kept_inspiration_suggestion', { p_suggestion_id: suggestionId });
  if (error) {
    logQueryError('undoKeptInspirationSuggestion', error, { eventId, suggestionId });
    return { status: 'error' };
  }
  if ((data as { status?: string } | null)?.status !== 'ok') return { status: 'error' };
  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
  return { status: 'ok' };
}
