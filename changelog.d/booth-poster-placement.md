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

**3 · The generic branch had BOTH defects still live — my first pass missed it.**

`venue-objects.tsx` renders the poster in **two** places, and the first commit only fixed the templated one. The generic silhouette branch (`:611`) kept the hardcoded `1.42` and got no disc at all, which also made the new "single source of truth" comment false. This is reachable, not theoretical: `registration_desk` / `custom` / `unassigned` booth kinds and vendor categories like `accommodation` all resolve **no template** (verified by executing `boothTemplateFor` against each). Both branches now read the same helper.

One subtlety worth recording, because getting it wrong is invisible: the generic branch's poster group is already a **child** of the yaw-rotated group, so it takes booth-LOCAL coordinates, while the template branch's poster is a **sibling** and must be `rotateLocalRad`'d. Applying the same call to both would double-rotate one of them.

**4 · Disc ORDER is load-bearing, and an earlier draft nearly broke it.**

`pushOutOfDiscs` walks discs sequentially and each expulsion *moves* the point, so a walker inside two overlapping discs lands on the edge of whichever disc was visited **last**. The poster overlaps its own booth's chassis and staff discs by construction, so emitting the poster disc first lets a later chassis expulsion shove the walker straight back through the banner — silently undoing the fix while every "is there a disc?" assertion still passes. A draft that hoisted the poster push above the generic early-return would have done exactly that for every templated booth. The push is a small closure called at the **end** of both branches, and a test now pins that ordering.

**5 · The half-width is derived, not hand-copied.** The original defect *was* a hand-copied constant (0.42 for a stand that is 0.45). `BOOTH_POSTER_FRAME` is now the single source for both `BoothPoster`'s geometry and the placement maths, with `BOOTH_POSTER_HALF_W` computed from it, so editing the frame can never silently invalidate the clearance again.

**Known trade-off, measured — and narrower than it first looked, but real.**

Pushing the stand clear of a wide chassis moves it further out, so on a *saturated* wall it can now reach into the neighbouring booth's slot where before it was buried inside its own. Booth spacing is `BOOTH_GAP = BOOTH_W + 3 = 15%` of the canvas **as a percentage**, so the outcome depends entirely on room size:

| Preset | wall axis | min centre-to-centre | effect |
|---|---|---|---|
| Intimate 14×10 | 14 m | 2.10 m | already overlapping before this change |
| **Standard 20×30** | 20 m | **3.00 m** | **the one regression** — a 2.0 m chassis' banner now reaches 2.15 m vs a neighbour edge at 2.00 m (15 cm), where the old 1.42 fit with 13 cm to spare |
| Grand 30×20 · Garden · Estate · Field | 30–200 m | 4.5–30 m | strictly better |

So this is *not* "only hand-crowded layouts" — it is one preset, one wall axis, narrow chassis, and only when that wall is packed to minimum spacing (`boothPerimeterSlots` distributes across the available segment, so minimum spacing is the worst case, not the default). Against that: the old placement was wrong on **every** booth of **every** preset, by 3–73 cm, always.

The exact remedy is known if it ever matters — the gap constant must satisfy `1.90 + g ≤ 2.00`, i.e. **g ≤ 0.10** where it is currently 0.25. It is left at 0.25 deliberately: tightening it to 0.10 buys the saturated-Standard case at the cost of a 10 cm visual gap on every other booth in every other room, which is the worse trade. Recorded here so the number is a decision, not an accident.

**6 · The test that claimed to prove the fix was a tautology.** The case titled *"renderer/obstacle cannot drift"* computed its expected value from `boothPosterLocalOffset` — the same function `templateBoothObstacles` calls internally. It compared the module to itself and **passed whether or not the renderer used the helper at all**; it was green throughout the period the generic branch was still hardcoded. The renderer is JSX in a `'use client'` module and this repo has no React render harness in the unit suite, so no test here can reach it.

That cross-file invariant now has a `lint-booth-poster-placement.mjs` guard with its own CI job — the pattern the repo already uses ten times for invariants TypeScript can't express. It scans the renderer's source for the banned literal, requires every `<BoothPoster>` site to derive from the helper, and forbids `BoothPoster` re-declaring its frame. Verified by mutation in both directions; scoped to `BoothPoster`'s body after a whole-file scan produced a false positive on `BoothSign`'s unrelated logo box.

**Test:** `lib/booth-poster-placement.test.ts`, 14 cases — clearance across all 10 chassis, the null-spec fallback, disc presence/absence, disc-vs-artwork agreement under any yaw (compares distance from booth centre, so it holds for all four facings), disc radius ≥ stand half-width, and the branding gate. One case pins the *old* constant's 9-chassis failure, so anyone "simplifying" the helper back to a literal learns why it was never right.

Full suite 2420/2420. *(An earlier note in #3460 claimed 5 pre-existing failures on `main`; those were an artifact of an uninstalled worktree, not real — with deps installed everything passes.)*

SPEC IMPACT: None. Geometry fix to shipped behaviour.
