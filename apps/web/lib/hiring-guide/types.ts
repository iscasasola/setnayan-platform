/**
 * Hiring Predictive Guide types — surfaces the Growth Cockpit in 0023 admin
 * (CLAUDE.md decision log 2026-05-20). Owner-facing dashboard that tracks
 * bottleneck signals, milestone forecasts, and Jan 30 2027 sunset hiring
 * deadlines.
 */

export type SignalLevel = 'green' | 'yellow' | 'red';

export type BottleneckSignalName =
  | 'verification'
  | 'support'
  | 'engineering'
  | 'marketing'
  | 'disputes'
  | 'founder_time';

export type BottleneckSignalsRow = {
  // Vendor verification backlog
  verification_backlog_count: number;
  verification_signal: SignalLevel;

  // Customer support response time
  support_avg_response_hours: number;
  support_signal: SignalLevel;

  // Marketing pipeline w-o-w signup growth
  signups_last_week: number;
  signups_prior_week: number;
  marketing_signal: SignalLevel;

  // Disputes volume
  open_disputes: number;
  disputes_signal: SignalLevel;

  // Vendor count for milestone forecasts
  verified_active: number;

  refreshed_at: string;
};

export type HiringPulse = 'pulse_1' | 'pulse_2' | 'pulse_3' | 'pulse_4';

export type HiringRoadmapStatus =
  | 'not_open'
  | 'sourcing'
  | 'interviewing'
  | 'offer_extended'
  | 'hired'
  | 'deferred';

export type HiringRoadmapEntry = {
  role_id: string;
  role_title: string;
  hire_by_date: string; // ISO date
  pulse: HiringPulse;
  salary_range_min_php: number | null;
  salary_range_max_php: number | null;
  status: HiringRoadmapStatus;
  bottleneck_signal_trigger: string | null;
  notes: string | null;
  /** Derived — days until hire_by_date. Negative if past due. */
  days_until_hire_by: number;
};

export type MilestoneForecast = {
  milestone_label: string;
  milestone_target: number;
  current_value: number;
  weekly_growth_rate: number;
  forecasted_date: string | null; // ISO date, null if rate is zero or negative
  weeks_to_milestone: number | null;
};

export type OwnerAlertType =
  | 'weekly_digest'
  | 'bottleneck_red'
  | 'bottleneck_yellow'
  | 'milestone_hit'
  | 'hiring_countdown_t_minus_30'
  | 'hiring_countdown_t_minus_14'
  | 'hiring_countdown_t_minus_7';

export type OwnerAlert = {
  alert_id: string;
  alert_type: OwnerAlertType;
  signal_name: string | null;
  milestone_value: number | null;
  payload: Record<string, unknown>;
  fired_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  suppressed_until: string | null;
};

export type FounderTimeReport = {
  log_id: string;
  user_id: string;
  week_starting: string; // ISO date
  primary_function: string;
  primary_pct: number;
  notes: string | null;
  reported_at: string;
};

/** Sunset deadline locked per CLAUDE.md 2026-05-20 launch promo decision. */
export const JAN_30_2027_SUNSET = '2027-01-30';

/**
 * Bottleneck signal thresholds per CLAUDE.md 2026-05-20 Hiring Predictive
 * Guide row. Used for display + alert-trigger logic.
 */
export const SIGNAL_THRESHOLDS = {
  verification: {
    green: '< 10 backlog/week',
    yellow: '10–25 backlog/week',
    red: '> 25 backlog/week',
  },
  support: {
    green: '< 2h avg response',
    yellow: '2–24h avg response',
    red: '> 24h avg response',
  },
  engineering: {
    green: '0 critical blockers',
    yellow: '1 critical blocker',
    red: '> 1 critical blocker for 2+ weeks',
  },
  marketing: {
    green: 'signups growing w-o-w',
    yellow: 'flat 2 weeks',
    red: 'declining 2 weeks',
  },
  disputes: {
    green: '< 2/week',
    yellow: '2–5/week',
    red: '> 5/week',
  },
  founder_time: {
    green: '< 30% on one function',
    yellow: '30–50% on one function',
    red: '> 50% on one function',
  },
} as const;

/**
 * Vendor + visit milestone targets that surface in the dashboard. The first
 * two are also gates from the marketing-SKU traffic gate (CLAUDE.md decision
 * log 2026-05-20).
 */
export const MILESTONE_TARGETS = [
  { label: 'Pulse 2 trigger', value: 100 },
  { label: 'Marketing SKU unlock', value: 1000 },
  { label: 'Phase 2 ad pricing', value: 5000 },
  { label: 'Pulse 4 scale', value: 25000 },
] as const;
