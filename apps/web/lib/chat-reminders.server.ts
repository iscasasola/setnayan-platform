import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { readInChunks } from '@/lib/read-all-pages';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';
import { emitNotification } from '@/lib/notification-emit';
import { supplierChatHref } from '@/lib/upcoming-schedule-door';
import { coupleChatHref } from '@/lib/couple-chat-door';
import { readCoupleWorkspaceRowId } from '@/lib/couple-chat-door.server';
import { groupChatHref } from '@/lib/chat-groups';
import { CHAT_REMINDER_TITLE, reminderPreview } from '@/lib/chat-reminders';
import { countUnread, readUnreadNotificationCount } from '@/lib/notifications';

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

type DueRow = { reminder_id: string; message_id: string; thread_id: string; side: 'couple' | 'vendor' };

/** One page of MY due reminders. Paged, never capped: the claim below takes EVERY due row, so the read must too. */
export const DUE_REMINDER_PAGE = 200;

/** The two server-side effects, injectable so the unit test drives the real function (defaults: the real ones). */
export type ReminderDeps = {
  notify: typeof emitNotification;
  admin: () => SupabaseClient;
};
const REAL_DEPS: ReminderDeps = { notify: emitNotification, admin: () => createAdminClient() };

const MESSAGE_COLUMNS = 'message_id,thread_id,event_id,vendor_profile_id,body,attachment_name,attachment_mime,voice_seconds,unsent_at';

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
 *   3 · claim them (`claim_my_due_chat_reminders`, atomic — two tabs can never both deliver one). The claim takes EVERY
 *       due row, so steps 1 and 2 read every due row too (paged), and a row that fell due in between is read after it.
 *   4 · tell me about each one I CLAIMED and can still READ. A claimed reminder whose message I can no longer read
 *       ends there, silently: the chat owes nothing to someone who is not in it.
 *
 * 📧 IN-APP ONLY: `chat_reminder` is not on EMAIL_ENABLED_TYPES (owner rule 2026-10-11: no new emails without his
 * word) — `lib/a-chat-reminder-stays-in-the-app.test.ts`.
 *
 * Never throws: it rides the shell's render, and a reminder must not cost anybody their page.
 */
export async function deliverDueChatReminders(supabase: SupabaseClient, userId: string, deps: ReminderDeps = REAL_DEPS): Promise<number> {
  try {
    // 🔢 EVERY DUE ROW, NOT THE FIRST 20 (#8071 review, controller 21 Nov): `claim_my_due_chat_reminders` marks every
    // due reminder delivered, so a read capped at 20 lost the 21st and later for good — claimed, never read, never told.
    const rows: DueRow[] = [];
    for (let from = 0; ; from += DUE_REMINDER_PAGE) {
      const due = await supabase
        .from('chat_message_reminders')
        .select('reminder_id,message_id,thread_id,side')
        .eq('user_id', userId)
        .is('delivered_at', null)
        .lte('remind_at', new Date().toISOString())
        .order('remind_at', { ascending: true })
        .range(from, from + DUE_REMINDER_PAGE - 1);
      if (due.error) {
        // Before the migration is live the table is not there — that is "no reminders", said in the log, not a fault.
        logQueryError('deliverDueChatReminders(due)', due.error, { user_id: userId, missing_relation: isMissingRelationError(due.error) }, 'graceful_degrade');
        return 0; // nothing claimed — still due next visit
      }
      const page = (due.data ?? []) as DueRow[];
      rows.push(...page);
      if (page.length < DUE_REMINDER_PAGE) break;
    }
    if (rows.length === 0) return 0;

    const read = await readInChunks<Msg>(
      rows.map((r) => r.message_id),
      (part) => supabase.from('chat_messages').select(MESSAGE_COLUMNS).in('message_id', part),
    );
    if (read.error) {
      logQueryError('deliverDueChatReminders(messages)', read.error, { user_id: userId }, 'graceful_degrade');
      return 0; // nothing claimed — still due next visit
    }
    const readable = new Map(read.rows.map((m) => [m.message_id, m]));
    const asked = new Set(rows.map((r) => r.message_id));

    const claim = await supabase.rpc('claim_my_due_chat_reminders');
    if (claim.error) {
      logQueryError('deliverDueChatReminders(claim)', claim.error, { user_id: userId }, 'graceful_degrade');
      return 0;
    }
    const claimed = (claim.data ?? []) as DueRow[];

    // ⏱ A reminder that fell due between the read and the claim is claimed but was never read: read it now, or it is
    // lost the same way. (One that WAS read and came back absent is a message this person may not read — said nothing.)
    const late = claimed.map((c) => c.message_id).filter((id) => !asked.has(id));
    if (late.length > 0) {
      const more = await readInChunks<Msg>(late, (part) => supabase.from('chat_messages').select(MESSAGE_COLUMNS).in('message_id', part));
      if (more.error) logQueryError('deliverDueChatReminders(late)', more.error, { user_id: userId, late: late.length }, 'graceful_degrade');
      for (const m of more.rows) readable.set(m.message_id, m);
    }

    const admin = deps.admin();
    // ⚡ EVERY CLAIMED REMINDER IS TOLD AT ONCE (speed audit L1, 24 Nov 2026). This runs inside the signed-in shell's
    // render, and it used to tell one reminder after another: a couple's link read, then the notice, then the next —
    // two trips per reminder on the page's critical path. Now each reminder's link read and notice run side by side.
    // `told` counts only the notices that went out: one that fails is logged and not counted, and never stops the rest.
    const outcomes = await Promise.allSettled(
      claimed.map(async (c): Promise<boolean> => {
        const m = readable.get(c.message_id);
        // Not readable by this person any more, or unsent since: nothing is said.
        if (!m || m.unsent_at) return false;
        const relatedUrl = !m.vendor_profile_id
          ? groupChatHref(m.thread_id)
          : c.side === 'vendor'
            ? supplierChatHref(m.event_id, m.thread_id)
            : coupleChatHref(
                m.event_id,
                await readCoupleWorkspaceRowId(admin, { eventId: m.event_id, vendorProfileId: m.vendor_profile_id, threadId: m.thread_id }),
                m.thread_id,
              );
        await deps.notify({
          userId,
          type: 'chat_reminder',
          title: CHAT_REMINDER_TITLE,
          body: reminderPreview(m),
          eventId: m.event_id,
          relatedUrl,
        });
        return true;
      }),
    );
    let told = 0;
    for (const o of outcomes) {
      if (o.status === 'fulfilled') {
        if (o.value) told += 1;
      } else {
        console.error('[deliverDueChatReminders] a notice failed:', o.reason instanceof Error ? o.reason.message : String(o.reason));
      }
    }
    return told;
  } catch (caught) {
    console.error('[deliverDueChatReminders] threw:', caught instanceof Error ? caught.message : String(caught));
    return 0;
  }
}

/**
 * 🔔 THE BELL'S UNREAD COUNT, WITH THE REMINDERS DUE RIGHT NOW ALREADY IN IT, in ONE round on a normal open (speed
 * audit L1, 24 Nov 2026).
 *
 * Before, every signed-in shell ran `deliverDueChatReminders(…).then(() => countUnread(…))`: the count waited for the
 * delivery, so even an open with nothing due paid two trips in a row before the bell could draw. Now the count starts
 * BESIDE the delivery:
 *   · nothing was told (nothing was due: the normal open) → the count it ran beside is exact, since nothing was added;
 *   · something was told → the count is asked once more AFTER the notices, so the bell includes them, exactly as before.
 *
 * The second ask is `readUnreadNotificationCount`, not `countUnread`: `countUnread` is a per-render `cache()`, so asking
 * it again would hand back the first answer, from before the notices. If the second ask is refused, the bell shows the
 * first measured count plus the notices this very request just added.
 *
 * Never throws: the delivery never throws, and a refused first count is 0, exactly as `countUnread` has always
 * answered the chrome (a thrown error there would take a whole dashboard subtree down).
 */
export async function unreadCountWithDueReminders(
  supabase: SupabaseClient,
  userId: string,
  deps: ReminderDeps = REAL_DEPS,
): Promise<number> {
  const [told, counted] = await Promise.all([deliverDueChatReminders(supabase, userId, deps), countUnread(supabase, userId)]);
  if (told === 0) return counted;
  const recounted = await readUnreadNotificationCount(supabase, userId);
  return recounted ?? counted + told;
}
