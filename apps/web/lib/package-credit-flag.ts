/**
 * Package CREDIT model feature flag (owner-locked 2026-07-26).
 *
 * The credit model — REQUIRED lines, CHOICE lines with per-option price
 * deltas, a spend-anywhere-in-the-catalogue credit pool, per-package
 * expiring/refundable unspent policy, and allowed overspend billed through
 * the existing apply-then-pay rail — ships DARK.
 *
 * This is a LAUNCH flag, not a kill-switch: it is OFF unless the env var is
 * the exact string 'true'. With it off, every surface keeps calling the
 * legacy `computeCustomization` in ./vendor-packages and behaves byte-for-byte
 * as it does today; the new schema columns are inert defaults and the pure
 * engine in ./package-credit is simply not consulted.
 *
 * NEXT_PUBLIC_ so the server (lock/booking actions) and any client preview
 * (the customize-and-lock modal) can never disagree about which pricing model
 * is live — a split-brain here would show a couple one number and charge them
 * another.
 *
 * NOTE (foundation PR): nothing is wired to this gate yet by design — this
 * wave lands the schema + the pure engine + its tests only. The UI and the
 * lock/money path are a separate wave, and that wave reads THIS function
 * rather than inventing a second env var.
 */
import { envFlagEnabled } from '@/lib/env-flag';

export function packageCreditEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_PACKAGE_CREDIT);
}
