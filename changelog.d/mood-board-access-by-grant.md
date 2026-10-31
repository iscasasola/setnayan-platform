## 2026-10-30 · feat(mood-board): the hosts give one person Mood Board access; everyone else views [migration]

Owner, 2026-10-30: "Only the host and whoever supplier they give access to and not all" · "The rest can view but not
edit" · "Host is the owners of the event". Stacked on #7090 (the hosts-only write lock).

- **The grant that already exists.** A person the hosts let into the event holds an `event_moderators` seat. Each area
  of that seat is set in Event details › Event access (`setDelegateArea` → `permissions_json.areas`). Mood Board is
  now one of those areas: **Edit · View**, View by default. There is no Off, because every delegate reads the board
  whatever the area says. No new table, column or access system.
- **Where the hosts switch it on.** A helper's row already had the per-area toggles. A coordinator on **Limited** now
  gets the same toggles under the Limited · Full pick, as Limited's own ⓘ promises ("until you allow a part in Event
  details › Access"). Full access is a co-host seat, so that coordinator is already a host. A supplier who asked for
  access through the access-request door sits on a coordinator seat, so once the hosts pick Limited they get the
  same toggles.
- **Migration `20271297714074_mood_board_access_by_grant.sql`.**
  - The INSERT and UPDATE policies on `event_inspiration_assets` admit the hosts OR a seat whose Mood Board area is
    Edit (`current_moderator_area_levels('mood_board')`).
  - The column grants from #7090 stay: `removed_at`, `slot_key`, `slot_position` only.
  - New `can_change_mood_board_photos(event)` asks the same question. It is executable by `authenticated` only.
- **Server actions say no in words.** A refused write under RLS is an empty success, so the actions now ask first.
  - Upload, remove, reorder and gallery pick ask `can_change_mood_board_photos`, after the limited-helper gate.
  - Palette, theme, theme intent, template and the suggestion Keep / Decline / Undo ask the hosts' gate
    (`colour_access_caller_is_couple`). The palette stays the hosts' because `couple_can_update_event` does not move.
  - New `lib/mood-board-gate.ts` holds the two questions. `lib/host-gate.ts` has the wrappers.
- The coordinator's "Same access as you" switch now turns OFF to each area's lowest level. Mood Board goes to View
  instead of an 'off' the action would refuse.
- **Tests.**
  - New db test `the-mood-board-is-changed-by-whoever-the-hosts-allow.db.test.ts`: a granted supplier, a granted
    Limited coordinator and a granted helper can upload, replace, move and remove.
  - The same test refuses a booked supplier with no grant, a coordinator at View, a guest, another event's host and a
    person granted elsewhere, and all of them can still read.
  - It also checks column limits, that taking the grant back works on the next write, that the gate and the policy
    agree, and that the palette stays the hosts'.
  - Sabotaged twice: dropping the area arm turns it red, and so does widening it to View.
  - New guard `lib/mood-board-gate.test.ts`: every action that writes a board photo asks the photo gate, and every
    palette or decision action asks the hosts' gate. The writer set is derived from the source.
- The exposure baseline is regenerated: one new function, and the two policy texts. The Ugat J46 `guardedBy` text is
  updated.
- New lab view `/dev/details-lab?access=grant`.

Not built (open questions):
- A booked supplier with **no seat** keeps View + Suggest a photo → the couple's Keep. They cannot open the couple's
  board editor, and their own Mood Board page is read-only.
- The floor access-request door does not offer Mood Board.

SPEC IMPACT: Implements DECISION_LOG 2026-10-30 "THE MOOD BOARD IS CHANGED BY THE HOSTS — AND BY ANY SUPPLIER THEY GIVE
ACCESS TO, NOT BY EVERY MEMBER" (it amends `lib/delegate-areas.ts`'s "Mood Board is fixed at View for delegates"). No
new ruling. The corpus row already records the decision.
