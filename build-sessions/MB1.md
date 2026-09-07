# MB1 — The room shows what the couple chose

**Goal:** the 3D Seat Plan room stops silently ignoring design the couple has already saved.

**Model:** Opus · high effort — correctness-critical rendering with a documented
restyle-everything trap. This is exactly where a cheaper model reaches for the convenient helper.
**Size:** 1 day. **Depends on:** MB0.

## Why it is second, ahead of everything shiny

The couple saves a fifth colour, three new zones, and a multi-select treatment — and the room
draws none of it, with no indication anything was dropped. Same disease as the guest list that
said "no guests yet" to a couple with 180 names: a silent absence rendering as a confident answer.

## Delivers

- The **5th major colour** reaches the room's material derivation — it is currently drawn nowhere
- The three new zones (`walls`, `photo_wall`, `welcome_signage`) render in
  `apps/web/app/_components/plan3d/venue-decor.tsx`
- Reception multi-select handled **honestly**: per the widening decision the room deliberately
  shows the primary treatment only (there is one physical panel). Render the primary **and say so
  in the room's legend** — do not let a couple believe their combination is on screen when it is not

## Hard constraint

🛑 **Do NOT feed the room's chair/floral slots from the palette editor's helper.** They derive
differently, and reusing it restyles every room already sold.

Prove non-regression the way the multi-select widening did: render the seeded configurations
before and after, byte-compare the output for boards that use none of the new inputs.

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- existing `plan3d` tests
- a **new guard** pinning that all 5 majors and all zones reach the *render* — not just the
  resolver. The Panood controller resolved camera status correctly and still lied on screen
  because nothing re-ran the render.
- sabotage the new guard: drop the 5th colour, drop a zone, confirm red, restore

## Owner decides first

Nothing.
