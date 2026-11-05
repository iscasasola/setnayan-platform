## 2026-11-04 · test(schedule): event chapters slice 7 — Rehearsal dinner stays as it ships

The owner's event-chapters brief, item 7: **"Do NOT change Rehearsal dinner."** Whether it becomes a chapter, stays a per-guest Invited-to block, or goes remains an open owner call.

- **Measured:** slices 1–6 (#7238, #7256, #7267) change no line that names Rehearsal dinner.
- **Guard:** nothing tested that before, so `lib/rehearsal-dinner-stays-as-it-ships.test.ts` (4 tests) pins it as it ships:
  - it is a per-guest Invited-to block worded "Rehearsal dinner";
  - the inner circle is invited by default, and a plain guest is not;
  - it is not one of the four default chapters;
  - a caterer's production sheet still counts its portions.
- **Proof:** renaming its label turns the guard red. When the owner rules, change the guard in the same PR as the change, with the ruling quoted.

SPEC IMPACT: None. No behaviour changes; Rehearsal dinner stays an open owner call.
