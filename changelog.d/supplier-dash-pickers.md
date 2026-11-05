## 2026-11-01 · feat(supplier): My Performance's two pickers are each one dropdown

Step 4 of `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §12 ("Dashboard remainder — pickers"), applying the owner's
2026-10-30 "ONE SELECTOR FOR EVERY PAGE" ruling (Q1: the segmented rows become the same ▾) to the last segmented
choice rows on the supplier dashboard that pick a VIEW:

- **Momentum window** (Daily · Monthly · Annual) — was a sliding `PillTrack`; now the shared `PickMenu`. Solo still
  hides Daily; a pick still swaps the pre-rendered window instantly.
- **Service scope** (All services · each active service) — was a pill tablist at ≤4 services and a native `<select>` at
  5+ (two looks for one choice); now the shared `PickMenu` at every count, each option its own address.

`lib/pills-are-everywhere.test.ts` lets the retired track go with a reasoned line (floor 26 → 25), as #7120 did.
Guarded by `app/vendor-dashboard/performance/the-pickers-are-one-dropdown.test.ts`. Two-choice toggles inside forms
(₱ | %, discount unit) and the plan page's billing term are form inputs, not view pickers — left as they are.

SPEC IMPACT: None — applies an existing ruling (DECISION_LOG 2026-10-30).
