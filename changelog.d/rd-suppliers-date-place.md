## 2026-10-13 · feat(suppliers): the date and place sheets, Help me choose, and calendar truth — "Not set", never "Free" (Suppliers PR5 · Pairs P5 + P6)

The couple's Suppliers page, step 5, stacked on step 4 (#6516). Map `SUPPLIER_CONNECTION_MAP_2026-10-10.md` P5 (rows 30–31) and P6 (row 25); owner rulings 2026-10-10 answers 7–10; prototype `suppliers_date_place_help_tour_2026-10-10.html` (the tour stays last — not built).

**Calendar truth (both ends, one rule)** — `lib/calendar-truth.ts` + `.server.ts`. The couple's "Free on your date" read calendar BLOCKS only and called a supplier with no calendar free (row 30). One read now: the lock's own refusal (`service_cards_unbookable_on` — closure, the shop's hard hold, a full calendar, a full slot: what marks the supplier's own Dates day Blocked or full) and whether the shop has a schedule pool. No pool → **"Calendar not set"** (the word the supplier's Dates prints, S-PR3), never Free; a failed read → no badge. The bench card, the inspector, the supplier sheet and Build's fit line ("· 1 not set"; ✓ only when every priced pick is READ free) all read it.

**The date sheet** — opened by the line's date (or Build's Help me choose / Set the date), in place, one lazy read (`vendors/_actions/fact-sheet.ts`, read-only, couple only): the ladder (Year → Month → Day → Time), I have a date | Help me choose (pills), the day as a Form row with a date; a day a booked supplier cannot do is refused by the draft door and named with the shipped clash note (J51; its "Yes, ask them" is now the accent, not ink); an open date change shows with Withdraw (answer 10, also "· change asked" on the line). Saved dates WAIT for the Event Hub's Apply (answer 7): the one draft door, and the line says "in your draft"; the page plans Find's fit and Build's fit on the drafted day while bookings keep the live row.

**Help me choose** — one month's Saturdays through the calendar truth, ONLY the days every PRICED pick can take (answer 8, `lib/help-me-choose.ts`) and every booked supplier can do; the picked day in terracotta; Use ‹day›.

**The place sheet** — the ladder (City or area → Reception → Ceremony; no Region rung), City or area, a booked venue as the supplier's details | Enter your own (pills, no boxed card), a place typed by hand = its name and its pin (`AddressPinField`, kind 25) for guests only — not added to the suppliers (answer 9); Find in ‹venue›.

**Find** shows only what can be booked on the date: the category page passes `hideUnbookable` (2026-10-10 search ruling; "farther away" unchanged).

Lab: `/dev/suppliers-lab?sheet=date|help|place` (+ `&help=none|unread|nomonth`, `&cal=notset`, `&change=1`, `&drafted=1`, `&venues=none`, `&factfail=read|write`).

SPEC IMPACT: None to the corpus decisions (implements PR5 + answers 7–10 as ruled). Two choices recorded in the PR for the owner: the bench/Build fit now follows the DRAFTED date (bookings stay on the live date); a supplier with blocks but no pool reads "Calendar not set" on a free day.
