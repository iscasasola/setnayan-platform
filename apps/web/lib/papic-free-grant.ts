import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPapicFreeGrantPoints } from '@/lib/papic-tier-copy';

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
 */

/** The `papic_event_point_grants.source` value reserved for the free pool. */
export const PAPIC_FREE_GRANT_SOURCE = 'free_grant' as const;

export type FreePapicGrantRow = {
  event_id: string;
  points: number;
  source: typeof PAPIC_FREE_GRANT_SOURCE;
  note: string;
};

/**
 * The row we insert. PURE + unit-tested, so the shape is asserted without a
 * database. `points` is passed IN (resolved from the admin-editable config by
 * the caller) rather than baked in — that is the whole point of the 2026-07-28
 * correction.
 */
export function freePapicGrantRow(eventId: string, points: number): FreePapicGrantRow {
  return {
    event_id: eventId,
    points,
    source: PAPIC_FREE_GRANT_SOURCE,
    note: 'Free pool — armed at event creation (owner-locked 2026-07-27).',
  };
}

/**
 * Arm the free 50-point pool for an event. Idempotent, best-effort, non-fatal.
 *
 * Returns true when this call inserted the grant OR the grant was already there
 * (i.e. the event is fenced either way), false only when the write errored and
 * the event may still be unmetered.
 *
 * MUST be called with an ADMIN (service-role) client: the couple's own RLS
 * client has no INSERT policy on papic_event_point_grants, and it must not —
 * a host granting themselves points is exactly what the fence exists to stop.
 */
export async function ensureFreePapicPoolGrantAdmin(
  admin: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    // The admin-editable allowance. Resolved per call rather than cached: event
    // creation is rare, the read is one indexed row, and a stale cache here would
    // silently mint the OLD allowance after an admin edit — the exact drift this
    // correction exists to remove.
    const points = await fetchPapicFreeGrantPoints(admin);
    const { error } = await admin
      .from('papic_event_point_grants')
      .insert(freePapicGrantRow(eventId, points));
    if (!error) return true;
    // 23505 = unique_violation against papic_event_point_grants_one_free_per_event
    // → this event is ALREADY armed. That is the steady state (every call after
    // the first), not a failure.
    return isAlreadyArmedError(error);
  } catch {
    // Pre-bootstrap DB / missing table / transport hiccup. Never fatal: the
    // Papic-studio self-heal call retries on the next render.
    return false;
  }
}

/**
 * True when a PostgREST error means "the free grant already exists".
 * PURE + unit-tested — this predicate is the difference between "armed" and a
 * false alarm, so it is asserted rather than trusted.
 */
export function isAlreadyArmedError(error: { code?: string | null } | null): boolean {
  return error?.code === '23505';
}
