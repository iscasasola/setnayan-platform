## 2026-09-11 · fix(lock): the supplier's yes checks the card's daily limit, and the shop's hold limit per date really refuses (LOCK-PATH 2)

Two gaps LOCK-PATH CAPACITY (#5441) found and left, both proven as real
signed-in sessions in the PGlite replay
(`apps/web/tests/db/the-suppliers-yes-and-the-hold-limit-really-refuse.db.test.ts`, 17 tests).

**1 · The supplier's yes.** With the lock handshake on, a couple's Lock is an
ask and the supplier's Agree (`vendor_agree_to_lock`) is what books. The ask was
checked against the card's "Bookings per day"; the Agree was not, so anything
that grew the card's count between the two (a Locked-QR claim, a booking made
with the handshake off, a limit the supplier lowered) let a yes book past it.
The Agree now refuses with `daily_limit_reached` — counted by the SAME
`service_card_bookings_on` the ask and the bench search use — and the supplier
is told why and what to do (`lib/lock-answer-notice.ts`). The function is
production's live body byte for byte plus 40 added lines (line-hash diff: +40 / −0,
two hunks); grants unchanged. A row that is already booked is never refused by
the limit (it adds no booking). The H6 parity guard now covers the Agree too.

**2 · The shop's hold limit per date.** Rule 3 (owner 2026-05-24): a couple's
Lock is refused once the shop already has `max_soft_holds_per_date` (default 3,
no writer) other couples holding that date at `contracted`. The gate counted
through the couple's own session — RLS shows a couple only their own events — so
it always counted 0. It now asks `vendor_soft_holds_on` (SECURITY DEFINER,
read-only, service_role only): other couples at `contracted`, one per event (a
package's covered lines are not extra holds — the free-tier cap's own
precedent), not archived, day-precise events only. Pinned by
`apps/web/lib/the-hold-limit-counts-every-couple.test.ts`.

**Not a gap:** the per-plan customers-per-date ceiling (Free 1 · Verified 2 ·
Solo 3 · Pro 5 · Enterprise 10) is `enforce_vendor_whitelist_per_date`, a
SECURITY DEFINER trigger on the supplier's own accept; shown refusing a Solo
supplier's 4th accept as a real session.

Production today: 0 cards with a daily limit, 0 pending asks, 1 contracted
booking (year-precision), both shops on the default hold limit — nothing
accepted yesterday is refused today. Migration
`20271223386305_the_suppliers_yes_and_the_hold_limit_really_refuse.sql`.

SPEC IMPACT: DECISION_LOG.md row (LOCK-PATH 2) — records that the supplier's
yes now obeys the card's daily limit and that Rule 3's hold limit is enforced
(counted per couple, day-precise), and that the per-plan ceiling was already
enforced.
