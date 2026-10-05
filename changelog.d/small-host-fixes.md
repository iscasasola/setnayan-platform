## 2026-10-04 · fix(host): one "Table" word, suppliers open fast with the top bar, the ticket never shows blank

Three defects the controller found live on maria-and-jose at 375 px (2026-10-05).

- **Guest list rows — one "Table" word, and the name fits.** The phone row, the
  seat headings and the check-in desk prefixed every table name with "Table ",
  so the couple's "Sweetheart Table" read "Table Sweetheart Table" and "Table 9"
  read "Table Table 9" (all 32 rows on the live event; 26 of them ran off the
  card's edge, the sponsors' showing only "· T"). One rule now, `tableWords()`
  in `apps/web/lib/table-words.ts` (a bare number gets the word, every other
  name is printed as the couple typed it), shared with the guest card, which
  already had it privately. The table name stays on the line when it fits and
  moves under it, whole, when it does not; only a name wider than the card
  ends in "…". On the lab copy of the event's 32-row roster: 0 rows clipped.
  Guard: `apps/web/lib/table-words.test.ts`.
- **Suppliers — the top bar is back, the screen opens faster, and the copy is
  plain.** `ServicesTakeover` hid the app's only top bar below 1024 px (a
  2026-06-09 "focus mode" rule Guests dropped on 2026-08-21); it no longer does,
  and the bench anchors clear the bar's measured height. The closed find area
  (342 KB of the page's 365 KB of markup on maria-and-jose) is no longer drawn
  and hydrated on a phone until it first opens; a deep link and a computer still
  get it at once. The page's server reads that need nothing from each other
  (paywall, store shell, taxonomy, plan-group scope, build picks, deposits,
  review badges, bench pins, live headcount, saved requests, category
  decisions, unread counts, saved plans, allocation inputs, market pool) now
  start together right after the gates (`apps/web/lib/start-read.ts`) instead
  of one database trip at a time. "Next: pay your first payment" → "Next: make
  your first payment" (and the locked row's button). Guards:
  `suppliers-keeps-the-shell-bar.test.ts`, `suppliers-opens-fast.test.ts`,
  `lib/your-team-rows.test.ts`.
- **Guest card — the ticket never shows as a blank white box.** The ticket is a
  1080×1440 PNG drawn on demand (10–24 s measured on prod for a fresh draw);
  until it has loaded, the box is the ticket's own shape with the guest's name
  and a QR mark, and the picture fades in over it. Guard:
  `guests/_components/the-ticket-never-shows-blank.test.ts`.

`/dev/guests-lab?part=rows` draws the real Guest list rows on a copy of
maria-and-jose's roster (names, roles, sides, table names).

SPEC IMPACT: None.
