import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Revoke half of the RA 10173 coordinator consent audit loop.
 *
 * The grant half (inviteHost) records the couple's data-privacy consent in
 * public.coordinator_access_consents when a coordinator host invite is
 * created. This helper closes the loop: when that access ends — the couple
 * removes the host, the inviter revokes the pending invite, or the invitee
 * declines — stamp revoked_at on the matching un-revoked consent row(s).
 *
 * Deliberately UNCONDITIONAL (not gated on
 * NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED): consent rows may exist from
 * a period when the flag was ON even if it is OFF now, and stamping them is
 * always correct. If no consent row exists (flag was OFF at invite time, or
 * the host wasn't a coordinator), the UPDATE matches zero rows and is a
 * silent no-op.
 *
 * Best-effort audit write: never throws — the removal itself must succeed
 * even if this stamp fails, matching the grant half's error posture.
 *
 * Spec: corpus Coordinator_Whats_Next_2026-07-18.md § 4 (revoked_at loop).
 */
export async function stampCoordinatorConsentRevoked(
  admin: SupabaseClient,
  eventId: string,
  moderatorId: string,
): Promise<void> {
  try {
    const { error } = await admin
      .from('coordinator_access_consents')
      .update({ revoked_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('moderator_id', moderatorId)
      .is('revoked_at', null);
    if (error) {
      console.error(
        '[coordinator-consent] revoked_at stamp failed',
        error.message,
      );
    }
  } catch (e) {
    console.error('[coordinator-consent] revoked_at stamp threw', e);
  }
}
