## 2026-08-07 · fix(papic): the camera refused every shot — the capture window was one millisecond wide

**This is why Papic has never stored a single photo.**

`paparazzi_seats.valid_from` / `valid_until` are **DATE** columns, so the API
returns `"2026-09-19"`. Both capture gates called `Date.parse()` on that — which
is midnight **UTC**, i.e. **08:00 Manila**. A one-day window writes the *same
date* into both columns, so start and end landed on the **same instant**.

**The window was open for about one millisecond, once, at 8 AM on the event day.**

Measured in production: **six of thirteen seats** carry
`valid_from = valid_until` — and **both seats anyone has ever claimed are in
that set**. Two real people claimed a camera, and every shot they took was
refused.

### It was worse than a refusal — it looked like success

The 403 carried **no error code**. The client turned it into a generic
`Error('presign')`, which is not in the terminal-error set — so the shot went to
the **durable offline queue** and **the shot counter still went up**. The
photographer was shown nothing and had every reason to believe the photo was
taken.

*A refusal nobody can see is indistinguishable from success.*

### Fixed

- **One shared helper**, `captureWindowState()` — a DATE means a whole Manila
  day, 00:00:00 to 23:59:59.999 at +08:00. Both gates now call it, so the
  comparison cannot drift in two places again.
- **The 403 now carries a code**, and the client re-throws it by name so it
  reaches the terminal set instead of being queued and retried forever.
- Fails **open** on null or unparseable bounds — a legacy seat is never bricked.

🛡 **Sabotage-tested.** Reverting to the shipped `Date.parse()` fails two tests
by name, including one that asserts a 2 PM ceremony is inside the window.

⚠ **RUN THIS UNDER `Asia/Manila`.** In UTC the start bound looks correct —
midnight UTC really is the start of the UTC day — so a UTC-only suite is blind
to it. **That is exactly how it shipped, and CI runs UTC.** 7058 tests pass in
both.

### Not fixed here, deliberately

The seven seats with **null** bounds already worked and still do. The durable
follow-up is migrating those two columns to `timestamptz` so the write stops
being lossy — a schema change, worth its own pass.

SPEC IMPACT: None.
