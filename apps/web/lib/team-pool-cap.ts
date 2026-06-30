import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// ────────────────────────────────────────────────────────────────────────────
// Admin account-access model — Phase 2d: §10b team-pool weekly cap.
//
// Problem (design §4): the §10b shared comp pool (comp_grants.source='team_pool')
// has no per-member ceiling — one team-pool member could drain the whole
// allocation in a week.
//
// Fix: a per-member ROLLING-7-DAY spend cap (default ₱2,500/member/week,
// admin-configurable) enforced by a BEFORE INSERT trigger on comp_grants
// (migration enforce_team_pool_weekly_cap). The cap is enforced in the DB so it
// binds regardless of which code path inserts the grant — including the
// service-role admin client, which bypasses RLS but NOT triggers.
//
// SAFETY — fails-OFF: the trigger is inert unless
// platform_settings.team_pool_weekly_cap_enforced IS TRUE, so enabling it is a
// deliberate owner action. There is also no team_pool comp insert path in the
// app today, so the trigger is a no-op on all current inserts.
//
// This module is the TS-side accessor for the config + the error-surfacing
// helper. The cap itself lives in the trigger — this is read/format glue for a
// future admin settings UI and for relaying the trigger's rejection cleanly.
// ────────────────────────────────────────────────────────────────────────────

/** Fail-safe default cap when platform_settings carries no value: ₱2,500 in centavos. */
export const TEAM_POOL_WEEKLY_CAP_DEFAULT_CENTAVOS = 250_000;

/** UPPER_SNAKE error codes the trigger RAISEs (relayed verbatim from Postgres). */
export const TEAM_POOL_CAP_EXCEEDED_CODE = 'TEAM_POOL_WEEKLY_CAP_EXCEEDED';
export const TEAM_POOL_GRANT_REQUIRES_GRANTER_CODE = 'TEAM_POOL_GRANT_REQUIRES_GRANTER';

export type TeamPoolCapConfig = {
  /** Whether the trigger is actively enforcing (tri-state resolved to a boolean; fails-OFF). */
  enforced: boolean;
  /** The configured per-member rolling-7-day cap in PHP centavos. */
  capCentavos: number;
};

/**
 * Resolve the §10b team-pool weekly-cap config, DB-first / fails-OFF.
 * UNCACHED on purpose — a console flip must take effect on the next request,
 * mirroring resolveSetnayanAiPaywallEnabled().
 */
export async function resolveTeamPoolCapConfig(): Promise<TeamPoolCapConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_settings')
      .select('team_pool_weekly_cap_enforced, team_pool_weekly_cap_centavos')
      .eq('id', 1)
      .maybeSingle();
    const enforcedDb = data?.team_pool_weekly_cap_enforced as
      | boolean
      | null
      | undefined;
    const capDb = data?.team_pool_weekly_cap_centavos as number | null | undefined;
    return {
      enforced: enforcedDb === true,
      capCentavos:
        typeof capDb === 'number' && Number.isFinite(capDb) && capDb >= 0
          ? capDb
          : TEAM_POOL_WEEKLY_CAP_DEFAULT_CENTAVOS,
    };
  } catch {
    // DB unreachable / columns absent (pre-migration) → fails-OFF defaults.
    return {
      enforced: false,
      capCentavos: TEAM_POOL_WEEKLY_CAP_DEFAULT_CENTAVOS,
    };
  }
}

/**
 * Turn a comp_grants insert error into a friendly, user-facing message when it
 * is one of the team-pool cap rejections (else returns null so the caller can
 * fall through to its generic handling). The trigger RAISEs
 * `TEAM_POOL_WEEKLY_CAP_EXCEEDED: cap=… spent_7d=… this_grant=…` (all centavos).
 */
export function describeTeamPoolCapError(message: string | undefined | null): string | null {
  if (typeof message !== 'string') return null;
  if (message.includes(TEAM_POOL_CAP_EXCEEDED_CODE)) {
    const peso = (centavos: number) =>
      `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
    const cap = /cap=(\d+)/.exec(message)?.[1];
    const spent = /spent_7d=(\d+)/.exec(message)?.[1];
    if (cap && spent) {
      return `This team-pool comp would exceed the weekly limit of ${peso(
        Number(cap),
      )} per member (already used ${peso(Number(spent))} in the last 7 days).`;
    }
    return 'This team-pool comp would exceed the per-member weekly limit.';
  }
  if (message.includes(TEAM_POOL_GRANT_REQUIRES_GRANTER_CODE)) {
    return 'A team-pool comp must record the team member who granted it.';
  }
  return null;
}
