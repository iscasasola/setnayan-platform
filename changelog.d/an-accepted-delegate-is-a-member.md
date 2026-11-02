## 2026-08-24 · fix(delegates): an accepted delegate is a member of the event

**Owner ruling, asked directly and answered: "Full helper access."** When the
couple's invited delegate accepts, they become a proper helper — they see what
the coordinator role sees, private planning included (weighed and chosen).
Couple-only tables stay couple-only: this grants the existing role, it touches
no policy.

**The defect it closes, live in prod:** two membership lists exist, and 86
tables' rules know only the first. The token-accept door minted the member row
in app code; the access-request approval door creates the delegate row
born-accepted and never minted; and the one real external planner arrived
through neither — seeded straight into the database, created and accepted at
the identical microsecond. An RLS denial is 200 + zero rows + null error, so
that planner opened the checklist of a wedding with **94 items and read an
empty list** — a blank page that looks like an unplanned wedding, the same
mechanism as "0 cameras out" mid-shoot (4ba5ced17). **One write body, two
doors — and the second door forgot half the write.**

The mint moves into the database: a trigger on the delegate table, so every
door present and future — including straight SQL, which is how the live row
arrived — mints the same membership. With its inverse built at write time:
removal revokes the coordinator row, never a couple row (the insert conflicts
out; the delete names the type). The app-side copy in the token-accept action
is **removed** so the trigger is the one writer, and the db test proves that
door still mints. Backfill: exactly one row, dry-run against prod in a
rolled-back transaction before merge.

Also: the checklist page gains the membership gate its four siblings
(check-in · souvenirs · galleries · live) already had — a locked door beats a
blank page, and it guards the next role that is not yet a member.

8 db tests; 6 migration mutations, each measured before → after, each RED.
⚠ Honest limit: the **backfill** cannot be proven in the PGlite replay (it
runs on an empty database there) — it is verified in prod by the object after
merge. And the trigger's second-role guard is a **belt**: the schema holds one
delegate row per person per event, and a test pins that premise so whoever
relaxes the UNIQUE is told the belt just became load-bearing.

SPEC IMPACT: DECISION_LOG.md row 2026-08-24 (owner ruling recorded).
