import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 🔒 ONLY A HOST BOOKS OR PAYS (owner 2026-11-21, DECISION_LOG "BOOKED COORDINATOR ON BUILD: FIND + RECOMMEND +
 * SHORTLIST, NO BOOKING, NO PAYING" — verbatim *"no booking, no paying"* — and "COORDINATOR: DUE PAYMENTS VIEWABLE +
 * 'REMIND THE HOSTS', NOT LOGGABLE").
 *
 * ── WHAT THIS REPLACED ──────────────────────────────────────────────────────
 * Since 2026-07-19 (#5) a coordinator could book ('vendor_lock') and pay ('checkout') when the hosts ticked those
 * scopes at invite time (`coordinator_access_consents.scopes`) — and, worse, the whole check sat behind the
 * `coordinator_consent_money` Data Privacy control, which defaults INACTIVE, so in practice it answered TRUE for every
 * event member. A coordinator could submit the couple's orders, upload payment proof and record deposits.
 *
 * ── WHAT IS TRUE NOW ────────────────────────────────────────────────────────
 * One rule, no control, no opt-in: the caller is a `couple` member of the event (a host — the creator, a partner, a
 * co-host the hosts made). Everybody else — a coordinator, a helper, a booked supplier, a stranger, and a failed read —
 * is refused. The hosts' opt-in scopes are retired; the scope names stay as the callers' words for WHICH act was
 * refused.
 *
 * Callers pass an admin (service-role) client: the membership row must be read whatever the caller's own RLS view is.
 * 🔒 `lib/only-a-host-books-or-pays.test.ts` (every call site, every outcome).
 */
export type CoordinatorMoneyScope = 'vendor_lock' | 'checkout';

/** The words a refused booking says — the coordinator's three verbs instead (drawing, Suppliers frame). */
export const ONLY_A_HOST_BOOKS =
  'Only a host can book. You can find a shop, recommend a partner, or add it to the shortlist — the hosts book.';
/** The words a refused payment says — the coordinator reminds instead. */
export const ONLY_A_HOST_PAYS = 'Only a host can log or pay. You can see what is due and remind the hosts.';

export async function coordinatorMoneyScopeAllowed(
  admin: SupabaseClient,
  eventId: string,
  userId: string,
  scope: CoordinatorMoneyScope,
): Promise<boolean> {
  return coordinatorMoneyScopeGranted(admin, eventId, userId, scope);
}

/**
 * The rule itself — exported for the unit tests (the stub client). `scope` no longer changes the answer: no scope
 * can be granted to anybody who is not a host.
 */
export async function coordinatorMoneyScopeGranted(
  admin: SupabaseClient,
  eventId: string,
  userId: string,
  _scope: CoordinatorMoneyScope,
): Promise<boolean> {
  void _scope;
  if (!eventId || !userId) return false;
  const { data: member, error } = await admin
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  // A refused read is never a host (fail-closed: money) — and the reason is said in the log, never swallowed.
  if (error) {
    console.error('[coordinatorMoneyScope] membership unread — refusing:', error.message, { event_id: eventId });
    return false;
  }
  return (member as { member_type?: string } | null)?.member_type === 'couple';
}
