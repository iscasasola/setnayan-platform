import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';

/**
 * apps/web/lib/kwento-access.ts
 *
 * Single source of truth for "does this event have Kwento (the guest-story
 * composer) by the OWNERSHIP dimension?".
 *
 * Kwento became a paid SKU (owner 2026-06-26) with a NEW-EVENTS-ONLY rollout
 * (owner 2026-06-26): events created before the 2026-06-27 cutover are
 * GRANDFATHERED free (events.kwento_free_grandfathered = TRUE) so no current
 * couple loses a shipped free feature; events created after need the KWENTO
 * entitlement — directly, or via a bundle that grants it (e.g. PAPIC_UNLOCK).
 *
 * Returns TRUE when the event is grandfathered OR owns KWENTO (admin-approved).
 * This REPLACES the bare eventSkuActive('KWENTO') ownership check at the Kwento
 * gates; it does NOT subsume the separate "Kwento is a Papic add-on, so Papic
 * must also be active" rule (eventPapicActive) — callers keep AND-ing that where
 * they already do, so the composed behaviour for a grandfathered event matches
 * the pre-paywall world exactly (free Kwento whenever Papic is active).
 *
 * Read on an ADMIN client (guests have no auth.uid(); couple surfaces also pass
 * admin so a co-host who didn't place the order still resolves ownership).
 * FAIL-OPEN on any read error / pre-migration column-absent state: a transient
 * hiccup must never strip a reception's free composer — this is a soft paywall
 * on a new add-on, not worth breaking the day-of experience for.
 */
export async function eventKwentoEnabled(
  admin: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('events')
      .select('kwento_free_grandfathered')
      .eq('event_id', eventId)
      .maybeSingle();
    // Pre-migration (column absent) or any read error → fail-OPEN.
    if (error) return true;
    const grandfathered =
      (data as { kwento_free_grandfathered?: boolean } | null)
        ?.kwento_free_grandfathered === true;
    if (grandfathered) return true;
    return await eventSkuActive(admin, eventId, 'KWENTO');
  } catch {
    return true; // fail-open
  }
}
