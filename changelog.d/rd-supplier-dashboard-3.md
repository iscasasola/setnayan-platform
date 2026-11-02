## 2026-10-13 · feat(supplier): Customers › Dates — one calendar in kind 31, its folds, the day sheet, and one QR codes page (S-PR3)

- **The month** is the shared `CalendarGrid`, extended to control kind 31 (`app/_components/calendar.tsx`, `lib/calendar-grid.ts`): green dot Booked, amber dot Holding, a hatched square for a blocked day, bold when full; the picked day stays the one terracotta circle; `CalendarLegend` says every mark in words. Facts still come from `buildCustomerCalendarMonth`, folded by `lib/vendor-dates.ts`.
- **Under it**: the picked day's rows ("Sat 3 · Tomorrow") with ONE Calendars dropdown, then Block days · Waitlist · Capacity folds (kind 17 `Counter`, saves itself) and a QR codes row; thumb row Block a date · Add. Every form posts the shipped calendar action and comes back to Dates (`return_to=dates`, `return_fold`).
- **One day** (frame 35) at `?seg=dates&day=`; `/calendar/[date]` forwards there. Bookings, outside clients, couples holding the date (with Chat), the waiting list, the shop's holds (Reopen), Block this day (a switch), Who works it (read).
- **Holding is real now**: the thread `event` embed is always null for a supplier, so the old "N asking" mark never showed; Dates reads the dates once from `events` (admin, scoped to the shop's own threads).
- **Never "Free"** (owner P5): a quiet day says "Nothing on this day"; no calendar says "Not set".
- **QR codes** = `/invite`: Shortlist · free | Booked · one-use (one dropdown), the new shared `QrCard` (kind 24: dark on white, Share main · Download second, opens big, used/void stamped), the Issued ledger fold; `/locked-qr` forwards to it.
- Retired: `calendar/surface.tsx` (1,233 lines), `customers-filter-bar.tsx`, `_components/qr-section.tsx`, `_components/qr-card.tsx`, the Availability accordion fold.
- Guard: `customers/dates-is-one-calendar.test.ts` (8 claims, 20 sabotages red). Re-anchored: people-is-rows, the-roster-opens-on-who-is-waiting, every-qr-carries-the-strip, reads-are-honest, upsells-obey-the-switch, the-four-small-lists-read-to-the-end, vendor-room-access, a-round-code-sits-in-a-round-slot, pills-are-everywhere, service-card-kind.

SPEC IMPACT: None (builds the approved plan § 2 / § 6 S-PR3 and control templates round 2 kinds 17 · 24 · 31; decisions not in the record are listed in the PR body).
