import 'server-only';

/**
 * security_alert — the 10th 0028 V1 notification template, centralized.
 *
 * One template, three triggers (all fire-and-forget via Next's after() at the
 * call site, so a slow notifications insert or Resend call never delays the
 * user's redirect):
 *   • password_changed  — profile Security section change-password
 *     (lib/account-security-actions.ts · changePassword)
 *   • password_reset    — email recovery link completed
 *     (app/reset-password/actions.ts · completePasswordReset)
 *   • sessions_revoked  — "Sign out other devices"
 *     (lib/account-security-actions.ts · signOutOtherDevices)
 *
 * Delivery rides the standard emitNotification funnel — in-app notification
 * row + plaintext Resend email (subject = title) with the funnel's standard
 * "Manage notifications" footer + Web Push (security_alert is on the
 * high-signal push allowlist). No bespoke email path: this module only owns
 * the COPY so all three triggers stay consistent.
 *
 * Body convention: what happened → when (Philippine time) → "If this wasn't
 * you, reset your password immediately" with the /forgot-password link.
 */

import { emitNotification } from '@/lib/notification-emit';

export type SecurityAlertEvent =
  | 'password_changed'
  | 'password_reset'
  | 'sessions_revoked';

const EVENT_COPY: Record<
  SecurityAlertEvent,
  { happened: string; ifNotYou: (resetUrl: string) => string }
> = {
  password_changed: {
    happened:
      'Your password was changed from your profile’s Security section.',
    ifNotYou: (resetUrl) =>
      `If this wasn’t you, reset your password immediately (${resetUrl}) ` +
      'and then use “Sign out other devices” in the Security section of ' +
      'your profile.',
  },
  password_reset: {
    happened:
      'Your password was reset via the email recovery link, and all other ' +
      'devices were signed out.',
    ifNotYou: (resetUrl) =>
      `If this wasn’t you, reset your password again immediately ` +
      `(${resetUrl}) — your email inbox may also be compromised, so secure ` +
      'it first.',
  },
  sessions_revoked: {
    happened:
      'All other devices were signed out of your account from your ' +
      'profile’s Security section. Only the device that made the change ' +
      'stays signed in.',
    ifNotYou: (resetUrl) =>
      `If this wasn’t you, reset your password immediately (${resetUrl}).`,
  },
};

export type EmitSecurityAlertArgs = {
  userId: string;
  event: SecurityAlertEvent;
  /** In-app destination — the profile page hosting the Security section. */
  relatedUrl: string;
};

/** Never throws (emitNotification fails soft); safe inside after(). */
export async function emitSecurityAlert(
  args: EmitSecurityAlertArgs,
): Promise<void> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://setnayan-platform-web.vercel.app';
  const copy = EVENT_COPY[args.event];
  const when = new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'long',
    timeStyle: 'short',
  });
  await emitNotification({
    userId: args.userId,
    type: 'security_alert',
    title: 'Security alert on your Setnayan account',
    body: [
      copy.happened,
      `When: ${when} (Philippine time).`,
      'If this was you, no action is needed.',
      copy.ifNotYou(`${appUrl}/forgot-password`),
    ].join(' '),
    relatedUrl: args.relatedUrl,
  });
}
