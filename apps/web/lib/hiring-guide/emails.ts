/**
 * Email templates for the Hiring Predictive Guide (CLAUDE.md decision log
 * 2026-05-20). Sent via the existing Resend infra in `apps/web/lib/email.ts`.
 *
 * All four templates route to the owner notification address
 * (NEXT_PUBLIC_OWNER_NOTIFICATION_EMAIL or process.env.OWNER_NOTIFICATION_EMAIL,
 * falling back to iscasasolaii@gmail.com per
 * [[reference_setnayan_owner_email]]).
 *
 * These are text-only templates following the existing sendVendorInviteEmail
 * pattern. HTML rendering is a follow-on.
 */

import 'server-only';
import { sendEmail, type SendEmailResult } from '@/lib/email';
import type {
  BottleneckSignalName,
  HiringRoadmapEntry,
  MilestoneForecast,
  SignalLevel,
} from './types';

export function getOwnerNotificationEmail(): string {
  return (
    process.env.OWNER_NOTIFICATION_EMAIL ??
    process.env.NEXT_PUBLIC_OWNER_NOTIFICATION_EMAIL ??
    'iscasasolaii@gmail.com'
  );
}

// ---------------------------------------------------------------------------
// 1. Weekly Growth Digest — fires Mon 8am PHT (recurring)
// ---------------------------------------------------------------------------

export type WeeklyDigestArgs = {
  verifiedActiveVendors: number;
  signupsLastWeek: number;
  signupsPriorWeek: number;
  weeklyBookingsPhp: number | null;
  setnayanRevenue5pctPhp: number | null;
  bottlenecks: Array<{ name: BottleneckSignalName; level: SignalLevel; detail: string }>;
  hireByCountdowns: Array<{ role: string; daysUntil: number }>;
  milestones: MilestoneForecast[];
  dashboardUrl: string;
};

export async function sendHiringWeeklyDigestEmail(
  args: WeeklyDigestArgs,
): Promise<SendEmailResult> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekLabel = weekStart.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
  });

  const growthPct =
    args.signupsPriorWeek > 0
      ? Math.round(((args.signupsLastWeek - args.signupsPriorWeek) / args.signupsPriorWeek) * 100)
      : null;

  const lines: string[] = [
    `Setnayan Growth Digest — Week of ${weekLabel}`,
    ``,
    `This week:`,
    `  • Verified active vendors: ${args.verifiedActiveVendors.toLocaleString('en-PH')}`,
    `  • Vendor signups: ${args.signupsLastWeek}${growthPct !== null ? ` (${growthPct >= 0 ? '+' : ''}${growthPct}% vs prior week)` : ''}`,
  ];
  if (args.weeklyBookingsPhp !== null) {
    lines.push(`  • Bookings processed via Setnayan Pay: ₱${args.weeklyBookingsPhp.toLocaleString('en-PH')}`);
  }
  if (args.setnayanRevenue5pctPhp !== null) {
    lines.push(`  • Setnayan revenue (5% Pay fee): ₱${args.setnayanRevenue5pctPhp.toLocaleString('en-PH')}`);
  }

  lines.push(``, `Bottleneck signals:`);
  for (const b of args.bottlenecks) {
    const icon = b.level === 'red' ? '🔴' : b.level === 'yellow' ? '🟡' : '🟢';
    lines.push(`  ${icon} ${b.name}: ${b.detail}`);
  }

  if (args.milestones.length > 0) {
    lines.push(``, `Forecasted milestones:`);
    for (const m of args.milestones.slice(0, 3)) {
      if (m.forecasted_date) {
        lines.push(
          `  • ${m.milestone_target.toLocaleString('en-PH')} vendors (${m.milestone_label}): ${m.forecasted_date} (~${m.weeks_to_milestone} weeks)`,
        );
      }
    }
  }

  if (args.hireByCountdowns.length > 0) {
    lines.push(``, `Hiring deadlines (Jan 30 2027 sunset):`);
    for (const h of args.hireByCountdowns) {
      lines.push(`  • ${h.role}: ${h.daysUntil > 0 ? `${h.daysUntil} days remaining` : `${Math.abs(h.daysUntil)} days OVERDUE`}`);
    }
  }

  lines.push(
    ``,
    `View the full dashboard: ${args.dashboardUrl}`,
    ``,
    `—`,
    `Set na 'yan.`,
  );

  return sendEmail({
    to: getOwnerNotificationEmail(),
    subject: `Setnayan Growth Digest — Week of ${weekLabel}`,
    text: lines.join('\n'),
  });
}

// ---------------------------------------------------------------------------
// 2. Bottleneck Alert — fires real-time when signal flips yellow → red
//    (Suppressed 7 days after fire to avoid alert fatigue)
// ---------------------------------------------------------------------------

export type BottleneckAlertArgs = {
  signal: BottleneckSignalName;
  level: SignalLevel;
  currentValue: string;
  threshold: string;
  recommendedRole?: string;
  recommendedSalaryRange?: string;
  dashboardUrl: string;
};

const SIGNAL_LABEL: Record<BottleneckSignalName, string> = {
  verification: 'Vendor Verification Backlog',
  support: 'Customer Support Response Time',
  engineering: 'Engineering Blockers',
  marketing: 'Marketing Pipeline',
  disputes: 'Open Disputes / Force Majeure',
  founder_time: 'Founder Time Allocation',
};

export async function sendBottleneckAlertEmail(
  args: BottleneckAlertArgs,
): Promise<SendEmailResult> {
  const levelIcon = args.level === 'red' ? '🚨' : '⚠️';
  const levelWord = args.level.toUpperCase();
  const label = SIGNAL_LABEL[args.signal];

  const lines: string[] = [
    `${levelIcon} Setnayan Alert — ${label} just flipped ${levelWord}`,
    ``,
    `Current: ${args.currentValue}`,
    `Threshold: ${args.threshold}`,
    ``,
  ];

  if (args.recommendedRole) {
    lines.push(`Recommended action:`, `  → Hire ${args.recommendedRole}`);
    if (args.recommendedSalaryRange) {
      lines.push(`  → Salary range: ${args.recommendedSalaryRange}`);
    }
    lines.push(``);
  }

  lines.push(
    `This alert won't repeat for 7 days. Resolve or acknowledge in the dashboard.`,
    ``,
    `Take action: ${args.dashboardUrl}`,
    ``,
    `—`,
    `Set na 'yan.`,
  );

  return sendEmail({
    to: getOwnerNotificationEmail(),
    subject: `${levelIcon} Setnayan Alert — ${label} at ${levelWord}`,
    text: lines.join('\n'),
  });
}

// ---------------------------------------------------------------------------
// 3. Milestone Hit — fires real-time when vendor count crosses 100/1,000/5,000/25,000
// ---------------------------------------------------------------------------

export type MilestoneHitArgs = {
  milestoneValue: number;
  milestoneLabel: string;
  unlocks?: string[];
  dashboardUrl: string;
};

export async function sendMilestoneHitEmail(
  args: MilestoneHitArgs,
): Promise<SendEmailResult> {
  const lines: string[] = [
    `🎉 Setnayan hit ${args.milestoneValue.toLocaleString('en-PH')} verified active vendors today.`,
    ``,
    `Milestone: ${args.milestoneLabel}`,
    ``,
  ];

  if (args.unlocks && args.unlocks.length > 0) {
    lines.push(`This milestone unlocks:`);
    for (const u of args.unlocks) {
      lines.push(`  ✓ ${u}`);
    }
    lines.push(``);
  }

  lines.push(
    `View the full dashboard: ${args.dashboardUrl}`,
    ``,
    `—`,
    `Set na 'yan.`,
  );

  return sendEmail({
    to: getOwnerNotificationEmail(),
    subject: `🎉 Milestone — ${args.milestoneValue.toLocaleString('en-PH')} verified vendors`,
    text: lines.join('\n'),
  });
}

// ---------------------------------------------------------------------------
// 4. Hiring Countdown — fires at T-30, T-14, T-7 days before each hire-by date
// ---------------------------------------------------------------------------

export type HiringCountdownArgs = {
  role: HiringRoadmapEntry;
  daysRemaining: 30 | 14 | 7;
  bottleneckStatus?: { name: BottleneckSignalName; level: SignalLevel };
  dashboardUrl: string;
};

export async function sendHiringCountdownEmail(
  args: HiringCountdownArgs,
): Promise<SendEmailResult> {
  const urgency =
    args.daysRemaining === 7
      ? '🚨 1 week to'
      : args.daysRemaining === 14
        ? '⚠️ 2 weeks to'
        : '⏰ 30 days to';

  const salaryRange =
    args.role.salary_range_min_php && args.role.salary_range_max_php
      ? `₱${args.role.salary_range_min_php.toLocaleString('en-PH')}–₱${args.role.salary_range_max_php.toLocaleString('en-PH')}/mo`
      : 'see roadmap';

  const lines: string[] = [
    `${urgency} ${args.role.role_title} hire-by date (${args.role.hire_by_date})`,
    ``,
    `Salary range: ${salaryRange}`,
    `Current status: ${args.role.status.replace(/_/g, ' ')}`,
  ];

  if (args.bottleneckStatus && args.bottleneckStatus.level !== 'green') {
    lines.push(
      ``,
      `Related signal: ${SIGNAL_LABEL[args.bottleneckStatus.name]} is currently ${args.bottleneckStatus.level.toUpperCase()} — this hire is needed to relieve that bottleneck.`,
    );
  }

  if (args.role.notes) {
    lines.push(``, `Notes: ${args.role.notes}`);
  }

  lines.push(
    ``,
    `Update status: ${args.dashboardUrl}`,
    ``,
    `—`,
    `Set na 'yan.`,
  );

  return sendEmail({
    to: getOwnerNotificationEmail(),
    subject: `${urgency.replace(/[🚨⚠️⏰]\s*/g, '')} ${args.role.role_title} hire`,
    text: lines.join('\n'),
  });
}
