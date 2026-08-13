## 2026-08-13 · fix(front-door): HQ joins the rail, and the cards are sized like the page they copy

Owner 2026-08-13: *"we get to keep that sidebar as agreed and user home and shop and
admin will be on that sidebar"* and *"look at the text size difference of youtube and
setnayan"*.

**THE ADMIN ROW DID NOT EXIST — and could not have.** `FrontDoorAccount` carried
`shopName` and **no admin signal at all**, so the data never reached the component.
The shop row shipped; the admin half was never wired. That is why the owner, an
admin, found no HQ anywhere in the rail.

Both rows are **capability-gated**: absent for anyone without that access, never a
greyed door. Four honest targets beat five with a dead one.

🔑 **DECIDED BY THE CANONICAL PREDICATE, NOT A LOCAL COPY.**
`lib/admin/admin-predicate.ts` is three clauses wide — `is_internal` ·
`is_team_member` · `account_type === 'admin'` — and its own docblock records what a
narrower copy cost: an `is_internal`-only check let a Team Pool member approve
payouts and verify vendors while getting a hard "Unauthorized" on the editorial
queue. All three columns are read, in the **same round trip** as the shop lookup.

⚖ **AND IT FAILS CLOSED, opposite to the counts beside it.** `isAdminProfile(null)`
is `false`, so a rejected read HIDES HQ rather than offering a door that then
refuses. Deliberate asymmetry: a missing row is a nuisance, an offered-then-denied
one is a lie. The counts fail the other way — `null` renders "couldn't load", never
`0`.

**TYPE SCALE — measured, not eyeballed.** Ours was **15px/600** against the
reference's **14px/500**, byline **13px** against **12px**. Seven per cent on the
title plus a whole weight step is enough to read as a different product; the grid is
the same four columns, so the chunkiness was all type. Phone keeps **14.5px** — 14px
at arm's length on a 375px screen is not the same read as 14px on a monitor.

GUARD: `app/_components/frontdoor/rail-carries-what-you-run.test.ts` — five
assertions: both rows exist, both are gated, the admin signal uses the canonical
predicate, all three predicate columns are selected, and the card type is 14px/500 +
12px. Mutation-tested with each sabotage MEASURED: deleting the HQ row took
`href="/admin"` 1 → 0 and failed 2; restoring 15px/600 raised the 15px count 2 → 3
and failed 1; narrowing the read to `is_internal` alone failed 1. Restored 5/5.
Neighbouring front-door suite 18/18.

SPEC IMPACT: None.
