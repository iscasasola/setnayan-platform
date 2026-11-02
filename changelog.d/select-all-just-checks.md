## 2026-09-21 · fix(guests): select-all just ticks the boxes — no wall of name chips

Owner, after select-all drew 79 name chips under the bulk bar: *"do not show this when we click on
the select all. just put a check. and pressing it will deselect everything as well."*

- The selection remembers where it started (`viaAll` in `guest-selection-store.ts`). Started from
  select-all → the bar shows the count and the actions, no chips — and stays that way while you untick
  a few. Picked by hand → the chips still show (they exist so a pair picked far apart can be checked).
- The header checkbox clears ANY selection — all of it or a few (the dash state) — and ticks everyone
  only when nothing is ticked. The phone's select-all follows the same rule.
- Guard `_components/select-all-just-checks.test.ts` executes the store and pins both call sites;
  sabotaged 3 ways (flag never set · chips ungated · partial does not clear), each caught.

SPEC IMPACT: None
