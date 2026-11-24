import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from './vendor-tier-caps';

/**
 * vendor-deep-search-addon.ts — Deep Search (supplier-facing): who may run it, and how many runs a month includes.
 *
 * Deep Search runs the web-research deep search on a supplier's OWN business and shows the "What We Learned" review
 * (owner 2026-07-22; it REUSES the admin verification engine in lib/vendor-deep-search.ts).
 *
 * ⚖ 2026-11-22 (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED", 🧰✅ "SPECIAL TOOLS STAY INSIDE THE PLANS" and 🔎 "DEEP SEARCH
 * ALLOWANCE = 1 RUN A MONTH"). Owner, verbatim: *"Retire it"* · *"Deep Search 1 a month"*.
 *   • ⛔ NOT SOLD. The ₱499-per-search `vendor_billing_catalog.vendor_deep_search` row is retired (migration
 *     `*_deep_search_sale_retired_monthly_allowance.sql`); no surface prices a search and the run action mints no order.
 *     The SKU code stays only so an order somebody ALREADY paid for still runs on approval (lib/sku-activation.ts).
 *   • INCLUDED on Plus, Pro and Ultra: `platform_settings.deep_search_runs_per_month` runs each PAID MONTH (an admin
 *     setting on Admin › Settings, never a number here). Free and Verified get none: they see what it finds and
 *     "Included in Plus · Upgrade".
 *   • It resets each paid month and unused runs do not carry over: a run is one `vendor_deep_search_uses` row keyed by
 *     the month's start (`free_cycle_start`) and its slot (`allowance_slot`), claimed BEFORE the search runs
 *     (`claimIncludedDeepSearchRun`, lib/vendor-deep-search-run.ts).
 *
 * The decisions are PURE functions (no I/O, no clock — the caller passes `nowMs`). The DB reader takes its Supabase
 * client as an argument, so this module has no server-only import and stays unit-testable under `tsx --test`.
 * 🔒 lib/vendor-deep-search-addon.test.ts · lib/deep-search-is-never-sold.test.ts
 */

/**
 * The retired catalogue row, and the `orders.service_key` of a Deep Search order bought before 2026-11-24. NOTHING
 * NEW CARRIES IT: it is kept only so `activateVendorDeepSearchOrder` can still run a search somebody already paid for.
 */
export const VENDOR_DEEP_SEARCH_SKU_CODE = 'vendor_deep_search';

// ── Who may run it ───────────────────────────────────────────────────────────

export type DeepSearchDenyReason =
  /** Free or Verified — Deep Search is included from Plus. */
  | 'tier_too_low'
  /** A paid plan, but the shop is not verified yet. */
  | 'unverified';

export type DeepSearchEligibilityInput = {
  /** vendor_profiles.tier_state. */
  tier: string | null | undefined;
  /** vendor_profiles.verification_state. */
  verification: string | null | undefined;
};

export type DeepSearchEligibility = { ok: true } | { ok: false; reason: DeepSearchDenyReason };

/** The plan includes Deep Search runs: Plus (`solo`), Pro and Ultra (`enterprise`). Free and Verified do not. */
export function deepSearchIncluded(tier: string | null | undefined): boolean {
  return isTierAtLeast(tier, 'solo');
}

/**
 * THE eligibility decision — pure, so the run action (server) and the surface share one answer. Checked in the order the
 * action refuses: plan → verification.
 *
 * The plan rule does NOT follow the paywall switch (`VENDOR_TIER_FEATURE_GATE`): every run costs Setnayan a research
 * pass, and the owner gave the runs to the paid plans only (2026-11-22 "Free/Verified get none"). It is an allowance a
 * plan includes, not a paywall the switch can lift.
 */
export function deepSearchEligibility(input: DeepSearchEligibilityInput): DeepSearchEligibility {
  if (!deepSearchIncluded(input.tier)) return { ok: false, reason: 'tier_too_low' };
  if (input.verification !== 'verified') return { ok: false, reason: 'unverified' };
  return { ok: true };
}

/** Human copy for each deny reason (surfaced in the supplier UI). */
export const DEEP_SEARCH_DENY_MESSAGE: Record<DeepSearchDenyReason, string> = {
  tier_too_low: 'Deep Search is included in Plus, Pro and Ultra. Pick a plan on the Plans page to run it.',
  unverified: 'Get your shop verified first — Deep Search opens once you’re verified.',
};

// ── The paid month ────────────────────────────────────────────────────────────

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** `base` moved `months` calendar months back, on the same day of the month (clamped to the month's last day). */
function monthsBefore(base: Date, months: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() - months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m, Math.min(base.getUTCDate(), lastDay), base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds()),
  );
}

export type DeepSearchMonth = {
  /** When this paid month began — the key every included run of the month is claimed against. */
  startIso: string;
  /** When the next month's runs open (the allowance resets; nothing carries over). */
  resetsAtIso: string;
};

/**
 * The shop's CURRENT PAID MONTH. Plans are billed one calendar month at a time and `tier_expires_at` is the end of the
 * month paid for, so the month runs from one month before it. A shop paid several months ahead is in the EARLIEST
 * unexpired month (stepping back from the expiry, each step counted from the expiry itself so a 31st never drifts).
 * With no future expiry (a comp plan, or an unread one) the month is the Manila calendar month.
 */
export function deepSearchMonth(tierExpiresAt: string | null | undefined, nowMs: number): DeepSearchMonth {
  const expiry = tierExpiresAt ? new Date(tierExpiresAt) : null;
  if (expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() > nowMs) {
    for (let k = 1; k <= 1200; k++) {
      const start = monthsBefore(expiry, k);
      if (start.getTime() <= nowMs) {
        return { startIso: start.toISOString(), resetsAtIso: monthsBefore(expiry, k - 1).toISOString() };
      }
    }
  }
  const manila = new Date(nowMs + MANILA_OFFSET_MS);
  const y = manila.getUTCFullYear();
  const m = manila.getUTCMonth();
  return {
    startIso: new Date(Date.UTC(y, m, 1) - MANILA_OFFSET_MS).toISOString(),
    resetsAtIso: new Date(Date.UTC(y, m + 1, 1) - MANILA_OFFSET_MS).toISOString(),
  };
}

/** Runs left this month: the allowance less the runs already claimed, never below 0. Not set (null) = none. */
export function deepSearchRunsLeft(perMonth: number | null, usedThisMonth: number): number {
  if (perMonth === null || !Number.isFinite(perMonth) || perMonth <= 0) return 0;
  return Math.max(0, Math.trunc(perMonth) - Math.max(0, Math.trunc(usedThisMonth)));
}

// ── DB reader (client passed in — no server-only import) ──────────────────────

export type DeepSearchRunsPerMonthRead = { read: true; perMonth: number | null } | { read: false };

/**
 * THE allowance: `platform_settings.deep_search_runs_per_month` (admin-edited). `perMonth: null` = not set — no run is
 * included. A refused read is `{ read: false }`: the surfaces say they couldn't read it and the action refuses to run,
 * never a remembered number.
 */
export async function fetchDeepSearchRunsPerMonth(client: SupabaseClient): Promise<DeepSearchRunsPerMonthRead> {
  try {
    const { data, error } = await client
      .from('platform_settings')
      .select('deep_search_runs_per_month')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] vendor-deep-search-addon: runs per month', error);
      return { read: false };
    }
    const raw = (data as { deep_search_runs_per_month?: number | string | null } | null)?.deep_search_runs_per_month;
    const n = raw === null || raw === undefined ? NaN : Number(raw);
    return { read: true, perMonth: Number.isFinite(n) && n > 0 ? Math.trunc(n) : null };
  } catch (e) {
    console.error('[supabase-error] vendor-deep-search-addon: runs per month (threw)', e);
    return { read: false };
  }
}
