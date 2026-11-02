## 2026-09-20 · fix(payments): the QR says what it carries, and the way out follows the payer

Owner, paying a real ₱837.50 Setnayan booking fee on prod (reference `SN9B7485DD`,
order `S89O-DW67KBQADN`): *"the amount is not filled up. it only shows 0."* and, of the
back link, *"what is this? it is not working properly."* Two defects, one shape — a
sentence written by hand in one file contradicting the value that decides it in another.

**1 · Three sentences about one QR code, two of them false.** `/pay/<ref>` step 1 said
*"the amount is already in it"*, `/vendor-dashboard/booking-fees/<id>` said *"The code on
the payment page already has the amount in it"*, and the caption six lines under the code
said *"type ₱837.50 yourself — this code doesn't carry an amount."* The third was the
honest one. `mintOrderQr` already knew the answer and already returned `null` when it
could not mint; **its answer never reached the words.**

- New `lib/qr-amount-truth.ts` — one verdict (`resolveQrAmount`), one place that phrases
  it (`qrWords`), one rule for a sentence that covers two rails
  (`everyOpenRailCarriesAmount`: *every* open rail must carry it, not *any*), and
  `payloadCarriesOwnAmount` for a code somebody else issued.
- Six surfaces now read their sentence off it: `/pay` page + panel, the booking-fee order
  page (including the two static merchant images it prints itself, which carry nothing),
  the couple's order page, the couple's checkout drawer, and the supplier's scan-to-pay QR
  shown to couples — the last of which said nothing at all about the amount before.
- 🚨 **The static code is no longer painted while the minted one is coming.** `/pay`
  renders the amount-carrying code in the browser, so the un-minted merchant image sat on
  screen — real, scannable, and worth ₱0 — for as long as the `qrcode` chunk took to
  arrive, then swapped. A placeholder holds that window now; the static code returns only
  if the render genuinely fails, and the caption flips with it.

**2 · A supplier paying their own fee was pointed at their customer's dashboard.** The old
`backFor(order)` asked for `event_id` first and read its presence as "the payer owns this
celebration". On a booking fee it means *the fee is for this event*; the same row carries
`vendor_profile_id` and a `user_id` that is the supplier's.

- New `lib/pay-back-link.ts` takes the viewer as well as the order. A shop's own bill never
  offers the couple's dashboard: a booking fee goes back to that fee's page, anything else
  to the shop.
- ⚠ **Dead end, not a leak** — `/dashboard/[eventId]/layout.tsx` `notFound()`s without a
  couple `event_members` row or an accepted moderator row, and the supplier holds neither
  (measured on prod: 1 member row, the couple's; 0 moderator rows). Nothing of the
  couple's was shown. The guard pins that the layout, not this wording fix, is what refuses.

**Guards** — `lib/the-qr-never-promises-what-it-cannot-carry.test.ts` (9 assertions,
executes the resolver against Setnayan's real GCash and BDO payloads and against a
hand-built, CRC-valid static-with-amount code; floors `qrWords` call sites per surface) and
`lib/the-way-out-follows-the-payer.test.ts` (11). Sabotage-proven three ways each: restoring
the hand-written step 1 → 1 fail; `qrWords` promising a prefill on a static verdict → 3;
`every` → `some` → 4; the event-first back rule → 2; the page dropping `user.id` → 1;
`isCoupleOnlyRoute` weakened to a bare `/dashboard/` prefix → 1.

SPEC IMPACT: None. No decision changes — the payment flow, the rails and the booking-fee
lane are unchanged; only what the screens SAY about the code, and where "back" goes.
