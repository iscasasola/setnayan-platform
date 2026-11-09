/**
 * ONE MORE SHOW of one unanswered blocker, counted on the server (`chat_blocker_shown()`), so a reload or a second
 * device cannot reset the 5 / 30 / 60 s hold (`lib/blocker-hold.ts`).
 *
 * Called from the browser with the reader's own session — NOT a server action. The RPC is SECURITY DEFINER, granted
 * to `authenticated` and keyed on `auth.uid()` + chat membership, so the browser call is exactly as safe, and it does
 * not spend one of the app's capped Vercel routes (`scripts/lint-server-action-budget.mjs`).
 */
import { createClient } from '@/lib/supabase/client';

/** The server's word for each blocker (`chat_blocker_shows.blocker_kind`). */
export type BlockerKind =
  | 'booking_ask'
  | 'booking_fee_overdue'
  | 'coordinator_agree'
  | 'change_approval'
  | 'call_time_unset'
  | 'quote_expired';

/**
 * → the new count (1, 2, 3…). Null = it could not be counted (the caller is not in this chat, or the call failed) —
 * the hold then takes the longest, never the shortest.
 */
export async function recordBlockerShow(threadId: string, kind: BlockerKind, subjectKey: string): Promise<number | null> {
  try {
    const { data, error } = await createClient().rpc('chat_blocker_shown', {
      p_thread_id: threadId,
      p_kind: kind,
      p_subject_key: subjectKey.slice(0, 100),
    });
    if (error) {
      console.warn('[recordBlockerShow] not counted', error.code);
      return null;
    }
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}
