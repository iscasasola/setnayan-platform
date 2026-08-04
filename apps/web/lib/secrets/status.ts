// Secrets & Rotation board — age + alarm maths.
//
// PURE. No env reads, no DB, no `server-only` — every input is passed in, so the
// whole alarm surface is unit-testable (lib/secrets/status.test.ts) and the same
// function renders on the server page and in the tests.

import type { SecretDef } from './rotation-registry';

export type SecretStatus = 'ok' | 'due-soon' | 'overdue' | 'manual' | 'unknown';

/** How many days before the policy deadline we start warning. */
export const DUE_SOON_WINDOW_DAYS = 14;

const MS_PER_DAY = 86_400_000;

/** Whole-ish days between `then` and `now` (fractional — callers round for display). */
export function ageDays(lastRotatedAt: Date, now: Date = new Date()): number {
  return (now.getTime() - lastRotatedAt.getTime()) / MS_PER_DAY;
}

/**
 * The board's alarm state for one secret.
 *
 *   • policyDays null      → 'manual'  (rotate only on compromise — never alarms)
 *   • lastRotatedAt null   → 'unknown' (styled like overdue, labelled "never recorded")
 *   • age > policyDays     → 'overdue'
 *   • age > policyDays-14  → 'due-soon'
 *   • otherwise            → 'ok'
 *
 * Order matters: 'manual' wins over 'unknown', because a manual-rotation secret
 * with no recorded rotation is not a problem — it is the expected steady state.
 */
export function computeStatus(
  def: Pick<SecretDef, 'policyDays'>,
  lastRotatedAt: Date | null,
  now: Date = new Date(),
): SecretStatus {
  if (def.policyDays === null) return 'manual';
  if (!lastRotatedAt) return 'unknown';
  const age = ageDays(lastRotatedAt, now);
  if (age > def.policyDays) return 'overdue';
  if (age > def.policyDays - DUE_SOON_WINDOW_DAYS) return 'due-soon';
  return 'ok';
}

/** Statuses that light the red banner at the top of the board. */
export function isAlarming(status: SecretStatus): boolean {
  return status === 'overdue' || status === 'unknown';
}

/**
 * Effective "last rotated" for a secret: the NEWEST of
 *   (a) the platform_secret_rotations row we stamped, and
 *   (b) the newest Vercel `updatedAt` across the secret's env vars.
 *
 * (b) matters because a secret changed directly in the Vercel dashboard — the
 * pre-board workflow — would otherwise read as "never rotated" forever. Env
 * metadata carries no values, only timestamps.
 */
export function resolveLastRotated(
  def: Pick<SecretDef, 'envVars'>,
  rotationRowAt: Date | null,
  envUpdatedAtByKey: Readonly<Record<string, number | null>>,
): Date | null {
  let newest: number | null = rotationRowAt ? rotationRowAt.getTime() : null;
  for (const envVar of def.envVars) {
    const ts = envUpdatedAtByKey[envVar];
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      if (newest === null || ts > newest) newest = ts;
    }
  }
  return newest === null ? null : new Date(newest);
}

/** "rotated 12d ago" / "never recorded" — the age cell on each row. */
export function formatAge(lastRotatedAt: Date | null, now: Date = new Date()): string {
  if (!lastRotatedAt) return 'never recorded';
  const days = Math.floor(ageDays(lastRotatedAt, now));
  if (days <= 0) return 'rotated today';
  if (days === 1) return 'rotated 1 day ago';
  if (days < 60) return `rotated ${days} days ago`;
  const months = Math.floor(days / 30);
  return `rotated ~${months} months ago`;
}

/** Short chip copy per status. */
export const STATUS_LABEL: Record<SecretStatus, string> = {
  ok: 'OK',
  'due-soon': 'Due soon',
  overdue: 'Overdue',
  manual: 'Manual only',
  unknown: 'Never recorded',
};
