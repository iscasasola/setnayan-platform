## 2026-08-21 · test(papic): run the load test the Papic plan asked for — the hot row is NOT the wall

**The owner's own plan listed this under "Open risks / must-hold invariants"**
(`Papic_Build_Brief_2026-07-17.md` · `Papic_v3_Whats_Next_2026-07-18.md`):

> *"Lite single-hot-row throughput (fast pre-read + accepts/sec limiter, not
> advisory-lock-per-event; **load-test**)"*

The fast pre-read shipped. The accepts/sec limiter was never put on a capture
path (`enforceRateLimit` has three callers — wall-claim, seat-lookup, slug-check
— and **zero** on any capture route). The load test was never run. The owner then
gave the number that makes it urgent: Papic can see **1–250 photos or clips per
second per event**, and every capture that dips into the shared pot updates ONE
row — `papic_event_pool_usage`, primary key `event_id`.

**THE RESULT — 10,000 captures across 20 cameras, all forced through the shared row:**

```
  SELECT 1 (baseline) .... 7,311/s
  pre-read ............... 4,598/s
  reserve (THE HOT ROW) .. 3,039/s
  one capture ............ 0.547ms of database work
  ⇒ ceiling .............. 1,830 captures/second
```

**AND IT DOES NOT DECAY, which was the real question.** A reception runs for
hours; 250/s for one hour is ~900,000 updates to a single row, and every update
leaves a dead tuple behind. Measured in blocks:

```
  block 1 (1–2,000) ...... 2,966/s
  block 5 (8,001–10,000) . 3,083/s
  → the last block is 4% FASTER than the first
```

No version-chain death spiral at this volume. **The lock the July plan worried
about is not the ceiling — there is roughly 7× headroom over the stated peak.**

⚠ **A CEILING, NOT A FORECAST, AND THE SCRIPT SAYS SO IN ITS OWN OUTPUT.** PGlite
is one in-process session: no lock contention, no network, and a developer laptop
rather than a burstable `t4g.nano`. Production can only be slower. What this test
CAN settle is a negative — and it settles it: the row itself is not the wall.

🔑 **SO THE RISK MOVED, and this is the useful finding.** With the row cleared,
what is left at 250 captures/second is **~500 network round trips per second**
from Vercel to Supabase Singapore against **60 direct connections** — a
concurrency-and-latency wall, not a locking one. That points at the same remedy
the plan already named (claim credits in blocks rather than one per capture) for
a different reason than the plan gave.

⛔ **NEVER POINT THIS AT PRODUCTION.** A research fan-out against the live
database took setnayan.com down for 50 minutes on 2026-08-20. This script builds
an in-memory database, uses it, and throws it away.

Run: `pnpm --filter @setnayan/web loadtest:hot-row` (env: `CAPTURES`, `CAMERAS`, `COST`).

SPEC IMPACT: `0012_papic/Papic_v3_Whats_Next_2026-07-18.md` § 6 — the hot-row risk
is now MEASURED. The limiter half of that line is still owed.
