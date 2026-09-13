## 2026-09-03 · feat(reception-design): the editor says which treatment the 3D room actually draws

Reception-design attributes can be MULTI-select. When a couple picks two — say
"draped fabric + fairy lights" for a ceiling — the surfaces disagree by design:

- the mood board, the printable and the concept PDF render **every** chosen
  treatment (`selAll`),
- every 3D consumer draws **one**, the primary (`sel`).

That asymmetry is intended and is not the defect. The defect is leaving it
unsaid. The couple sees both treatments everywhere they look except the room,
and reasonably concludes the room is showing their combination — nothing errors,
nothing logs, and the misunderstanding survives until they are standing in a
venue that does not match the picture they booked against.

**Fix — the editor now names the treatment the room draws**, beneath the chips
for any multi-select attribute with more than one pick: *"The 3D room draws
Draped canopy only. Your other 1 choice shows on the mood board and the printed
concept."*

Naming it is the point. A generic "showing one of several" still leaves the
couple guessing WHICH, which is most of the original confusion. The existing
`primaryLabel()` "+1" chip summary is complementary — it says more are selected,
never that the room draws only one.

**Guard — `lib/the-room-says-what-it-is-not-showing.test.ts`.** The copy makes a
factual claim, so the invariant behind it is pinned FIRST: the disclosure names
`chosen[0]`, and that sentence is true only while `sel(...) === selAll(...)[0]`.
If that ever stopped holding the note would not merely go stale — it would
confidently name the wrong treatment, which is worse than saying nothing. The
test sweeps that invariant across **every** shipped part+attribute rather than
one hand-picked pair, and asserts at least one multi-select attribute exists so
the disclosure cannot quietly become dead code.

🪤 **A sabotage caught a hole in the guard before it shipped.** The first
version asserted a bare `/chosen.length > 1/`, which stayed GREEN through the
deletion of the gate — because `primaryLabel()` already contains that exact
expression for its "+1" summary, so the loose pattern matched a different line
entirely. Anchored to the full gate expression, all four sabotages go red.

Implements rule 04 of the "Mood Board → 3D Plan" data contract (2026-09-03):
*say what the room is not showing.*

SPEC IMPACT: None — discloses existing behaviour, changes no rendering.
