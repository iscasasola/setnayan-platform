## 2026-10-08 · fix(suppliers): Find at 375 — one button height, nothing shows above the pinned date line, and a lab that draws the page

The controller walked Find on a real event at 375 px (2026-10-08) and measured
three things. Stacked on `rd/suppliers-find` (#6425).

- **One height in a verb row.** "Pay" (a link) drew 40 px tall beside "Your
  record" and "Connect" (buttons) at 44: `globals.css` floors every `<button>`
  at 44 px and a link has no floor. Every `ActionButton` in the bench is now the
  rule's 40 px pill, whatever the element (`.slcat .ab{min-height:40px}`).
  The icon-only circles after "Pay" are the design — acceptance picture
  `05-booked-rows-room-size-light.jpg` draws `Pay` with its word and the rest as
  icons at 375 — and are left as they are.
- **Nothing shows between the top bar and the pinned date line.** On a phone
  the app's top bar slides away as the page scrolls down and back as it scrolls
  up (`transform 0.3s ease-out`). The pinned block followed it on Tailwind's
  `ease-out` (a different, faster curve) and the open category's pinned head
  did not travel at all — it jumped — so each time the bar came back a strip of
  the list showed above the date line and under the segmented control. Both now
  move for the same time on the same curve as the bar, with no reduced-motion
  exception the bar does not have.
- **"More to compare" under a booked category:** not drawn, by design (the
  prototype: `bookedIn(k) ? '' : …`); a booked category carries "＋ Add your
  own" at its foot instead. A category with only the couple's own suppliers and
  no booking does draw the list. No change — now held by a test.
- **`/dev/suppliers-lab`** (404 in production, held by
  `the-lab-never-ships.test.ts`): the real shell, the real Find body and the
  real supplier sheet on fixture data, under a stand-in top bar that slides the
  way the real one does. The marketplace read is answered from fixtures through
  `MoreRowStandInCtx` (null everywhere else). It has no door, like every lab —
  one line in the root map's `no-door` baseline.

+0 exported server actions · no migration · no new read: the page's Supabase
requests per render are unchanged.

SPEC IMPACT: None.
