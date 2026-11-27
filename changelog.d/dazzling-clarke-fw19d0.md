## 2026-11-27 · fix(layout): iPad and phone polish from the 27 Nov walkthrough (lane OLD-L8)

- **Unihome event card** uses the drawing's cover-left, words-right card from 768 px (it started at 1024), so one cover no longer fills an iPad's first screen.
- **Unihome jump row:** a tapped icon stays lit until the person scrolls by hand, and the bottom of the page lights Discover only once Discover fills the upper half of the view. It used to light Discover while Events was at the top.
- **Unihome profile:** the public address ends in "…" instead of breaking mid-word, and "· off" stays with it.
- **Account switcher:** the other-accounts rows lose the circled "@" mark, and the email shows under a real name only.
- **Supplier contracts** (`/dashboard/[eventId]/contracts`) draws the back button (16 Nov back rule).
- **Supplier Money › Log a payment** wears the payment topic's icon (`TOPIC_ICON.payment`) instead of a ✓, which read as "done".
- **Hub Maker look sample:** the "Our day · Directions · Table 7" card wears the plate's own ink, the way the guest page's plates do. In light mode it drew the page's ink, which was pale on a mustard card.

Guard: `lib/the-ipad-and-layout-polish-holds.test.ts`, sabotage-checked. `money-is-rows.test.ts` now pins the new icon. Measured in the Maker lab: the sample card on mustard under a pale page ink read 2.02:1 before and reads 7.93:1 now.

Open for the owner: Shop Analytics at iPad 820 is not changed. The cut card on the left is the loop's copy beside the centred first card, which is the owner-ruled centre-snap carousel; fixing it is a design change. "New event" plus the floating "Create an event" both stay, because the approved Unihome v5 drawing has both. The word on "Log a payment" waits too: the One Thumb Row standard draws an icon-only round.

SPEC IMPACT: None. These are fixes to already-drawn screens. No new design, no data change.
