## 2026-09-11 · fix(lock): a service card's daily limit really refuses — LOCK-PATH CAPACITY (N5 · part E)

**The bug** (measured by S2 in production `pg_policies`; re-measured by N5 in the replay as
a real `authenticated` couple): the lock's per-card daily-limit gate (`vendors/actions.ts`
finalizeVendor "#2", `soft_hold_limit_reached`) counted the card's bookings on the couple's
date through the COUPLE'S session, and RLS shows a couple only their own events — with two
other couples already booked on a limit-2 card it counted **0 of 2** and let a third lock.
It also ignored `event_date_precision`, so a month-only event stored as the 1st counted as
a booking on the 1st.

- Migration `20271222330608`: ONE count — `service_card_bookings_on(card, day[, exclude])`,
  SECURITY DEFINER, STABLE, read-only, returns one integer (contracted · deposit_paid ·
  delivered · complete, not archived, DAY-PRECISE events only); EXECUTE for `service_role`
  alone. `service_cards_unbookable_on` (H6) learns the same verdict: a card with no active
  time slot and a daily_capacity is refused on a day when that count reaches its limit.
- The #2 gate reads the couple's own event (date + precision) and booking row through the
  couple's session, asks only on a day-precise event, and asks the count with the admin
  client scoped by those session-proved inputs. Errors degrade open, logged.
- H6's tripwire (the TS test and its database half) is REMOVED — it existed to fail exactly
  when this gate was fixed. The parity guard now pins the daily limit on all three sides
  (count · gate · mirror: statuses = `CONFIRMED_VENDOR_STATUSES`, day-precision, `>=`, same
  function, slot precedence, returned by the mirror); the seeded differential gains a
  limit-2 card, a month-first day, and an independent row count over 80 card-days.
- Production today: 0 cards with a daily limit, 0 confirmed bookings with a service — nothing
  accepted yesterday is refused today.
- Guards: `tests/db/a-cards-daily-limit-really-refuses.db.test.ts` (12) ·
  `tests/db/a-full-card-leaves-bench-search.db.test.ts` (19) ·
  `lib/h6-mirrors-the-booking-path.test.ts` (11).

SPEC IMPACT: DECISION_LOG.md — a row recording that the per-card daily limit now refuses at
the couple's lock and in the bench search, day-precise only (closes the latent note in the
2026-09-11 H6 correction row). No iteration doc changes.
