# STAGE2 handover → RA1

From the session that ran the Q10 `stage` pilot and shipped PR #5270.

> ⚠ **PR #5270 IS MERGED (`e9dc0f85b`, 2026-09-06T11:07:01Z) AND LIVE IN PRODUCTION.**
> The oversight message that requested this handover described the branch as an
> unpushed commit and asked me not to push or open a PR. That was already out of
> date: five `stage` rows are seeded, approved and live, and all five SVGs serve
> 200 from `www.setnayan.com` hashing byte-identically to the repo. **RA1 is not
> starting from zero on this zone — it is CORRECTING a live one.**

## 🔴 THE CORRECTION — oversight was right, and it is worse than flagged

Oversight said editorial cream's nearest neutral is 14.0 so 15 bleeds. Confirmed,
and **three of the five shipped tolerances bleed**, not one. Re-measured on the
shipped files at 520px with **NO census floor**, counting only colours whose hue
is >40° from the slot (i.e. a DIFFERENT object, not the slot's own antialiased
edge, which is legitimately recoloured):

| style | shipped | nearest off-hue neutral | largest clean | verdict |
|---|---|---|---|---|
| elegant · simple · classic | 9 | none inside 30 | 30 | ✅ correct |
| **bridgerton · regal** | **12** | `#7F7B76` @ **8.37** | **8** | ✗ 111 colours / **2,770 px (1.794%)** |
| **editorial cream** | **15** | `#A6A09B` @ **12.73** | **12** | ✗ 48 colours / **786 px (0.509%)** |
| **tropical heritage** | **15** | `#A7A99D` @ **3.62** | **3** | ✗ 486 colours / **1,128 px (0.730%)** |
| modern minimalist | 15 | `#C8C2C1` @ 51.44 | 30 | ✅ correct |

**`tropical heritage` is UNSEEDABLE.** Its clean maximum is 3 and
`moodboard_asset_color_ranges` CHECKs `tolerance_de BETWEEN 5 AND 30`, so no
legal tolerance separates the sage runner from `#A7A99D`. **Re-cut, or ship that
family with no range.**

⚠ **CORRECTION TO MY OWN WORDING: this is NOT "the MB23 bride case".** MB23
deleted the bride's range and `figureBySubtype` then preferred a DIFFERENT
variant that had one — attire figures are interchangeable representatives of a
ROLE, so the couple still saw an AI figure that recoloured. Decor layers are
**not** interchangeable across style families: MB14b's invariant explicitly
forbids handing an uncovered `(zone, style)` another family's image. Deleting the
range makes `fetchDecorLayerCatalog` skip the asset (`if (!slot1) continue`, in
both `seating/actions.ts` and `reception-decor-layers-server.ts`), so the couple
falls back to the FLAT SVG — which is what every zone did before 2026-09-06, and
is the correct behaviour for this asset class. RA1 spotted the discrepancy; the
misleading citation was mine.

Suggested corrections if RA1 keeps these files: bridgerton **12 → 8**, editorial
**15 → 12**, tropical **retire the range or re-cut**. Re-measure rather than
trusting this table.

## 🪤 WHY I MISSED IT — the trap to inherit

My measurement enumerated only fills covering **≥0.2% of the opaque area** and
called everything else noise. Every one of these neutrals is **below that floor**
— the largest is `#B8B4AE` at 0.081%. They are the chairs', shadows' and
panelling's antialiased tones: small per colour, ~1–2% of the frame in total, and
they take the couple's colour.

I even documented the 0.2% floor as a limitation in `RECEPTION-ART-PLAN.md` — and
then shipped tolerances that the limitation was actively hiding a defect behind.
**A stated limitation is not a mitigated one.**

➡ **RA1 should measure with no floor.** ⚠ **AND MY SUGGESTED METHOD FOR THE
SECOND HALF WAS WRONG — RA1 refuted it with measurements on these same five
files (PR #5274), and its version is the one to use.**

I proposed separating "the slot's own antialiased edge" (correct to recolour)
from "another object's edge" (must not move) by HUE: >40° from the slot's hue =
a different object. That fails in both directions on this very set —
`elegant`'s cream background `#F3ECE0` sits at hue **37.9°** against a slot at
**38.0°**, so a >40° rule exempts THE BACKGROUND as "the slot's own edge", and
a near-grey cutoff misclassifies the slot itself in the other direction.

**"The slot's own edge" is a POSITIONAL property, not a colour one.** RA1
measures it by dilating the slot's exact pixels by 2px and treating anything
outside that as another object. Use that. My hue rule is one more instance of
the failure this session kept hitting — a cheap proxy standing in for the
property actually claimed ([[setnayan-guards-must-test-the-claim]]).

## The two files

- `bridgerton-regal.STAGE2.svg` — Higgsfield job `4dc332b6-8141-4fbf-b528-a9a5755f834b`,
  Recraft V4.1 vector, 16:9, `background_color` `#F3ECE0`, **`colors: ['#8C6BA6']` — ONE
  colour, not two.** Slot samples to exactly `#8C6BA6`. Shipped at 12; **8 is the
  clean value.**
- `tropical-heritage.STAGE2.svg` — job `eb31811d-6219-4567-9630-9c7b00353c5d`,
  `background_color` `#E4D9CC`, `colors: ['#9CB29A','#E4D9CC']`. Slot `#9CB29A`.
  Shipped at 15; **clean max 3 — unseedable, see above.**

## The two generation rules that DID hold up

1. **Tag a draped or flat-clad surface, never ornate furniture.** 4 of 4 keepers
   tag a tablecloth, runner or clad riser. 0 of 3 attempts that tagged carved
   chairs or a piped sofa survived — the model insists on a second tone for
   frames, trim and piping, and a second tone of the *same object* sits at stock
   colour while the rest recolours around it.
2. **`colors: [seed, background]` does not pin the dominant region.** Recraft
   invented its own dominant (`#8358FB`) and spent the passed seed `#8C6BA6` on a
   *different object* — two same-hue regions 12.6 apart. Three rounds failed that
   way; passing **one** colour fixed it on the next attempt.

Yield, for planning: **5 keepers / 10 generations = 1 per 2.0** (MB28's ceremony
scenes were 1 per 8.5). That number stands — the tolerance error does not change
how many images were usable, only what they should be seeded at.

Other job ids: elegant `0326170e-1e9f-44e5-9743-e13ae1381dba` · editorial cream
`1ebcaafd-53ce-4924-860e-7d033ffc49e1` · modern minimalist
`a4c02e1d-feac-4ca9-a705-dcce7da3ba53`.
