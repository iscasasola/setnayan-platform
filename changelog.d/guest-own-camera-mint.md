## 2026-08-02 · feat(papic): the event-site guest can buy their own shots too

PR #4054 let a guest buy shots for the camera they hold. But only a **seat** can
hold a dedicated balance, and the event site's camera identifies its shooter by a
**signed cookie** — no seat, often no account at all. So the guest the owner
actually asked about, the one shooting the free shared pool, was still refused
and could only top up the **host's** pool.

**No new schema was needed.** `paparazzi_seats.guest_id` already exists (from the
host-bought Limited guest cameras), already enforces one active camera per guest,
and those cameras already run with a NULL claimer — a guest's camera is
credentialed by their personal QR, not by an auth user. So "give this guest a
camera of their own" is an INSERT into a shape the product already has, and
everything downstream works untouched: the order records the camera, approval
grants seat-scoped points to it, the host's pool total still sums only unscoped
grants, and the pool still stands down while the guest's own balance lasts.

🪤 **The camera is minted at `tier = 'unlimited'` — the only tier with no daily
cap.** A dedicated balance is spent first and then falls through to the *tier's*
daily budget: 20/day for free/mini/roll, 70 for ltd. The event-site camera has
never had a daily cap, so any other tier would have left a guest who **paid**
more limited than one who did not, starting the day their bought shots ran out.

🪤 **The seat reserve is used only when the guest holds bought points.** Routing
an un-bought guest through it would impose that same cap on people who paid
nothing and asked for nothing. Gated on `dedicated > 0`, so the whole feature is
invisible to everyone except the people who bought it.

🚨 **One leak found and closed in this change's own code.** The seat ledger can
book and the pool leg then fail (an RPC error, or a balance that hit zero between
the two calls). The route returns 409/503 on that and never reaches its unwind —
so a shot the guest **paid for** would burn on a photo that was refused. The
reserve helper owns both bookings, so it now owns the partial unwind: both
ledgers or neither.

⚠ **Not added: the inline camera on the guest's landing page.** Its "return here
afterwards" path would have to leave the `/papic/...` allowlist in
`safeReturnTo`, which exists to stop an open redirect at the one moment a guest
is most primed to type a payment detail into whatever page appears. Not worth
weakening for a second placement — the standalone camera is reachable from both
the day-of bar and the guest hub, and that is where the doorway lives.

Behind `NEXT_PUBLIC_PAPIC_GUEST_BUY`, now ON in production.

SPEC IMPACT: `DECISION_LOG.md` — an event-site guest is minted their own camera
at purchase (reusing `paparazzi_seats.guest_id`); minted at the uncapped tier on
purpose; the seat reserve is entered only with a dedicated balance present.
