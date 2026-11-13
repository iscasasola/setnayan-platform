## 2026-11-13 · fix(walk): round 7 of the re-walk (RW-65 · RW-81 · …)

- **RW-65** The "What do you need?" dropdown's first choice read "Simple event · Papic + one QR", a working name; it now
  says "Just photos and one QR for everyone". The Get-together tile's description said "No vendors, no marketplace" —
  a guarded data migration changes it to "No suppliers to book" only while the row still holds its seed text, so an
  admin's own wording is never overwritten.
- **RW-81** The sample shop page on /for-suppliers drew "View larger map →" as a live link. Both map components take
  `mapHref={null}` (like `checkHref={null}`) and then draw the words with no link; the sample passes it on every map.
  Guard: `app/v/[slug]/the-sample-is-the-real-page.test.ts`.
- **RW-64** "Someone —" stopped being printed as a name in the From-your-people picker, on the reply page ("Someone —
  · Not you? Switch") and in the account switcher. One pure rule, `realNameOrNull` (`lib/no-name.ts`): a name made only
  of People's placeholder word and marks with no letter or digit is no name, and each screen then uses its own no-name
  words ("Your reply"; the switcher's email). The placeholder word now lives in that pure module and People imports it.
- **RW-87** The supplier card's run of show said "NOW · Not started yet" 179 days early. Before the event's day the Now
  box says "Starts on Fri, Dec 18." (the page hands in the day's words); "Run of show · Live" keeps its name (owner).
- **RW-89** A booked category row on the couple's Suppliers list no longer offers "Your request" beside "Booked ✓", and
  the category name keeps its width ("Lights & Sound" no longer stacks a letter per line: `overflow-wrap:anywhere`
  let it shrink to one letter).
- **RW-84** Today's "Booked" stat line reads "events this month" — it counts events DATED this month (the owner's Q2
  default), so four bookings made this month for later dates are not read as missing. Counting by booking date instead
  is an owner question, flagged.
- **RW-67** A service card states its daily limit once: when it shares a schedule, the field says the schedule's
  number is the one that holds; the schedule line no longer repeats "· 1 a day".
- Guard: `lib/the-walk-round-7.test.ts`.

SPEC IMPACT: None.
