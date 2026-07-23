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

  // À-la-carte customer software services.
  // ₱499 (Live Background) RETIRED from the body 2026-07-22 — Live Background is
  // bundle-only now (folded into Monogram PRO ₱1,000), so it no longer prints a
  // standalone price and ₱499 left the fixture.
  '₱100', // Papic One — flat per-camera price (floor of the retail range)
  '₱299', // Kwento
  '₱999', // Custom Subdomain (per year) · additional-branch 28-day · Papic Pool 3,000 shots
  '₱1,299', // Pabati (per day) · Live Studio Mobile (per day)
  '₱1,499', // Setnayan AI one-time (single ₱1,499 SKU, owner FINAL 2026-07-12) · Patiktok
  '₱1,999', // Papic Pool — 6,000 shots
  '₱2,000', // Stories (per-day cap)
  '₱2,499', // Pakanta · Thank You Video · Live Studio Desktop (per day)
  '₱2,500', // Live Photo Wall (per day) · Pro vendor 28-day
  '₱2,999', // 3D Plan · Papic Pool 10,000 shots + the +10,000 top-up
  '₱3,500', // Website PRO — the umbrella (Cinematic Reveal + Editorial PRO, both bundle-only · owner 2026-07-22)

  // Vendor Solo tier subscription (28-day / annual). Token PACKS were retired
  // 2026-07-21 (owner) and answering an inquiry is now FREE, so the token-only
  // pack figures (₱200 per-token · ₱5,000 25-pack · ₱20,000 100-pack) were
  // removed from llms.txt + here. ₱1,000 and ₱10,000 survive only as Solo's own
  // 28-day / annual prices below.
  '₱1,000', // Solo vendor 28-day · Animated Monogram (Monogram PRO · reprice 2026-07-22)
  '₱10,000', // Solo vendor annual

  // Vendor tier subscriptions (28-day / annual) — round-number reprice 2026-07-22.
  // Solo 28-day ₱1,000 + Solo annual ₱10,000 are the two figures just above;
  // Pro 28-day ₱2,500 shares Live Photo Wall above.
  '₱25,000', // Pro annual (was ₱24,999)
  '₱8,000', // Enterprise 28-day (was ₱7,999)
  '₱80,000', // Enterprise annual (was ₱79,999)

  // Voucher example ceiling used in the FAQ copy
  '₱500', // "20% off up to ₱500 max discount" example
];
