/**
 * Price-Under-Declaration Plausibility Scanner feature flag.
 *
 * The scanner is a deterministic SECOND layer (couple-confirmation stays the
 * load-bearing anchor) that flags a couple-confirmed locked booking whose
 * declared price is implausibly low — for ADMIN triage only, never a couple- or
 * vendor-facing signal and never an automated penalty. See lib/plausibility-
 * scoring.ts (pure math) + lib/plausibility-scanner.ts (server I/O).
 *
 * ACTIVATION — public flag `NEXT_PUBLIC_PLAUSIBILITY_SCANNER_ENABLED`, default
 * OFF. This is a LAUNCH flag (opt-in), not a kill-switch: only the exact string
 * 'true' turns it on. While OFF there is NO change anywhere — the admin
 * integrity-watch "Prices" tab does not render, the rescan action is not
 * exposed, and no plausibility flag is ever computed or written. The migration
 * that widens integrity_flags is inert on its own (a nullable column + a wider
 * CHECK create zero rows), so the dark build is fully behaviour-preserving.
 *
 * NEXT_PUBLIC_ so a server admin surface and any future client reader agree on
 * one value. Pure + secret-free (mirrors verified-median-flag.ts) so it is
 * unit-testable under `tsx --test`.
 */
import { envFlagEnabled } from '@/lib/env-flag';

export function plausibilityScannerEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_PLAUSIBILITY_SCANNER_ENABLED);
}
