## 2026-09-03 · fix(mood-board): a colour name must belong to the colour's own hue family

`nearestColorName` matched on plain RGB Euclidean distance, at any distance,
across any hue boundary. RGB² does not care which channel moved, so a colour
that differs from a candidate almost entirely in the green channel reads as
"close". Measured on the shipped function:

| input | returned | actually is |
|---|---|---|
| `#20452F` | **Charcoal** | a deep pine green named as a blue-black neutral |
| `#CDD590` | **Tan** | a pale yellow named as an orange-brown |
| `#DC143C` | **Rose** | Crimson — which is in the CSS table **exactly** |

Across a 6,480-hex sweep of the hue circle, **45.1% of all answers came from
the wrong hue family.** The brief attributed this to the unbounded `CSS_NAMES`
fallback; that is only half of it. `#20452F` sits 1265 RGB² from Charcoal,
inside the curated layer's own 2400 radius — **the wrong name was produced by
the curated layer, before the fallback was ever reached.** Both layers are now
gated.

**The fix.** Every candidate must pass a hue test before its distance is
considered, in CIELAB:

- **CIELAB, not a second colour space.** `labOfHex` already existed, private, in
  `moodboard-theme-generator.ts`. It moved to a new `lib/color-space.ts` that
  both files import — one implementation, because the generator writes the
  seeded theme descriptions and `color-names` writes the words inside them, and
  a silent drift between the two is invisible until a couple reads "Charcoal"
  under a green. No OKLab/OKLCH was added; none existed to reuse.
- **ΔH\*ab, not a degree tolerance.** Lab hue is wildly non-uniform — yellow
  103° and green 136° are 33° apart while cyan 196° and blue 306° are 110°
  apart, so one degree tolerance is several families wide in the greens and
  barely a shade wide in the blues. ΔH\* is chroma-weighted. Threshold **12**,
  the completion's own `MIN_PERCEPTUAL_GAP`, with a 40° ceiling, its
  `ANALOGOUS_MAX_HUE_GAP`.
- **Achromatic inputs, both directions.** Below C\*ab **6** (the completion's
  `INVISIBLE_HUE_CHROMA`) a colour has no nameable hue and may only take a
  neutral name — so a near-grey still reads as Charcoal/Silver/Gainsboro. At or
  above C\*ab **12** a neutral name is refused. Between them both are honest.
- **An exact hex names itself**, in either table. Crimson is Crimson.
- **An honest fallback.** When nothing same-family is within ΔE 40, the answer
  is built from the measurement — "Dark Green", "Light Yellow-Green" — never a
  confidently wrong name. It fires for 0.88% of the sweep. `nearestColorName`
  still returns `null` only for an unparseable hex, which is the contract all
  four call sites already code against.
- The curated radius moved from RGB² 2400 to **ΔE 20** — the same reach
  re-expressed (that ball's ΔE p50 is 18.6), and the radius at which agreement
  with the old function *on the answers it got right* peaks.

After: `#20452F` → **Forest Green**, `#CDD590` → **Pale Goldenrod**,
`#DC143C` → **Crimson**. Zero guard violations and zero round-trip failures
across the sweep and all 140 CSS + 32 curated entries.

New `resolveColorName` reports which layer answered — the descriptive fallback
legitimately emits words the CSS table also holds ("Purple", "Deep Pink"), and
a guard reading only the string cannot tell a hue-checked match from a
fallback. An earlier cut of the test reported three violations that were
neither.

⚠ **DATA, NOT CODE — 1,752 seeded rows carry a wrong-family colour word and
this fix does not repair them.** Reported, not silently regenerated; see below.

SPEC IMPACT: None. No schema, no locked decision, no pricing. The seeded-row
finding below is an owner call, not a spec change.

### The seeded theme rows — measured, not estimated

`moodboard-theme-generator.ts` feeds `nearestColorName` into
`generateDescription`, and that output is frozen into
`20271196372720_moodboard_theme_templates_2500_seed.sql`. Re-deriving every
row's description from its own `role_palette.reception` with the pre-fix
function reproduces **2,500 of 2,500 (100%)** stored descriptions — so the
pipeline is confirmed, not assumed.

- **1,752 of 2,500 rows (70.1%) contain a colour word from the wrong hue
  family** — `#CFC1A0`, a warm beige, described as "Dusty Rose"; `#D6CA86`, a
  gold, as "Peach".
- 2,069 rows (82.8%) would get a different colour phrase under the fix.
- Most-replaced words: Dusty Rose ×495 · Sage ×400 · Blush ×264 · Charcoal ×227
  · Silver ×223.
- **Theme NAMES are not affected.** `generateName` draws from
  `MOOD_PREFIXES` × `STYLE_NOUNS` word banks and never calls
  `nearestColorName`. The 50 name matches on a colour word are substrings of
  "A **Red**-Carpet" and "A **Rust**ic".
- The 100 hand-authored rows in `20271194462267` are unaffected — that prose
  was written by a person.

A second stored surface: "Suggest for me" (`theme-card.tsx` → `theme-suggest.ts`)
writes a colour-named theme name **and** description straight into
`events.moodboard_theme_name` / `moodboard_theme_description`. Already-saved
couple themes keep whatever word the old code produced.

**Recommendation (owner decision — not taken here):** regenerate the 2,500
generated rows via `apps/web/scripts/generate-moodboard-theme-seed.ts` in a
follow-up PR of its own, so a 2,500-row data change is reviewable separately
from this logic fix. Note the existing seed migration is gated on
`COUNT(*) < 200` and will not re-run on its own. The saved couple themes should
be left alone — they are the couple's own words once edited.
