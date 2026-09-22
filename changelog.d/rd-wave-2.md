## 2026-09-22 · chore(wave): redesign wave 2 — four builds, one merge

Folds four banked redesign branches into a single trunk so the owner pays for one
merge instead of four:

- `rd/closing-copy-says-who` — three thread states stop printing the declined sentence.
- `rd/chat-frame` — the ported v2 chat layout, both registries.
- `rd/overview-counts-are-named` — the two Overview counts get distinct names.
- `rd/event-hub-wears-a-theme` — the Event Hub theme, plus a fix to the select-column
  scanner so it can follow `export const A_COLUMNS = B_COLUMNS;`.

`apps/web/scripts/port-control-baseline.json` is **regenerated on the merged tree**, not
hand-merged: the theme branch generated its copy from `b02063e90` and the merged tree
resolves to `6edffa3de` (+2 destinations, +6 blocks — controls that landed on main after
that branch was cut). The other three generated baselines (exposure, dup-rule,
money-formatter) already matched; the exposure generator was probed with a deliberate
sabotage line first, because a generator that exits 0 and writes nothing is
indistinguishable from one that no-ops.

🔑 **A refactor can take a guard's coverage away without failing that guard.** The theme
branch's `export const INVITE_LOOK_COLUMNS = HUB_LOOK_COLUMNS;` silently dropped three
live `.select()` sites out of the phantom-column check — the doors were still correct,
they were simply no longer looked at. Only the ratchet on *what the scanner could not
resolve* noticed. The fix is in the resolver, not the call sites: a scanner that cannot
read the correct pattern punishes the correct fix and rewards the copy.

SPEC IMPACT: None.
