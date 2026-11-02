## 2026-08-31 · fix(papic): the recommended cap is raisable — a couple who sets 300 can deliver 300

Owner ruling, verbatim: *"yes it is raisable. but that is the recommended cap. if
cap is activated."*

`papic_record_guest_capture` carried `v_credits CONSTANT INTEGER := 150` and
refused there regardless of what the couple had chosen. A couple could activate
the per-guest ceiling, set 300, and their guests were stopped at 150 — and TOLD
150, a number the couple never picked. The only thing that lifted it was an active
`PAPIC_UNLOCK` order, and production has never sold one, so it bound on every
celebration.

The flat number becomes a FLOOR the couple's activated cap may raise, never a lid
over it: `v_allowance := GREATEST(v_credits, COALESCE(v_ceiling, 0))`. Un-capped
celebrations are untouched (150 exactly as before, which is the default
everywhere); a ceiling BELOW 150 still binds at the ceiling, because that gate
runs first.

The 150 remains funding-blind on purpose — it is the per-phone deposit guard, and
`v_used` is still every credit she has spent from any ledger. Raising the guard was
the owner's call; what it measures is unchanged.

Verified by mutation: with the `GREATEST` reverted to `v_credits` (occurrences
1 -> 0), the two headline tests go red. Guards on the replaced function re-run
green — papic-guest-spend-ceiling 23/23, papic-guest-own-credits-are-hers 15/15.

SPEC IMPACT: None — implements an owner ruling already recorded for the corpus.
