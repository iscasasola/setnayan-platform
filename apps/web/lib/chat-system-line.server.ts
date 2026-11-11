import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * ONE SETNAYAN LINE INTO THE (event × shop) CONVERSATION — from a server action, written with the service role.
 *
 * The database already records most changes as a line (`chat_record_post_line`, migration 20271329937802 — "the chat
 * is the overall record"); that helper has no client grant, so a server action that needs the same kind of line
 * writes it the way `revealExclusivePerks` and the re-quote nudge already do: `sender_role = 'system'`,
 * `sender_user_id = NULL` (never unread for anybody — 20271336137492). Used by (chat gaps, 8 Nov):
 *   · a payment ASK (`askForPaymentCore`) — the asked amount reaches the couple's open chat at once, and the stream
 *     refreshes the money step around it (`lib/chat-live-refresh.ts`);
 *   · an ACCESS ask from the supplier's (+) (`askAccessFromChat`) — "the thread shows a plain line".
 *
 * Never throws and never blocks the action it follows: no thread yet → nothing to post; a refused insert is logged.
 */
export async function postThreadSystemLine(
  admin: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; body: string },
): Promise<boolean> {
  const body = args.body.trim().slice(0, 4000);
  if (!body) return false;
  try {
    const { data: thread, error: threadErr } = await admin
      .from('chat_threads')
      .select('thread_id')
      .eq('event_id', args.eventId)
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle();
    if (threadErr) {
      logQueryError('postThreadSystemLine.thread', threadErr, { event_id: args.eventId }, 'graceful_degrade');
      return false;
    }
    const threadId = (thread as { thread_id?: string } | null)?.thread_id;
    if (!threadId) return false;
    const { error } = await admin.from('chat_messages').insert({
      thread_id: threadId,
      event_id: args.eventId,
      vendor_profile_id: args.vendorProfileId,
      sender_user_id: null,
      sender_role: 'system',
      body,
    });
    if (error) {
      logQueryError('postThreadSystemLine.insert', error, { thread_id: threadId }, 'graceful_degrade');
      return false;
    }
    return true;
  } catch (caught) {
    logQueryError('postThreadSystemLine (threw)', caught, { event_id: args.eventId }, 'graceful_degrade');
    return false;
  }
}
