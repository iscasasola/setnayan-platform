## 2026-09-15 · fix(guests): a role split must carry EVERY keyed behaviour, not one

Two owner rulings, and the general rule they add up to.

**1 · "witness should be inner circle too."** `INNER_CIRCLE_ROLES` listed `wali`,
`imam` and `wakil` under a comment reading "Nikah principals" — which reads as the
whole cast, and was not. A Nikah witness defaulted to three blocks while the other
three got five. Found by `a-split-role-keeps-its-standing.test.ts` on its first run,
parked with a dated reason rather than guessed (how a Muslim ceremony seats its
witnesses is not a refactor's call), and ruled on the same day. The guard's
stale-entry assertion then FORCED the exception line to be deleted rather than left
as decoration. **Park → ask → rule → delete; the exception map is empty again.**

**2 · "both ninongs and ninangs should inherit what the original principal sponsor
does."** Inner-circle standing was the instance, not the rule. Swept every site
keyed on `guests.role` and classified each as a READER (must cover all three values)
or a WRITER/OFFER (must offer only the two). Readers already correct: role-groups,
seating tier 1, entourage, editorial voices, emcee script, mood-board grouping.
Writers already corrected in #5508. The mood-board `principal_sponsor` is a
different key space (`MoodboardSlotKey`) and is deliberately untouched.

**The sweep found a live MONEY defect that #5508 had not.** `SPONSOR_GUEST_ROLES` in
`lib/papic-guest-allotments.ts` mapped only the plain role, so a Ninong fell through
to `'guest'` at 1× — the exact default the file's own docblock says it exists to
prevent ("handing them the same allowance as a plus-one"). Measured on the live
roster, it was not a shortfall but an **inversion**:

```
principal_sponsor_ninong   21 guests   weight 1
principal_sponsor_ninang   17 guests   weight 1
cord/veil/coin/candle       6 guests   weight 2   ← outranked them
```

The couple's godparents ranked BELOW the secondary sponsors in the Papic photo
division — and `papic_share_weight` counts an un-named sponsor as that many heads
AND hands them that many shares, so the error compounded on both sides of it.

🔑 **AND THE TEST BUILT TO CATCH EXACTLY THIS STAYED GREEN.** The TS table and the
SQL function are one rule written twice, held together by
`papic-sponsors-get-a-bigger-share.db.test.ts` — but the split missed BOTH halves
identically, so they agreed with each other perfectly while both were wrong.
**A test that compares two mechanisms to each other cannot see an omission they
share. Consistency is not correctness.** Its trailing `assert.equal(sponsors, 5)`
could not help either: with ninong/ninang weighing 1 everywhere, the count stayed 5.
That assertion now names the SET, so a role falling out of it fails with the role's
name, and a new sponsor role fails until somebody decides what it is worth.

Both halves fixed: the TS map, and `papic_share_weight()` via migration
`20271227977601` (through the pipeline, never applied directly — every other branch
byte-identical, the only change is the two added values; the retired plain role
keeps its weight, since rows on other events still hold it).

**The guard is now the property generalised.** `a-split-role-keeps-its-standing.test.ts`
checks that roles sharing a role group agree about EVERY keyed behaviour, from one
`KEYED_BEHAVIOURS` table — invited-to blocks, seating tier, and Papic share weight.
A new behaviour keyed on role is one line. Sabotage-verified with occurrence counts
printed before and after, so the mutation is proven to have landed where it was
aimed rather than merely to have run.

Verified: 15,678 unit tests pass · typecheck clean · 31 CI lint guards green ·
migration timestamp guard green · the papic db suite 12/12 with the migration replayed.

SPEC IMPACT: `DECISION_LOG.md` — the Nikah-witness ruling and the general
"both new roles inherit every keyed behaviour" rule.
