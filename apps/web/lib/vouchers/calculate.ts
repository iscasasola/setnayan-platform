/**
 * apps/web/lib/vouchers/calculate.ts
 *
 * Pure-function discount math for the voucher system. NO Supabase calls,
 * NO floating-point arithmetic, NO mutation — input → output.
 *
 * WHY · Day 2 of the 4-day pre-pilot voucher + inline-checkout sprint
 *       (CLAUDE.md 2026-05-29 Day 2 row · V1 SCOPE EXPANSION). Day 1.5
 *       refactor (PR #595) locked the 3-type voucher model:
 *         • pct_off          → % off, no cap (e.g. 10% off any covered SKU)
 *         • pct_off_capped   → % off up to a fiat ceiling
 *                              (e.g. 50% off up to ₱500 cap)
 *         • free             → 100% off all covered services
 *
 *       Splitting calculate() from validate() lets us unit-test the math
 *       independently from the DB-layer code-lookup. validate() wraps this
 *       once the DB row has been resolved.
 *
 * BigInt centavos: PHP centavos can hit BIGINT (e.g. ₱54,999/yr Enterprise
 * subscription = 5,499,900 centavos) and the 50% capped voucher math
 * involves multiply+divide which would lose cents under JS Number if we
 * weren't careful. BigInt keeps all intermediate values exact integer
 * math. Convert at the boundaries only.
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-29 Day 2 row (this work)
 *   • PR #595 schema refactor: discount_codes triple-shape coherence
 *     CHECK constraint (migration 20260529020000 line 114-128)
 *     enforces pct_off → cap_centavos NULL · pct_off_capped → cap > 0 ·
 *     free → both NULL. This module assumes valid input from the DB.
 *   • Locked policy from owner's architect spec brief:
 *     - One voucher per order · single-voucher per order
 *     - Voucher apply BEFORE order creation · invalid clears field +
 *       brand-voice error
 *     - Coverage gate first (service not in covered_service_keys → reject)
 */

/**
 * Voucher rules row shape, mirrored from `public.discount_codes`. Only
 * the fields needed for math + coverage check — other columns (is_active,
 * expires_at, max_uses, uses_count) are pre-validated upstream by
 * validate.ts before this is called.
 */
export type VoucherRules = {
  voucher_type: 'pct_off' | 'pct_off_capped' | 'free';
  pct_value: number | null; // 1-100 for pct_off & pct_off_capped, NULL for free
  cap_centavos: bigint | null; // positive for pct_off_capped, NULL otherwise
  covered_service_keys: string[]; // empty array = covers nothing
};

/**
 * Result envelope. `applied: true` means a positive discount was computed
 * and final_centavos < original_centavos. `applied: false` means coverage
 * failed (or some other rejection); reason contains brand-voice copy the
 * UI can render verbatim.
 */
export type DiscountCalcResult = {
  applied: boolean;
  discount_centavos: bigint;
  final_centavos: bigint;
  reason?: string;
};

/**
 * Compute the discount and final total for a voucher applied to a given
 * service + original price.
 *
 * Coverage gate FIRST: a 50% voucher on Panood doesn't apply when the
 * couple's at a Papic detail page. We surface this with a polite reason
 * (no "INVALID_SERVICE_MISMATCH" jargon) so the UI just renders it.
 *
 * Math safety: pct_off and pct_off_capped multiply original × pct then
 * integer-divide by 100. Using BigInt means no fractional cents creep in.
 * The cap (when present) clips the discount BEFORE applying so the final
 * is always >= original - cap. free shortcircuits to discount = original.
 */
export function calculateVoucherDiscount(
  service_key: string,
  original_centavos: bigint,
  voucher: VoucherRules,
): DiscountCalcResult {
  // Defensive: callers should pre-validate original > 0 but free orders
  // with original = 0 should just no-op (already zero, nothing to discount).
  if (original_centavos <= 0n) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: original_centavos,
      reason: 'This service is already free — no discount needed.',
    };
  }

  // Coverage gate — first thing we check. Per locked policy.
  if (!voucher.covered_service_keys.includes(service_key)) {
    return {
      applied: false,
      discount_centavos: 0n,
      final_centavos: original_centavos,
      reason: 'This code does not cover this service.',
    };
  }

  // 3-type discount math.
  switch (voucher.voucher_type) {
    case 'free': {
      // 100% off all covered services.
      return {
        applied: true,
        discount_centavos: original_centavos,
        final_centavos: 0n,
      };
    }

    case 'pct_off': {
      // Straight % off, no cap.
      if (voucher.pct_value === null || voucher.pct_value <= 0) {
        // Shouldn't happen given the DB CHECK constraint, but guard.
        return {
          applied: false,
          discount_centavos: 0n,
          final_centavos: original_centavos,
          reason: 'This code is not currently valid.',
        };
      }
      const pct = BigInt(voucher.pct_value);
      const discount = (original_centavos * pct) / 100n;
      return {
        applied: true,
        discount_centavos: discount,
        final_centavos: original_centavos - discount,
      };
    }

    case 'pct_off_capped': {
      // % off up to a fiat cap. Compute raw discount, clip to cap, apply.
      if (
        voucher.pct_value === null ||
        voucher.pct_value <= 0 ||
        voucher.cap_centavos === null ||
        voucher.cap_centavos <= 0n
      ) {
        // Shouldn't happen given the DB CHECK constraint.
        return {
          applied: false,
          discount_centavos: 0n,
          final_centavos: original_centavos,
          reason: 'This code is not currently valid.',
        };
      }
      const pct = BigInt(voucher.pct_value);
      const rawDiscount = (original_centavos * pct) / 100n;
      const discount =
        rawDiscount > voucher.cap_centavos ? voucher.cap_centavos : rawDiscount;
      return {
        applied: true,
        discount_centavos: discount,
        final_centavos: original_centavos - discount,
      };
    }

    default: {
      // Defensive: exhaustive check.
      const _unreachable: never = voucher.voucher_type;
      void _unreachable;
      return {
        applied: false,
        discount_centavos: 0n,
        final_centavos: original_centavos,
        reason: 'This code is not currently valid.',
      };
    }
  }
}

/**
 * Format a centavos BigInt as a peso string for UI display.
 * e.g. 149900n → "₱1,499.00"
 *
 * Co-located here because the drawer + form server actions both need
 * to format BigInt centavos in error / success messages.
 */
export function formatCentavosPeso(centavos: bigint): string {
  const pesos = Number(centavos) / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
