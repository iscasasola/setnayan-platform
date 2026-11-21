/**
 * 🔕 MUTE THIS CHAT — per person (Unichat drawing v3 · controller ruling 21 Nov 2026).
 *
 * A mute silences ONE chat's phone notices for ONE person, on all their devices. Everyone else keeps getting them. The
 * bell row still lands, so the chat's unread counts stay true — only the buzz stops. Stored in `chat_thread_mutes`
 * (migration 20271356402294, Pattern A: own rows).
 *
 * Two places send a chat's phone notice, and both ask THIS module:
 *   1. `notifyChatRecipients` (lib/chat-actions.ts) → `emitNotification({ …, silent })` — the bell row lands, the push
 *      is skipped for a muted person;
 *   2. `/api/notify` (the shop-wide webhook push on `vendor_push_tokens`) — `tokensToBuzz` leaves out the devices of a
 *      member who muted. A token registered before 2026-11-21 has no person yet and is still sent.
 *
 * 🔑 A refused read is NOT "nobody muted" and NOT "everybody muted": it is unknown, and an unknown mute SENDS — a missed
 * message is worse than one unwanted buzz. The read logs so the two are told apart.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** The people who muted this chat, or `null` when the read failed (unknown — then nobody is silenced). */
export type ThreadMutes = ReadonlySet<string> | null;

/** Is this person's phone notice for this chat silenced? An unread mute list silences no one. */
export function chatNoticeSilentFor(mutes: ThreadMutes, userId: string): boolean {
  return mutes !== null && mutes.has(userId);
}

/** The shop devices to buzz: every active token except those registered by a person who muted. No person = sent. */
export function tokensToBuzz<T extends { user_id?: string | null }>(tokens: readonly T[], mutes: ThreadMutes): T[] {
  if (mutes === null || mutes.size === 0) return [...tokens];
  return tokens.filter((t) => !t.user_id || !mutes.has(t.user_id));
}

/** The ⋯ row's words, as drawn. */
export function muteRowLabel(muted: boolean): string {
  return muted ? 'Unmute this chat' : 'Mute this chat';
}

/** The toast after the press, as drawn ("Muted. Cards that need you still show."). */
export function muteToast(muted: boolean): string {
  return muted ? 'Muted. Cards that need you still show.' : 'Unmuted. This chat notifies you again.';
}

/** Who muted this thread — read with the service role where notices are sent. `null` = the read failed (logged). */
export async function readThreadMutes(admin: SupabaseClient, threadId: string): Promise<ThreadMutes> {
  try {
    const { data, error } = await admin.from('chat_thread_mutes').select('user_id').eq('thread_id', threadId);
    if (error) {
      console.error('[chat-mutes] mutes read failed — nobody is silenced', { thread_id: threadId, error: error.message });
      return null;
    }
    return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  } catch (e) {
    console.error('[chat-mutes] mutes read threw — nobody is silenced', { thread_id: threadId, error: String(e) });
    return null;
  }
}

/**
 * Has the viewer muted this chat? Read with THEIR client (Pattern A). `null` = unknown (a refused read): the ⋯ row is
 * then not drawn — a switch that may say the wrong thing is worse than none.
 */
export async function readMyMute(supabase: SupabaseClient, threadId: string, userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('chat_thread_mutes')
      .select('thread_id')
      .eq('thread_id', threadId)
      .eq('user_id', userId);
    if (error) {
      console.error('[chat-mutes] own mute read failed', { thread_id: threadId, error: error.message });
      return null;
    }
    return (data ?? []).length > 0;
  } catch {
    return null;
  }
}
