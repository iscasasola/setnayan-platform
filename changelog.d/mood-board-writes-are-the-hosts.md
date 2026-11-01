## 2026-10-30 · fix(security): tighten who can change Mood Board rows [migration]

- Migration `20271297469032_mood_board_writes_are_the_hosts.sql` re-scopes the INSERT and UPDATE policies on
  `event_inspiration_assets` to the event's hosts (`current_couple_event_ids()` — the creator and full co-hosts) plus
  admins (`admin_all`, unchanged), and limits UPDATE to the columns the app changes (`removed_at`, `slot_key`,
  `slot_position`). Write grants for `anon` are removed. READ is unchanged: everyone who saw the board still does.
- Matches the existing ruling in `lib/delegate-areas.ts` (Mood Board is View for delegates; it "saves for the hosts
  alone") and the palette/theme columns on `events`, which were already host-only.
- The couple's ✓ Keep / Undo on a supplier suggestion (SECURITY DEFINER) is untouched and still writes the board.
- New db test `the-mood-board-is-changed-by-its-hosts.db.test.ts` (sabotaged once: re-opening the policies turns it
  red). Exposure baseline regenerated — it shows only removed reach. Ugat J46 `guardedBy` text updated.

SPEC IMPACT: None — enforces the already-recorded delegate-area ruling in the database; no decision changes.
