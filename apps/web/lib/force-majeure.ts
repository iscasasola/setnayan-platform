// Shared labels and types for force-majeure flags. Pure module — safe to
// import from server, client, and route-handler code. The string sets here
// must stay in sync with the CHECK constraints on public.force_majeure_flags
// (see supabase/migrations/20260514110000_force_majeure_flags.sql).

import type { SupabaseClient } from '@supabase/supabase-js';

export const FLAG_TYPES = [
  'typhoon',
  'family_emergency',
  'vendor_cancellation',
  'venue_cancellation',
  'other',
] as const;

export type FlagType = (typeof FLAG_TYPES)[number];

export const FLAG_TYPE_LABEL: Record<FlagType, string> = {
  typhoon: 'Typhoon',
  family_emergency: 'Family emergency',
  vendor_cancellation: 'Vendor cancellation',
  venue_cancellation: 'Venue cancellation',
  other: 'Other',
};

export const FLAG_STATUSES = [
  'open',
  'under_review',
  // A stale flag the auto-sweep advanced for admin attention (it is NOT a
  // resolution — the flag stays in the triage queue). Added 2026-07-24 (gap
  // audit B2): the sweep used to silently mark stale flags 'resolved'.
  'escalated',
  'refund_issued',
  'rescheduled',
  'partial_credit',
  'mediation',
  'resolved',
  'dismissed',
] as const;

export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const FLAG_STATUS_LABEL: Record<FlagStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  escalated: 'Escalated',
  refund_issued: 'Refund issued',
  rescheduled: 'Rescheduled',
  partial_credit: 'Partial credit',
  mediation: 'Mediation',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

// Tone colours follow the existing palette (terracotta for action-needed,
// amber for in-flight, emerald for happy resolutions, rose for dismissed).
export const FLAG_STATUS_TONE: Record<FlagStatus, string> = {
  open: 'bg-danger-100 text-danger-800',
  under_review: 'bg-warn-100 text-warn-900',
  escalated: 'bg-danger-100 text-danger-800',
  refund_issued: 'bg-success-100 text-success-800',
  rescheduled: 'bg-success-100 text-success-800',
  partial_credit: 'bg-success-100 text-success-800',
  mediation: 'bg-violet-100 text-violet-800',
  resolved: 'bg-success-200 text-success-900',
  dismissed: 'bg-ink/10 text-ink/55',
};

// The 6 resolution paths an admin can take. Excludes `open` and
// `under_review` which are reached by "take ownership", not resolution.
export const RESOLUTION_ACTIONS = [
  'refund_issued',
  'rescheduled',
  'partial_credit',
  'mediation',
  'resolved',
  'dismissed',
] as const satisfies readonly FlagStatus[];

export type ResolutionAction = (typeof RESOLUTION_ACTIONS)[number];

export function isFlagType(value: unknown): value is FlagType {
  return typeof value === 'string' && (FLAG_TYPES as readonly string[]).includes(value);
}

export function isResolutionAction(value: unknown): value is ResolutionAction {
  return (
    typeof value === 'string' &&
    (RESOLUTION_ACTIONS as readonly string[]).includes(value)
  );
}

/**
 * Idempotent lazy sweep — advances stale `open` / `under_review` flags to
 * `escalated` once their 7-day `auto_resolve_at` window has elapsed. Call
 * from any page that lists or surfaces force-majeure flags (admin queue +
 * couple disputes page) so the data converges on next pageview.
 *
 * Gap audit B2 (2026-07-24): this used to silently mark stale flags
 * `resolved` from the admin's (or the couple's OWN) triage pageview — a
 * destructive close of an untouched dispute, and the "escalated" path the
 * help/tour copy promises did not exist. It now ESCALATES: the flag stays in
 * the admin triage queue (page.tsx admits `escalated` into the default
 * filter) with no resolution stamped, so a real admin still decides the
 * outcome. Nothing is ever auto-CLOSED without a human.
 *
 * Per the owner-locked no-cron architecture (PR #47, 2026-05-14): use
 * database state + on-access checks instead of any scheduled job. The
 * sweep is best-effort — failures never block the page render.
 *
 * Requires a service-role / admin client because the couple's session
 * client can't UPDATE `force_majeure_flags` (admin-only UPDATE policy
 * from the base migration).
 */
export async function sweepEscalateStaleFlags(
  adminClient: SupabaseClient,
): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    await adminClient
      .from('force_majeure_flags')
      .update({ status: 'escalated' })
      .in('status', ['open', 'under_review'])
      .lt('auto_resolve_at', nowIso);
  } catch (e) {
    console.error('[force-majeure] escalation sweep failed:', e);
  }
}

// Returns a human-readable "auto-resolve in X" string. Negative = elapsed.
// Returns null when the input is null (no auto-resolve set, shouldn't happen
// at the DB level but we tolerate it).
export function formatAutoResolveCountdown(
  isoTimestamp: string | null,
  now = new Date(),
): string | null {
  if (!isoTimestamp) return null;
  const target = new Date(isoTimestamp).getTime();
  const diffMs = target - now.getTime();
  const absMs = Math.abs(diffMs);
  const days = Math.floor(absMs / 86_400_000);
  const hours = Math.floor((absMs % 86_400_000) / 3_600_000);
  if (diffMs <= 0) {
    if (days > 0) return `auto-resolved ${days}d ago`;
    return 'auto-resolve elapsed';
  }
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.max(1, Math.floor(absMs / 60_000));
  return `${mins}m left`;
}
