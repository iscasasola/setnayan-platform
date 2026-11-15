/**
 * vendor-plan-contents.ts — WHAT EACH SUPPLIER PLAN INCLUDES, as the admin last set it.
 *
 * ⚖ Owner 2026-11-13, verbatim "Yes, add both" (specs DECISION_LOG "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN
 * CONTENTS"): plan contents become admin-editable, "like a price change, the code values as the seed". Drawn on the
 * approved admin prototype (catalogue.html › Plan contents: plan-pick · cfm-cap).
 *
 * 🔑 THE TABLE IS THE NUMBER, `TIER_CAPS` IS THE FALLBACK. `public.vendor_plan_contents` (migration
 * 20271344452857) is seeded from `TIER_CAPS` and edited through the two-admin approval
 * (`approve_plan_contents_change`). Every read here falls back to the code value when a row is missing or the read
 * fails — a failed read must never turn a plan's allowance into 0 (taking from a shop) or into "no limit"
 * (granting what nobody decided).
 *
 * ⛔ ONLY THE SEVEN KEYS BELOW ARE EDITABLE, ON PURPOSE. Each one's readers follow the table — the database twin
 * `vendor_tier_limit()` for the first four, `fetchLiveTierCaps` (and through it `fetchCapsWithAddOns`, the one read
 * every create gate uses) for the rest. A key whose readers still print the code value would be an edit that
 * changes nothing; it stays read-only on the screen until its readers move.
 *
 * Pure: no `server-only`, no `next/*`. The caller hands in its own Supabase client (the table is public-read).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { TIER_CAPS, TIER_LABEL, VENDOR_TIERS, asVendorTier, type TierCaps, type VendorTier } from '@/lib/vendor-tier-caps';

export type PlanContentCapKey =
  | 'whitelistPerDate'
  | 'waitlistAcceptances'
  | 'branchesIncluded'
  | 'bookingsPerDatePerService'
  | 'servicesPerLeaf'
  | 'parentCategories'
  | 'agentAccounts';

export type PlanContentKeyDef = {
  /** `vendor_plan_contents.key` (and, for the first four, `vendor_tier_limit`'s key). */
  key: string;
  /** The `TierCaps` field it overrides. */
  capKey: PlanContentCapKey;
  /** What the admin reads. */
  label: string;
  /** Plain words: where the number takes effect. */
  readBy: string;
  /** May the admin set "no limit"? Never for the four the database serves (its callers COALESCE a NULL to 0). */
  noLimitAllowed: boolean;
};

export const EDITABLE_PLAN_KEYS: readonly PlanContentKeyDef[] = [
  {
    key: 'services_per_leaf',
    capKey: 'servicesPerLeaf',
    label: 'Service cards per category',
    readBy: 'the Add-a-service gate, the Card Maker and the plan picker',
    noLimitAllowed: true,
  },
  {
    key: 'parent_categories',
    capKey: 'parentCategories',
    label: 'Categories',
    readBy: 'the Add-a-service gate and the Card Maker',
    noLimitAllowed: true,
  },
  {
    key: 'agent_accounts',
    capKey: 'agentAccounts',
    label: 'Team seats',
    readBy: 'the Team invite gate',
    noLimitAllowed: true,
  },
  {
    key: 'branches_included',
    capKey: 'branchesIncluded',
    label: 'Branches included',
    readBy: 'the branch gate (in the database) and Add a branch',
    noLimitAllowed: false,
  },
  {
    key: 'bookings_per_date_per_service',
    capKey: 'bookingsPerDatePerService',
    label: 'Bookings per date, per service card',
    readBy: 'the booking yes (in the database) and the Card Maker',
    noLimitAllowed: false,
  },
  {
    key: 'waitlist_acceptances',
    capKey: 'waitlistAcceptances',
    label: 'Wait list places',
    readBy: 'the wait list ceiling (in the database)',
    noLimitAllowed: false,
  },
  {
    key: 'whitelist_per_date',
    capKey: 'whitelistPerDate',
    label: 'Couples held per date',
    readBy: 'the per-date hold limit (in the database)',
    noLimitAllowed: false,
  },
] as const;

const BY_KEY = new Map(EDITABLE_PLAN_KEYS.map((d) => [d.key, d]));

export function planContentKeyDef(key: string): PlanContentKeyDef | null {
  return BY_KEY.get(key) ?? null;
}

/** One row of `vendor_plan_contents`. `value` NULL = no limit. */
export type PlanContentRow = { plan: string; key: string; value: number | null };

/** The code value of one allowance (the seed and the fallback). `null` = no limit (Infinity in TIER_CAPS). */
export function codeValue(plan: VendorTier, capKey: PlanContentCapKey): number | null {
  const v = TIER_CAPS[plan][capKey];
  return Number.isFinite(v) ? v : null;
}

/**
 * Lay the stored rows for ONE plan over its code caps. Rows for another plan, an unknown key or a malformed value
 * are ignored (the code value stands) — pure, so the rule is tested by running it.
 */
export function applyPlanContents(tier: string | null | undefined, rows: readonly PlanContentRow[] | null): TierCaps {
  const plan = asVendorTier(tier);
  const base = TIER_CAPS[plan];
  if (!rows || rows.length === 0) return base;
  const out: TierCaps = { ...base };
  for (const r of rows) {
    if (r.plan !== plan) continue;
    const def = BY_KEY.get(r.key);
    if (!def) continue;
    if (r.value === null) {
      if (def.noLimitAllowed) out[def.capKey] = Infinity;
      continue;
    }
    if (typeof r.value !== 'number' || !Number.isInteger(r.value) || r.value < 0) continue;
    out[def.capKey] = r.value;
  }
  return out;
}

/**
 * THE LIVE CAPS for a plan: the admin-edited numbers over the code values. A failed read logs and returns the code
 * values — withholding a change, never inventing one.
 */
export async function fetchLiveTierCaps(supabase: SupabaseClient, tier: string | null | undefined): Promise<TierCaps> {
  const plan = asVendorTier(tier);
  try {
    const { data, error } = await supabase
      .from('vendor_plan_contents')
      .select('plan, key, value')
      .eq('plan', plan);
    if (error) {
      console.error('[supabase-error] vendor-plan-contents: plan read (using the code values)', error);
      return TIER_CAPS[plan];
    }
    return applyPlanContents(plan, (data ?? []) as PlanContentRow[]);
  } catch {
    return TIER_CAPS[plan];
  }
}

/** The plans the editor offers, bottom to top — Free and Verified sit in the same table (prototype). */
export const PLAN_CONTENT_PLANS: readonly VendorTier[] = VENDOR_TIERS;

export function planWords(plan: VendorTier): string {
  return TIER_LABEL[plan];
}

/** "No limit" or the number, as the editor shows it. */
export function planValueWords(v: number | null): string {
  return v === null ? 'No limit' : v.toLocaleString('en-PH');
}

export type ParsedPlanValue = { ok: true; value: number | null } | { ok: false; message: string };

/**
 * The editor's typed value → a stored value. Blank or a word is refused; "no limit" only where the key allows it.
 * Whole numbers 0..10,000 (no plan allowance in the code is above 25, so the ceiling only stops a slipped key).
 */
export function parsePlanValue(def: PlanContentKeyDef, raw: string, noLimit: boolean): ParsedPlanValue {
  if (noLimit) {
    return def.noLimitAllowed
      ? { ok: true, value: null }
      : { ok: false, message: `${def.label} always needs a number — the database reads it as a limit.` };
  }
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return { ok: false, message: 'Type a whole number (0 or more).' };
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n > 10_000) return { ok: false, message: 'That number is too large for a plan allowance.' };
  return { ok: true, value: n };
}

/** "Pro · Team seats 5 → 4" — the approval's rationale and the history line. */
export function describePlanChange(plan: VendorTier, def: PlanContentKeyDef, from: number | null, to: number | null): string {
  return `${planWords(plan)} · ${def.label} ${planValueWords(from)} → ${planValueWords(to)}`;
}

/** Lowering = the new number admits less than the old one (no limit counts as the most). */
export function isLowering(from: number | null, to: number | null): boolean {
  if (to === null) return false;
  if (from === null) return true;
  return to < from;
}
