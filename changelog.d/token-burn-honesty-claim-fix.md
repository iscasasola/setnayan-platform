## 2026-07-01 · fix(vendor): correct the token-burn honesty surfaces to the LIVE RPC (verified burns, no founder bypass)

Follow-up to PR #2456 ("token burn-on-answer is LIVE"). That PR correctly fixed
the big lie (burn was documented as "inert / not wired" when it is live), but its
replacement copy described the **pre-retune** RPC, not the live one. Two sub-claims
were themselves stale against `20270307985604_vendor_verified_tier_retune_burns_tokens.sql`
(the current `unlock_vendor_event` body):

- **"VERIFIED ≤10/wk free"** — wrong. Verified now **burns** 1–3 region-banded
  tokens per answer AND keeps the ≤10/week cap (`v_paid := v_tier IN
  ('verified','solo','pro','enterprise')`). Its own RPC comment: verified is
  "both capped AND charged, strictly worse than Solo."
- **"FOUNDER exempt / token-gate-exempt"** — unsupported. The `is_founder`
  bypass added in `20261013000000` was dropped in both later `CREATE OR REPLACE`
  redefinitions (`20270221294989` solo · `20270307985604` retune). The current
  RPC has no founder branch; the only no-burn path is FREE, which is *blocked*
  from accepting. So the honest reason prod token spend reads ₱0 is "no paid
  vendor has burned a qualifying inquiry yet (the lone real vendor is the
  founder)," **not** "the founder is token-gate-exempt."

Corrected the tier behavior + ₱0 framing in the five surfaces #2456 touched:
`lib/vendor-peso.ts` (header + `burnInert` JSDoc), `admin/insights/.../peso-per-lead-admin-card.tsx`
(comment + the user-facing "Why ₱0" note), `vendor-dashboard/subscription/.../peso-per-lead-card.tsx`
(comment), `_components/home/vendor-benefits.ts` (2026-07-01 (c) note), and the
still-pending `changelog.d/token-burn-live-honesty.md` fragment (so the eventual
collected CHANGELOG.md is accurate).

SPEC IMPACT: None (comment/copy only — no schema or logic change; the live RPC is
unchanged). The earlier band-source follow-up still stands: `unlock_vendor_event`
reads `token_burn_bands` while `lib/v2/region-token-burn.ts` reads
`regions.burn_band` — two min-wage-seeded maps to reconcile to one source.
