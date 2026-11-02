## 2026-09-23 · refactor(papic): the couple's hand-out comes off, whole

⚖ Owner 2026-09-16 (*"no dedicated shots individually"*), re-confirmed 2026-09-22 against a
question naming **this control** rather than the category — an earlier asking said
"dedicated camera credits", which names two mechanisms at once, and its answer
(*"should stay"*) was about the FREE camera grant.

**Removed:** `PapicCamerasCard`, `setCameraShots`, `papic_dedicate_shots`, and
`papic_seat_allocations`. 🔑 It was the page's own contradiction — the Crew-cameras sheet
says every shot draws from the shared pot while the card four blocks below handed credits
to one QR.

**Why all four together.** Removing the card alone orphans the RPC (`ugat-both-ends`:
*"call it, or drop the function"*, and it forbids a baseline line); dropping the RPC alone
orphans the table, because it is its **only writer**. Measured by writing the DROP and
running the guard, not predicted. Half-retiring it is what turned PR #5875 red.

**Nothing is stranded.** `papic_seat_allocations` **0 rows / 0 credits**, verified against
prod immediately before writing the migration — and re-checked **at apply time**, because a
measurement taken hours earlier is a claim. The guard refuses with the row and credit count
rather than deleting anything; proved against a populated table.

**⚠ What STAYS, and each is guarded at apply time:** the FREE Papic One camera grant
(`papic_event_point_grants.seat_id` — 4 rows, 20 pts), `paparazzi_seats` (24 rows — a seat
is the camera CLAIM), and `papic_seat_grant_releases` (the guest give-back, opposite
direction).

**The arithmetic is provably unchanged** — three functions read the table as a term that is
0 on every row that exists. In `papic_seat_releasable_grants` the two ceilings become
identical once the hand-out is gone, so `LEAST(x, x)` collapses to one arm. ⚠ Its `- spent`
is load-bearing and is kept.

**21 call sites across five db test files re-pointed, never deleted.** Two are autopsies of
shipped money defects and keep their property: the #5028 autopsy now asserts the wrong tool
**cannot be reached** and that the right primitive still meets the contract on the same
grant-funded camera that exposed the defect. Nine hand-out tests are retired **with their
list**, so the removal is a decision on the record.

**Paper trail:** `port-control-baseline.json` and `user-fk-behaviour.generated.txt`
regenerated; the ugat concept register keeps its key and says **DROPPED**; the controls
bill records the removal with its reason. ⚠ `prod-schema.snapshot.txt` is deliberately NOT
regenerated — it is the *prod* half of the drift check and prod still has the table until
this applies.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-09-22 row recording this as blocked is now built.
