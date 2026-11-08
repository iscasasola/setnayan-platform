import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import type { NotificationType } from '@/lib/notifications';

/**
 * 🔔 TELL EVERY SETNAYAN ADMIN THAT A MESSAGE LANDED IN /admin/help — the loop `submitHelpMessage` (app/help/actions.ts)
 * always ran, lifted out so the supplier Report (THE ONE BUILD §5.4, `report-actions.ts`) tells the same people the
 * same way instead of a second copy.
 *
 * The TYPE is the caller's, because it decides the channel: the public Help form keeps its shipped `chat_message`;
 * a supplier Report is `supplier_report`, which is NOT on EMAIL_ENABLED_TYPES ("admin in-app notice only, no email").
 * Anchors to the message's row in the flat /admin/help list (`id="message-<id>"`) — there is no per-message page.
 * Never throws: a failed notice must not fail the submission.
 */
export async function notifyAdminsOfHelpMessage(args: {
  type: Extract<NotificationType, 'chat_message' | 'supplier_report'>;
  messageId: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: internals } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    for (const adminUser of internals ?? []) {
      await emitNotification({
        userId: adminUser.user_id,
        type: args.type,
        title: args.title,
        body: args.body,
        relatedUrl: `/admin/help#message-${args.messageId}`,
      });
    }
  } catch {
    // Notification failures shouldn't block the submission.
  }
}
