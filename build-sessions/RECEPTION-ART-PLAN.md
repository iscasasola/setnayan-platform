# RECEPTION ART PLAN — generated decor for the reception room

**Owner ruling 2026-09-06 (Q10): GO, on the staged plan — not on ~55 images up front.**
Write the recipe once, run ONE pilot zone, measure the yield for RECEPTION zones, size the rest
from that number. This file is the recipe. Each zone session is a short brief pointing here.

> **This file is intent. `MB-OVERSIGHT.md` is state, and even that is a report — measure with
> `gh` and the live database before quoting either.** (Learned twice on 2026-09-06.)

---

## Where the room stands

`renderVenueSvg` composites **13 zones**. Only **two** have generated artwork:

| | zones | artwork |
|---|---|---|
| ✅ has images | `backdrop` · `ceiling` | 10 files (2 × 5 style families), MB14b, live |
| ⬜ flat SVG only | `stage` · `tables` · `feast` · `program` · `booths` · `walls` · `photo_wall` · `welcome_signage` · `tunnel` · `entrance` · `people` | — |

`people` and `entrance` are **out of scope**: `people` is a modifier drawn from role attire
colours, and `entrance` is the aisle runner, a floor tint rather than a dressable object. That
leaves **9 candidate zones × 5 families = 45 cells**, not 55 — recount before quoting the number.

---

## Part 1 · GENERATION — already solved, do not re-derive

`apps/web/scripts/reception-decor-pilot-prompts.ts` is the reproducible record: prompt shape,
Recraft V4.1 params, and the sampling step. **Read it before writing a prompt.** Its contract:

```ts
type DecorPromptEntry = {
  zone; style; prompt;              // prompt ends with COMMON_SUFFIX
  aspectRatio: '4:5' | '16:9';
  backgroundColor: string;          // the EXACT hex handed to Recraft
  seedColor: string;                // a hint, never the final sampled hex
};
```

- **Route:** Higgsfield MCP `generate_image_batch`, `model: 'recraft_v4_1'`,
  `params: { model_type: 'vector', resolution: '2k', aspect_ratio, background_color, colors: [seedColor, backgroundColor] }`.
  **Batch cap is 12 requests per call** — one zone (5 cells) fits in one call.
- **`COMMON_SUFFIX` is load-bearing**: *"one dominant color region occupies most of the frame,
  rest of scene in muted neutral tones so the region is easy to isolate for recoloring."* That
  sentence is what makes a file taggable at all.
- **Sampling slot 1:** rasterise, then exclude pixels by **RGB distance to the known
  `background_color`** — *not* a saturation threshold. A warm cream background has enough HSL
  saturation (low-lightness denominator) to fool a naive filter; this was learned the hard way on
  the pilot. Exclude near-white/near-black strokes too, then take the largest remaining cluster.

⚠ **One thing in that file is now WRONG and this plan supersedes it:** it says
`toleranceDe = 15, matching the figure_attire seed`. **A uniform tolerance is exactly the defect
MB28 spent a session correcting.** See Part 2.

---

## Part 2 · MEASUREMENT — where every session so far has paid

🔑 **THE TOLERANCE IS A NUMBER IN THE ENGINE'S METRIC, NOT CIELAB ΔE.**
`colorDistance` (`lib/color-recolor.ts`) is `sqrt(0.3dr² + 0.59dg² + 0.11db²)/2.55`, a
weighted-RGB proxy. It disagrees with CIELAB **sharply and in the dangerous direction**:

| pair | CIELAB ΔE | what `recolorRGBA` sees |
|---|---|---|
| church fabric → floor | 14.4 | **5.1** |
| beach fabric → driftwood | 11.9 | **3.5** |
| every MB28 per-file ceiling | 8–15 | **5–10** |

MB25 paid for this once. MB28's brief re-derived the CIELAB numbers and **every one of its eight
ceilings was too wide**. Do not transfer a ΔE figure. Re-measure through the real function.

**The procedure, per file:**

1. Rasterise at the component's own `MAX_PREVIEW_PX` (**520**) with `sharp`, `fit: 'contain'`.
2. Census every exact fill — **NO AREA FLOOR** (see the correction at the end of this file;
   a 0.2% floor is what let three live tolerances ship too wide).
3. The tagged region is slot 1. Everything else is a **neutral that must move by ZERO**.
4. Seed the **largest integer tolerance at which no neutral moves**. Assert both directions: one
   step higher bleeds; the region still recolours completely.
5. If the nearest neutral is **< 5** away, the slot is **UNSEEDABLE** — `tolerance_de` is CHECKed
   `BETWEEN 5 AND 30`. **Re-cut the artwork (MB28b) or ship the zone without that slot (MB23's
   bride, MB28's beach). NEVER widen a tolerance and NEVER lower the table CHECK for one file.**

🪤 **JUDGE EVERY CANDIDATE ON A REAL RECOLOUR THROUGH `recolorRGBA` — NEVER A FILL-SWAP SIM.**
A fill swap answers *"is this path in the right region"*; it **structurally cannot show a
tolerance bleeding into a neighbouring colour**. That is precisely how the beach's driftwood
passed generation review and had to be caught by pixel measurement afterwards.

🪤 **AND LOOK AT THE PICTURE.** MB28's round rejected 60 of 68 variants *on sight* — a pew, lawn,
sand, lattice, ceiling or chandelier had taken a slot colour. RV1's three worst defects were all
found by rendering the room and looking at it, with green tests throughout.

---

## Part 3 · WIRING — what a zone needs besides a file

1. Asset rows + ranges in one migration (idempotent on `storage_path`; a `DO $$ … RAISE` on the
   expected live count).
2. Add the zone to **`PILOT_DECOR_ZONES`** (`lib/reception-decor-layers.ts`) — otherwise
   `resolveDecorLayer` returns `{kind:'svg'}` and the images are dead rows.
3. **The uncovered `(zone, style)` cell must render byte-identically to the flat SVG.** MB14b's
   invariant; a near-miss substitute is the one thing that must never happen.
4. Per-file pixel guard extending `the-background-never-wears-the-palette.test.ts` — **extend, do
   not parallel** — plus a companion assertion that the region actually moves, or "no neutral
   moved" passes vacuously.
5. ⚠ **`renderDecorLayerDataUrl` must actually fetch the served path.** MB14b shipped ten live
   rows whose only consumer returned `null` — *"a `null` that means 'nothing to show' and a `null`
   that means 'the feature is unwired' are indistinguishable to a caller: assert BYTES."*

---

## Part 4 · SEQUENCE

**Pilot — `stage` (5 cells).** The couple's own spot: the most-looked-at zone in the room and the
one a guest photographs. Its output is a **measured yield for reception zones**, which is the
number this plan exists to obtain. MB28's *68 generations to keep 8* is borrowed from ceremony
scenes — larger, busier frames with two slots — and is very likely pessimistic here.

**Then, sized from the pilot:** `tables` → `feast` · `program` · `booths` (the celebration zones
RV1 added) → `walls` · `photo_wall` → `tunnel` · `welcome_signage` last.

**Stop rule:** if a zone's yield is worse than ~1 keeper per 4 generations, stop and report the
number rather than spending through it. The room degrades gracefully — an uncovered zone keeps
rendering as flat SVG, which is what every zone does today.

---

## Part 5 · PILOT RESULT — `stage`, run 2026-09-06

**Yield: 4 keepers / 9 generations = 1 per 2.25.** MB28's ceremony scenes were 8/68 = 1 per 8.5.
**Reception zones are ~3.8× cheaper**, as the plan predicted — the frames are smaller, simpler and
single-slot. Extrapolated over the remaining 9 zones × 5 families = 45 cells: **~101 generations**,
against ~380 at the ceremony rate.

| family | rounds | result |
|---|---|---|
| elegant · simple · classic | 1 | ✅ sweetheart table, gold cloth · slot `#C9A059` tol **9** |
| tropical heritage | 1 | ✅ long head table, sage runner · slot `#9CB29A` tol **15** |
| modern minimalist | 1 | ✅ clad riser, deep plum · slot `#4A3B45` tol **15** |
| editorial cream | 3 | ✅ round draped table, dusty rose · slot `#D98BA6` tol **15** (maxClean 30) |
| bridgerton · regal | 3 | ❌ **UNSOLVED** — see below |

### 🔎 Four findings that change this recipe

1. **THE RECIPE WAS MISSING A CHECK, AND IT PASSED A BAD FILE.** The first measurement pass only
   asked *"do the neutrals stay put?"* — every cell passed, including one whose chairs turned
   burgundy while **a second purple stayed stock**, which reads as a rendering bug. MB23's attire
   guard has `farthestTone` for exactly this; the decor recipe never carried it forward.
   **Always also ask: does EVERY tone of the tagged object move?** Now in Part 2.
2. **AND THE FIRST VERSION OF THAT CHECK FLAGGED THE BACKGROUND — 69% OF THE FRAME.** It used an
   HSL *saturation* threshold, and `#F3ECE0` cream reads s≈0.44 because of the low-lightness
   denominator. `reception-decor-pilot-prompts.ts` warns about this **in prose**, and it was walked
   into anyway. Exclude the background by **RGB distance to the known `background_color`**, and
   treat line-art by **lightness**. (See [[setnayan-guards-must-test-the-claim]].)
3. **`colors: [seedColor, backgroundColor]` DOES NOT GUARANTEE THE SEED BECOMES THE DOMINANT
   REGION.** On `bridgerton · regal` Recraft invented its own dominant (`#8358FB`, the cloth) and
   used the passed seed `#8C6BA6` for a *different* object (the floor) — producing two same-hue
   regions 12.6 apart, i.e. one recolours and one does not. **Re-sample the pixels; never trust the
   seed** — the existing recipe says this and it is now measured.
4. **DRAPED FABRIC WORKS; ORNATE MULTI-PART FURNITURE DOES NOT.** All four keepers tag a *draped or
   flat-clad surface* (tablecloth, runner, riser face). All three failures tagged *ornate carved
   chairs or a piped sofa*, where the model insists on a second tone for frames, trim and piping.
   **➡ Recipe change: for every zone, choose a draped or flat-clad surface as the tagged region.**

### Still open on this zone

`bridgerton · regal` after three rounds. The diagnosis is finding 3, and the cheap next test is to
pass **one** colour in `colors` (or none) and name the neutral palette explicitly, rather than
handing the model a second hex it can spend elsewhere. Not attempted — the pilot's job was the
number, and it has it. A zone shipping 4 of 5 families degrades gracefully: the uncovered cell
renders as flat SVG, exactly as all 9 zones do today.

🔴 **THE 0.2% CENSUS FLOOR WAS NOT A CAVEAT — IT WAS THE BUG. Superseded 2026-09-07.**
This paragraph used to say sub-threshold regions are invisible to the measurement and call
that "acceptable at card size". It was not: **three of the five stage tolerances shipped too
wide** (PR #5270, live) because every neutral that bled sits UNDER the floor — the largest is
0.081% — being the antialiased edges of chairs, shadows and panelling. Caught by MB Oversight
on `editorial cream`, then found on `bridgerton · regal` and `tropical heritage` too, and
corrected by RA1 in PR #5274.

**A stated limitation is not a mitigated one.** Writing the floor down here felt like handling
it; it only documented where the defect would hide.

➡ **MEASURE WITH NO AREA FLOOR, and decide "is this the slot's own antialiased edge?"
POSITIONALLY — dilate the slot's exact pixels by 2px — never by colour.** A hue-distance rule
was tried and fails in BOTH directions on these very files: `elegant`'s cream background sits
at hue 37.9° against a slot at 38.0°, so a >40° "off-hue" rule exempts the BACKGROUND as "the
slot's own edge". See RA1's guard in `the-background-never-wears-the-palette.test.ts`.
