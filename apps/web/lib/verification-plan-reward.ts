/**
 * verification-plan-reward.ts — 🏅 THE ULTRA WEEKS A VERIFICATION GIVES (owner, 12 Nov 2026). Pure.
 *
 * Owner, verbatim: *"Regular verified will add one set 4-week ultra for vendors, and founders verified will give them
 * 3 sets of the 4-week ultra for vendors."* On top of the Verified badge's own reward (Papic 150 + 4 weeks Papic
 * Challenges — `lib/badge-rewards.ts`, untouched).
 *
 *   · Founders verification (Admin › Verify, `grantVerificationBypass`) → 3 × 4 weeks of Ultra
 *   · Regular verification (the four papers approved, `applyApplicationDecision`) → 1 × 4 weeks of Ultra
 *
 * 🔑 THE MECHANISM IS THE SHIPPED COMP, NOT A NEW ONE: `tier_state` + `tier_expires_at` + `tier_source = 'admin_comp'`,
 * exactly what `setVendorTier` writes. So the supplier already reads it as "Ultra · free until … · from Setnayan"
 * (`lib/plan-gift.ts`), and it ends by itself (`sweep_vendor_tier_expiry`; a verified shop reads Verified after it —
 * `lib/vendor-tier-lapse.ts`). Ultra's key is `enterprise` (`TIER_LABEL`).
 *
 * 🔑 ONCE PER SHOP, EVER — the server half checks the audit log for an earlier reward before writing one, so a second
 * press, a re-grant, or papers approved after a founders verification never pays twice.
 */
import type { VendorTier } from './vendor-tier-caps';

/** Ultra's tier key. */
export const ULTRA_TIER: VendorTier = 'enterprise';
/** One "set" is four weeks. */
export const PLAN_REWARD_SET_DAYS = 28;
/** How many sets each door gives (owner 12 Nov 2026). */
export const ULTRA_SETS = { founders: 3, regular: 1 } as const;
export type VerificationDoor = keyof typeof ULTRA_SETS;

const DAY_MS = 86_400_000;
const PAID = new Set(['solo', 'pro', 'enterprise']);

export type PlanRow = {
  tier_state?: string | null;
  tier_expires_at?: string | null;
  tier_source?: string | null;
};

export type PlanRewardWrite = { tier_state: VendorTier; tier_expires_at: string; tier_source: 'admin_comp' };

/**
 * The plan write a reward makes, or null when it must not touch the plan:
 *   · a plan the shop PAYS for itself (a paid tier not stamped `admin_comp`) is never overwritten by a gift;
 *   · an open-ended comped Ultra (no end day) already has more than any reward could add.
 * A comped Ultra still running is EXTENDED from its own end day (the weeks stack); anything else (Free, Verified, a
 * comped Solo or Pro, an Ultra already over) starts Ultra today.
 */
export function ultraRewardWrite(row: PlanRow | null, door: VerificationDoor, now: Date): PlanRewardWrite | null {
  const tier = row?.tier_state ?? 'free';
  const comped = row?.tier_source === 'admin_comp';
  if (PAID.has(tier) && !comped) return null;
  const endMs = row?.tier_expires_at ? Date.parse(row.tier_expires_at) : Number.NaN;
  if (tier === ULTRA_TIER && comped && !row?.tier_expires_at) return null;
  const fromMs = tier === ULTRA_TIER && comped && Number.isFinite(endMs) && endMs > now.getTime() ? endMs : now.getTime();
  return {
    tier_state: ULTRA_TIER,
    tier_expires_at: new Date(fromMs + ULTRA_SETS[door] * PLAN_REWARD_SET_DAYS * DAY_MS).toISOString(),
    tier_source: 'admin_comp',
  };
}
