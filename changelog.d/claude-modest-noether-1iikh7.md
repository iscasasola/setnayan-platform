## 2026-11-27 · ship: OLD-account Batch A (L3 press/Tab/no-select #8422 + L4 words #8423)

One batch branch for the two OLD-account lanes that cannot go green alone: L4 removes the
`.sn-example` CSS that L3 needs to stay under the globals.css ceiling (main 649,985 B → batch
648,855 B), and L4's deleted Example components need the generated maps regenerated once.

- Merges #8423 (L4) then #8422 (L3) with merge commits; no code edits beyond the merges.
- Regenerated `lib/ugat/screens.generated.json` and `scripts/port-control-baseline.json`. Every
  removal the port lint reported is a deliberate L4 Example component (incl. `Head`/`Owed`, which
  lived only in the deleted `budget-example.tsx`).
- Root map: dropped `/dev/empty-looks-lab` (deleted by L4) from `no-door`, and the line the ratchet
  reported fixed from `never-read`. Hand-written reasons on every other line are kept (no
  `--baseline` rewrite).

SPEC IMPACT: R3 supersedes the 9 Nov "Empty Look" (Example previews retired app-wide) — DECISION_LOG row
written by the OLD controller after live; FEATURE_REGISTER pointers to the three deleted files go with it.
