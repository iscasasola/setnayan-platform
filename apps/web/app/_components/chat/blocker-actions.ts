'use server';

import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';

/** The server's word for each blocker (`chat_blocker_shows.blocker_kind`). */
export type BlockerKind =
  | 'booking_ask'
  | 'booking_fee_overdue'
  | 'coordinator_agree'
  | 'change_approval'
  | 'call_time_unset'
  | 'quote_expired';

/**
 * ONE MORE SHOW of one unanswered blocker to the caller → the new count (1, 2, 3…), which sets the 5 / 30 / 60 s hold
 * (`lib/blocker-hold.ts`). Kept on the server (`chat_blocker_shown()`), so a reload or a second device cannot reset it.
 * Null = it could not be counted (the caller is not in this chat, or the call failed) — the hold then takes the longest.
 */
export async function recordBlockerShow(threadId: string, kind: BlockerKind, subjectKey: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('chat_blocker_shown', {
    p_thread_id: threadId,
    p_kind: kind,
    p_subject_key: subjectKey.slice(0, 100),
  });
  if (error) {
    logQueryError('recordBlockerShow', error, { thread_id: threadId, kind }, 'graceful_degrade');
    return null;
  }
  return typeof data === 'number' ? data : null;
}
