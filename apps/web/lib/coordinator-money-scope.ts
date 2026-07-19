import type { SupabaseClient } from '@supabase/supabase-js';
import { isCoordinatorConsentGateEnabled } from '@/lib/coordinator-consent-gate';

/**
 * Consent-SCOPED coordinator money authority (owner decision 2026-07-19 #5).
 *
 * The absolute "money wall" (a coordinator can never touch payments) is
 * superseded: coordinators MAY lock vendors and handle the payment process,
 * but ONLY upon the couple's approval of the coordinator's access
 * limitations. The couple grants the optional scopes when they send the
 * coordinator host invite (consent modal toggles, default OFF) and the grant
 * is recorded in public.coordinator_access_consents.scopes:
 *
 *   • 'vendor_lock' — may lock (finalize) vendors directly.
 *   • 'checkout'    — may handle payments: submit orders, upload payment
 *                     proof, record vendor deposits.
 *
 * Flag posture — NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED (default OFF):
 *   • Flag OFF → returns true unconditionally. Flag-off behavior is EXACTLY
 *     today's (membership-only guards) — no reads, no new denials.
 *   • Flag ON  → couple members are always allowed; any non-couple caller is
 *     allowed only when an un-revoked consent row for one of their live
 *     moderator rows grants the requested scope. Everything else — no
 *     moderator row, no consent row, revoked consent, scope not granted,
 *     or a read error — DENIES (fail-closed).
 *
 * Callers pass an admin (service-role) client: the consent row belongs to the
 * couple's event scope, not the coordinator's own RLS view, and the check must
 * not depend on what the caller can read.
 */
export type CoordinatorMoneyScope = 'vendor_lock' | 'checkout';

export async function coordinatorMoneyScopeAllowed(
  admin: SupabaseClient,
  eventId: string,
  userId: string,
  scope: CoordinatorMoneyScope,
): Promise<boolean> {
  // Flag OFF → exact current behavior (permissive; membership guards upstream
  // remain the only gate).
  if (!isCoordinatorConsentGateEnabled()) return true;

  // Couple members always hold full money authority over their own event.
  const { data: member } = await admin
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if ((member as { member_type?: string } | null)?.member_type === 'couple') {
    return true;
  }

  // Non-couple caller (coordinator / other host) → resolve their live
  // moderator row(s) on this event…
  const { data: moderators } = await admin
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .is('removed_at', null);
  const moderatorIds = (moderators ?? [])
    .map((m) => (m as { moderator_id?: string }).moderator_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (moderatorIds.length === 0) return false;

  // …then require an un-revoked consent row that grants the scope. Missing
  // key / '{}' scopes = not granted (fail-closed).
  const { data: consents } = await admin
    .from('coordinator_access_consents')
    .select('scopes')
    .eq('event_id', eventId)
    .in('moderator_id', moderatorIds)
    .is('revoked_at', null);
  return (consents ?? []).some((row) => {
    const scopes = (row as { scopes?: unknown }).scopes;
    if (!scopes || typeof scopes !== 'object') return false;
    return (scopes as Record<string, unknown>)[scope] === true;
  });
}
