## 2026-10-19 · fix(march): a tapped name's guest card opens OVER the Maker — it was opening behind it

Owner, on live (Maker › Studio › Wedding March): *"tapping the person on the wedding march does not show the guest card as planned"*.

- The 2026-10-14 tap (PR #6540, live since batch 8) did fire: the tapped name wore its ring and the card was read — but its
  `Sheet` (`z-50`) was portalled bare onto `<body>`, while the Maker is a full-screen `fixed … z-[80]` layer. The card drew
  BEHIND the Maker, so on the phone nothing visibly happened. The 10-14 walk was in `/dev/details-lab`, which has no Maker
  shell over it, so it could not see this. Reproduced in `/dev/maker-lab?studio=1` (Chromium and WebKit iPhone 13): card in
  the DOM, covered.
- `march-guest-card.tsx`: the card's portal is now its own layer, `MARCH_CARD_LAYER` (`relative z-[90]` — the Studio's own
  `WishSheet` lift): over the Maker and its bars, still under what the card opens itself (its Title / Details dropdowns
  `z-[95]`, ⓘ notes `z-[96]`, toasts `z-[100]`). Fixes Details › Your event › Wedding March the same way.
- A chip tapped in the full "Not walking" list (`z-[95]`): the list steps aside while the card is open and is back after.
- A held tap is a tap: a finger that stays past the 250 ms long-press (the name lifts) and lets go where it pressed, never
  having wandered, opens the card instead of a no-op drop. One pure answer for every release, `releaseIs` (lib/march-drag.ts):
  anything that left the 4 px / 8 px slop at any moment is a drag, and a drag never opens the card.
- Dev lab only: the lab's card stand-in reads the card's Title key (`name_title`) the way `updateGuest` does, so a lab rename
  keeps "Mr.".
- Guard: `lib/the-march-opens-the-guest-card-in-place.test.ts` gains 6 (the layer's z read against the shell's, the Sheet's and
  PickMenu's), 6b (the tray steps aside) and 7 (`releaseIs` over 320 press cases: a drag never opens the card; a tap on a
  person always does); test 1 re-anchored on `releaseIs`.

SPEC IMPACT: None — implements the owner's 2026-10-14 ruling as planned; a held tap counting as a tap is named in the PR.
