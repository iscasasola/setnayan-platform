# HANDOVER — rd/honour-attendants-own-rows (2026-10-19)

Task: Studio › Mood Board & Dress Code — the honour attendants get their own rows (owner 2026-10-19, two shared rows
shaped like Principal Sponsors: Best Man + Best Woman; Maid + Matron of Honor).

## Decisions taken
- Storage = existing shape: `roles.maid_of_honor`, `roles.best_man` (+ `women.roles.best_man`). Matches the existing
  palette slots and survives the old dress-code form (it keeps roleLabel-known role keys).
- Reader switch = the reader's column Wear is picked (`honourRowSpeaks`); colours alone never move a guest off the group.
- General view lists honour rows like every other row (one fact with the Studio).
- Measured prod (SELECT-only): ONE event holds an old-form `roles.best_man {style: suit}` + `roles.best_woman
  {style: long_gown}`, and touched `best_man`/`maid_of_honor` colours (#803236). After merge: its best man reads the
  honour row (Suit and tie — same Wear as its groomsmen; colour #803236 instead of the groomsmen's); the best woman
  keeps the groomsmen row (her old line is not read); the general view gains the two rows (Studio shows the same).

## State
- [x] code + guard written
- [ ] targeted tests (waiting on heavy lock / install)
- [ ] sabotage
- [ ] shots 375 light/dark
- [ ] PR draft
