## 2026-09-18 · fix(panood): delete the dead "broadcast day has ended" branch

The controller's cut-mismatch notice forked on `entitled` to show a per-event-DAY
message ("your broadcast day has ended, so live switching is paused. Add another
day...") that could never render: `air.withheld` is only non-null when
`decideProgramAir` was called with `owned: false`, and `entitled` is the same
`owned` boolean under a different name, so the branch that required
`entitled === true` was unreachable at that call site — confirmed 0 of 12
measured combinations. The copy also described a billing model LS6 retired
(owner 2026-09-02, "one unlock, for the life of the event, no clock") — there is
no "day" to have run out of. Deleted the dead branch; kept the always-taken
sibling unconditionally.

SPEC IMPACT: None.
