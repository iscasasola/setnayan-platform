## 2026-07-02 · feat(vendor): Solo tier gets 1 team seat (seat-ladder finalized)

Owner locked the vendor team-seat ladder (invitable teammates **on top of** the
always-free owner/admin — `team/actions.ts` counts only non-owner seats):

  Free 0 · Free · Verified 0 · Solo 1 · Pro 3 · Enterprise 10

Only one value changed against `origin/main`: **`solo.agentAccounts` 0 → 1** in
`lib/vendor-tier-caps.ts` (Verified was already 0, Enterprise already the finite
10 — my local checkout was stale; audited against `origin/main` per house rule).
This lifts Solo one seat above Free · Verified — a paid tier no longer gave
*fewer* team seats than a free-verified shop (the sharp edge previously flagged).

Nothing else in code needed touching: the Team invite guard, the seat-cap error
copy, and the subscription-card seat label all derive from `agentAccounts`, so
they reflect "1 team seat" for Solo automatically. Updated the in-repo tier-truth
doc `VENDOR_TIERS_AND_BENEFITS.md` (§6 Solo line + Enterprise note + new §10
ladder block) and fixed a stale "code currently has `Infinity`" note (code is the
finite 10 now).

NOT in this PR — held for owner sign-off: the Enterprise-only **+₱500/28d
extra-seat add-on** (buy seats beyond the base 10). That needs a billing-catalog
SKU + purchased-seat count + effective-cap wiring (base + purchased) + a Team
"Add seat" CTA + admin reconcile, plus a billing-lifecycle decision (co-terminate
with the Enterprise sub vs. independent per-seat renewal; lapse behavior).

SPEC IMPACT: Vendor tier caps. Canonical as-built truth is the in-repo
`apps/web/VENDOR_TIERS_AND_BENEFITS.md` §6/§10 (updated here). Also logged at the
bottom of the corpus `DECISION_LOG.md` per the relaxed sync mandate.
