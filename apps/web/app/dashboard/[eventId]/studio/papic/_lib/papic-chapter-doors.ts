import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PAPIC_WHOLE_EVENT, readChapterId } from '@/lib/papic-chapter';

/**
 * 📷 THE PAPIC CARD'S TWO ACTS ON A CHAPTER (owner 2026-11-01, DECISION_LOG "THE PAPIC CARD ON HOME SHOOTS INTO A
 * CHAPTER"): pick the chapter Papic shoots into (or the whole event), and Start now — a meeting before the day turns
 * Papic on at its start; the host may start it early (`papic_chapter_windows`, migration 20271300249267).
 *
 *   · NOT A NEW SERVER ACTION (the route budget, lint-server-action-budget.mjs): two more DOORS of the one Papic
 *     dispatcher, `papicSaveInPlace` (in-place-actions.ts) — which refuses a limited helper first (area `photos`, every
 *     Papic setting's area) and answers { ok } or the words thrown here. Home re-renders in place (`revalidatePath`) — no
 *     redirect, the screen never resets.
 *   · ON THE CALLER'S OWN CLIENT: RLS lets only the couple write (`papic_chapter_windows_couple_write`).
 *   · HONEST: a write that reached no row is "not saved" — every write reads back what it changed.
 */

const NOT_SAVED = 'That did not save. Nothing changed — please try again.';

function isEventId(v: unknown): v is string {
  return readChapterId(v) !== null;
}
function field(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
}

/** The card's pick: `event_id` + `chapter` (a chapter id, or `whole`). Throws the words on a refusal. */
export async function pickPapicChapter(fd: FormData): Promise<void> {
  const eventId = field(fd, 'event_id');
  const key = field(fd, 'chapter');
  if (!isEventId(eventId)) throw new Error(NOT_SAVED);
  const blockId = key === PAPIC_WHOLE_EVENT ? null : readChapterId(key);
  if (key !== PAPIC_WHOLE_EVENT && !blockId) throw new Error(NOT_SAVED);

  const supabase = await createClient();
  // One pick per event: the old pick goes first (the partial unique index would refuse two).
  const { error: unpickErr } = await supabase
    .from('papic_chapter_windows')
    .update({ picked: false })
    .eq('event_id', eventId)
    .eq('picked', true);
  if (unpickErr) {
    logQueryError('pickPapicChapter.unpick', unpickErr, { event_id: eventId }, 'graceful_degrade');
    throw new Error(NOT_SAVED);
  }
  if (!blockId) {
    revalidatePath(`/dashboard/${eventId}`);
    return;
  }

  const { data, error } = await supabase
    .from('papic_chapter_windows')
    .upsert({ block_id: blockId, event_id: eventId, picked: true }, { onConflict: 'block_id' })
    .select('block_id, picked')
    .maybeSingle();
  if (error || !data || (data as { picked?: boolean }).picked !== true) {
    if (error) logQueryError('pickPapicChapter.pick', error, { event_id: eventId, block_id: blockId }, 'graceful_degrade');
    throw new Error(NOT_SAVED);
  }
  revalidatePath(`/dashboard/${eventId}`);
}

/** Start now: `event_id` + `chapter` — it opens at this instant (and becomes the one the card shoots into). */
export async function startPapicChapterNow(fd: FormData): Promise<void> {
  const eventId = field(fd, 'event_id');
  const blockId = readChapterId(field(fd, 'chapter'));
  if (!isEventId(eventId) || !blockId) throw new Error(NOT_SAVED);

  const supabase = await createClient();
  const { error: unpickErr } = await supabase
    .from('papic_chapter_windows')
    .update({ picked: false })
    .eq('event_id', eventId)
    .eq('picked', true)
    .neq('block_id', blockId);
  if (unpickErr) {
    logQueryError('startPapicChapterNow.unpick', unpickErr, { event_id: eventId }, 'graceful_degrade');
    throw new Error(NOT_SAVED);
  }
  const { data, error } = await supabase
    .from('papic_chapter_windows')
    .upsert({ block_id: blockId, event_id: eventId, picked: true, opened_early_at: new Date().toISOString() }, { onConflict: 'block_id' })
    .select('block_id, opened_early_at')
    .maybeSingle();
  if (error || !data || !(data as { opened_early_at?: string | null }).opened_early_at) {
    if (error) logQueryError('startPapicChapterNow', error, { event_id: eventId, block_id: blockId }, 'graceful_degrade');
    throw new Error(NOT_SAVED);
  }
  revalidatePath(`/dashboard/${eventId}`);
}
