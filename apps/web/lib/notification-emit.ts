import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NotificationType } from '@/lib/notifications';

export type EmitNotificationArgs = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedUrl?: string | null;
};

/**
 * Server-only helper that drops a row into public.notifications via the
 * service-role client. Called from server actions immediately after the
 * underlying state change (chat insert, order update, payment decision).
 *
 * Designed to fail soft: a failed notification should never roll back the
 * primary action. We log and continue.
 *
 * Email delivery is intentionally not wired here — when Resend is configured,
 * a follow-on emits a queue row + worker process.
 */
export async function emitNotification(args: EmitNotificationArgs): Promise<void> {
  const { userId, type, title, body = null, relatedUrl = null } = args;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('notifications').insert({
      user_id: userId,
      type,
      title: title.slice(0, 160),
      body,
      related_url: relatedUrl,
    });
    if (error) {
      console.error('[notifications] emit failed:', error.message);
    }
  } catch (e) {
    console.error('[notifications] emit threw:', e);
  }
}
