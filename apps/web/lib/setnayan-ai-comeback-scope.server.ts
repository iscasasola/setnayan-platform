import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ComebackScopeEvent } from './setnayan-ai-comeback-offer';

/**
 * setnayan-ai-comeback-scope.server.ts — the ONE read that turns "this event"
 * into "every event its hosts own", so the comeback window can be scoped to the
 * USER while the price and the entitlement stay per event (owner-locked
 * 2026-08-30).
 *
 * 🔑 WHY THE SCOPE IS DERIVED FROM THE EVENT RATHER THAN PASSED IN. The charge
 * path (`resolveOrderChargeCentavos`) takes an `eventId` and NO user id — on
 * purpose, because everything it prices is server-resolved from stored state. A
 * client-supplied "here are my events" would be a client-supplied discount, and
 * a discount is a price (see lib/order-charge-authority.ts). So the hosts are
 * read from `event_members`, and their events from `event_members` again.
 *
 * ⛔ THIS IS NOT A PER-USER ENTITLEMENT AND MUST NOT BECOME ONE. The deleted
 * `getEventHostAiSubscription()` (removed 2026-08-01, owner: "it is per event")
 * did exactly this fan-out and then let ONE purchase unlock every event. This
 * returns only `created_at` and `setnayan_ai_active`, and its callers use them
 * to decide WHO IS OFFERED WHAT — never to grant access. Buying on one event
 * still unlocks that event alone.
 *
 * Every read reports its error, and an error REFUSES (SEC-7): a comeback price
 * derived from a half-read event set would be a discount nobody could justify.
 */

/**
 * A scope row carries the event's TYPE as well, so the caller can price each
 * event from its own tier without a second read. The pure eligibility module
 * stays type-agnostic — it decides membership, never money — so this widens
 * {@link ComebackScopeEvent} here rather than there.
 */
export type ComebackScopeRow = ComebackScopeEvent & { eventType: string | null };

export type ComebackScopeResolution =
  /** The host's whole event set — possibly empty, which simply means no offer. */
  | { status: 'resolved'; events: ComebackScopeRow[] }
  /** A read FAILED. No offer set is knowable, so nothing may be discounted. */
  | { status: 'read_error'; message: string };

/**
 * Every event owned by the hosts of `eventId`, as the comeback offer sees them.
 *
 * `member_type = 'couple'` is the host marker used throughout this app; a
 * coordinator or a vendor on the event is not a host and does not carry the
 * offer. `hidden_at` is deliberately NOT filtered — hiding an event is a
 * display preference, while the anchor this feeds ("when you started planning
 * with us") is a fact about when they arrived.
 */
export async function resolveComebackScopeForEvent(
  admin: SupabaseClient,
  eventId: string,
): Promise<ComebackScopeResolution> {
  // 1. Who hosts THIS event.
  const { data: hosts, error: hostsErr } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple');
  if (hostsErr) {
    return { status: 'read_error', message: `event_members(${eventId}): ${hostsErr.message}` };
  }
  const userIds = Array.from(
    new Set(
      (hosts ?? [])
        .map((r) => (r as { user_id?: string | null }).user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  // No host ⇒ nobody to offer. Empty, not an error — and it fails closed
  // downstream, because an empty set yields no window and no eligible events.
  if (userIds.length === 0) return { status: 'resolved', events: [] };

  // 2. Every event those hosts own.
  const { data: memberships, error: memErr } = await admin
    .from('event_members')
    .select('event_id')
    .in('user_id', userIds)
    .eq('member_type', 'couple');
  if (memErr) {
    return { status: 'read_error', message: `event_members(hosts): ${memErr.message}` };
  }
  const eventIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((r) => (r as { event_id?: string | null }).event_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  if (eventIds.length === 0) return { status: 'resolved', events: [] };

  // 3. The two stored facts the offer reads off each one.
  const { data: rows, error: evErr } = await admin
    .from('events')
    .select('event_id, created_at, setnayan_ai_active, event_type')
    .in('event_id', eventIds);
  if (evErr) {
    return { status: 'read_error', message: `events(host scope): ${evErr.message}` };
  }

  const events: ComebackScopeRow[] = (rows ?? []).map((r) => {
    const row = r as {
      event_id?: string | null;
      created_at?: string | null;
      setnayan_ai_active?: boolean | null;
      event_type?: string | null;
    };
    return {
      eventId: row.event_id ?? '',
      createdAt: row.created_at ?? null,
      setnayanAiActive: row.setnayan_ai_active ?? null,
      eventType: row.event_type ?? null,
    };
  });
  return { status: 'resolved', events };
}
