/**
 * 🧰 SPECIALIZED TOOLS — A FREE TIER, ONE PAID UNLOCK, AND A FIRST-BOOKING TRIAL (Build 4).
 *
 * ⚖ DECISION_LOG rows dated 2026-11-09 (🧰). Owner, verbatim:
 *   · *"Specialized tools has free. And has paid 499-4990 to unlock all other tools for 4 weeks."*
 *     + *"This includes their custom tools."* — then *"499 4 week and 4990 annual"*.
 *   · *"So this is available for verified suppliers only and up. The do a booking. It locks. They
 *     need to purchase to use it for their next booking."*
 *   · Pro and Ultra include the unlock: *"Yes. This boosts the value of ultra"*.
 *   · The free tier: Scanner + Headcount · Run of show · Emcee script · Song Desk · Floor Command +
 *     March · Live Watch — every supplier, no purchase.
 *
 * Everything above the last section is PURE. The database is the gate
 * (`vendor_specialized_tools_unlocked` in migration 20271331982978); {@link specializedToolsUnlockFrom} is
 * its mirror, held in step by `tests/db/specialized-tools-unlock.db.test.ts`. The last section holds the two
 * database reads (re-exported from `lib/entitlements.ts`); they take a client and import nothing server-only,
 * because `lib/vendor-photo-challenge.ts` is bundled into client components.
 *
 * Prices are NOT here. They live in `vendor_billing_catalog` (admin-managed); a buy path reads
 * the row. CLAUDE.md: never derive a price from a code comment.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { isTierAtLeast, type VendorTier } from '@/lib/vendor-tier-caps';

/** The 4-week unlock. */
export const SPECIALIZED_TOOLS_SKU_CODE = 'vendor_specialized_tools' as const;
/** The yearly unlock (10× the 4-week price — tests/db/a-year-is-ten-four-week-cycles.db.test.ts). */
export const SPECIALIZED_TOOLS_ANNUAL_SKU_CODE = 'vendor_specialized_tools_annual' as const;

export const SPECIALIZED_TOOLS_SKU_CODES: readonly string[] = [
  SPECIALIZED_TOOLS_SKU_CODE,
  SPECIALIZED_TOOLS_ANNUAL_SKU_CODE,
];

/** The three add-ons the unlock replaced. Retired, never deleted; paid time runs to its end. */
export const SPECIALIZED_TOOLS_REPLACES: readonly string[] = [
  'vendor_photo_challenge',
  'vendor_3d_booth',
  'vendor_3d_booth_event',
];

/** "4 weeks" is 28 days, as every other 4-week supplier add-on. */
export const SPECIALIZED_TOOLS_PERIOD_DAYS = 28;
/** "1 year" is 365 days, as every other yearly supplier purchase. */
export const SPECIALIZED_TOOLS_ANNUAL_PERIOD_DAYS = 365;

export function isSpecializedToolsSku(sku: string | null | undefined): boolean {
  return sku === SPECIALIZED_TOOLS_SKU_CODE || sku === SPECIALIZED_TOOLS_ANNUAL_SKU_CODE;
}

/** How many days one order of this SKU buys, or null for a key that is not the unlock. */
export function specializedToolsPeriodDays(sku: string | null | undefined): number | null {
  if (sku === SPECIALIZED_TOOLS_SKU_CODE) return SPECIALIZED_TOOLS_PERIOD_DAYS;
  if (sku === SPECIALIZED_TOOLS_ANNUAL_SKU_CODE) return SPECIALIZED_TOOLS_ANNUAL_PERIOD_DAYS;
  return null;
}

/**
 * The next window end: one period from the LATER of now and the current end, so an early renewal
 * keeps the time already paid for. Same shape as `nextPhotoChallengeExpiry`.
 */
export function nextSpecializedToolsExpiry(
  currentExpiresAt: string | null | undefined,
  periodDays: number,
  nowMs: number = Date.now(),
): string {
  const cur = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(cur) && cur > nowMs ? cur : nowMs;
  return new Date(base + periodDays * 24 * 60 * 60 * 1000).toISOString();
}

// ── THE TOOLS ────────────────────────────────────────────────────────────────

/**
 * 🆓 THE FREE TIER — every supplier, no purchase, no plan (owner 2026-11-09). "March" is part of
 * Floor Command and is measured under its own key.
 *
 * ⛔ Nothing in this module, in `lib/entitlements.ts`'s unlock read, or in the migration gates any
 * of these. `lib/specialized-tools-free-tier.test.ts` holds that, file by file.
 */
export const FREE_SPECIALIZED_TOOLS = [
  'scanner',
  'headcount',
  'run_of_show',
  'emcee_script',
  'song_desk',
  'floor_command',
  'march',
  'live_watch',
] as const;
export type FreeSpecializedTool = (typeof FREE_SPECIALIZED_TOOLS)[number];

/**
 * 🔓 THE PAID TOOLS — what the unlock opens today. Every future Setnayan tool and the shop's own
 * tools (Tools Maker, Thu 12 Nov) join this side. Forms Maker is NOT a tool here: it is free on
 * every plan (owner 2026-11-09, *"Form make it free"*).
 */
export const PAID_SPECIALIZED_TOOLS = ['papic_challenge', '3d_plan', 'custom'] as const;
export type PaidSpecializedTool = (typeof PAID_SPECIALIZED_TOOLS)[number];

export type SpecializedToolKey = FreeSpecializedTool | PaidSpecializedTool;

/** Every key `record_specialized_tool_use` accepts — mirrors the table's CHECK. */
export const SPECIALIZED_TOOL_KEYS: readonly SpecializedToolKey[] = [
  ...FREE_SPECIALIZED_TOOLS,
  ...PAID_SPECIALIZED_TOOLS,
];

const FREE_SET: ReadonlySet<string> = new Set(FREE_SPECIALIZED_TOOLS);

/** Does this tool need the unlock? Free-tier tools never do. An unknown key does (fail closed). */
export function toolNeedsUnlock(tool: string): boolean {
  return !FREE_SET.has(tool);
}

// ── WHO MAY HAVE IT ──────────────────────────────────────────────────────────

/** The floor for buying the unlock and for the trial: Verified and up (owner 2026-11-09). */
export const SPECIALIZED_TOOLS_MIN_TIER: VendorTier = 'verified';
/** The plans that INCLUDE the unlock — no purchase (Pro/Ultra owner 2026-11-09; Plus owner 2026-11-14 "SIMPLER SUPPLIER PLANS"). */
export const SPECIALIZED_TOOLS_INCLUDED_TIERS: readonly VendorTier[] = ['solo', 'pro', 'enterprise'];

/** The facts the decision reads — the same columns the SQL reads. */
export type SpecializedToolsFacts = {
  tier_state: string | null;
  tier_expires_at: string | null;
  verification_state: string | null;
  unlock_expires_at: string | null;
  trial_event_id: string | null;
  trial_ends_at: string | null;
};

export type SpecializedToolsSource = 'plan' | 'paid' | 'trial';

export type SpecializedToolsUnlock =
  | { unlocked: true; source: SpecializedToolsSource }
  | { unlocked: false; source: null };

function liveAt(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > nowMs;
}

/** A paid plan counts only while its own term runs (the tier sweep is login-driven). */
function planLive(facts: SpecializedToolsFacts, nowMs: number): boolean {
  if (!facts.tier_expires_at) return true;
  return liveAt(facts.tier_expires_at, nowMs);
}

/**
 * THE MIRROR of `vendor_specialized_tools_unlocked(shop, event)`. Pro / Ultra with a live plan →
 * `plan`. Otherwise a VERIFIED shop on Verified and up → `paid` while the window runs, or `trial`
 * on the trial's own event until it ends. `custom` reads as Free (`asVendorTier`), as the SQL does.
 */
export function specializedToolsUnlockFrom(
  facts: SpecializedToolsFacts | null | undefined,
  eventId: string | null | undefined,
  nowMs: number = Date.now(),
): SpecializedToolsUnlock {
  if (!facts) return { unlocked: false, source: null };
  const tier = facts.tier_state;
  if (
    SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(tier as VendorTier) &&
    planLive(facts, nowMs)
  ) {
    return { unlocked: true, source: 'plan' };
  }
  if (facts.verification_state !== 'verified') return { unlocked: false, source: null };
  if (!isTierAtLeast(tier, SPECIALIZED_TOOLS_MIN_TIER)) return { unlocked: false, source: null };
  if (liveAt(facts.unlock_expires_at, nowMs)) return { unlocked: true, source: 'paid' };
  if (eventId && facts.trial_event_id === eventId && liveAt(facts.trial_ends_at, nowMs)) {
    return { unlocked: true, source: 'trial' };
  }
  return { unlocked: false, source: null };
}

// ── MAY THIS SHOP BUY IT? ────────────────────────────────────────────────────

export type SpecializedToolsDenyReason =
  /** Not a verified business — the unlock is Verified and up. */
  | 'not_verified'
  /** Below the Verified tier (unverified Free). */
  | 'tier_too_low'
  /** Pro and Ultra already include it — never sell it to them. */
  | 'included_in_plan';

export type SpecializedToolsEligibility =
  | { ok: true }
  | { ok: false; reason: SpecializedToolsDenyReason };

/**
 * Who may BUY the unlock (owner 2026-11-09): a verified shop on Verified or Supplier Plus. Pro and Ultra are
 * refused because their plan already includes it — taking ₱499 for something they hold is the
 * defect. Buying while a window runs is allowed: it stacks.
 */
export function specializedToolsPurchaseEligibility(input: {
  tier: string | null;
  tierExpiresAt?: string | null;
  verification: string | null;
  nowMs?: number;
}): SpecializedToolsEligibility {
  const nowMs = input.nowMs ?? Date.now();
  if (
    SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(input.tier as VendorTier) &&
    (!input.tierExpiresAt || liveAt(input.tierExpiresAt, nowMs))
  ) {
    return { ok: false, reason: 'included_in_plan' };
  }
  if (input.verification !== 'verified') return { ok: false, reason: 'not_verified' };
  if (!isTierAtLeast(input.tier, SPECIALIZED_TOOLS_MIN_TIER)) return { ok: false, reason: 'tier_too_low' };
  return { ok: true };
}

export const SPECIALIZED_TOOLS_DENY_MESSAGE: Record<SpecializedToolsDenyReason, string> = {
  not_verified: 'Specialized tools opens once your business is verified.',
  tier_too_low: 'Specialized tools is for verified suppliers and up.',
  included_in_plan: 'Your plan already includes Specialized tools.',
};

// ── THE TRIAL CLAIM'S ANSWER ─────────────────────────────────────────────────

/** What `specialized_tools_claim_trial` returns. Anything but `claimed` grants nothing. */
export type SpecializedToolsTrialStatus =
  | 'claimed'
  | 'not_eligible'
  | 'used_by_business'
  | 'no_booking'
  | 'unreadable';

const TRIAL_STATUSES: ReadonlySet<string> = new Set<SpecializedToolsTrialStatus>([
  'claimed',
  'not_eligible',
  'used_by_business',
  'no_booking',
  'unreadable',
]);

/** Read the RPC's jsonb answer; anything unrecognised is `unreadable` (fail closed). */
export function parseTrialClaim(raw: unknown): {
  status: SpecializedToolsTrialStatus;
  eventId: string | null;
  endsAt: string | null;
} {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status = typeof r.status === 'string' && TRIAL_STATUSES.has(r.status)
    ? (r.status as SpecializedToolsTrialStatus)
    : 'unreadable';
  return {
    status,
    eventId: typeof r.event_id === 'string' ? r.event_id : null,
    endsAt: typeof r.ends_at === 'string' ? r.ends_at : null,
  };
}

// ── USAGE: SHAPE ONLY ────────────────────────────────────────────────────────

/** The shape-key rule the table and the RPC enforce: a short lower-case key, or empty. */
export const SHAPE_KEY_PATTERN = /^([a-z][a-z0-9_]{0,31})?$/;

export function isShapeKey(v: string | null | undefined): boolean {
  return SHAPE_KEY_PATTERN.test(v ?? '');
}

// ── THE TWO DATABASE READS (re-exported from lib/entitlements.ts) ────────────

/**
 * Freeze the shop's one-time trial if it has a qualifying first booking, then
 * ask the database whether the paid tools are open at `eventId`.
 *
 * The claim is idempotent and the booking trigger usually made it already; it
 * is repeated here so a shop verified AFTER its first booking still gets that
 * booking's trial the first time anything asks.
 *
 * SERVICE ROLE ONLY (both RPCs are revoked from `authenticated`) — pass
 * `createAdminClient()`. Fails CLOSED: any refusal or error is `false`, and is
 * logged, never thrown — a tool page must render the locked state, not crash.
 */
export async function fetchVendorSpecializedToolsUnlocked(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string | null,
): Promise<boolean> {
  if (!vendorProfileId) return false;
  try {
    const claim = await admin.rpc('specialized_tools_claim_trial', {
      p_vendor_profile_id: vendorProfileId,
    });
    if (claim.error) {
      console.error('[supabase-error] entitlements: specialized_tools_claim_trial', claim.error);
    }
    const { data, error } = await admin.rpc('vendor_specialized_tools_unlocked', {
      p_vendor_profile_id: vendorProfileId,
      p_event_id: eventId,
    });
    if (error) {
      console.error('[supabase-error] entitlements: vendor_specialized_tools_unlocked', error);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error('[entitlements] fetchVendorSpecializedToolsUnlocked failed', e);
    return false;
  }
}

/**
 * Count one open or one scan of a specialized tool — SHAPE ONLY (owner
 * 2026-11-09: usage of a tool's shape, never guest data). Pass the signed-in
 * user's client: the RPC derives the shop from the session. Best-effort: a
 * refused or failed count returns `false` and never throws, so measurement can
 * never break the tool it measures.
 */
export async function recordSpecializedToolUse(
  supabase: SupabaseClient,
  input: {
    eventId: string;
    tool: string;
    kind?: 'open' | 'scan';
    template?: string | null;
    scannerMode?: string | null;
    category?: string | null;
  },
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('record_specialized_tool_use', {
      p_event_id: input.eventId,
      p_tool_key: input.tool,
      p_kind: input.kind ?? 'open',
      p_template_key: input.template ?? null,
      p_scanner_mode: input.scannerMode ?? null,
      p_category: input.category ?? null,
    });
    if (error) {
      console.error('[supabase-error] entitlements: record_specialized_tool_use', error);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error('[entitlements] recordSpecializedToolUse failed', e);
    return false;
  }
}
