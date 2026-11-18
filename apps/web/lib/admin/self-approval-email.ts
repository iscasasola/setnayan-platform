import 'server-only';
import { sendEmail } from '@/lib/email';
import { OWNER_EMAIL } from './owner';
import { SELF_APPROVAL_WAIT_HOURS } from './self-approval';

/**
 * The two emails to the owner about his own request (DECISION_LOG 2026-11-13):
 * one when it starts waiting, one when it runs (or fails to). This is the
 * owner's own ruling about mail to himself, so it is sent directly rather than
 * through the notification allowlist.
 *
 * sendEmail never throws and records every attempt in email_deliveries, so a
 * missing Resend key shows up there as `not_configured` instead of vanishing.
 */

export const SELF_APPROVAL_EMAIL_KIND_WAITING = 'admin_self_approval_waiting';
export const SELF_APPROVAL_EMAIL_KIND_RAN = 'admin_self_approval_ran';

const APPROVALS_URL = 'https://www.setnayan.com/admin/approvals';

export async function emailOwnerWaiting(args: { what: string; publicId: string; runAfter: string }) {
  const when = new Date(args.runAfter).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  await sendEmail({
    to: OWNER_EMAIL,
    kind: SELF_APPROVAL_EMAIL_KIND_WAITING,
    subject: `Waiting ${SELF_APPROVAL_WAIT_HOURS} h: ${args.what}`,
    text:
      `You approved your own request ${args.publicId}: ${args.what}.\n\n` +
      `It waits ${SELF_APPROVAL_WAIT_HOURS} hours and then runs, at about ${when} (Manila).\n` +
      `To stop it, open ${APPROVALS_URL} and press Cancel before then.\n\n` +
      `If you did not do this, cancel it now and change your password.`,
  });
}

export async function emailOwnerRan(args: { what: string; publicId: string; ok: boolean; error?: string }) {
  await sendEmail({
    to: OWNER_EMAIL,
    kind: SELF_APPROVAL_EMAIL_KIND_RAN,
    subject: args.ok ? `Done: ${args.what}` : `Did not run: ${args.what}`,
    text: args.ok
      ? `Your request ${args.publicId} ran after its ${SELF_APPROVAL_WAIT_HOURS}-hour wait: ${args.what}.\n\n` +
        `It is in the Admin log under your name. ${APPROVALS_URL}`
      : `Your request ${args.publicId} was due to run but could not: ${args.error ?? 'the change was refused'}.\n\n` +
        `Nothing changed. It has been closed so it cannot keep failing in the background — ` +
        `raise it again once the reason above is fixed. ${APPROVALS_URL}`,
  });
}
