/**
 * Server queries for the Hiring Predictive Guide dashboard.
 *
 * ⚠ THE OLD HEADER HERE SAID "all queries are owner-only by RLS". That was true
 * of the three TABLES (`owner_alerts`, `founder_time_log`, `hiring_roadmap`) and
 * FALSE of `bottleneck_signals_current`, which is a MATERIALIZED VIEW —
 * materialized views do not honour row-level security, so there was no policy on
 * it and none was possible. Its defining migration
 * (`20260523000000_hiring_guide_owner_alerts.sql`) granted SELECT to
 * `authenticated`, which on Supabase means every signed-in couple, vendor, guest
 * or coordinator could read the vendor-verification backlog, support response
 * times, weekly signup counts and the open-dispute total straight off PostgREST.
 *
 * Closed by `20271116295515_revoke_bottleneck_signals_matview_from_authenticated`
 * — the GRANT is the whole access control for a matview, so revoking it IS the
 * fix. Guarded by `apps/web/tests/db/bottleneck-signals-internal-only.db.test.ts`.
 *
 * Every function below uses `createAdminClient()` (service_role), which is
 * unaffected by that revoke — the revoke cost this file nothing.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  BottleneckSignalsRow,
  HiringRoadmapEntry,
  MilestoneForecast,
  OwnerAlert,
} from './types';
import { MILESTONE_TARGETS } from './types';

/**
 * Fetch the current bottleneck signals snapshot from the materialized view.
 * The view is refreshed hourly via the on-access sweep pattern (no pg_cron
 * per [[reference_setnayan_cron_strategy]]).
 *
 * Returns null if the materialized view hasn't been populated yet — caller
 * should render an empty state and trigger a manual refresh.
 */
export async function getBottleneckSignals(): Promise<BottleneckSignalsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bottleneck_signals_current')
    .select('*')
    .order('refreshed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[hiring-guide] getBottleneckSignals failed', error);
    return null;
  }
  return data as BottleneckSignalsRow | null;
}

/**
 * On-access refresh sweep for the bottleneck signals materialized view.
 * Called from the dashboard server component if `refreshed_at` is more than
 * 1 hour stale. Idempotent — safe to call concurrently (the view has a
 * unique index on refreshed_at).
 */
export async function refreshBottleneckSignalsIfStale(): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('bottleneck_signals_current')
    .select('refreshed_at')
    .order('refreshed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastRefresh = data?.refreshed_at ? new Date(data.refreshed_at) : null;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (!lastRefresh || lastRefresh < hourAgo) {
    // ⚠ `refresh_bottleneck_signals` DOES NOT EXIST — verified against the live
    // database on 2026-08-06: no migration creates it and prod's `pg_proc` has
    // no such name. So this sweep has never refreshed anything, and the single
    // row in the view still carries `refreshed_at = 2026-05-20`, the moment
    // `CREATE MATERIALIZED VIEW` populated it.
    //
    // The old shape hid that completely: a missing RPC does not THROW through
    // postgrest-js, it RESOLVES with `{ error }`, so the try/catch below could
    // never fire and the warning it guarded has never once printed. A silent
    // no-op wearing a handled-error comment. Read the error instead.
    //
    // Not fixed here on purpose: creating the function is a database change with
    // its own decisions (CONCURRENTLY cannot run inside PostgREST's transaction;
    // a plain REFRESH takes an exclusive lock) and this file is the reader, not
    // the owner of that call.
    const { error } = await supabase.rpc('refresh_bottleneck_signals' as never);
    if (error) {
      console.error(
        '[hiring-guide] refresh_bottleneck_signals RPC failed — the bottleneck numbers on ' +
          '/admin/app-performance are STALE, not live. The function does not exist in the ' +
          'database; nothing has refreshed this view since it was created.',
        error.message,
      );
    }
  }
}

/**
 * Fetch the hiring roadmap entries seeded by the migration plus any updates
 * admin has made. Ordered by hire-by-date ascending.
 */
export async function getHiringRoadmap(): Promise<HiringRoadmapEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hiring_roadmap')
    .select('*')
    .order('hire_by_date', { ascending: true });

  if (error) {
    console.error('[hiring-guide] getHiringRoadmap failed', error);
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data ?? []).map((row) => {
    const hireBy = new Date(row.hire_by_date);
    hireBy.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((hireBy.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...row,
      days_until_hire_by: daysUntil,
    } as HiringRoadmapEntry;
  });
}

/**
 * Forecast when each milestone will be reached based on the last 4 weeks of
 * vendor signup growth. Uses a simple linear projection — refines later when
 * we have more data per CLAUDE.md decision log 2026-05-20.
 */
export async function getMilestoneForecasts(
  currentVerifiedActive: number,
): Promise<MilestoneForecast[]> {
  const supabase = createAdminClient();

  // Last 4 weeks of weekly signups
  const { data: weeklySignups } = await supabase
    .from('vendor_profiles')
    .select('created_at')
    .gte('created_at', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString());

  const weeklyCount = (weeklySignups ?? []).length / 4;

  // Growth rate: compare last 2 weeks vs prior 2 weeks
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const recentCount = (weeklySignups ?? []).filter(
    (r) => new Date(r.created_at) >= twoWeeksAgo,
  ).length;
  const priorCount = (weeklySignups ?? []).filter(
    (r) =>
      new Date(r.created_at) >= fourWeeksAgo &&
      new Date(r.created_at) < twoWeeksAgo,
  ).length;
  const growthRate = priorCount > 0 ? recentCount / priorCount : 1;

  return MILESTONE_TARGETS.map((target) => {
    const remaining = Math.max(0, target.value - currentVerifiedActive);
    if (remaining === 0) {
      return {
        milestone_label: target.label,
        milestone_target: target.value,
        current_value: currentVerifiedActive,
        weekly_growth_rate: growthRate,
        forecasted_date: null,
        weeks_to_milestone: 0,
      };
    }

    if (weeklyCount <= 0) {
      return {
        milestone_label: target.label,
        milestone_target: target.value,
        current_value: currentVerifiedActive,
        weekly_growth_rate: growthRate,
        forecasted_date: null,
        weeks_to_milestone: null,
      };
    }

    // Adjust weeks projection by momentum
    let weeksProjected = remaining / weeklyCount;
    if (growthRate > 1.1) weeksProjected *= 0.8;
    else if (growthRate < 0.95) weeksProjected *= 1.5;

    const forecastDate = new Date(Date.now() + weeksProjected * 7 * 24 * 60 * 60 * 1000);

    return {
      milestone_label: target.label,
      milestone_target: target.value,
      current_value: currentVerifiedActive,
      weekly_growth_rate: growthRate,
      forecasted_date: forecastDate.toISOString().slice(0, 10),
      weeks_to_milestone: Math.round(weeksProjected),
    };
  });
}

/**
 * Fetch recent unacknowledged alerts to surface in the dashboard banner.
 */
export async function getRecentAlerts(limit = 20): Promise<OwnerAlert[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('owner_alerts')
    .select('*')
    .is('acknowledged_at', null)
    .order('fired_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[hiring-guide] getRecentAlerts failed', error);
    return [];
  }
  return (data ?? []) as OwnerAlert[];
}

/**
 * Acknowledge an alert — called from the dashboard when owner clicks
 * acknowledge. RLS gates this to admins + internal users.
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('owner_alerts')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq('alert_id', alertId);

  if (error) {
    console.error('[hiring-guide] acknowledgeAlert failed', error);
    throw error;
  }
}
