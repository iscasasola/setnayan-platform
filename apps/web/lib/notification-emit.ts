import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { isWebPushConfigured, sendWebPush } from '@/lib/web-push';
import type { NotificationType } from '@/lib/notifications';

// Web Push is wired at the same funnel as email but kept deliberately MINIMAL:
// only the highest-signal, time-sensitive types fire a push on top of the
// in-app notification + email. Everything else stays in-app/email only (the
// rest of 0028 is untouched). `chat_message` is the canonical "new
// vendor/couple message"; `vendor_inquiry_received` is its vendor-facing
// counterpart (a new booking inquiry to answer). Add more types here later as
// per-channel preferences (0028 deferred item) land.
//
// NOTE (deviation): the brief named "wedding-day reminder" as the 2nd emit
// point, but no `wedding_day_reminder` notification type exists in the code —
// day-of mode (0031) is UI/cron-free and emits no notification. We wired
// `vendor_inquiry_received` instead as the second high-signal push type.
const PUSH_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  'chat_message',
  'vendor_inquiry_received',
  // security_alert (2026-06-12): "your password was changed" is exactly the
  // high-signal, time-sensitive class this allowlist exists for — if it
  // WASN'T the user, every second until they see it matters.
  'security_alert',
  // inquiry_accepted (inquiry-accepted-visibility 2026-06-16): a vendor taking
  // the couple's inquiry opens the thread + reveals the name — the moment the
  // couple has been waiting on. High-signal + time-sensitive (they'll want to
  // reply while the vendor is engaged), so it earns a push. The type already
  // exists in the NotificationType enum + is emitted on accept; this only adds
  // the push channel — no schema change.
  'inquiry_accepted',
]);

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

  // Best-effort Web Push for the high-signal types only. Gated on VAPID env
  // (no-ops when unset) and fully fire-and-forget — a push failure never
  // affects the in-app notification or the email that already landed.
  if (isWebPushConfigured() && PUSH_ENABLED_TYPES.has(type)) {
    try {
      await sendWebPush(userId, {
        title,
        body,
        url: relatedUrl,
        tag: type,
      });
    } catch (e) {
      console.error('[notifications] push-on-emit failed:', e);
    }
  }
}
