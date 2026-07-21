## 2026-07-22 · fix(suite): Compare-vendors free doorway now opens a real comparison

The Suite free layer's "Compare vendors" card linked to bare `/explore/compare`, but that page renders a comparison **only** with `?ids=<uuid>,<uuid>` and `redirect('/explore')`s without them — so every tap silently bounced to the marketplace index and never showed a comparison. It slipped past `scripts/lint-routes.mjs` and the doorway guardrails because the route folder exists; the failure is a param-gated redirect, not a 404. Since `NEXT_PUBLIC_SUITE` has been on in production for days, this dead doorway was live for real users.

Fix: `SuitePage` now resolves the couple's saved-vendor shortlist in the same query `/explore` uses (`event_vendors` where `marketplace_vendor_id` is set and status ≠ declined, earliest two), added to the existing `Promise.all` batch (no extra round-trip latency). The card jumps straight to `/explore/compare?ids=a,b` when ≥2 vendors are saved; otherwise it falls back to the marketplace save-flow (`routes.explore.index`) where the couple saves candidates first. Both targets are working pages. The blurb is reworded to describe the save-then-compare flow honestly in both states.

Added a merge-blocking regression guardrail (`suite-doorway-guardrails.test.ts`, now 14 tests): the compare card's static `FREE_TOOLS` href must be `routes.explore.index` (never the param-gated `routes.explore.compare`), and `SuitePage` must build `/explore/compare?ids=…` at render — closing the "exists-but-redirects" blind spot the audit flagged.

Verified: `tsc --noEmit` clean, `next lint` clean, all 14 `suite-doorway-guardrails` unit tests pass.

SPEC IMPACT: None. Behavior bug fix on the shipped Suite surface — no pricing, SKU, or spec-corpus change. The 2026-07-22 completeness audit that found it is recorded in the DECISION_LOG.
