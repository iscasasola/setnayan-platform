## 2026-09-29 · fix(guests): a malformed guest address is "not found", never a crash

`/dashboard/<event>/guests/{guest}` (a non-UUID segment) rendered the global error boundary —
"Something on our end didn't work" — instead of a 404 (measured on prod commit bd0ba53b8). The
segment reached `.eq('guest_id', '{guest}')`; Postgres rejected it (22P02 invalid input syntax for
type uuid); and `fetchGuestById` deliberately RE-THROWS every error except a missing relation, so the
page's own `notFound()` never ran. (The earlier assumption that `fetchGuestById` "returns null on a
query error" was only true for a missing relation.)

- The guest page checks `isUuid(guestId)` / `isUuid(eventId)` once, first, → `notFound()`.
- `GET /api/website/qr/guest/[guestId]` refuses a non-UUID with 400 before querying.
- Both reuse `lib/is-uuid.ts`, which existed for exactly this class (`/join/zzzbad`).
- Guard `lib/a-malformed-guest-id-is-not-found.test.ts` is keyed on the `[guestId]` SEGMENT, so a new
  page or route added under it is covered the day it lands; sabotage-proven.

SPEC IMPACT: None.
