/**
 * Alert-firing engine for the Hiring Predictive Guide. Runs on-access (no
 * pg_cron per [[reference_setnayan_cron_strategy]]) — every load of
 * /admin/operations-hiring triggers a sweep that:
 *
 *   1. Refreshes the bottleneck_signals_current materialized view if stale
 *   2. Detects new alert conditions (signal flips · milestone hits ·
 *      countdown deadlines)
 *   3. Inserts new rows into owner_alerts (deduped via 7-day suppression
 *      window for bottleneck alerts; once per milestone for milestone hits;
 *      once per T-30/T-14/T-7 firing for hiring countdowns)
 *   4. Fires email via the templates in `./emails.ts`
 *
 * Each detected alert is logged in owner_alerts AND sent via email atomically
 * (best-effort — email failure doesn't roll back the alert log so the owner
 * still sees the alert in the dashboard).
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBottleneckSignals, getHiringRoadmap, getMilestoneForecasts } from './queries';
import {
  sendBottleneckAlertEmail,
  sendMilestoneHitEmail,
  sendHiringCountdownEmail,
} from './emails';
import { MILESTONE_TARGETS, SIGNAL_THRESHOLDS, type BottleneckSignalName, type SignalLevel } from './types';

const BOTTLENECK_SUPPRESSION_DAYS = 7;
const COUNTDOWN_THRESHOLDS = [30, 14, 7] as const;

export type SweepResult = {
  alertsFired: number;
  emailsSent: number;
  emailsFailed: number;
  errors: string[];
};

/**
 * Main sweep entrypoint. Idempotent — safe to call on every page load.
 * Returns a summary of alerts fired in this sweep.
 */
export async function runHiringAlertSweep(dashboardUrl: string): Promise<SweepResult> {
  const result: SweepResult = { alertsFired: 0, emailsSent: 0, emailsFailed: 0, errors: [] };
  const supabase = createAdminClient();

  // --- Step 1: bottleneck signal flips ---
  const signals = await getBottleneckSignals();
  if (!signals) {
    return result;
  }

  const flipChecks: Array<{
    name: BottleneckSignalName;
    level: SignalLevel;
    currentValue: string;
    threshold: string;
    recommendedRole?: string;
    recommendedSalaryRange?: string;
  }> = [
    {
      name: 'verification',
      level: signals.verification_signal,
      currentValue: `${signals.verification_backlog_count} pending verifications`,
      threshold: SIGNAL_THRESHOLDS.verification.red,
      recommendedRole: 'Vendor Verification Lead',
      recommendedSalaryRange: '₱50,000–100,000/mo',
    },
    {
      name: 'support',
      level: signals.support_signal,
      currentValue: `${signals.support_avg_response_hours.toFixed(1)}h avg response (last 7d)`,
      threshold: SIGNAL_THRESHOLDS.support.red,
      recommendedRole: 'Customer Support Lead',
      recommendedSalaryRange: '₱45,000–90,000/mo',
    },
    {
      name: 'marketing',
      level: signals.marketing_signal,
      currentValue: `${signals.signups_last_week} signups (vs ${signals.signups_prior_week} prior)`,
      threshold: SIGNAL_THRESHOLDS.marketing.red,
      recommendedRole: 'Marketing / Content Lead',
      recommendedSalaryRange: '₱60,000–120,000/mo',
    },
    {
      name: 'disputes',
      level: signals.disputes_signal,
      currentValue: `${signals.open_disputes} open disputes`,
      threshold: SIGNAL_THRESHOLDS.disputes.red,
      recommendedRole: 'Disputes Handler',
      recommendedSalaryRange: '₱45,000–90,000/mo',
    },
  ];

  for (const check of flipChecks) {
    if (check.level !== 'red' && check.level !== 'yellow') continue;

    // Suppression check — was this signal alerted in the last 7 days?
    const suppressUntil = new Date(Date.now() - BOTTLENECK_SUPPRESSION_DAYS * 24 * 60 * 60 * 1000);
    const { data: recent } = await supabase
      .from('owner_alerts')
      .select('alert_id')
      .in('alert_type', ['bottleneck_red', 'bottleneck_yellow'])
      .eq('signal_name', check.name)
      .gte('fired_at', suppressUntil.toISOString())
      .limit(1);

    if (recent && recent.length > 0) continue;

    // Fire the alert
    const alertType = check.level === 'red' ? 'bottleneck_red' : 'bottleneck_yellow';
    const { error: insertErr } = await supabase.from('owner_alerts').insert({
      alert_type: alertType,
      signal_name: check.name,
      payload: {
        level: check.level,
        currentValue: check.currentValue,
        threshold: check.threshold,
      },
    });

    if (insertErr) {
      result.errors.push(`alert insert failed: ${insertErr.message}`);
      continue;
    }
    result.alertsFired++;

    // Only red-level alerts trigger email (yellow is dashboard-only)
    if (check.level === 'red') {
      const email = await sendBottleneckAlertEmail({
        signal: check.name,
        level: check.level,
        currentValue: check.currentValue,
        threshold: check.threshold,
        recommendedRole: check.recommendedRole,
        recommendedSalaryRange: check.recommendedSalaryRange,
        dashboardUrl,
      });
      if (email.ok) result.emailsSent++;
      else result.emailsFailed++;
    }
  }

  // --- Step 2: milestone hits ---
  const milestones = await getMilestoneForecasts(signals.verified_active);
  for (const milestone of milestones) {
    if (milestone.current_value < milestone.milestone_target) continue;

    // Have we already alerted on this milestone?
    const { data: priorMilestone } = await supabase
      .from('owner_alerts')
      .select('alert_id')
      .eq('alert_type', 'milestone_hit')
      .eq('milestone_value', milestone.milestone_target)
      .limit(1);
    if (priorMilestone && priorMilestone.length > 0) continue;

    const { error: msInsertErr } = await supabase.from('owner_alerts').insert({
      alert_type: 'milestone_hit',
      milestone_value: milestone.milestone_target,
      payload: {
        label: milestone.milestone_label,
        currentValue: milestone.current_value,
      },
    });
    if (msInsertErr) {
      result.errors.push(`milestone insert failed: ${msInsertErr.message}`);
      continue;
    }
    result.alertsFired++;

    const unlocks: string[] = [];
    if (milestone.milestone_target === 1000) {
      unlocks.push('First 30 pre-registered vendors get 50% launch discount');
    } else if (milestone.milestone_target === 100) {
      unlocks.push('Pulse 2 hiring trigger — consider Vendor Verification Lead');
    } else if (milestone.milestone_target === 5000) {
      unlocks.push('Pulse 3 hiring window opens');
    }

    const email = await sendMilestoneHitEmail({
      milestoneValue: milestone.milestone_target,
      milestoneLabel: milestone.milestone_label,
      unlocks: unlocks.length > 0 ? unlocks : undefined,
      dashboardUrl,
    });
    if (email.ok) result.emailsSent++;
    else result.emailsFailed++;
  }

  // --- Step 3: hiring countdowns (T-30 / T-14 / T-7) ---
  const roadmap = await getHiringRoadmap();
  for (const role of roadmap) {
    if (role.status === 'hired' || role.status === 'deferred') continue;

    for (const threshold of COUNTDOWN_THRESHOLDS) {
      if (role.days_until_hire_by !== threshold) continue;

      const alertType = `hiring_countdown_t_minus_${threshold}` as const;

      const { data: prior } = await supabase
        .from('owner_alerts')
        .select('alert_id')
        .eq('alert_type', alertType)
        .contains('payload', { role_id: role.role_id })
        .limit(1);
      if (prior && prior.length > 0) continue;

      const { error: insertErr } = await supabase.from('owner_alerts').insert({
        alert_type: alertType,
        signal_name: role.bottleneck_signal_trigger,
        payload: {
          role_id: role.role_id,
          role_title: role.role_title,
          hire_by_date: role.hire_by_date,
          status: role.status,
        },
      });
      if (insertErr) {
        result.errors.push(`countdown insert failed: ${insertErr.message}`);
        continue;
      }
      result.alertsFired++;

      const email = await sendHiringCountdownEmail({
        role,
        daysRemaining: threshold,
        bottleneckStatus: role.bottleneck_signal_trigger
          ? {
              name: role.bottleneck_signal_trigger as BottleneckSignalName,
              level: getSignalLevel(signals, role.bottleneck_signal_trigger),
            }
          : undefined,
        dashboardUrl,
      });
      if (email.ok) result.emailsSent++;
      else result.emailsFailed++;
    }
  }

  return result;
}

function getSignalLevel(signals: Awaited<ReturnType<typeof getBottleneckSignals>>, name: string): SignalLevel {
  if (!signals) return 'green';
  switch (name) {
    case 'verification':
      return signals.verification_signal;
    case 'support':
      return signals.support_signal;
    case 'marketing':
      return signals.marketing_signal;
    case 'disputes':
      return signals.disputes_signal;
    default:
      return 'green';
  }
}
