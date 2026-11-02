## 2026-06-28 · fix(vendor): make the tier ladder strictly monotonic (Free < Verified < Solo < Pro < Enterprise)

Solo (paid ₱2,000/28d) was accidentally weaker than free Verified on several
caps. Re-tuned the legacy `verified` row so every higher tier strictly dominates
the one below it (owner-approved 2026-06-25).

- `apps/web/lib/vendor-tier-caps.ts` — `verified` caps: `inAppGated` false→true,
  `parentCategories` 3→1, `agentAccounts` 1→0. Solo now wins on
  `servicesPerLeaf` (3 vs 2) and `inAppCustomersPerWeek` (∞ vs 10) and ties or
  beats Verified everywhere else. Verified-row enforcement (team seats /
  services-per-leaf / parent-categories / inquiry gate) is read straight from
  this matrix server-side, so no extra wiring was needed.
- New migration `20270307985604_vendor_verified_tier_retune_burns_tokens.sql` —
  `CREATE OR REPLACE FUNCTION unlock_vendor_event(...)` adds `'verified'` to the
  paid set (`v_paid := (v_tier IN ('verified','solo','pro','enterprise'))`) so
  verified now burns 1-3 region-banded tokens per in-app answer, WHILE keeping
  its existing ≤10/week free-cap branch. Verified is therefore both capped and
  charged — strictly worse than Solo's unlimited-no-cap.

Untouched: the separate "hide Free from marketplace search" lever (still
undecided), Solo/Pro/Enterprise caps, and `claim_unlock_vendor_event` (the
tier-agnostic flat manual-add burn).

SPEC IMPACT: Vendor tier ladder retune — Verified nerfed to sit below paid Solo.
Affects any existing Verified accounts (≈0 in prod today; founder-only
marketplace). Tracked in memory `project_setnayan_vendor_tier_gap_retune` and
`project_setnayan_vendor_tier_ladder`. Corpus note: the vendor-tier matrix
should reflect Verified = capped (10/week) AND token-burning.
