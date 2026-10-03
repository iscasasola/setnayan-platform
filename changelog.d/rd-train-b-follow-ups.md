## 2026-10-04 · fix(guests): Undo restores only deleted guests and never trusts supplier attribution from the browser · nikah login return · deterministic session-budget test

Follow-ups from the independent review of train b (#6314, live at 777cf8f).

- **SECURITY — the guest-delete Undo (#6311).** `restoreDeletedGuests`
  (`apps/web/app/dashboard/[eventId]/guests/groups-actions.ts`) had two defects:
  1. it un-deleted every id the browser listed with no `deleted_at IS NOT NULL`
     filter, so a guest who was never deleted counted as "restored" and song
     requests the browser sent for them were inserted with the service role;
  2. those song requests came back FROM THE BROWSER and were written verbatim —
     `decided_by_vendor_profile_id` and `decided_at` included — so a host could
     forge which supplier decided a request on their own event.

  Fixed in the database (migration `undo_restores_only_deleted_guests`): the
  delete now MOVES a really-deleted guest's requests into a service-only pen
  (`guest_released_song_requests`, RLS on, no browser grant) through
  `release_deleted_guest_song_requests`, and the Undo calls
  `restore_deleted_guests(event, ids)`, which un-deletes only guests that ARE
  soft-deleted on that event and restores only what the pen holds for them,
  exactly as stored. It takes no song data from the caller; nothing about a
  song request travels to the browser any more. Callers are the guests table's
  own writers (couple · guest-list moderator with edit · admin); anyone else is
  refused. A song somebody else requested during the Undo window keeps their
  request, and the Undo now says one did not come back. Seats are re-placed
  only for guests the database really restored. `lib/released-song-requests.ts`
  (the browser-copy re-check) is deleted — there is no browser copy left.
  Proven by `apps/web/tests/db/the-undo-restores-only-what-was-deleted.db.test.ts`,
  sabotaged three ways (each red, then green); the third caught a real NULL
  in the caller check while it was being written (`NOT (false OR NULL)` is
  NULL, which plpgsql's IF reads as "allowed").
- **`/dashboard/[eventId]/nikah`** sent a signed-out visitor to a bare
  `/login`; it now uses `loginRedirectPath` like the other dashboard pages, so
  they come back to the page after signing in.
- **`lib/supabase/session-budget.test.ts`** no longer measures the wall clock
  or counts every live timer in the process: the budget is asserted on a faked
  clock (not one tick early, and on the tick it is due) and the timer cleanup
  follows the one handle `withBudget` created.

SPEC IMPACT: None — the owner's 2026-10-03 rule (the song request goes with a
deleted guest and the Undo brings it back) is unchanged; only where the Undo's
copy is kept moved, from the browser into the database.
