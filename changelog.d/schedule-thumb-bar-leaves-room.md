## 2026-11-04 · fix(thumb-room): a floating bar that mounts late leaves room for itself — the Schedule's Edit / + Add a moment no longer covers the last lines

Owner 2026-11-04 (DECISION_LOG "THE APP LOOKS LIKE THE PROTOTYPES", the "Also fix" clause — the only part kept after "CORRECTION — THE APP'S TEMPLATE WINS: WHITE STAYS"): on the Schedule's chapter page the floating Edit / + Add a moment bar covered the last lines of content.

Root cause, measured in WebKit at 390 px: `--sn-thumb-room` read `""` while the bar floated. `useThumbRoom` ran its effect once with `[rowRef]` as its only dependency; the Schedule's bars (`ChapterThumbRow`, `ScheduleAddPill`) are portalled to `<body>` and render `null` on their first commit, so the ref was empty then and the effect never ran again. The column (`[data-shell-main]`) therefore reserved only the dock's clearance.

Fix, in the shared hook (`lib/thumb-room.ts`): every commit checks which element the ref holds and the measuring effect re-arms when it changes. Covers every late-mounted or re-shown floating row, not just the Schedule's. `/dev/chapters-lab` now wears `data-shell-main` like the real event column, so a walk sees the room.

Guard: `lib/a-thumb-row-leaves-room.test.ts` test 8 (sabotage: deps back to `[rowRef]` → red).

No token, colour or font-weight change.

SPEC IMPACT: None
