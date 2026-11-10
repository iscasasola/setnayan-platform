## 2026-11-10 · fix(dates): four event dates printed the day before — formatted in Manila now

Found on the owner's walk: Inquire's event picker listed "Indalecio & Claire · Dec 17, 2026" for an event dated 18 Dec. `new Date('<date>T00:00:00+08:00').toLocaleDateString('en-PH', …)` without `timeZone` runs on Vercel in UTC and prints the day before for everyone. Same shape fixed in the shop's waitlist line, the supplier calendar action and a supplier email (`lib/vendor-email-triggers.ts`). Guard `lib/manila-dates-format-in-manila.test.ts` fails any such call without `timeZone: 'Asia/Manila'`.

SPEC IMPACT: None.
