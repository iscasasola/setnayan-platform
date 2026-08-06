## 2026-08-06 · fix(prod): the couple's face-tagging opt-out renders on nothing

All five production events sit in the mode where the opt-out card is supposed to
appear. **It appears on none of them.**

The card reads three columns from `events` with the signed-in client. Two are
readable; `face_tagging_declined_by_couple` is not — so the database refuses the
whole query and the component's `if (error || !data) return null` hides it.

🪤 **The self-hiding is deliberate and correct** — a control that cannot enable
anything should not be offered. It is also precisely what made this invisible: a
missing card reads as *"not applicable here"*, never as *"the query failed"*.
This is the same class as the face-mode column that stored nothing for seven
weeks, and it is a **decision the couple is entitled to make and cannot reach**.

🚨 **DO NOT FOLLOW POSTGRES'S OWN HINT.** The live error ends with *"Grant the
required privileges to the current role with: `GRANT SELECT ON public.events TO
authenticated`"*. Following it would hand every signed-in user the whole row —
the encrypted photo-delivery OAuth token, the master QR token, both partners'
birth dates, the couple's budget. **23 columns on that table are withheld on
purpose**; the other 176 already carry column-level grants. This grants the ONE
column the card needs.

Row access is unchanged — a couple still reaches only their own event. A column
grant widens WHICH FIELDS, never WHOSE ROWS. The regenerated exposure baseline
shows exactly one added line: `anon=-  authenticated=S`.

**Verified:** 2 tests, both mutation-checked — removing the narrow grant goes
red, and *widening it into a table grant* goes red. Baseline diff reviewed line
by line.

SPEC IMPACT: None.
