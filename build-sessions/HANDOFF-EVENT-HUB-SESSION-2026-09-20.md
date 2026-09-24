# Handoff from the "Event Hub builds status" session, 2026-09-20

None of this session's messages reached the Overall Controller. All of them were held for approval and expired. This file carries what they said.

## Done
- **DAY-7 (emcee questions):** PR #5639 MERGED 2026-09-19T16:29:51Z. Built by S32, not this session. Worktrees wt-S32 and wt-q5639 belong to that session and were left alone.
- **DAY-12 (Live Studio venue screens):** PR #5723 MERGED 2026-09-19T17:31:59Z (merge 516dbf7ecc). All 18 checks passed. `setnayan.com/live` has been served in prod since 17:38Z. No migration. Worktree pruned.
- **Phone tab label:** the owner chose to keep "Event Hub Controller". Row CLOSED.

## Owner rulings, 2026-09-20 (DAY-12)
1. Venue screens belong in the unified Live Studio controller.
2. Screens show only live background, mirror or off. They never show the photo wall.
3. Mirroring is acceptable if the screen shows a visible "delayed" label.

## Decided by the owner, 2026-09-20
- Venue screens stay FREE.
- The cap of 6 screens per event stands.

## Prod check, done 2026-09-20 as testnayan1 on "Song Desk Test Night"
Add, pair, live background, off, mirror and remove all worked in prod, and the TV followed every change within seconds.
Three defects were found and fixed in PR #5732 (MERGED): the sheet closed after each action and hid the new code, the delay notice covered YouTube's title bar, and `rel=0` appeared twice in the embed URL.
Still open: in the Browser pane the mirrored video stopped on its play button. It needs a look on a real TV.
Test data: the temporary watch link was removed. Screen row id 4 stays marked removed (not hard-deleted).

## Corpus
The DAY-12 row was appended to `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` but NOT committed. That file already had another session's uncommitted NFC row.
