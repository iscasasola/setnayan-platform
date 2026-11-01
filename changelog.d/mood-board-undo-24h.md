## 2026-10-30 · feat(mood-board): coordinators apply, the owners have 24 hours to undo; suppliers' photos to approve on Home [migration]

Owner, 2026-10-30: "Suppliers need approval and coordinators auto apply and owners of the events has 24 hrs to undo
that change" · "So the changes made will show on home and the hosts need to approve it. Coordinators can also approve
the changes made by suppliers?" → "Yes we want that because we can allow coordinators to give access to speficic parts
of the app." Stacked on #7096 (Mood Board access by grant) and #7090 (the hosts-only write lock).

- **Suppliers without Edit: unchanged.** They suggest a photo, and the photo goes on the board only when someone
  taps Keep (`vendor_begin_inspiration_suggestion` is untouched).
- **Anyone else who changes the photos is recorded.** This covers a coordinator, a helper, or a supplier the hosts
  set to Mood Board Edit. The change still applies at once, as #7096 allows. Each upload, replace, move or remove is
  ONE row in the new `event_mood_board_changes` table: who, when, which part, and the before and after
  (`slot_key` · `slot_position` · `removed_at`) of every photo row it touched. An upload's new row is recorded as
  "did not exist". The recording is done by an AFTER trigger on `event_inspiration_assets`, so a write that skips
  the app is recorded too. The server actions open each change first through `begin_mood_board_change`, which is
  also the photo gate, so one press is one change.
- **One in-app notice per owner, per change.** The owners are the couple and every full co-host. The notice reads
  "Coordinator Styled by Bea changed the Mood Board · Stage", type `mood_board_changed`, and it opens Home. No email
  and no push. An owner's own changes record nothing and notify nobody.
- **Undo, owners only, within 24 hours, checked on the server.** `undo_mood_board_change` is SECURITY INVOKER: the
  restore is written as the owner, through #7090's policies and its three-column grant. The SECURITY DEFINER half on
  each side does the checks: an owner of this event, within 24 hours, not already undone. The change is marked undone
  only once every row really is back. If the board has moved on (a row is no longer where this change left it, or
  another photo now sits where it would go back), Undo answers "This part changed again since — undo the later change
  first." and writes nothing.
- **Suppliers' suggestions can be answered by anyone with Mood Board Edit.** Keep, No thanks and the Keep toast's
  Undo were hosts-only after #7096. Now `couple_decide_inspiration_suggestion` / `couple_undo_kept_inspiration_suggestion`
  ask `can_change_mood_board_photos` instead of `colour_access_caller_is_couple`. That gate itself is untouched and
  still guards the colour grants. Edit holders also get one SELECT policy so they can read the suggestions. A Keep by
  someone who is not an owner is a recorded change: the owners are notified and have 24 hours to Undo it, and Undo
  puts the suggestion back to waiting. If the coordinator undoes the Keep from their own toast, their own change is
  closed instead of a second one being recorded.
- **Home.** Two new lines in the Today list, `MoodBoardAsksDoorway`, both answered in place in the house Sheet. One
  is "Bloom & Co. suggested a photo · Stage" with Decline · Keep, shown to whoever may answer. The other is the last
  24 hours of changes by others, each with Undo and its time left, shown to the owners only. Both come from ONE read,
  `mood_board_home_asks`. Lab: `/dev/details-lab?asks=moodboard`.
- **Server-action budget unchanged (1225).** `undoKeptInspirationSuggestion` became the single dispatcher
  `undoMoodBoardChange(eventId, { suggestionId } | { changeId })`.
- **Proof.** `tests/db/mood-board-changes-the-owners-can-undo.db.test.ts` has 11 tests, all green. Sabotage: widening
  the window to 48 h and switching off the moved-on check turned tests 3 and 5 red; after restoring, all green.
- Migrations `20271298460272_mood_board_changed_notification_type.sql` (the enum value, on its own) and
  `20271299051148_mood_board_changes_undo_24h.sql`. Ugat J46 claims the new table. Erasure coverage lists its two
  user stamps (SET NULL).

SPEC IMPACT: Implements DECISION_LOG 2026-10-30 "MOOD BOARD CHANGES: SUPPLIERS ASK, COORDINATORS APPLY, THE OWNERS HAVE
24 HOURS TO UNDO" (and its Home / coordinators-approve follow-up). It also amends the same day's "THE MOOD BOARD IS
CHANGED BY THE HOSTS — AND BY ANY SUPPLIER THEY GIVE ACCESS TO": Keep / No thanks are no longer the hosts' alone. No
corpus edit was needed beyond those rows.
