## 2026-11-11 · fix(plans): an ended plan never reads as current on the Plan page, even when the lapse sweep is refused

Build 5 plan row 14 + Lane W. The root cause of SetnaProd's ended Solo gift still reading Solo was fixed by #7419
(merged 2026-11-10): the vendor-dashboard layout fired `sweep_vendor_tier_expiry` only for an inline
`['pro','enterprise']`, so the SQL sweep, which has lapsed Solo since 20271286893359, was never asked to. #7419
added `LAPSING_TIERS` and made the Plan screen sweep before drawing. Re-measured on production 2026-11-10
(read-only): SetnaProd is now `verified` with no end day.

What this adds: the one path #7419 left open. When the sweep RPC is refused, the Plan screen kept its first read and
still printed "You are on Solo · until Oct 19, 2026". The new `endedPlanReadsFree` (lib/vendor-tier-lapse.ts) makes
the screen read a run-out plan as Free/Verified with no end day, which is what every gate already enforces.
Held by `lib/an-ended-plan-never-reads-as-current.test.ts`.

SPEC IMPACT: None
