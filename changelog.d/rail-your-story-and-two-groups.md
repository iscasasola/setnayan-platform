## 2026-08-13 · feat(front-door): Your Story joins the rail, and the slot splits in two

Owner 2026-08-13: *"so their storytelling, events, shop and admin must be accessible
there."* Storytelling was the one missing — **zero references in the rail**, though the
surface has shipped at `/dashboard/creator` all along.

Planned with Fable; three of its corrections were verified and are why this PR is
shaped as it is.

🔑 **THE ORGANISING PRINCIPLE, because six rows bolted on one at a time is a junk
drawer.** One sentence a future session can apply mechanically:

> **Does the destination refuse a signed-in person? No → it is a desk you own, it
> lives in My Home and always renders. Yes → it is a console only some people hold,
> it lives under "What you run" and renders only for those the door admits.**

So the slot is now:

    My Home        Back to your events · Alaala · Your Story · [People notice]
    What you run   {shop} · Setnayan HQ        ← label+divider render ONLY if a row follows

**STORYTELLING IS A THING YOU HAVE, NOT A THING YOU RUN — so it is NOT gated.**
"creator = user" is owner-locked (2026-07-16): the apply/approve gate and the
`is_creator` flag were both dropped, so `/dashboard/creator` opens for every
authenticated person. Gating on "is a storyteller" (≥1 published chapter on a public
profile) would hide a desk **8 of 9 production accounts are entitled to sit at**.
A real **0** is shown, deliberately — an empty desk you own is not an absence of
permission, and the destination's own zero state is already a written invitation.

🚨 **AND IT CLOSED A LATENT DEFECT NOBODY WAS LOOKING FOR.** The shop row gated on
owning a `vendor_profiles` row, while `/vendor-dashboard` admits an owner **OR** a
`vendor_team_members` member (`fetchUserRoleSummary`, and the console's own layout).
**A shop's hired team member could open the console and get no row offering it.**
Latent today — prod holds 0 team members who own nothing — so it would have bitten
the first real hire. The rail now asks the same question the door asks.

**ONE ADMIN PREDICATE, NOT TWO.** `lib/roles.ts` carried a hand-rolled copy of the
three clauses; it now calls `isAdminProfile()`. Identical truth table on the identical
row shape — and `admin-predicate.ts`'s own docblock records what the last narrow copy
cost: a Team Pool member who could approve payouts and verify vendors but got a hard
"Unauthorized" on the editorial queue.

A heading over nothing is a fake door in label form, so "What you run" and its divider
render only when a row follows — an ordinary couple sees neither.

GUARD: `rail-carries-what-you-run.test.ts` 5 → 8 assertions, and **re-anchored**: the
predicate assertions now point at `lib/roles.ts`, because `front-door.tsx` no longer
reads those columns — left pointed at the old file they would have passed forever
while proving nothing.
🪤 **My first cut of the column check demanded the three columns in a FIXED ORDER and
went red against a select naming the same three in a different order** — a guard
failing on spelling rather than on the property it holds. Now order-independent.
Mutation-tested, every sabotage measured: deleting the Your Story row (1 → 0) · gating
it on having a story · narrowing the shop gate back to ownership · dropping
`is_team_member` from the predicate select — **each turned it red**, restored 8/8.
Neighbouring suites 36/36.

SPEC IMPACT: `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` §2 — the account slot is now
two groups and carries Your Story. Applied in the corpus.

