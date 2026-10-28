## 2026-10-29 · fix(vendor-dashboard): Today's "newly earned" line stacks on a phone; an empty Today says "Nothing waiting" once

Owner bug, 28 Oct, live shots of `/vendor-dashboard` at 390 px — *"mobile view does not look nice"*; and 29 Oct,
*"always maximize the screen use"*.

- **The earned line (`badge-earned-line.tsx`, #7021).** Pill, sentence, Save to print and Got it shared ONE row, so
  "You earned SETNAYAN Verified ✓ — your tarp and card can show it" was crushed into a 20–35 px column, 12–13 lines
  tall. Now: row 1 is the pill + ONE short line ("You earned SETNAYAN Verified" — the pill already wears the ✓); the
  "your tarp and calling card can show it" reason moved behind an ⓘ (`InfoTip`). Row 2 is Save to print · Got it,
  right-aligned. From 768 px both sit on one row. If a sentence ever outgrows the room beside the pill it wraps under
  the pill at full width, never into a column. Save to print and Got it behave exactly as before (same `SaveFileLink`,
  same `localStorage` dismiss). `newlyEarned` (`lib/shop-badges.ts`) now returns `sentence` + `detail`.
- **Empty Today.** With nothing waiting the Next card said "Nothing waiting · No bookings yet… · See the month" and
  the waiting list directly under it said "✓ Nothing waiting on you" again. The row is now skipped when the Next card
  IS the empty state (`clear` — reached only after the desk read in full). Under any other card the row still says
  the list is empty; an unread desk still says "couldn't load", never "nothing waiting".
- **Lab:** `/dev/supplier-lab?s=clear&earned=verified|milestone` mounts the earned line above an empty Today.

Measured (lab, Chromium + WebKit, 375/390 light + dark, 768): the sentence is 1 line at 183–194 px (it was 20–35 px,
12–13 lines); "Nothing waiting" appears once on the page (it was twice).

Guards: `app/vendor-dashboard/_components/the-earned-line-stacks-on-a-phone.test.ts` (every announceable sentence ≤ 40
chars with no tail; the root is a block below `md:`; the actions are a sibling row, not inside the sentence row) and
`app/vendor-dashboard/_components/empty-today-says-it-once.test.ts` (rendered markup: once on `clear`; still drawn under
payday; never on an unread desk). Each sabotaged once and restored.

SPEC IMPACT: None.
