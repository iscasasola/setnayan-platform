## 2026-08-02 · feat(papic): a guest can buy their OWN shots, and is told the real wait

Owner: guests may buy dedicated shots for themselves — *"ship it with 24 hours
wait. Or maybe have a emergency purchase part if the event day is the day itself.
these will be priority."*

**The purchase was impossible by construction.** Buying dedicated shots required
*already holding* dedicated shots — `papic_seat_dedicated_points(seat) > 0`,
checked on the surface and again in the action. Nobody could ever buy their
first. A guest whose shared pool ran dry could only top up the **host's** pool:
pay for shots that anybody else at the party could then spend.

The old note said granting a pool camera a private balance would *"silently move
it off the pool the host is watching."* True — and it is the behaviour we want,
not a hazard. `papic_reserve_event_points_for_seat` returns `-1` only **while**
`papic_seat_dedicated_points(seat) > 0`, so a camera spends what its holder paid
for **first** and **rejoins the shared pool the moment those run out**. The host
is never billed for a guest's shots; the guest is never stranded once they are
spent. Both halves of the check are gone; the identity half — *only the camera
you are holding* — is untouched and now pinned by a test.

**The wait is stated instead of implied.** Every `setnayan_pay_methods` row is
`is_active = false`, so a person confirms each payment by hand. The panel said
shots go live "once the Setnayan team confirms it", which tells a guest nothing
about whether that means seconds or a day. It now says up to 24 hours, says a
person does it, and says they can keep shooting on the shared pool meanwhile.

**Same-day orders jump the queue.** A 24-hour SLA is a fine promise on an
ordinary order and a broken product on one whose event is **today** — the party
ends before anyone opens the queue. `/admin/payments` now sorts same-day first,
**above even a clean match** (a clean match on next month's wedding can wait),
badges the row, and counts them in a banner. The guest-facing promise and the
queue position come off **one** function, so they cannot drift apart.

🪤 **"Today" is Manila, not UTC.** A PH evening reception is already tomorrow in
UTC: `2026-08-02T16:00Z` is Aug 3 in Manila. A UTC comparison would file the
busiest hours of a live event as "not today" and drop exactly the orders that
most need to jump. Reuses `manilaTodayIso` from `lib/vendor-cashflow.ts`.

⚠ **NOT covered — the seatless guest camera.** `/papic/guest` identifies its
shooter by a signed cookie, not a seat, and a dedicated balance can only attach
to a seat (`paparazzi_seats.claimer_user_id`). So a pool guest who arrived
through the event site still cannot buy their own shots; they can still top up
the shared pool. Reaching them needs a seat minted at purchase — a separate
change, not a copy tweak. The action refuses this case explicitly (`no_camera`)
rather than failing oddly, and a test pins the refusal.

Ships behind `NEXT_PUBLIC_PAPIC_GUEST_BUY`, still **off**. The admin-queue
ordering is live regardless — it is not gated, and it is correct with or without
guest buying.

SPEC IMPACT: `DECISION_LOG.md` — guest self-purchase allowed on any camera its
holder claimed; dedicated-then-pool spend order recorded as intended behaviour;
same-day purchases prioritised in manual reconciliation.
