## 2026-09-18 · fix(manpower): `handshake_tokens_consumed` now writes 0, matching its own comment (SUP-54)

`manpower_gigs.handshake_tokens_consumed` DEFAULTed to 2 — a leftover from
the pre-retirement token economy (migration `20260704020000`). Vendor token
packs were retired 2026-07-21 and accepting a crew shift was made free, and
`acceptManpowerGig`'s own comment in
`apps/web/app/vendor-dashboard/manpower/actions.ts` already claimed
"handshake_tokens_consumed stays at its 0 default" — but nothing ever wrote
0: `claim_manpower_gig()` never touches the column and `postManpowerGig`'s
INSERT never set it, so every posted gig silently recorded the stale
default of 2, contradicting the comment sitting a few lines away.

Checked which side was true before picking a fix: free-to-accept is the
shipped, owner-ruled behaviour (its own long comment and changelog trail);
the column default was simply never updated when the token model retired.
Migration `20271233392742_handshake_tokens_consumed_defaults_to_zero.sql`
corrects the default to 0 and updates the column comment; `postManpowerGig`
now also writes `handshake_tokens_consumed: 0` explicitly rather than
relying on the column default. No backfill of existing rows — a
pre-retirement row recording 2 may reflect tokens genuinely consumed under
the old model, and this migration cannot tell the two cases apart.

Guarded by a new test in
`apps/web/tests/db/a-shop-sees-the-work-it-could-claim.db.test.ts`
(`handshake_tokens_consumed defaults to 0`) that inserts a gig with no
explicit value and asserts what the column actually returns.

SPEC IMPACT: None.
