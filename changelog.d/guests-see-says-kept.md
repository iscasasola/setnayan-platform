## 2026-10-21 · fix(maker): "What guests see" — a Keep that worked looks like it worked

Owner, on the Maker's "What guests see" sheet: *"after I pressed apply. it just greyed out?"* The save had
worked — the ticks were in the Event Hub draft — but the only sign was a small grey line and a button gone grey
(it had nothing left to save), which read as "nothing happened". The button also said "Apply", the word of the
Maker's own ✓, which is what publishes (INTERACTION_RULES §8).

- The sheet's button now says what it does: **Keep · N changes** (and **Keep**, waiting, with nothing ticked),
  with one quiet line under it while ticks wait: *"Guests see it once you publish with ✓."* The tap lines and
  the leave question follow (*"— Keep to put it in your draft."* · *"Leave without keeping?"*).
- After a successful Keep the button reads **✓ Kept** in the confirm green (pressable — a tap closes now), and
  the sheet closes itself 1.2 s later (`GUESTS_SEE_KEPT_MS`). The Maker's ✓ already wears the count: the save
  asks for it with the write (`HUB_DRAFT_BAR_FIELD`), unchanged.
- A refused or failed Keep leaves the sheet open with the reason, the ticks still waiting, as before.
- The decision lives in `lib/guests-see-table.ts` (`guestsSeeKeepOutcome` · `guestsSeeMainButton` ·
  `guestsSeeCloseWhenKept`); guarded by `apps/web/lib/the-guests-see-keep-is-seen.test.ts` (six sabotages, each
  red). Two older guards re-aimed to the new names, same properties.

SPEC IMPACT: None — no DECISION_LOG row rules on this button's word; the 2026-10-10 prototype
(`maker_what_guests_see_2026-10-10.html`) drew "Apply · N changes", so the rename is flagged for the owner in the PR.
