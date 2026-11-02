## 2026-08-10 · test(papic): pin the five render-time self-heals ahead of the room extractions

**PR 3a of the Papic three-room plan** — the guard the plan calls for, landed
*before* the extraction it protects, so the trap can never be walked into.

Five idempotent writes sit in this page's prologue and **every one is
Cameras-flavoured**: the three free seats and their claim QR tokens, the free
50-point pool grant, the one free dedicated camera, the Limited snapshot
reconcile, and the guest-camera sync.

🚨 **Filing them with the Cameras room is the TIDY move, and it is the wrong
one.** Since the page now opens on a room chosen by the event's date, a couple
whose event has passed lands on **Photos** — so free cameras would silently stop
being created and capture would silently stop being metered for exactly the
population least likely to open Cameras. `provisionFreeCamerasAdmin` has **one**
production call site (this page), and the pool-grant call's own comment records
that with no grant `papic_reserve_event_points()` takes its "fence absent →
allow" branch and capture runs **UNMETERED**.

Nothing throws, nothing logs, CI stays green. The only symptom is an absence —
the same family as the phantom column, the phantom enum value, the phantom RPC
argument and the blocked iframe.

The guard asserts three things: each self-heal is still called at all; each runs
**before any room is chosen**; and none sits behind a room condition. Plus a
fourth that stops the other three passing **vacuously** — if the room switch were
removed, the "prologue" would become the whole file and every check would go
green while proving nothing.

Mutation-tested three ways, baseline green, every sabotage verified applied:
filing a self-heal inside the Cameras room — *the exact tidy move* (2 fail) ·
deleting a self-heal outright (2 fail) · removing the room switch so the checks
would read vacuously (2 fail).

⏭ **The extraction itself is deliberately NOT in this PR.** Moving the JSX only
shuffles a file; the benefit — each room loading only its own data — comes from
gating the reads, and that is precisely the change that can silently stop free
cameras. That belongs on its own careful pass, now that the trap is pinned.

SPEC IMPACT: None — no behaviour changed; an existing ordering is now enforced.
