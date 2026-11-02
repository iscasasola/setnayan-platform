## 2026-07-24 · fix(papic): stop the full-res drop sweep starving on Drive-deferred photos (gap audit)

Gap audit 2026-07-23 · Batch B2. `runFullResDropSweep` selects the oldest-N
not-yet-dropped captures (`ORDER BY captured_at ASC LIMIT 500`). A couple's
Drive-**deferred** photos keep `full_res_dropped_at IS NULL` AND are the oldest,
so they permanently occupy the head of that window: every run re-reads the same
stuck rows, defers them again, drops nothing, and NEVER reaches newer droppable
photos behind them. The sweep converges to zero drops while storage grows.
Trigger: a couple connects Drive then disconnects (or the sync jams / token
dies), so `loadEventDriveCopyState` never confirms the copy and `isDriveDeferred`
defers every one of their photos forever.

Fix (the audit's endorsed cursor option):
- Migration `20270923187654` adds `full_res_drop_deferred_at TIMESTAMPTZ` to
  `papic_photos` + `papic_guest_captures` (+ matching partial indexes on the
  sweep's candidate predicate).
- The sweep now orders by `(full_res_drop_deferred_at ASC NULLS FIRST,
  captured_at ASC)` — never-/least-recently-deferred first — and re-stamps every
  DEFERRED candidate `= now()` after the pass (batched, best-effort, skipped on
  dry runs). A deferred row rotates to the back of the window; a row that later
  becomes droppable stops being re-stamped, keeps its older cursor, sorts ahead
  of the still-deferred backlog, and gets dropped.

Ships INERT: the column defaults NULL (= "never deferred", sorts first), so
existing rows behave exactly as before until the sweep stamps them. The cursor
affects ORDER only, never eligibility — nothing can be dropped unsafely.

Verified: existing 48 fullres-drop tests green · tsc/lint clean · migration
replays.

SPEC IMPACT: None — background-sweep robustness fix.
