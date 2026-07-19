## 2026-06-25 · test(compat): cover the vendor compatibility-score ranking core

Post-review gap (adversarial audit): `lib/compat-score.ts` (`computeCompatScore` / `explainCompatScore`) is pure, branch-heavy ranking math driving the public `/vendors` grid + the wizard match %, yet had zero tests among lib/'s ~50. Added `lib/compat-score.test.ts` (node:test): weights sum to 1; the admit-unknown NEUTRAL baseline; half-life distance decay + floor (nearer always outranks farther, never 0); Bayesian reviews prior-pull (volume beats a thin 5★, unrated sits at the prior); verified > unverified; the 80/60 tier cutoffs; and `explainCompatScore` gating + the `>=4.0 → "4.8★"` vs generic "Highly rated" phrasing split + the ordered 3-reason cap. No production code touched.

SPEC IMPACT: None.
