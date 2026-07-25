import 'server-only';
import { emitNotification } from '@/lib/notification-emit';
import type { NotificationType } from '@/lib/notifications';
import { isVendorTeamRolesV2Enabled } from '@/lib/vendor-team-roles-flag';
import {
  buildAssignmentNotice,
  type VendorAssignmentInput,
} from '@/lib/vendor-team-assignment-notice';

/**
 * vendor-team-assignment-notify.ts — the IMPURE half of the assignment hook.
 *
 * Flag-gated (NEXT_PUBLIC_VENDOR_TEAM_ROLES_V2, default OFF) and fail-soft: an
 * assignment must never be rolled back because a notification could not be
 * delivered, so every failure is swallowed exactly the way emitNotification
 * already swallows its own.
 *
 * ⚠ CAST AT THE SEAM: `vendor_assignment_received` is a real value of the
 * `public.notification_type` DB enum (migration 20271003612974) but is NOT yet
 * in the `NotificationType` TS union — `lib/notifications.ts` is owned by
 * another concurrent track, so this track does not edit it. The pure builder
 * therefore types `type` as `string` and we assert it here. Drop the cast (and
 * this note) once the union carries the value.
 */
export async function notifyVendorAssignment(
  input: VendorAssignmentInput,
): Promise<void> {
  if (!isVendorTeamRolesV2Enabled()) return;
  const notice = buildAssignmentNotice(input);
  if (!notice) return;
  try {
    await emitNotification({
      userId: notice.userId,
      type: notice.type as NotificationType,
      title: notice.title,
      body: notice.body,
      relatedUrl: notice.relatedUrl,
    });
  } catch {
    // fail-soft — the assignment already landed.
  }
}
