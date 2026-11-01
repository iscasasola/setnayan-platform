## 2026-10-28 · perf(guests): a guest's card opens at the tap — the person at once, only their card read

Owner, 27 Oct, his event in the iPhone app: the Guests › guest card took ~2 s to open.

- **Cause (measured, `/dev/guests-lab?part=screen&open=1&many=150`, Playwright 390 × 844):** a tap moved `?inspect=`
  with `router.push`, so Next re-rendered the WHOLE Guests page on the server and sent every name back (~312 KB for
  182 guests) while the sheet said only "Opening…"; the name painted only after that and a redraw of every row —
  median 3,153 ms tap → name in Chromium at 4× CPU, 1,068 ms in WebKit.
- **Fix:** the sheet opens AT THE TAP with the card's own head (face · eyebrow · name · reply, now in
  `guest-card-head.tsx`, re-exported by the card body) drawn from the row on screen; only the body waits, for ONE card
  read (`openGuestCard(…, 'list')`, the Wedding March's reader — ~39 KB); the address moves by native `pushState`
  (Back closes it; closing asks the server nothing). The list reads only the inspector's stable way in
  (`useInspectorSelect`), so an open redraws no row. A save's revalidation (or a deep link) still renders the card on
  the server, and that newer card takes over (`InspectorLayout inspectorId`). The card read alone is 2 trips, not 3:
  the sign-in check rides beside it on its own client (`getCurrentUser`).
- **After:** tap → name ~256 ms Chromium 4× · ~111 ms WebKit (lab, dev server).
- Guard: `guests/_components/the-card-opens-at-the-tap.test.ts`; `the-guests-page-asks-once.test.ts` 1b (card alone
  ≤ 2 trips). Lab: `?part=screen&open=1` times tap → card.

SPEC IMPACT: None — same card, same reads, same rules; only when it is drawn and what is asked for.
