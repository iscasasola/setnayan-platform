import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';
import { emitNotification } from '@/lib/notification-emit';
import { supplierChatHref } from '@/lib/upcoming-schedule-door';
import { coupleChatHref } from '@/lib/couple-chat-door';
import { readCoupleWorkspaceRowId } from '@/lib/couple-chat-door.server';
import { groupChatHref } from '@/lib/chat-groups';
import { CHAT_REMINDER_TITLE, reminderPreview } from '@/lib/chat-reminders';

/**
 * ⏰ A DUE "REMIND ME" COMES BACK — in the app, to the person who set it (Unichat H1; migration 20271354347259).
 *
 * CRON-FREE, like every scheduled thing here (the 2026 no-pollers lock): a reminder is "delivered" on the person's
 * own next visit — the signed-in shells call this beside their bell count. An in-app notice has no reader until the
 * person is in the app anyway, so nothing is later than it would have been.
 *
 * THE ORDER IS THE SAFETY:
 *   1 · read MY due reminders (RLS: own rows). None → done, one small indexed read.
 *   2 · read their messages UNDER MY OWN RLS. A person who left the chat, was removed from the event, or was never a
 *       recipient of a private line gets NO row back — the database's own policies decide, nothing here re-states them.
 *       If this read FAILS we stop: nothing was claimed, so every reminder is still due on the next visit — a refused
 *       read never eats a reminder.
 *   3 · claim them (`claim_my_due_chat_reminders`, atomic — two tabs can never both deliver one).
 *   4 · tell me about each one I CLAIMED and can still READ. A claimed reminder whose message I can no longer read
 *       ends there, silently: the chat owes nothing to someone who is not in it.
 *
 * 📧 IN-APP ONLY: `chat_reminder` is not on EMAIL_ENABLED_TYPES (owner rule 2026-10-11: no new emails without his
 * word) — `lib/a-chat-reminder-stays-in-the-app.test.ts`.
 *
 * Never throws: it rides the shell's render, and a reminder must not cost anybody their page.
 */
export async function deliverDueChatReminders(supabase: SupabaseClient, userId: string): Promise<number> {
  try {
    const due = await supabase
      .from('chat_message_reminders')
      .select('reminder_id,message_id,thread_id,side')
      .eq('user_id', userId)
      .is('delivered_at', null)
      .lte('remind_at', new Date().toISOString())
      .limit(20);
    if (due.error) {
      // Before the migration is live the table is not there — that is "no reminders", said in the log, not a fault.
      logQueryError('deliverDueChatReminders(due)', due.error, { user_id: userId, missing_relation: isMissingRelationError(due.error) }, 'graceful_degrade');
      return 0;
    }
    const rows = (due.data ?? []) as { reminder_id: string; message_id: string; thread_id: string; side: 'couple' | 'vendor' }[];
    if (rows.length === 0) return 0;

    const read = await supabase
      .from('chat_messages')
      .select('message_id,thread_id,event_id,vendor_profile_id,body,attachment_name,attachment_mime,voice_seconds,unsent_at')
      .in(
        'message_id',
        rows.map((r) => r.message_id),
      );
    if (read.error) {
      logQueryError('deliverDueChatReminders(messages)', read.error, { user_id: userId }, 'graceful_degrade');
      return 0; // nothing claimed — still due next visit
    }
    type Msg = {
      message_id: string;
      thread_id: string;
      event_id: string;
      vendor_profile_id: string | null;
      body: string | null;
      attachment_name: string | null;
      attachment_mime: string | null;
      voice_seconds: number | null;
      unsent_at: string | null;
    };
    const readable = new Map(((read.data ?? []) as Msg[]).map((m) => [m.message_id, m]));

    const claim = await supabase.rpc('claim_my_due_chat_reminders');
    if (claim.error) {
      logQueryError('deliverDueChatReminders(claim)', claim.error, { user_id: userId }, 'graceful_degrade');
      return 0;
    }
    const claimed = (claim.data ?? []) as { reminder_id: string; message_id: string; thread_id: string; side: 'couple' | 'vendor' }[];

    const admin = createAdminClient();
    let told = 0;
    for (const c of claimed) {
      const m = readable.get(c.message_id);
      // Not readable by this person any more, or unsent since: nothing is said.
      if (!m || m.unsent_at) continue;
      const relatedUrl = !m.vendor_profile_id
        ? groupChatHref(m.thread_id)
        : c.side === 'vendor'
          ? supplierChatHref(m.event_id, m.thread_id)
          : coupleChatHref(
              m.event_id,
              await readCoupleWorkspaceRowId(admin, { eventId: m.event_id, vendorProfileId: m.vendor_profile_id, threadId: m.thread_id }),
              m.thread_id,
            );
      await emitNotification({
        userId,
        type: 'chat_reminder',
        title: CHAT_REMINDER_TITLE,
        body: reminderPreview(m),
        eventId: m.event_id,
        relatedUrl,
      });
      told += 1;
    }
    return told;
  } catch (caught) {
    console.error('[deliverDueChatReminders] threw:', caught instanceof Error ? caught.message : String(caught));
    return 0;
  }
}
