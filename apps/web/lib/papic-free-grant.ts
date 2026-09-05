import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/papic-free-grant.ts — ARM the Papic FREE pool.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The owner locked "Free = a 50-point shared event pool" on 2026-07-22, and
 * confirmed the figure on 2026-07-27 ("free is 50 points"). The database was
 * built for it — `papic_event_pool_status()` branches on "the event holds ANY
 * grant (Free / One / Pool)" — but nothing ever wrote the free grant.
 * `provisionFreeCamerasAdmin()` materializes the 3 tier='free' seats and stops.
 *
 * The result was not a broken free tier but an UNMETERED one: with no pass and
 * no grant, `papic_event_pool_status()` returns applies = FALSE, and
 * `papic_reserve_event_points()` takes its "fence absent → RETURN TRUE, ledger
 * untouched" branch. Free capture was effectively unlimited.
 *
 * That is survivable while Papic is opt-in. It is NOT survivable now that Papic
 * is switched on for every new event across all 16 event types (spec:
 * Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md), because it would hand
 * every signup unlimited free photo + video storage.
 *
 * THE ONE NUMBER (corrected 2026-07-28)
 * ─────────────────────────────────────
 * `papic_tier_config.free.points_per_day` is NULL by design — the One-Pool model
 * moved Free off any per-day budget onto the shared pool. The live allowance is
 * the ADMIN-EDITABLE `papic_event_pool_config.free_grant_points`, read through
 * the single reader `fetchPapicFreeGrantPoints()` in lib/papic-tier-copy.ts.
 *
 * The first cut of this module hardcoded 50 instead, which introduced a THIRD
 * copy of the number (alongside `PAPIC_FREE_GRANT_POINTS_FALLBACK` and the
 * migration literal) and — worse — meant the grant would ignore the admin
 * control entirely. An admin who set the allowance to 90 would see copy say 90
 * while the meter kept handing out 50. Display and enforcement now resolve
 * through the same reader, and `PAPIC_FREE_GRANT_POINTS_FALLBACK` is the ONE
 * fallback literal for both.
 *
 * IDEMPOTENCY IS NOT OPTIONAL
 * ───────────────────────────
 * This is called from every event-creation path AND lazily from the Papic studio
 * as a self-heal, so it WILL run more than once per event. Without a guard those
 * calls would stack 50s and silently inflate the pool.
 *
 * The guard is the partial unique index `papic_event_point_grants_one_free_per_event`
 * (migration 20271017100000), and we let it FIRE rather than trying to avoid it:
 * a plain INSERT that comes back with 23505 (unique_violation) means "already
 * armed", which is a success. We deliberately do NOT use PostgREST `upsert` +
 * `onConflict` here — `ON CONFLICT (event_id)` cannot infer a PARTIAL index
 * (Postgres requires the index predicate in the conflict target, which PostgREST
 * cannot express), so an upsert would fail outright with "no unique or exclusion
 * constraint matching the ON CONFLICT specification". Insert-and-catch is both
 * correct and race-safe: concurrent creation + self-heal calls collapse to one
 * row, and the loser reads its own 23505 as "fine, it's armed".
 *
 * The index must stay PARTIAL. A plain unique on (event_id, source) would also
 * cap `topup_order` and `camera_grant` at one row per event — but Papic Pool
 * top-ups are explicitly repeatable and Papic One is sold per camera, so those
 * sources legitimately stack. Only 'free_grant' is once-per-event.
 *
 * BEST-EFFORT BY DESIGN
 * ─────────────────────
 * Never throws, never blocks. A failure here must not break event creation — a
 * couple must always get their event. The cost of a miss is one event that stays
 * unmetered until someone opens its Papic studio, where the self-heal call arms
 * it. That is why the lazy call site is kept even though creation now covers it:
 * the two together are what make "every event is fenced" true in practice.
 *
 * FIRST EVENT ONLY — AND THE ROW IT IS STORED IN (2026-09-04, fixed 2026-09-06)
 * ────────────────────────────────────────────────────────────────────────────
 * The free allowance is a "try Papic once" sample, not a per-event perk: an
 * account gets it on their FIRST event ever and the 1-point minimum on every
 * event after, regardless of event_type (per-type would have been a 16x
 * farming loophole — one simple_event + one wedding + one birthday, each 50).
 *
 * 🚨 THE FIRST VERSION STORED THAT FACT IN A ROW THE CUSTOMER CAN DELETE.
 * It asked `event_members` whether the account had another 'couple' row. But
 * `couple_can_delete_member` is `FOR DELETE TO authenticated`, so a signed-in
 * customer could delete their own membership with one PostgREST call and the
 * history simply vanished — next event, another full 50, repeatable, with the
 * credits already granted to the older event still sitting on it. The exact
 * farming the rule was written that morning to stop, through a different door.
 * Found by a post-merge audit 2026-09-05; fixed by migration 20271208142357.
 *
 * 🔑 A RULE IS ONLY AS DURABLE AS THE ROW IT READS. The claim now lives in
 * `papic_free_grant_claims` — one row per account, ever, PRIMARY KEY on
 * user_id, REVOKEd from anon and authenticated so no browser can read or
 * delete it. Membership is the customer's to remove; entitlement history is not.
 *
 * 🔑 AND THERE IS NOW EXACTLY ONE DECISION SITE. `papic_claim_free_pool()` is
 * called by both the `event_members` trigger and this module. The previous
 * shape kept the rule in SQL *and* in TypeScript, and for a day the two
 * disagreed about which was even live — this module's own docblock claimed an
 * insert that the trigger had already won the race to perform.
 *
 * 🚨 IT CANNOT BE ZERO. A repeat event gets 1 point, not 0:
 * `papic_event_pool_status()` fences on `SUM(points) > 0`, not on whether a
 * grant ROW exists ("granted_points <= 0 is this function's test for 'this
 * event has no Papic pool product at all'"), so a 0-point row is
 * indistinguishable from no grant and would revert the event to UNMETERED
 * capture — the state this whole module exists to prevent. 1 point flips
 * applies=TRUE and is consumed by the first capture.
 */

/** The `papic_event_point_grants.source` value reserved for the free pool. */
export const PAPIC_FREE_GRANT_SOURCE = 'free_grant' as const;

/**
 * Arm the free pool for an event. Idempotent, best-effort, non-fatal.
 *
 * 🔑 THIS FUNCTION NO LONGER DECIDES ANYTHING. It calls
 * `papic_claim_free_pool(p_event_id, p_user_id)` — the one SQL decision site
 * (migration 20271208142357) that the `event_members` trigger also calls.
 * Before that migration the rule lived in BOTH places, and the two disagreed
 * about which was live for a whole day. One site cannot drift from itself.
 *
 * Returns true when the call completed (the event is armed either way — the
 * function is a no-op when a free_grant already exists), false only when the
 * RPC errored and the event may still be unmetered.
 *
 * MUST be called with an ADMIN (service-role) client: EXECUTE on the function
 * is granted to `service_role` alone, and `papic_free_grant_claims` is
 * revoked from every browser role. A customer who could reach either would be
 * able to reset their own "first event ever" — which is exactly the defect
 * this replaced (they could delete their own `event_members` row, and the old
 * rule read that table).
 *
 * `creatingUserId` — pass the creating user's id at event-creation call sites
 * (event_members has no couple row yet at that point in the flow). Omit it at
 * the Papic-studio self-heal call site: the SQL resolves the couple itself,
 * deliberately NOT the visiting user, who need not be the couple.
 */
export async function ensureFreePapicPoolGrantAdmin(
  admin: SupabaseClient,
  eventId: string,
  creatingUserId?: string,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    const { error } = await admin.rpc('papic_claim_free_pool', {
      p_event_id: eventId,
      p_user_id: creatingUserId ?? null,
    });
    if (error) {
      console.error('[ensureFreePapicPoolGrantAdmin] papic_claim_free_pool failed', error.message);
      return false;
    }
    return true;
  } catch {
    // Pre-bootstrap DB / missing function / transport hiccup. Never fatal: a
    // couple must always get their event, and the Papic-studio self-heal call
    // retries on the next render.
    return false;
  }
}
