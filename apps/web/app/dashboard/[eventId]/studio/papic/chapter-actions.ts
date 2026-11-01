'use server';

import { createClient } from '@/lib/supabase/server';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PAPIC_WHOLE_EVENT, readChapterId } from '@/lib/papic-chapter';

/**
 * 📷 THE PAPIC CARD'S TWO ACTS ON A CHAPTER (owner 2026-11-01, DECISION_LOG "THE PAPIC CARD ON HOME SHOOTS INTO A
 * CHAPTER"): pick the chapter Papic shoots into (or the whole event), and Start now — a meeting before the day turns
 * Papic on at its start; the host may start it early (`papic_chapter_windows`, migration 20271300249267).
 *
 *   · SAVED IN PLACE: each returns { ok } and the card refreshes itself — no redirect, the screen never resets.
 *   · ON THE CALLER'S OWN CLIENT: RLS lets only the couple write (`papic_chapter_windows_couple_write`), and a limited
 *     helper is refused first (`limitedHelperRefusal`, area `photos` — every Papic setting's area).
 *   · HONEST: a write that reached no row is "not saved" — every write reads back what it changed.
 */

type Saved = { ok: true } | { ok: false; error: string };
const NOT_SAVED = 'That did not save. Nothing changed — please try again.';

function isEventId(v: unknown): v is string {
  return readChapterId(v) !== null;
}

export async function pickPapicChapter(eventId: string, key: string): Promise<Saved> {
  const refused = await limitedHelperRefusal(eventId, 'photos');
  if (refused) return { ok: false, error: refused };
  if (!isEventId(eventId)) return { ok: false, error: NOT_SAVED };
  const blockId = key === PAPIC_WHOLE_EVENT ? null : readChapterId(key);
  if (key !== PAPIC_WHOLE_EVENT && !blockId) return { ok: false, error: NOT_SAVED };

  const supabase = await createClient();
  // One pick per event: the old pick goes first (the partial unique index would refuse two).
  const { error: unpickErr } = await supabase
    .from('papic_chapter_windows')
    .update({ picked: false })
    .eq('event_id', eventId)
    .eq('picked', true);
  if (unpickErr) {
    logQueryError('pickPapicChapter.unpick', unpickErr, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, error: NOT_SAVED };
  }
  if (!blockId) return { ok: true };

  const { data, error } = await supabase
    .from('papic_chapter_windows')
    .upsert({ block_id: blockId, event_id: eventId, picked: true }, { onConflict: 'block_id' })
    .select('block_id, picked')
    .maybeSingle();
  if (error || !data || (data as { picked?: boolean }).picked !== true) {
    if (error) logQueryError('pickPapicChapter.pick', error, { event_id: eventId, block_id: blockId }, 'graceful_degrade');
    return { ok: false, error: NOT_SAVED };
  }
  return { ok: true };
}

/** Start now: the chapter opens at this instant (and becomes the one the card shoots into). */
export async function startPapicChapterNow(eventId: string, blockIdRaw: string): Promise<Saved> {
  const refused = await limitedHelperRefusal(eventId, 'photos');
  if (refused) return { ok: false, error: refused };
  const blockId = readChapterId(blockIdRaw);
  if (!isEventId(eventId) || !blockId) return { ok: false, error: NOT_SAVED };

  const supabase = await createClient();
  const { error: unpickErr } = await supabase
    .from('papic_chapter_windows')
    .update({ picked: false })
    .eq('event_id', eventId)
    .eq('picked', true)
    .neq('block_id', blockId);
  if (unpickErr) {
    logQueryError('startPapicChapterNow.unpick', unpickErr, { event_id: eventId }, 'graceful_degrade');
    return { ok: false, error: NOT_SAVED };
  }
  const { data, error } = await supabase
    .from('papic_chapter_windows')
    .upsert({ block_id: blockId, event_id: eventId, picked: true, opened_early_at: new Date().toISOString() }, { onConflict: 'block_id' })
    .select('block_id, opened_early_at')
    .maybeSingle();
  if (error || !data || !(data as { opened_early_at?: string | null }).opened_early_at) {
    if (error) logQueryError('startPapicChapterNow', error, { event_id: eventId, block_id: blockId }, 'graceful_degrade');
    return { ok: false, error: NOT_SAVED };
  }
  return { ok: true };
}
