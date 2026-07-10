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
 * Sourced from the live prod retail + vendor-billing catalog (2026-07-05).
 */
export const APPROVED_LLMS_PRICES: readonly string[] = [
  // Free / zero
  '₱0',

  // Planning tier — Setnayan AI subscription (28-day cycle)
  '₱799', // recurring per 28-day cycle
  '₱499', // first cycle (also: Live Background)

  // À-la-carte customer software services
  '₱30', // Papic Ltd per camera per day (floor of the retail range)
  '₱100', // Papic Unli per camera per day · flat per-token price
  '₱299', // Kwento
  '₱1,299', // Camera Bridge · Pabati (per day) · Live Studio Mobile (per day)
  '₱1,499', // Cinematic Reveal · Patiktok
  '₱1,999', // Animated Monogram
  '₱2,000', // Stories (per-day cap)
  '₱2,499', // Pakanta · 3D Plan · Thank You Video · Live Photo Wall (per day) · Live Studio Desktop (per day) · Pro vendor 28-day
  '₱3,499', // Editorial PRO (Live Studio multicam one-time retired 2026-07-08 → per-day device tiers)
  '₱4,999', // Couple Website PRO (upper à-la-carte bound)
  '₱15,000', // Papic Ltd per-day cap

  // Vendor token banding + packs (flat ₱100/token)
  '₱300', // top of the 1–3 token unlock band (₱100–₱300)
  '₱400', // 4-token pack
  '₱1,000', // 10-token pack
  '₱2,500', // 25-token pack
  '₱5,000', // 50-token pack
  '₱10,000', // 100-token pack

  // Vendor tier subscriptions (28-day / annual)
  '₱999', // Solo 28-day · additional-branch 28-day
  '₱9,999', // Solo annual
  '₱24,999', // Pro annual (Pro 28-day ₱2,499 shares the customer figure above)
  '₱7,499', // Enterprise 28-day
  '₱74,999', // Enterprise annual

  // Voucher example ceiling used in the FAQ copy
  '₱500', // "20% off up to ₱500 max discount" example
];
