## 2026-07-02 · feat(vendor): Solo self-serve tier + comparable benefits on the subscription page

Owner: "plus i do not see solo. and update the benefits of each. the saved 12 weeks."

**Solo is now a buyable tier alongside Pro + Enterprise.** Solo (₱999/28d ·
₱9,999/yr, Ladder B) was always meant to be a self-serve entry tier, but two
pieces were never wired, so the page hid it:

- `solo_vendor_annual` was never seeded (only `solo_vendor_monthly` existed — the
  Ladder-B reprice UPDATE for the annual row was a no-op on a non-existent row).
- `create_vendor_subscription` mapped only `pro_`/`enterprise_` SKUs → any
  `solo_vendor_%` SKU raised `UNMAPPED_SKU_TIER`.

Migration `20270426213000_vendor_solo_self_serve.sql` closes both additively:
seeds `solo_vendor_annual` at ₱9,999 and adds a leading `solo_vendor_%` → `'solo'`
branch to the RPC (body otherwise verbatim — admin gate, `NOT_VERIFIED` gate, and
the token add-on all preserved). Solo grants **no** bundle tokens (the credit
CASE already returns 0 for non-pro/ent) and burns tokens per answered inquiry
exactly like Pro/Enterprise, so no change to `_apply_subscription_credit` /
`approve_vendor_subscription` was needed — `'solo'` is already a valid
`vendor_tier_state`.

**Self-gating (no broken button).** The Solo card renders only when
`solo_vendor_annual` is present in the live catalog — a safe proxy for "the
migration is applied," since the SKU + the RPC branch land together. Until then
the page shows Pro + Enterprise exactly as before; once applied, Solo appears on
the next request with **no redeploy** (server component reading live prices).

⚠ **Migration NOT yet applied to prod.** `supabase db push` is currently blocked
by drift — prod has an out-of-band migration `20270426100000` (pushed by a
parallel session, not in `origin/main`) that isn't in the local tree, and this
environment has no psql/MCP to hand-apply SQL. Once the drift is reconciled, a
normal `db push` applies this migration and Solo goes live automatically. **The
Solo card stays hidden until then — safe to merge/deploy now.**

**Benefits updated + made comparable.** Rewrote the plan cards to show
tier-DIFFERENTIATING benefits in a PARALLEL order (categories · agent seats ·
reach · listings/category · portfolio · analytics), all derived from the
`TIER_CAPS` matrix so copy can't drift from enforced caps. Benefits shared by
every paid plan (real business name day one · unlimited in-app inquiries ·
marketplace search · own event website) moved to a single "Every plan includes"
strip above the cards. Solo's pitch reflects the shipped reality (unlimited
volume + real name day one + 3 services/category — NOT "no tokens", which is
false in code). The "Recommended" highlight sits on Pro (the middle default).

**Annual savings corrected to "12 weeks."** Annual = 10× the 28-day fee (a
subscription year is 13 cycles billed for 10 → 3 free = 84 days = 12 weeks). The
cycle toggle now reads "save 12 weeks" (was the inaccurate "save ~2 months"), and
each annual card shows a "Save 12 weeks vs paying monthly" chip.

No other tier's price or caps changed; prices stay DB-catalog-driven.

SPEC IMPACT: None (completes the Solo tier's self-serve wiring that iteration
0006 / the 2026-07-01 Ladder-B decision already intended; logged at the bottom of
the corpus `DECISION_LOG.md`). Load-bearing items surfaced for owner sign-off in
the session response: (1) Solo becomes self-serve buyable, (2) the prod migration
is pending on drift reconciliation.
