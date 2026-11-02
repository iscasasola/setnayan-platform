## 2026-07-10 · feat(seating): live sync — the 2D editor and 3D lab follow each other in real time

Owner: "make sure 2D and 3D work simultaneously." Both surfaces already share
one source of truth (`event_tables` + assignments + floor plan) via the same
loaders and server actions, but a VIEW-ONLY surface (a co-owner/coordinator, or
the couple in the other view) only saw the editor's changes after a manual
reload — there was no Realtime on seat data (only presence).

- **Migration** `20270711955398_enable_realtime_seating_plan.sql` — opts
  `event_tables`, `event_seat_assignments`, `event_floor_plan` into the
  `supabase_realtime` publication (mirrors the budget realtime migration) +
  `REPLICA IDENTITY FULL` on the first two so DELETEs carry the `event_id` the
  client filters on. Idempotent; RLS already scopes events per viewer.
- **`useSeatingLiveRefresh(eventId, enabled)`** — subscribes to those three
  tables filtered to the event and debounces a `router.refresh()` (350 ms, so a
  multi-row save coalesces into one re-fetch). Wired into BOTH the 2D editor and
  the 3D lab.
- **Safety:** `enabled = !canEdit` — ONLY the view-only surface subscribes. The
  editing surface never auto-refreshes (a refresh mid-drag could clobber its
  optimistic layout / unsaved 2D drafts), and it's the sole editor anyway (the
  single-editor lock), so it has no peer changes to receive.

Known gap (unchanged): the lock is keyed by USER, so the SAME person editing in
two tabs is `canEdit` in both → they don't live-sync to each other. That's a
lock-design item, out of scope here.

`tsc` clean · radius + retired-string lints clean · migration timestamp guard ✓.

⚠ OWNER ACTION: the migration must be applied to prod (`supabase db push`) for
live sync to activate — until then the subscription is harmless (the tables
aren't published, so no events fire).

SPEC IMPACT: None (realtime plumbing on the existing shared plan).
