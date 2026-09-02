# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-02 · fix(venue): the guest walk turns instead of snapping, and honours reduced motion

Two movement defects on the PUBLIC guest walk, both found by an adversarial
pacing audit. Neither showed up as a failing test for the same reason: the demo,
the lab and the shared kit all behave correctly — **the one surface guests
actually use was the exception.**

### 1 · Reduced motion was cosmetic on this surface only

`usePrefersReducedMotion` was wired to exactly one thing here: stopping the
beacon halo pulse. The auto-walk still ran — so a viewer who asked for reduced
motion got a **frozen mannequin gliding 2.2 m/s across the room on page load**.
Motion stripped of the gait that explains it, which is the worse half of the two.

Every sibling surface already keeps a "complete without animating" contract —
the demo teleports (`durationMs: 1`), the lab skips the walk, the kit holds
`STAND_BASE`, `SitController` snaps but still fires `onSeated`. The guest walk
now jumps to the final waypoint and lets the existing arrival branch run, so the
callbacks and the beacon retire exactly as they always did.

### 2 · The walker turned 180° in a single frame

`g.rotation.y = Math.atan2(dx, dz)` with no smoothing: tap behind the figure and
the body flipped instantly. Now `lerpAngle(…, damp(0.015, delta))` — the same
idiom the demo Walker and `plan3d-remote-players` already use, frame-rate
independent at 30fps and 120fps.

`lerpAngle` moves into `lib/figure-rig.ts` beside `damp`, whose own docblock
already states the rationale: one definition rather than each surface
re-deriving it.

> ⚠ `plan3d-scene.tsx` still carries private copies of **both** `lerpAngle` and
> `damp`, predating that module. They are identical. Consolidating them is left
> for a separate change and noted in the new docblock — that file is large and
> its correctness is visual, so it is not something to fold into an unrelated fix.

### Guards

`lib/the-walk-turns-and-yields-to-reduced-motion.test.ts`. `lerpAngle` is pure,
so it is tested directly — exhaustively over 50×33 angle pairs for the property
that actually matters (shortest arc, never the long way round), plus a
frame-rate-independence check that 30fps and 120fps agree after one second. The
two in-`useFrame` fixes are pinned by source guards.

| Sabotage | Caught |
|---|---|
| restore `rotation.y = Math.atan2(...)` | ✅ |
| freeze in place instead of completing the walk | ✅ |

The second sabotage is the important one: reduced motion must **complete** the
walk, not merely stop it. Freezing mid-path would strand the beacon and never
fire `onArrive`.

### Not in this change

The same audit found a larger defect on this surface: the viewer's own seat
renders a seated figure **while** the walking avatar walks to it, so a token
holder sees two of themselves, the walker ends inside the chair, and the hint
"tap your gold seat to sit" is unkeepable — there is no `SitController` mounted
here at all. Verified independently against `origin/main`. Left for a separate
change and surfaced to the owner: it restructures the scene graph on a live
guest surface, and its correctness is visual, not testable.

Verified: typecheck ✅ · lint ✅ · 11,886 unit tests ✅ · all 29 CI guards ✅

SPEC IMPACT: None.

## 2026-09-03 · fix(plan3d): one lerpAngle, not three — and the tie-break they disagreed on

Exporting `lerpAngle` from `lib/figure-rig.ts` (above) made two pre-existing
private copies visible to `lint:dup-rule`, which failed CI on this branch and
was right to:

    app/_components/plan3d/kit/sit-controller.tsx:123    function lerpAngle
    app/_components/plan3d/plan3d-remote-players.tsx:30  function lerpAngle

Both files already imported `damp` from that same module, which is exactly the
shape the guard looks for — a local declaration shadowing a helper the file
already imports the module of. Both now import `lerpAngle` instead.

### ⚠ The two copies were NOT the same function

`sit-controller`'s body was byte-identical, so deleting it changes nothing.
`plan3d-remote-players` used a **different implementation** — modulo-and-correct
rather than `atan2(sin, cos)` — and swapping it is a real substitution, so it
was measured rather than assumed:

| | |
|---|---|
| (a, b, k) triples compared | **396,344** |
| agree on the resulting heading | **396,112** |
| genuinely differ | **232** — all of them the exact half-turn (b − a = π) |

At exactly π the shortest arc is ambiguous: the old local copy spun one way
through the tie, the shared one spins the other. They land on the same heading
at k = 1 and differ only mid-interpolation.

🔑 **That is a tie-break, not a correctness property** — and there is no reason
a remote player should turn the opposite way from every other figure in the
room, which is the entire point of there being one of these. The difference is
recorded in a comment at the call site rather than quietly absorbed.

Verified: typecheck ✅ · lint ✅ · 11,886 unit tests ✅ · all 29 CI guards ✅
(including `lint:dup-rule`, the one that failed).
