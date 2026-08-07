## 2026-08-07 · fix(test): the tag-cap tests still asserted the 20-cap you retired

Owner 2026-08-06: *"no tag limit. we can tag as many."* Migration
`20271117449785` removes the per-photo limit. Two tests in
`photo-tag-cap.db.test.ts` still pinned the OLD rule and went red the moment the
decision reached the database:

  not ok - 20 live tags land; the 21st is silently skipped
  not ok - tombstoned tags free their slots — ghosts no longer burn the cap

🔑 **A test that pins a superseded product rule does not protect the product —
it argues against it.** Rewritten to assert what is now true: 22 distinct guests
all land (the retired rule would have stopped at 20 and silently dropped 2), and
tombstoning still keeps the row while dropping the live count. The gravestone
test is untouched and still passes.

Mutation-verified: putting the ceiling back to 20 turns both tests RED.

⚠ The 100,000 ceiling stays as a runaway-write backstop, not a product rule.

SPEC IMPACT: None — the owner decision is already recorded; this only stops the
tests contradicting it.
