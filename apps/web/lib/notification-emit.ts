import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';
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
 * Also fires an email to the recipient via Resend when RESEND_API_KEY is
 * configured (and the user's marketing_opt_in flag isn't disqualifying —
 * V1 sends transactional regardless of marketing preference).
 *
 * Designed to fail soft: a failed notification or email never rolls back
 * the primary action. We log and continue.
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

  // Send email if Resend is configured — fire-and-forget; failures here
  // never affect the in-app notification that already landed.
  if (isEmailConfigured()) {
    try {
      const admin = createAdminClient();
      const { data: recipient } = await admin
        .from('users')
        .select('email')
        .eq('user_id', userId)
        .maybeSingle();
      if (recipient?.email) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ??
          'https://setnayan-platform-web.vercel.app';
        const link = relatedUrl ? `${appUrl}${relatedUrl}` : appUrl;
        const text = [
          title,
          '',
          body ?? '',
          '',
          `Open Setnayan: ${link}`,
          '',
          '—',
          "You're receiving this because of activity on your Setnayan account.",
          `Manage notifications: ${appUrl}/dashboard/profile`,
        ]
          .filter((line) => line !== null && line !== undefined)
          .join('\n');

        await sendEmail({
          to: recipient.email,
          subject: title,
          text,
        });
      }
    } catch (e) {
      console.error('[notifications] email-on-emit failed:', e);
    }
  }
}
