/**
 * apps/web/lib/vouchers/validate.ts
 *
 * Server-side voucher validation that wraps the pure-function calculate.ts.
 * Walks the locked-policy checks in order, returns DiscountResult on success
 * OR a brand-voice rejection reason on every failure case.
 *
 * WHY · Day 2 of the 4-day pre-pilot voucher + inline-checkout sprint
 *       (CLAUDE.md 2026-05-29 Day 2 row · V1 SCOPE EXPANSION). Day 1 +
 *       Day 1.5 migrations (PRs #594 + #595) shipped the discount_codes +
 *       discount_code_redemptions tables · RLS gates admin reads-all +
 *       admin writes. Couples NEVER directly SELECT from discount_codes —
 *       this server-side function uses the admin client to look up the
 *       code, then validates expiry · uses · per-couple uniqueness · before
 *       handing off to calculateVoucherDiscount() for the actual math.
 *
 * Locked policy checks (in order, fail-fast):
 *   1. Format: 8-char alphanumeric uppercase (matches DB CHECK)
 *   2. Code exists (DB lookup)
 *   3. is_active = TRUE
 *   4. expires_at > NOW() (lazy-eval expiry per [[reference_setnayan_cron_strategy]])
 *   5. max_uses NULL OR uses_count < max_uses
 *   6. NOT already redeemed by this couple (UNIQUE (discount_code_id,
 *      couple_user_id) constraint from PR #595)
 *   7. Coverage gate (handled by calculate.ts)
 *   8. Math (handled by calculate.ts)
 *
 * Reasons returned use brand-voice editorial register per
 * [[feedback_setnayan_no_dev_text_post_launch]] — no engineering jargon,
 * no exclamation marks, no "INVALID_CODE_EXPIRED" SHOUTING.
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-29 Day 2 row (this work)
 *   • PR #594 migration line 51 — CHECK (code ~ '^[A-Z0-9]{8}$')
 *   • PR #595 migration line 143-154 — UNIQUE per-couple-per-code
 *   • apps/web/lib/vouchers/calculate.ts — pure math + coverage gate
 *   • RLS pattern: admin-only SELECT on discount_codes, so we use the
 *     service-role admin client (createAdminClient).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculateVoucherDiscount,
  type VoucherRules,
  type DiscountCalcResult,
} from './calculate';

/**
 * Full result envelope returned to the caller. Extends DiscountCalcResult
 * with the discount_code_id needed by the order-creation server action to
 * write the discount_code_redemptions row at insert time.
 */
export type DiscountResult = DiscountCalcResult & {
  /** UUID of the discount_codes row · NULL when applied=false. */
  discount_code_id: string | null;
  /** The canonicalized (UPPER) code string · NULL when applied=false. */
  code_normalized: string | null;
};

/**
 * 8-char alphanumeric uppercase. Mirrors DB CHECK constraint. Couples
 * type the code in any case (the input is uppercased on blur client-side)
 * and we canonicalize server-side too as belt-and-suspenders.
 */
const CODE_FORMAT_RE = /^[A-Z0-9]{8}$/;

/**
 * Look up + validate + apply a voucher code against a service + price.
 *
 * Returns DiscountResult either way — caller distinguishes via the
 * `applied` flag and renders `reason` directly on failure.
 *
 * Concurrency note: this runs at apply-time (before order create). The
 * actual race-protection between "couple A applies code at T=0" and
 * "couple A submits order at T=5s" is the UNIQUE (discount_code_id,
 * couple_user_id) constraint at INSERT time — if a parallel tab won
 * the race, the redemption INSERT fails with 23505 and the server action
 * surfaces "you've already used this code." So validate() being slightly
 * stale here is acceptable; the structural guarantee is at write-time.
 */
export async function validateAndCalculateVoucher(
  args: {
    code: string;
    service_key: string;
    original_centavos: bigint;
    couple_user_id: string;
  },
): Promise<DiscountResult> {
  // (1) Format check before round-tripping to the DB. Saves a network hop
  // on obviously-malformed input (e.g. couple typed only 4 chars).
  const normalized = args.code.trim().toUpperCase();
  if (!CODE_FORMAT_RE.test(normalized)) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: 'Discount codes are 8 characters · letters and numbers only.',
    };
  }

  // Couples can NEVER directly read discount_codes (admin-only RLS from
  // PR #594 migration line 114-130). The validate path uses the
  // service-role admin client — same pattern as iteration 0034 payments
  // reconciliation in apps/web/app/admin/payments/actions.ts.
  const admin = createAdminClient();

  // Column name is `discount_type` not `voucher_type` per migration
  // 20260529010000 + 20260529020000. An earlier draft of this select
  // silently passed `undefined` through to calculate.ts and tripped the
  // default branch ("This code is not currently valid") on EVERY couple
  // voucher apply. Renamed 2026-05-29 PM alongside the grant_tokens
  // extension landing in migration 20260703500000.
  const { data: codeRow, error: lookupErr } = await admin
    .from('discount_codes')
    .select(
      'discount_code_id, code, discount_type, pct_value, cap_centavos, covered_service_keys, effective_from, expires_at, max_uses, uses_count, is_active',
    )
    .eq('code', normalized)
    .maybeSingle();

  if (lookupErr) {
    // Defensive: shouldn't happen given the admin client bypasses RLS. Log
    // and treat as "not found" so couples don't see a raw error.
    console.warn('[validateVoucher] lookup error (admin client):', lookupErr);
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: "We couldn't check that code right now. Please try again.",
    };
  }

  // (2) Code exists.
  if (!codeRow) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: "That code doesn't look right. Double-check and try again.",
    };
  }

  // (2b) Vendor-only voucher reject · grant_tokens vouchers redeem ONLY
  // via /vendor-dashboard/redeem-code, never on couple checkout. Surface
  // the same polite copy that calculate.ts would surface as a defensive
  // fallback so couples don't see "for vendor accounts only" twice if a
  // future caller does extra logging.
  if (codeRow.discount_type === 'grant_tokens') {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: 'This code is for vendor accounts only.',
    };
  }

  // (3) is_active = TRUE.
  if (!codeRow.is_active) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: 'That code is no longer active.',
    };
  }

  // (4a) effective_from <= NOW(). Per 2026-05-29 gift-window owner request:
  // vouchers can be scheduled to activate later (NULL = effective immediately).
  if (
    codeRow.effective_from !== null &&
    new Date(codeRow.effective_from).getTime() > Date.now()
  ) {
    const startsAt = new Date(codeRow.effective_from);
    const formatted = startsAt.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: `That code starts on ${formatted}. Try again then.`,
    };
  }

  // (4b) expires_at > NOW(). Lazy-eval expiry per cron strategy memory rule.
  if (new Date(codeRow.expires_at).getTime() < Date.now()) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: 'That code has expired.',
    };
  }

  // (5) Total uses cap.
  if (
    codeRow.max_uses !== null &&
    typeof codeRow.uses_count === 'number' &&
    codeRow.uses_count >= codeRow.max_uses
  ) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: 'That code has reached its usage limit.',
    };
  }

  // (6) Per-couple uniqueness check. PR #595's UNIQUE (discount_code_id,
  // couple_user_id) constraint is the structural guarantee at INSERT;
  // this is the friendly check so we tell the couple BEFORE they upload
  // a screenshot. Best-effort: if the lookup fails, fall through to
  // calculate — the INSERT will catch the race.
  const { data: prior } = await admin
    .from('discount_code_redemptions')
    .select('redemption_id')
    .eq('discount_code_id', codeRow.discount_code_id)
    .eq('couple_user_id', args.couple_user_id)
    .maybeSingle();

  if (prior) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: args.original_centavos,
      discount_code_id: null,
      code_normalized: null,
      reason: "You've already used this code.",
    };
  }

  // (6b) Eligibility check (private vouchers). Per 2026-05-29 owner request:
  // if any rows exist in discount_code_eligible_users for this code, then
  // ONLY those user_ids can redeem. Zero rows = public (anyone-with-code).
  // Same admin client so RLS doesn't gate (matches the lookup pattern).
  const { data: eligibilityRows } = await admin
    .from('discount_code_eligible_users')
    .select('user_id')
    .eq('discount_code_id', codeRow.discount_code_id);

  if (eligibilityRows && eligibilityRows.length > 0) {
    const isEligible = eligibilityRows.some(
      (r) => r.user_id === args.couple_user_id,
    );
    if (!isEligible) {
      return {
        applied: false,
        discount_centavos: 0n,
        final_centavos: args.original_centavos,
        discount_code_id: null,
        code_normalized: null,
        reason: "That code isn't for your account.",
      };
    }
  }

  // (7) + (8) Hand off to calculate for coverage gate + math. grant_tokens
  // is already rejected at (2b) above so we narrow to the 3 discount types
  // calculate.ts can apply against an order.
  const rules: VoucherRules = {
    discount_type: codeRow.discount_type,
    pct_value: codeRow.pct_value,
    cap_centavos:
      codeRow.cap_centavos === null ? null : BigInt(codeRow.cap_centavos),
    covered_service_keys: codeRow.covered_service_keys ?? [],
  };

  const calc = calculateVoucherDiscount(
    args.service_key,
    args.original_centavos,
    rules,
  );

  if (!calc.applied) {
    // Coverage rejection or other math rejection from calculate.
    return {
      ...calc,
      discount_code_id: null,
      code_normalized: null,
    };
  }

  return {
    ...calc,
    discount_code_id: codeRow.discount_code_id,
    code_normalized: normalized,
  };
}
