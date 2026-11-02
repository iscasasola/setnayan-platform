## 2026-09-03 · fix(venue-3d): the public walk yields to the people in the room

The guest walk rendered its shared-room peers and then walked **straight through
them**. Both halves of the mechanism had shipped, correct and unit-tested, and
the wire between them was never connected:

- `remoteMovers()` (`lib/plan3d-room.ts`) — the producer. **Zero call sites**,
  while its own docblock claimed it *"Feeds plan3d-scene's REMOTE_MOVERS /
  separateAgents."*
- `REMOTE_MOVERS` (`app/_components/plan3d/plan3d-scene.tsx`) — the consumer. A
  hard-coded empty array, guarding a separation branch that therefore never ran.
  Its comment says so outright: *"empty (today, always)"*.

The couple's Lab (`seating-lab-3d.tsx`) has separated its crowd since 2026-07.
Only the two guest-facing surfaces lacked it — the same shape as the
reduced-motion and snap-turn defects: **the shared code was fine and the one
surface guests actually use was the exception.**

**Fix — `guest-venue-3d.tsx` now feeds its live peer map into the pass.** The
walk already held everything needed (`sharedRoom.remotes` and a live position
ref); it just never used them for anything but rendering. A latest-value
`remotesRef` mirrors the map so a peer's every move never re-renders the walk
loop, and the frame applies predictive separation carrying last frame's
*realised* velocity — an approaching peer is sidestepped early rather than
shoved on contact, at the Lab's exact `MOVER_MIN_DIST` so a guest and a lab
agent give each other the same berth.

**Two boundaries, both load-bearing:**

1. **The re-clamp runs LAST.** The path is pre-routed around obstacles, so a
   separation sidestep is the one thing that can push the figure into a table.
   `pushOutOfDiscs` re-clamps against the same obstacle set the path was built
   from — without it, dodging a peer is how you walk through a table.
2. **Separation runs only while translating, and only when a peer is present.**
   The walker stays mounted-but-bodyless while its owner is seated and its
   position feeds the shared-room broadcaster, so shoving it would slide a
   seated guest off their chair in every peer's window. An empty room allocates
   and re-clamps nothing, so a solo walk moves exactly as it did before.

**Guard — `lib/the-walk-yields-to-the-people-in-it.test.ts`.** The physics half
cannot be the whole guard: `separateAgents` and `remoteMovers` were both correct
and both fully unit-tested *while guests walked through each other*. A pure
test cannot see a missing call site, so the file also pins the wire, the
after-separation clamp ordering, the empty-room skip and the seated exclusion.
It comment-strips the source first — the fix's own prose names all three
symbols, so unstripped assertions would pass against a file whose code had been
deleted and whose comments remained. All five source assertions were
sabotage-tested red before landing.

⚠ **Still open, deliberately out of scope:** `plan3d-scene.tsx` (the homepage
demo and the `/3d_plan/demo/[token]` shared room) keeps its empty
`REMOTE_MOVERS`. It has no presence plumbing at all — wiring it means adding
`usePlan3dRoom` to that surface, which is a separate change.

SPEC IMPACT: None — no product decision changes; this makes the shipped
shared-room behaviour match what the code already documented as intended.
