## 2026-09-27 · fix(schedule): every screen shows a schedule time as the couple typed it

A stored schedule time (`event_schedule_blocks.start_at`) is the venue's wall clock in a UTC
column — `13:30Z` means 1:30 PM. The couple's Schedule and the guest page already read it that
way. Four screens re-zoned it into Asia/Manila (or into whatever zone the server ran in) and
showed a different time for the same row:

- Event Hub Maker, "Run of show" tile — "Guests arrive · **9:30 PM**" for a 1:30 PM arrival.
- The Maker's schedule panel ("What guests see on your schedule") — runtime-zone formatter.
- Supplier day-of console, "Your run of day" — 9:30 PM (the call time above it was already fixed).
- Supplier Customer Card, Script tab — 9:30 PM beside every moment.
- Couple Home "What's next" — printed the lifted instant in the server zone ("5:30 AM").

All now read through the one shared formatter (`formatWallClock` / `formatBlockTime`). Four
server-rendered formatters that were right only because Vercel runs in UTC (supplier Customer
Card times, seat plan cocktail window, proposal merge, schedule suggestions) now read the digits
explicitly. The schedule TEMPLATE anchor used local `setHours` (right on Vercel by accident); it
now reuses the seed's component-built `anchorIso`. No stored data changes.

Guard: `lib/a-schedule-time-reads-the-same-everywhere.test.ts` — template/edit write the same
value in every runtime zone; dashboard, guest page and Maker tile print the same string; and no
file handling schedule times formats a clock time in a real zone (real-instant sites exempt by
count, with the reason).

SPEC IMPACT: None — the stored convention is unchanged; this aligns the outliers with it.
