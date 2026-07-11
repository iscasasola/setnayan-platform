/**
 * Approved peso figures for the AI-crawler surface `public/llms.txt`.
 *
 * This is the allow-list the `llms-price-drift.test.ts` guard checks the file
 * against. Every `₱…` figure that appears in the BODY of llms.txt (everything
 * above the "This file was last refreshed on …" changelog footer) must be a
 * member of this set, and every member must appear at least once in the body.
 *
 * ⚠ UPDATE THIS DELIBERATELY, and only when the live catalog is repriced.
 * This guard exists so llms.txt can never drift silently: if a price changes
 * in the file without a matching, intentional edit here (or vice-versa),
 * `pnpm test:unit` fails in CI. That failing test is the point — it forces a
 * human to reconcile the AI-crawler surface against the real catalog rather
 * than letting a stale peso figure ship unnoticed to every LLM that reads us.
 *
 * The changelog footer is intentionally NOT guarded: it narrates prior states
 * and therefore legitimately contains historical (now-retired) figures.
 *
 * Sourced from the live prod retail + vendor-billing catalog (2026-07-10 pricing finalization).
 */
export const APPROVED_LLMS_PRICES: readonly string[] = [
  // Free / zero
  '₱0',

  // Planning tier — Setnayan AI (one-time, wedding-anchored, owner 2026-07-10)
  '₱499', // Setnayan AI one-time (also: Live Background · Camera Bridge per day)

  // À-la-carte customer software services
  '₱30', // Papic Ltd per camera per day (floor of the retail range)
  '₱100', // Papic Unli per camera per day
  '₱299', // Kwento
  '₱999', // Animated Monogram · Cinematic Reveal · Solo 28-day · additional-branch 28-day
  '₱1,299', // Pabati (per day) · Live Studio Mobile (per day)
  '₱1,499', // Patiktok
  '₱2,000', // Stories (per-day cap) · 10-token pack (2026-07-12 reprice)
  '₱2,499', // Pakanta · Thank You Video · Live Studio Desktop (per day) · Pro vendor 28-day
  '₱2,500', // Live Photo Wall (per day)
  '₱2,999', // 3D Plan · Editorial PRO
  '₱9,000', // Papic Ltd per-day cap (owner 2026-07-11, PR #3112)
  '₱15,000', // Papic Unli per-day cap (owner 2026-07-11, PR #3112)

  // Vendor tokens + packs (flat ₱200/token · flat 1-token burn · 2026-07-12 lock)
  '₱200', // flat per-token price · flat 1-token inquiry unlock (any region)
  '₱800', // 4-token pack
  '₱5,000', // 25-token pack
  '₱10,000', // 50-token pack
  '₱20,000', // 100-token pack

  // Vendor tier subscriptions (28-day / annual)
  '₱9,999', // Solo annual
  '₱24,999', // Pro annual (Pro 28-day ₱2,499 shares the customer figure above)
  '₱7,999', // Enterprise 28-day (repriced 2026-07-10, was ₱7,499)
  '₱79,999', // Enterprise annual (repriced 2026-07-10, was ₱74,999)

  // Voucher example ceiling used in the FAQ copy
  '₱500', // "20% off up to ₱500 max discount" example
];
