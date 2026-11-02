## 2026-08-21 · fix(papic): the accepts/sec limiter the plan asked for, on the doors it was meant for

**The owner's Papic plan listed this under "Open risks / must-hold invariants"**
(`Papic_Build_Brief_2026-07-17.md` · `Papic_v3_Whats_Next_2026-07-18.md`):

> *"Lite single-hot-row throughput (fast pre-read + **accepts/sec limiter**, not
> advisory-lock-per-event; load-test)"*

Three parts. The fast pre-read shipped. The load test ran on 2026-08-21 and
settled the row question (~1,830 captures/second ceiling, **no decay** over
10,000 captures — the lock is not the wall). **The limiter existed and was
attached to three routes that are not captures** — wall-claim, seat-lookup,
slug-check — and to **zero** capture paths. This puts it on both capture doors.

🔑 **PER CAMERA, NEVER PER EVENT — and that is the entire design.** The owner's
stated peak is **1–250 captures per second for an event**, spread across many
phones. An event-level limiter would have to sit above 250/s to avoid capping the
product, at which point it protects nothing at all. One phone shooting faster
than the ceiling is not a person: it is a stuck loop, a replayed request, or a
script — and every one of those spends real credits from the couple's pot.

**The ceiling: 60 captures per 5 seconds per camera** (~12/second sustained, with
a full second of burst headroom). A paparazzo hammering the shutter never meets
it; a runaway client meets it immediately. It is a backstop, not a quota, and
nothing in the product's own limits changes.

⚖ **IT FAILS OPEN, by construction** (`lib/with-rate-limit.ts`), and that is the
right direction here: what is guarded is a credit balance, not a security
boundary. Refusing real photographs because the limiter is sick would be worse
than the thing it prevents. The refusal is also a **soft** error on the camera
path — `too_fast`, which the capture UI already survives without crashing.

**Verification.** 5 guards, and **5 mutations, each landing verified by occurrence
count, all 5 RED**: camera door unlimited (1→0) · guest door keyed to everyone
(1→0) · **limiter keyed on the event** (13→12) · ceiling dropped to human speed
(1→0) · ceiling raised past usefulness (1→0). 582 papic tests · typecheck clean ·
lints clean.

🪤 **The guard could not import what it tests.** `app/papic/actions.ts` pulls in
`server-only`, which cannot load outside a Next runtime — importing the constants
killed the whole file before one assertion ran. It reads them out of source
instead, like the other guards on this surface.

SPEC IMPACT: `0012_papic/Papic_v3_Whats_Next_2026-07-18.md` § 6 — that open-risk
line is now fully discharged: pre-read shipped, load test run and recorded,
limiter wired.
