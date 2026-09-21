## 2026-09-21 · feat(guests): extra seats per guest — None, +1, +2, +3, +4

Owner: *"+1 per guest can be up to number 4. can be +1/+2/+3/+4. these are for the additional seats."*

- **New `guests.plus_one_count`** (0–4, `CHECK`), backfilled to 1 wherever `plus_one_allowed` was on.
  The boolean stays and is DERIVED: trigger `guests_plus_one_count_sync_trg` keeps
  `plus_one_allowed = (plus_one_count > 0)` whichever column a writer touched — so its ~15 readers stay
  right — and turning the boolean "on" again never shrinks a +3. Post-condition: no row disagrees.
- **The guest list's Seat column** — where the "+1" badge already rode — is now the control: a dashed
  "+" for none, "+N" for some; both open **None · +1 · +2 · +3 · +4** (`PlusOneChipEditor`, instant with
  undo, `setGuestPlusOneCount` checks it changed a row). The name line reads "+ 3 guests" when unnamed.
- **Counts are seats:** the plus-ones meter sums seats (`plusOneSeats`), and head projection is
  `1 + seats` (a +3 is four people).
- **Every way in takes the number:** the guest-detail page and the add-guest form (checkbox → a 0–4
  choice; an old form's checkbox still works and never shrinks a +3), the quick-add bar ("+3" was parsed
  and capped at 2, then saved as a yes — it now saves 3; cap 4), CSV import (`plus_ones`, or a number /
  yes in `plus_one_allowed`).
- **The invitation** tells a +3 guest "saved you 3 more seats" (was always "one more"); one name box
  still, and the note is suggested for the others.
- Verified: db test (5, real SQL via replay); `lib/plus-one-count.test.ts` (5) + parser/core/projection
  tests updated to the new cap (a typed +3 saves three); browser harness with the real picker — menu
  visible under its button, None/+1…+4, picking +3 saves `3`. Sabotaged 2 ways (meter counts guests ·
  CSV number ignored), each caught. Exposure: +1 column line, identical to `plus_one_allowed`'s.

⚠ Not in this PR — owner call: the seat plan seats guest ROWS. A plus-one with a named/TBA row gets a
chair; the other extra seats are counted in the head count and meter but get no placeholder chair.

SPEC IMPACT: None
