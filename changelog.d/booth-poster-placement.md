## 2026-07-21 · fix(plan3d): the booth poster stand clipped 9 of 10 chassis and had no avoidance disc

Two defects in the per-event poster stand shipped by PR #3437. Both are mine.

**1 · The offset was measured off the wrong body, and omitted the stand's own width.**

```ts
const { w } = BOOTH_FOOTPRINT_M;                              // 2.0 — the SHARED footprint
rotateLocalRad({ x: w / 2 + 0.42, z: -0.2 }, facingY);        // x = 1.42, for every booth
```

Once a template resolves, the booth's body is its **chassis**, whose widths run 1.8 m (DESK) to **3.4 m (BUFFET)** — the shared 2.0 m footprint describes none of them reliably. The sibling `BoothSign` already reads per-chassis geometry via `signAnchor`; the poster did not.

Worse, `BoothPoster` draws a top rail at `maxW + 0.12` = 0.90 m, so the stand reaches **0.45 m** either side of its origin — *more* than the 0.42 m gap the offset allowed. So the stand's inner edge sat at 0.97 m on **every** booth, and **nine of the ten chassis clip**, including the 2.0 m ones the constant was tuned for. Only DESK cleared, by 7 cm. BUFFET buried it 0.73 m inside the buffet run.

Placement now comes from one helper, `boothPosterLocalOffset(spec)` = `chassisHalfWidth + gap + standHalfWidth`.

**2 · The stand was not solid — walkers strolled through the banner.**

It contributed no avoidance disc. Fixed inside `templateBoothObstacles`, following the **staff-mascot precedent already in that same function** (which likewise pushes conditional discs from per-booth runtime data via `tpl.staff.count`). That placement matters: all three 3D call sites — `plan3d-scene.tsx`, the public `guest-venue-3d.tsx`, and the couple `seating-lab-3d.tsx` — call `templateBoothObstacles(booths, room)` with no local disc logic, so **the fix propagates to all three with zero call-site edits**.

The disc is gated on `boothCanBrand(tier) && posterUrl`, i.e. the *same* condition the renderer draws on, and positioned by the *same* helper. Renderer and obstacle cannot drift — a drift would place the disc where the artwork isn't, which reads as "guests walk through the poster" and is invisible to any test checking only one side. A test asserts they agree.

**Known trade-off, deliberately accepted.** Pushing the stand clear of a wide chassis moves it further into the aisle (BUFFET: 2.4 m from booth centre). Booth positions are couple-authored percentages with no enforced spacing, so a poster *can* now overlap a neighbouring booth where previously it was buried inside its own. That is the correct trade — the old behaviour was wrong 100% of the time, the new one only in hand-authored crowded layouts — but it is a real change and is recorded here rather than discovered later.

**Test:** new `lib/booth-poster-placement.test.ts`, 8 cases — clearance across all 10 chassis, the null-spec fallback, disc presence/absence, disc-vs-artwork agreement under any yaw (compares distance from booth centre, so it holds for all four facings), disc radius ≥ stand half-width, and the branding gate. One case pins the *old* constant's 9-chassis failure, so anyone "simplifying" the helper back to a literal learns why it was never right.

Full suite 2420/2420. *(An earlier note in #3460 claimed 5 pre-existing failures on `main`; those were an artifact of an uninstalled worktree, not real — with deps installed everything passes.)*

SPEC IMPACT: None. Geometry fix to shipped behaviour.
