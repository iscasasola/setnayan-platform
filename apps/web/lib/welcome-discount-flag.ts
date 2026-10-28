/**
 * 💲 The website-only welcome discount — the owner's switch (DECISION_LOG
 * 2026-10-28 "ONE PRICE EVERYWHERE = THE APP STORE PRICE; A WEBSITE-ONLY
 * WELCOME −40%").
 *
 * OFF by default, and it stays off until the owner has confirmed the new
 * one-price catalogue AND the margin at the welcome percentage. While OFF the
 * set-up price behaves exactly as it shipped before this switch existed
 * (`lib/welcome-discount.ts` → `setupPriceAppliesAtCreate`).
 *
 * SERVER-ONLY (no NEXT_PUBLIC_): the price is decided on the server, and the
 * browser learns a welcome figure only from a server answer.
 *
 * DELIBERATELY NOT converted to envFlagEnabled: it arms a money discount, so
 * only the exact string 'true' turns it on — a `TRUE` or `1` left in a
 * dashboard must never start discounting orders by itself.
 */
export function isWelcomeDiscountEnabled(): boolean {
  return process.env.WELCOME_DISCOUNT_ENABLED === 'true';
}
