## 2026-09-29 · fix(people): the Loved ones count is the Loved ones list — and never somebody else's row

Owner's People page, live after #6111: the picker read **"Loved ones 1"** while the view said **"No loved
ones yet."** The counted row was "Indigo Caterers" — ANOTHER user's business, visible to the owner only
because RLS on `dependents` admits an admin to every row. The Loved ones cards had been fixed for exactly
this on 2026-09-25 (they decide membership themselves: mine · handed over · my ACTUAL spouse's shared rows);
the People roster read the same table without that rule. Before the redesign it drew the row outright as
"In your care · Business · You hold this"; after it, it counted it.

- The rule now lives in ONE function, `lib/my-loved-ones.ts` (`myLovedOnes` / `lovedOnesInMyCare`), and
  both readers call it: the Loved ones view lists `myLovedOnes(rows)`, the picker counts
  `myLovedOnes(rows).length` — the count can never claim a row the list cannot show.
- The roster's alaga rows (read by the guest list's "Add from people" sheet) are `lovedOnesInMyCare` — so
  an admin is no longer offered other users' children, elders, pets and businesses as guests either.
- "Add a loved one" stays at the head of the Loved ones view.
- Tests: `lib/my-loved-ones.test.ts` (count == listed across person · pet · business, another user's
  Business neither listed nor counted, even for an admin); `the-people-page-lists-only-my-household.test.ts`
  re-pointed to pin that every reader uses the one rule.

SPEC IMPACT: None — it restores the 2026-09-25 household rule to the second reader.
