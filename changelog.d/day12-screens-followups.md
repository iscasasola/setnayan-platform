## 2026-09-20 · fix(live-studio): venue screens — three defects from the prod check (DAY-12 follow-up)

Prod check as testnayan1 on a test event, 2026-09-20: add a screen, pair a second tab at
`/live`, switch between live background, off and mirror, then remove it. Each step worked, and
the TV followed every change within seconds. It also found three defects:

- **The sheet closed after every screen action.** A server action's `redirect()` drops the
  `#hash`, so after "Add a screen" the controller came back with the sheet shut and the new
  screen's pairing code hidden. Actions now redirect with `?sheet=screens`. `SetupSheet`
  opens from either form (`sheetAnchorFrom`) and strips both when it closes. Its comment
  claimed a server action could redirect with a hash; that is now corrected.
- **The delay notice sat on YouTube's own title bar** in the top-left. It moves to the
  bottom-left, the one corner the YouTube player leaves clear.
- **`rel=0` appeared twice in the embed URL.** `screenEmbedSrc` now sets each player
  parameter instead of appending.

Guarded by `sheet-reopens-after-an-action.test.ts` (4 tests; changing the redirect back to
`#screens` turns one red) and one new case in `lib/live-screens.test.ts`.

Still open, and not changed here: in the check's browser the mirrored video stopped on its
play button instead of autoplaying. The page grants the frame autoplay, and the player is
not reloaded by the 5-second refresh. So the cause is YouTube or that browser, and it needs
a look on a real TV.

Test data: the temporary watch link on the test event was removed. The "Prod check" screen
row stays removed, which is by design; it was not hard-deleted.

SPEC IMPACT: None.
