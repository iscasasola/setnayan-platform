import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Setnayan Concierge — shared types, expiry formula, lazy sweeps.
 *
 * Source of truth for the V1 spec lives in iteration 0016 § 0 (wedding-anchored
 * access · 3-day card-less trial · tiered abuse enforcement). Single SKU
 * `concierge_complete` at ₱2,499 (repriced from ₱4,999 per CLAUDE.md sixth
 * 2026-05-18 row · migration 20260518400000_concierge_repriced_to_2499.sql).
 *
 * Per CLAUDE.md 2026-05-14 (PR #47) no new cron — expiry is enforced via
 * idempotent UPDATEs at the top of any page that surfaces Concierge state
 * (`sweepExpiredConcierge`).
 */

export type ConciergeStatus = 'diy' | 'trial' | 'active' | 'expired';
export type ConciergeTier = 'complete';

export type ConciergeEnforcementLevel =
  | 'none'
  | 'warning'
  | 'trial_banned'
  | 'full_banned';

// Owner-set kill switch (2026-05-20). Concierge surface is hidden from
// every entry point in the app while the purchase flow gets reworked
// (see chat log re: ideal-budget vs pay-now conflation in
// /dashboard/{eventId}/orders/new). Direct URLs to /dashboard/profile/concierge
// render a "Temporarily unavailable" panel — they do not 404, so any
// bookmarked links stay polite.
//
// Flip to `true` to re-light Concierge once the purchase form is rebuilt
// as a fixed-price SKU flow (no free-form budget input).
export const CONCIERGE_ENABLED = false;

export const CONCIERGE_PRICE_CENTAVOS = 249_900; // ₱2,499
export const CONCIERGE_PRICE_PHP = 2_499;
export const TRIAL_DURATION_DAYS = 3;
export const FLOOR_MONTHS = 12;
export const CAP_MONTHS = 24;
export const POST_WEDDING_TAIL_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/**
 * Wedding-anchored expiry formula, locked 2026-05-17 (third decision-log row):
 *
 *   expires = LEAST(
 *     GREATEST(wedding_date + 30 days, activated_at + 12 months),
 *     activated_at + 24 months
 *   )
 *
 * If `weddingDate` is null, defaults to the 12-month floor.
 *
 * Tested cases (see action JSDoc): NULL · 3mo · 12mo · 24mo · 36mo.
 */
export function computeConciergeExpiry(
  activatedAt: Date,
  weddingDate: Date | null,
): Date {
  const floor = addMonths(activatedAt, FLOOR_MONTHS);
  const cap = addMonths(activatedAt, CAP_MONTHS);
  if (!weddingDate) return floor;

  const postWedding = new Date(weddingDate.getTime() + POST_WEDDING_TAIL_DAYS * MS_PER_DAY);

  // GREATEST(wedding + 30d, activated + 12mo)
  const candidate = postWedding.getTime() > floor.getTime() ? postWedding : floor;
  // LEAST(candidate, activated + 24mo)
  return candidate.getTime() < cap.getTime() ? candidate : cap;
}

/**
 * Returns the cap (activated + 24mo) for use in long-engagement advisory
 * checks. Pure helper — exported for callers that need to ask "is the
 * wedding more than 24mo from activation?" without recomputing the whole
 * formula.
 */
export function conciergeCap(activatedAt: Date): Date {
  return addMonths(activatedAt, CAP_MONTHS);
}

export function isLongEngagement(
  activatedAt: Date,
  weddingDate: Date | null,
): boolean {
  if (!weddingDate) return false;
  return weddingDate.getTime() > conciergeCap(activatedAt).getTime();
}

/**
 * Days between two timestamps, rounded toward zero. Used for "X days
 * remaining" pills throughout the UI.
 */
export function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

export function daysRemaining(expiresAt: string | Date | null): number | null {
  if (!expiresAt) return null;
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return null;
  return daysBetween(exp, new Date());
}

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Pretty-print a date as "August 15, 2026" (US locale to match the rest of
 * the dashboard surface — Setnayan is en-primary).
 */
export function formatConciergeDate(iso: string | Date | null): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Lazy expiry sweep — flips `trial` and `active` rows whose
 * `concierge_expires_at` has passed to `'expired'`. Per the no-cron lock,
 * call this at the top of any page that surfaces Concierge state (couple
 * dashboard, Settings → Concierge, admin abuse queue).
 *
 * Best-effort: failures never block page render. Idempotent — re-running
 * after the first sweep is a no-op (WHERE clause filters by status).
 */
export async function sweepExpiredConcierge(
  adminClient: SupabaseClient,
): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    await adminClient
      .from('events')
      .update({ concierge_status: 'expired' })
      .in('concierge_status', ['trial', 'active'])
      .lt('concierge_expires_at', nowIso);
  } catch (e) {
    console.error('[concierge] expiry sweep failed:', e);
  }
}

/**
 * Detect deterministic anti-abuse signals on trial-start. V1 only covers
 * CRITICAL signals (phone match · payment-method fingerprint) per
 * HANDOFF_2026-05-17 § 3 — fuzzy similarity check on wedding_date / venue /
 * couple-name is deferred to V1.1 (TODO: see iteration 0016 § 0 anti-abuse).
 *
 * Returns the matched-user IDs and the signals row to insert into
 * `concierge_abuse_flags`. Empty match list = no flag, trial proceeds.
 */
export type AbuseSignalRow = {
  matchedUserIds: string[];
  similarityScore: number;
  signals: Record<string, boolean | string>;
};

export async function detectConciergeAbuseSignals(
  adminClient: SupabaseClient,
  args: { userId: string; userPhone: string | null },
): Promise<AbuseSignalRow | null> {
  const matchedIds = new Set<string>();
  const signals: Record<string, boolean | string> = {};

  if (args.userPhone && args.userPhone.trim().length >= 6) {
    const phoneNorm = args.userPhone.trim();
    try {
      const { data } = await adminClient
        .from('users')
        .select('user_id')
        .eq('phone', phoneNorm)
        .neq('user_id', args.userId)
        .not('concierge_trial_used_at', 'is', null)
        .limit(20);
      for (const row of data ?? []) {
        matchedIds.add((row as { user_id: string }).user_id);
      }
      if ((data ?? []).length > 0) {
        signals['phone_match'] = true;
      }
    } catch (e) {
      console.error('[concierge] phone abuse-signal lookup failed:', e);
    }
  }

  // V1.1 TODO: payment-method fingerprint, wedding_date fuzzy match,
  // venue name (pg_trgm), device fingerprint / IP window. See iteration
  // 0016 § 0 anti-abuse for the full weighted signal list.

  if (matchedIds.size === 0) return null;

  // Deterministic signals fire at score 1.0 (above the 0.7 V1 threshold).
  return {
    matchedUserIds: Array.from(matchedIds),
    similarityScore: 1.0,
    signals,
  };
}

/**
 * Map a strike count to the enforcement level it triggers. Used by
 * `adminConfirmConciergeAbuse` to auto-bump and by
 * `adminLiftConciergeEnforcement` to recompute the level after appeal.
 */
export function enforcementLevelForStrikes(
  strikeCount: number,
): ConciergeEnforcementLevel {
  if (strikeCount <= 0) return 'none';
  if (strikeCount === 1) return 'warning';
  if (strikeCount === 2) return 'trial_banned';
  return 'full_banned';
}

export const ENFORCEMENT_LEVEL_LABEL: Record<ConciergeEnforcementLevel, string> = {
  none: 'No enforcement',
  warning: 'Warning',
  trial_banned: 'Trial banned',
  full_banned: 'Full banned',
};

export const ENFORCEMENT_LEVEL_TONE: Record<ConciergeEnforcementLevel, string> = {
  none: 'bg-success-100 text-success-800',
  warning: 'bg-warn-100 text-warn-900',
  trial_banned: 'bg-danger-100 text-danger-800',
  full_banned: 'bg-danger-200 text-danger-900',
};

export const CONCIERGE_STATUS_LABEL: Record<ConciergeStatus, string> = {
  diy: 'DIY mode',
  trial: '3-day Trial',
  active: 'Setnayan Concierge · active',
  expired: 'Setnayan Concierge ended',
};

export const CONCIERGE_STATUS_TONE: Record<ConciergeStatus, string> = {
  diy: 'bg-ink/10 text-ink/70',
  trial: 'bg-warn-100 text-warn-900',
  active: 'bg-success-100 text-success-800',
  expired: 'bg-ink/10 text-ink/55',
};
