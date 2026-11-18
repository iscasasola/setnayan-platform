## 2026-11-16 · fix(book): Book asks one confirm before it sends

Owner ruling 2026-11-16 (DECISION_LOG 75a46e3c); walk EB-175. A Find card's **Book** sent a booking request to a
supplier on the first tap, with no confirm step.

`AccordionLockButton` is the one button every Book press goes through: the Find card, the build's booked tab,
the chat card and the proposal page. It now asks once before anything is sent:

- "Ask <supplier> to book your date? This sends <supplier> a booking request. It stays a request until they say
  yes." with **Not yet** and **Yes, send it**.
- It uses the shipped `useConfirm` box (`app/_components/confirm-dialog.tsx`), the same one the card's Remove uses.
  No new dialog is drawn.
- The words are `bookConfirmCopy` in `lib/explore-info-copy.ts`.

Owner 16 Nov ("A COUPLE IS ALWAYS TOLD WHEN A SUPPLIER IS NOT YET VERIFIED"): when the shop is read as not yet
verified, the confirm also carries the shipped `NotYetVerifiedThreadLine`
(`app/_components/chat/not-yet-verified-line.tsx`), with the same words and ⓘ as the chat head.

- It never blocks the booking.
- The Find card and the build pass `isVerified`.
- The chat card and the proposal page pass it through `CoupleLockTarget.notYetVerified`, which comes from the
  chat's own `readThreadShopNotYetVerified` read.
- Off-platform or unread shops draw nothing.

Stacked on #7828, which removed the client-side verification block from this button. Merge #7828 first.

Guard: `lib/book-asks-one-confirm.test.ts`. It was also broken twice for the new claim: the line dropped, and a
block added when the shop is not verified. It was broken twice to confirm it fails: the confirm removed, and the
dialog unmounted. There is no new server action and no migration.

SPEC IMPACT: None. DECISION_LOG 75a46e3c already records the ruling.
