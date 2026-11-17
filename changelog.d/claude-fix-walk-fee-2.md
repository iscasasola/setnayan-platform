## 2026-11-13 · fix(booking-fee): the supplier's own codes stay their own; the fee words say the shipped rule (RW-19 · RW-20)

- **RW-19 (money)** The supplier's own "Check a date" and "Reviews" codes carried no `?src=own`, so a couple who
  scanned the supplier's own date QR, then asked on the shop page, was stamped Setnayan-sourced and the supplier was
  charged a booking fee. Every code the supplier hands out is now tagged as theirs — Promote's four codes, the printed
  codes, the door sticker (`ownDatesUrl` · `ownReviewsUrl` beside `ownPageUrl`). The Check-a-date page already carried
  the arrival onto "See the shop"; its own ask now stamps the SAME rule as the shop page (`arrivalInquirySourceOf`, one
  function for both — it used to send no source at all). The Reviews door keeps `?src=own` on every way on (sign in,
  moved, the shop's reviews) and never echoes any other value.
- **RW-20 / F-W1-75** The Money tour said the fee is "due after the day" — no code does that; it now says the lock's own
  sentence, "Setnayan charges this once a couple we brought you agrees to book" (`BOOKING_FEE_CHARGED_WHEN`, shared with
  the fee bill), and says "No booking fee is charged right now" while the fee switch is off. The Hub tour no longer
  states "A day opens once its booking fee is paid" (a live setting decides that; a waiting day says so on its row).
  "Free until December 31, 2026" now reads "Your day-of tools are free until December 31, 2026. The booking fee is
  separate."
- Guards: `lib/the-shop-page-is-setnayan-sourced.test.ts` (every Promote code + the dates→shop link + the review door),
  `lib/the-fee-words-match-the-rule.test.ts`.

SPEC IMPACT: None.
