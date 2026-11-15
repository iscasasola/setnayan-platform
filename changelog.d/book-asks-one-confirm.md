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

Guard: `lib/book-asks-one-confirm.test.ts`. It was broken twice to confirm it fails: the confirm removed, and the
dialog unmounted. There is no new server action and no migration.

SPEC IMPACT: None. DECISION_LOG 75a46e3c already records the ruling.
