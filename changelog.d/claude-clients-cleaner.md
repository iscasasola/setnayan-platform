## 2026-11-19 · feat(supplier-clients): Clients, cleaner — no empty top, five tiles, the week at rest

Owner: *"fixe the clients page over all look, balance and simplicity … we do not want unwanted space on top"* → drawing
https://claude.ai/artifact/NZRgCqwiPS4SuuNn4jcXsR → *"Yes, all three"* (specs DECISION_LOG 2026-11-19 "SUPPLIER CLIENTS,
CLEANER", f0eff9e3). Reposition only — no new reads, actions, tables or copy.

- **No empty top (phone):** the Clients column loses `pt-4` and `space-y-4` (the sr-only `<h1>` made it 16px of nothing),
  the "Clients ⚙" row loses `py-1.5` / `mb-3`, and the "N booked · ₱X to collect" counts beside it (the tiles say them).
- **Q3 · one tiles row:** Booked · Asked · To collect · Overdue · Unread, over the month. The meetings tile left the row
  (its list stays: Show & sort › Show › Schedules); Overdue / Unread left their own pill row for tinted tiles — still
  hidden at a real 0, still "couldn't load" when unread.
- **Q1 · the week at rest:** on a phone the one Clients screen opens on the shipped week strip; "Whole month" opens the
  shipped grid in place. The legend moved into an ⓘ (`CalendarLegend` gained `as="span"` to sit in the tip). From 701
  the month always shows.
- **Q2 · ⚙ › Teams and days:** Not available · Waiting list · QR codes (`DatesFolds`) left the foot of the page for the ⚙
  sheet, under How many a day. Old `?open=block|waitlist` links forward with `gear=1`, so they still land on the fold.
- **From 701:** the title row is not drawn (the bar already says "Clients ▾"); the one ⚙ portals into the bar's tools
  box (`usePinTools`, now exported) beside 🔍 · sliders · ＋.

SPEC IMPACT: specs DECISION_LOG 2026-11-19 "SUPPLIER CLIENTS, CLEANER — APPROVED" (f0eff9e3) already records it; this
amends v113 one-screen (the month heads Clients → the week at rest on a phone), Build 2 #43a (month tools at the foot →
⚙) and #43c (the four tiles). No further corpus edit.
