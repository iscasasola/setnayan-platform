// Shared labels and types for force-majeure flags. Pure module — safe to
// import from server, client, and route-handler code. The string sets here
// must stay in sync with the CHECK constraints on public.force_majeure_flags
// (see supabase/migrations/20260514110000_force_majeure_flags.sql).

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
  open: 'bg-rose-100 text-rose-800',
  under_review: 'bg-amber-100 text-amber-900',
  refund_issued: 'bg-emerald-100 text-emerald-800',
  rescheduled: 'bg-emerald-100 text-emerald-800',
  partial_credit: 'bg-emerald-100 text-emerald-800',
  mediation: 'bg-violet-100 text-violet-800',
  resolved: 'bg-emerald-200 text-emerald-900',
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
