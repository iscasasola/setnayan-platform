## 2026-07-22 · fix(papic): periodic sweep heals stuck-'unscreened' captures without a couple visit

The always-on NSFW screen runs fail-open + fire-and-forget from the capture
`after()` hook, and its per-event healer `reScreenStuckCaptures` (lib/nsfw-screen.ts)
was only fired from TWO after() sites — both COUPLE-SIDE (the Papic moderation
page + the Life-Flash account page). So if a capture's first `screenCapture()`
dropped (an R2 hiccup, a cold/killed lambda) AND no couple ever reopened either
page, the row stayed `moderation_state = 'unscreened'` forever. Guest-facing
surfaces fail CLOSED (guest-live-gallery + Live Wall show only `'clean'`), so an
unscreened row never leaks — but a legitimately-safe photo could sit permanently
dark, and a dropped screen never self-healed.

**Fix — a GLOBAL cron-free heal ([[project_setnayan_cron_free]]).** New
`reScreenAllStuckCaptures()` (lib/nsfw-screen.ts) discovers every Papic event
that still has a grace-aged `'unscreened'` capture across BOTH capture tables and
re-runs the existing, unchanged per-event `reScreenStuckCaptures` on each. It's
bounded (≤25 events/sweep; a bigger backlog drains over successive sweeps) and
never-throwing. The discovery/dedup/grace logic is factored into a pure,
unit-tested `selectStuckEventIds()` so the grace-window guard — a capture only
seconds old (screen still in flight) is NOT swept — is provable without a DB.

`maybeRunPapicNsfwRescreen()` (new lib/papic-nsfw-rescreen-sweep.ts) gates the
sweep behind `claimPeriodicJob('papic-nsfw-rescreen', ~20 min)` and is wired into
`app/admin/layout.tsx` `after()` — the SAME central periodic-job site as the
Papic full-res drop / retention sweep, which already work these tables. Admin/HQ
traffic fires daily regardless of whether any couple visits, which is the whole
point: the heal no longer depends on a couple opening a Papic page. Interval
~20 min sits comfortably above the 15-min re-screen grace, so a dropped screen
heals in roughly one grace + one claim window while never racing an in-flight
screen.

Migration `20270913197664_papic_captures_unscreened_sweep_idx.sql` adds two
partial indexes (`… (created_at) INCLUDE (event_id) WHERE moderation_state =
'unscreened'`) so the periodic discovery scan stays cheap over the transient
unscreened set instead of seq-scanning the whole table as it grows. Additive +
idempotent; no table/column/RLS change, reuses the existing `cron_job_runs`
claim table.

No change to the screening logic, the NSFW thresholds, or the fail-closed guest
behavior — this only adds the periodic healing trigger.

SPEC IMPACT: None. Iteration 0012 Papic — the always-on NSFW screen's operating
behavior (fail-open background screen, fail-closed guest surfaces, locked
thresholds) is unchanged; this is a reliability/self-healing fix to the existing
cron-free re-screen path, implementation detail only.
