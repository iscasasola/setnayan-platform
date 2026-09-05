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
 *
 * FIRST EVENT ONLY (2026-09-04, owner-confirmed)
 * ───────────────────────────────────────────────
 * The free allowance is a "try Papic once" sample, not a per-event perk — an
 * account gets it on their FIRST event ever and (practically) nothing on
 * every event after, regardless of event_type (per-type would have been a
 * 16x farming loophole: one simple_event + one wedding + one birthday etc.
 * all on the same account). "First" is resolved from event_members
 * (member_type='couple'): any OTHER event already carrying a couple row for
 * this user_id means this is not the first.
 *
 * 🚨 IT CANNOT ACTUALLY BE ZERO — RULE 0 MISS CAUGHT MID-BUILD. The obvious
 * design ("insert a free_grant row with points = 0") is a schema-level
 * impossibility (points had `CHECK (points > 0)`) AND, worse, would not have
 * worked even with that relaxed: `papic_event_pool_status()` (live def.
 * migration 20271185813837) fences on `SUM(points) > 0`, not on whether a
 * grant ROW exists — its own comment says so explicitly: "granted_points <= 0
 * is this function's test for 'this event has no Papic pool product at
 * all'". A 0-point row is therefore indistinguishable from no grant at all
 * and would revert the event to the exact "no fence → unmetered" state this
 * whole module exists to prevent.
 *
 * So a repeat event gets `PAPIC_REPEAT_EVENT_GRANT_POINTS` (1) instead of the
 * full allowance — enough to flip `applies = TRUE` and fence the event,
 * consumed by the very first capture. Not literally "0 credits shown", but
 * the closest the current additive-sum model can express without changing
 * `papic_event_pool_status()` itself (a shared, many-times-redefined RPC —
 * out of scope for this change; loosening its `<= 0` check to an EXISTS
 * check would be a real behavior change for unrelated cases, e.g. a fully
 * refunded pool netting to exactly 0).
 *
 * The owning account is resolved two ways: at event-creation call sites the
 * caller passes `creatingUserId` directly (event_members doesn't have the
 * couple row yet at that point in the flow). At the Papic-studio self-heal
 * call site, `creatingUserId` is omitted and the couple's user_id is looked
 * up from event_members instead — deliberately NOT the visiting user, since
 * self-heal can fire for any studio visitor, not only the couple.
 *
 * If the owning user_id can't be resolved at all (lookup error, no couple row
 * yet), this falls back to granting the FULL allowance rather than the
 * repeat-event minimum — consistent with the module's best-effort
 * philosophy: a lookup hiccup should never wrongly deny a genuine
 * first-timer their free credits.
 */

/** The `papic_event_point_grants.source` value reserved for the free pool. */
export const PAPIC_FREE_GRANT_SOURCE = 'free_grant' as const;

/**
 * What a repeat event's free grant carries instead of the full allowance.
 * MUST stay > 0 — see the module docblock's "IT CANNOT ACTUALLY BE ZERO"
 * section: `papic_event_pool_status()` fences on `SUM(points) > 0`, so 0
 * would silently revert the event to unmetered.
 */
export const PAPIC_REPEAT_EVENT_GRANT_POINTS = 1;

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
 * correction. `isFirstEvent` picks the note text explicitly rather than being
 * inferred from `points`, since both branches now grant a positive number.
 */
export function freePapicGrantRow(
  eventId: string,
  points: number,
  isFirstEvent: boolean,
): FreePapicGrantRow {
  return {
    event_id: eventId,
    points,
    source: PAPIC_FREE_GRANT_SOURCE,
    note: isFirstEvent
      ? 'Free pool — armed at event creation (owner-locked 2026-07-27).'
      : 'Free pool minimum — not this account\'s first event (owner-confirmed 2026-09-04).',
  };
}

/**
 * True when `userId` already has another event carrying a 'couple' row —
 * i.e. this is NOT their first event, regardless of event_type. PURE query,
 * unit-tested via a stubbed client.
 */
async function hasPriorPapicEvent(
  admin: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple')
    .neq('event_id', eventId)
    .limit(1);
  if (error) throw error;
  return !!data && data.length > 0;
}

/**
 * Resolves the couple's user_id for an event from event_members. Used only at
 * the self-heal call site, where the visiting user may not be the couple.
 */
async function resolveCoupleUserId(admin: SupabaseClient, eventId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple')
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.user_id;
}

/**
 * Resolves this event's free grant: the full admin-configured allowance on an
 * account's first event ever, `PAPIC_REPEAT_EVENT_GRANT_POINTS` on every
 * event after. Never throws — any resolution failure (unknown owner, query
 * error) falls back to "first event", per the best-effort contract above.
 */
async function resolveFreeGrant(
  admin: SupabaseClient,
  eventId: string,
  creatingUserId: string | undefined,
): Promise<{ points: number; isFirstEvent: boolean }> {
  const fullAllowance = await fetchPapicFreeGrantPoints(admin);
  try {
    const ownerUserId = creatingUserId ?? (await resolveCoupleUserId(admin, eventId));
    if (!ownerUserId) return { points: fullAllowance, isFirstEvent: true };
    const hasPrior = await hasPriorPapicEvent(admin, ownerUserId, eventId);
    return hasPrior
      ? { points: PAPIC_REPEAT_EVENT_GRANT_POINTS, isFirstEvent: false }
      : { points: fullAllowance, isFirstEvent: true };
  } catch {
    return { points: fullAllowance, isFirstEvent: true };
  }
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
 *
 * `creatingUserId` — pass the creating user's id at event-creation call sites
 * (event_members has no couple row yet at that point). Omit it at the
 * Papic-studio self-heal call site; the couple's user_id is looked up from
 * event_members instead, since the studio visitor need not be the couple.
 */
export async function ensureFreePapicPoolGrantAdmin(
  admin: SupabaseClient,
  eventId: string,
  creatingUserId?: string,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    // The admin-editable allowance, or the repeat-event minimum when this
    // account has already used its first-event grant elsewhere. Resolved per
    // call rather than cached: event creation is rare, the reads are indexed,
    // and a stale cache here would silently mint the OLD allowance after an
    // admin edit — the exact drift the 2026-07-28 correction removed for the
    // allowance, now extended to this.
    const { points, isFirstEvent } = await resolveFreeGrant(admin, eventId, creatingUserId);
    const { error } = await admin
      .from('papic_event_point_grants')
      .insert(freePapicGrantRow(eventId, points, isFirstEvent));
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
