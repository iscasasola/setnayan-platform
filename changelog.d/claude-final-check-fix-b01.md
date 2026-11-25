## 2026-11-25 · fix(live): B-01 Story Assignments can assign guests again

Final check area 3, live fault B-01 (A1-056). The Story Assignments picker (`app/dashboard/[eventId]/alaala/assignments/page.tsx`) read guests with `rsvp_status = 'confirmed'`. The `public.rsvp_status` enum has only `pending · attending · declined · maybe`, so Postgres refused the read, the page degraded to an empty picker and no guest could be assigned a story. It now reads the guests who said yes (`'attending'`).

New guard `lib/a-guest-read-filters-on-a-real-rsvp-value.test.ts`: `RsvpStatus` matches the enum in the migration, and every literal `.eq` / `.neq` / `.in` filter on `rsvp_status` in app/, lib/ and components/ names a real value. Red before the fix (2 fail), green after.

SPEC IMPACT: None. No screen change, no schema change.
