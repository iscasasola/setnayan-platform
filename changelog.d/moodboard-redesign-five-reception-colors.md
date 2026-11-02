## 2026-09-03 · feat(mood-board): every theme carries exactly five reception colours

Owner directive: **"themes must be 5 colors."** All 2,600 rows in
`public.moodboard_theme_templates` carried exactly THREE in `role_palette.reception`. Both seed
migrations were still unmerged and un-applied, so they were edited in place rather than superseded
— **no new migration file** (`ls supabase/migrations/*.sql` is unchanged at 1,302; the two seeds
show as `M`).

**One implementation, not two.** `completeReceptionFive` in `apps/web/lib/moodboard-theme-generator.ts`
is the single derivation of slots 3 and 4, used by both groups, so the slot labels are truthful for
all 2,600 rows. Two mechanisms deriving the same five slots two different ways would each pass their
own tests and still disagree. The fixed contract is
**0 Dominant · 1 Supporting · 2 Accent · 3 Neutral · 4 Accent 2**, and slots 3-4 are derived FROM the
colours already present AND from the row's own `mood_tag` — see the second entry below, which
replaced the first cut's lightness rule wholesale.

- **The 2,500 generated rows were REGENERATED, not padded.** `generateTemplate` now builds reception
  as one five-colour set from the style anchor + mood transform — Dominant and Supporting carry the
  hues, the third anchor becomes the Accent (chroma-tamed only when the first two already spend the
  whole budget, so `bold_contrasting` and `maximalist_complex` keep their character), then
  `completeReceptionFive` derives the rest. `minimalist` and `simple_understated` still narrow the
  HUES — they now fill all five slots with at most one hue plus their neutrals. Re-run with
  `cd apps/web && npx tsx scripts/generate-moodboard-theme-seed.ts`; a clean re-run reproduces the
  committed seed byte for byte. Descriptions now name colours from the reception five rather than
  from anchors that never reached the palette.
- **The 100 hand-authored rows were LIFTED, not bulk-appended.** New one-off
  `apps/web/scripts/lift-moodboard-hand-authored-reception-to-five.ts` derives each row's two new
  members from that row's own three, asserts the original three survive unchanged AND in order, and
  edits only the `"reception":[…]` array — `diff` of both files with the reception arrays masked is
  IDENTICAL, so name/description/style_family/mood_tag/sort_order/reception_design are untouched.
  Idempotent (a second run reports `0 lifted, 100 already had five` and rewrites the file to itself)
  and fail-closed (any row that will not round-trip through the real sanitizer aborts the whole run
  before anything is written).

**🔑 `PALETTE_LIMITS.reception.max` is load-bearing, not cosmetic.** `sanitizeRolePalette` slices
every palette to `max` and sits on the ONLY write path into `events.role_palette` — a `max` under 5
silently CLAMPS all 2,600 five-colour themes back to three on their way into the couple's board, with
no error and a swatch strip that looks exactly like a board that was right. `max` 6 → **5**
(`slotLabels` covers exactly five, and nothing provides a sixth); `min` stays **3** so a couple may
still simplify their OWN palette (min is a soft warning in `palette-editor.tsx`, never a save block).
`slotLabels` gains its fifth: `['Dominant','Supporting','Accent','Neutral','Accent 2']`, and the hint
that still read "3 to 6 colors" now states the real range.

**Readers that assumed three.** `DEFAULT_PALETTE_SUGGESTIONS.reception` grew to five — `addColor`
picks `suggestions[arr.length % suggestions.length]`, so a three-entry list handed the couple a
REPEAT of the Dominant the moment they added a fourth. The gallery's swatch strip
(`template-gallery.tsx`) now leads with the reception five instead of walking keys in order, where
the two ceremony colours took the front of a 6-chip strip and could crowd out the theme's own
Accent 2. The AI scene prompt in `reception-scene.ts` capped its colour clause at 4, dropping every
theme's Accent 2. The Mood Board help copy in `lib/help.ts` still advertised "Reception 3-6". The
concept PDF's 6-swatch row already leads with reception and its cap is a real layout constraint
(6 × 40pt in a 250pt column) — left alone. `moodboard-printable.ts`, `theme-suggest.ts`, and the
merge/replace helpers in `moodboard-templates.ts` are length-agnostic and needed no change.

⚠ **Surfaced, not silently resolved:** the reception SVG reads only palette indexes 0-2
(`grep -o "P([0-9])" apps/web/lib/reception-scene.ts` → P(0)/P(1)/P(2) only) and
`resolveRoomDressing` derives from `r[0]`/`r[1]`/`r[2]`, so the Neutral and Accent 2 are **not drawn**
in the stylized scene or the 3D room. They do reach the palette editor, the printable's palette rows,
the concept PDF swatches, the gallery strip, and the AI prompt. Mapping them onto room surfaces is a
design decision, not a mechanical one — flagged for the owner rather than invented here.

**Verification.** New `apps/web/lib/every-theme-carries-five-reception-colors.test.ts` opens the SQL
that actually ships (both seed files) and asserts 100 + 2,500 rows, exactly five each, no repeated
swatch, valid uppercase hex, and a clean round-trip through the REAL `sanitizeRolePalette` — the
generator's own tests prove the FUNCTION returns five but cannot see a stale seed or the hand-authored
rows at all. Measured across all 2,600: length histogram `{"5": 2600}`, 0 clamped, 0 altered by the
sanitizer, 0 duplicate swatches. Two hand-authored rows carry three
high-chroma colours — both were already three saturated hues before this change (coral + gold +
emerald / azure), which the lift is required to preserve; everything ADDED to them is chroma ≤ 26.
Both guards were sabotage-tested: `max: 5 → 3` turned 7 tests red including the dedicated clamp
guard, and truncating one row in each seed file turned the count guard red while the generator's own
tests stayed GREEN — which is exactly why the seed-reading test exists. Full unit suite 12,164 pass /
0 fail; `tsc --noEmit` exit 0, zero lines; lint clean.

SPEC IMPACT: None — no schema change, no new column, no new migration. `role_palette` is the same
jsonb shape; only the number of colours inside `reception` and the editor's per-key bounds changed.

## 2026-09-03 · fix(mood-board): the completion reads the theme's MOOD, and stops inverting 906 of them

The five-colour completion above shipped mechanically perfect — 2,600 rows, all exactly five,
sanitizer-clean, 12,164 unit tests green — and **systematically inverted the mood of 906 themes
(35%)**. Found by an independent audit working in CIELAB / ΔE2000 rather than the generator's HSL, so
it did not share the generator's blind spot.

`completeReceptionFive` chose slots 3-4 by `missingBand` — "whichever lightness pole this set does
not have yet, deep first" — and `deriveNeutral` hard-coded the lightness (91 for light, 18 for deep).
**`mood_tag` was never an input at all.** A dark palette always already HAS deep, so it always
received light; a light one always received deep. Measured on the shipped SQL: `dark_moody` median
L\* 32.7 → 51.7 with swatches at L\*≥85 going **2 → 262**; `romantic_ethereal` 77.1 → 65.1 with
swatches at L\*≤25 going **0 → 235**; **383 rows stopped reading dark and 523 stopped reading light.**
"All black — walls, linens, chairs" received two near-whites; "a moody, nighttime heritage reception"
received L\*94 and L\*84; "All white, no accent color at all" received a charcoal and a sage.

⚠ **THE METRIC THAT PASS WAS PROUD OF — "0 rows with a lightness span under 30" — WAS THE DEFECT
STATED AS A VIRTUE.** Every palette spanned both poles precisely because the ones that deliberately
did not were forced to. That line is struck from the entry above; a full lightness span is not a goal.
The rebuilt seeds have **562** rows under a 30-point span, **1,343** with nothing in the deep band and
**870** with nothing in the light band — light themes that stay light, dark themes that stay dark.

- **Mood is a required parameter, not an option.** `completeReceptionFive(base, mood)` — a missing
  mood is now a compile error, and `MOOD_COMPLETION` gives all ten tags a profile: *deeper*
  (`dark_moody`, `nostalgic_vintage`), *lighter* (`romantic_ethereal`, `whimsical_storybook`,
  `minimalist`), *widen* (`bold_contrasting`, `maximalist_complex`, `glam_luxurious`), *stay*
  (`simple_understated`, `organic_natural`). The lift script reads each row's `mood_tag` out of the
  VALUES line and **fails closed** on one it cannot parse or does not recognise.
- **The pair straddles the set's own median, so the mood cannot invert — arithmetically.** The window
  is built from the set's own darkest/lightest/median with one addition at or below the median and one
  at or above, so the median of five IS the median of three. Measured worst drift across all 2,600
  rows: **0.256 L\***. Flip counts: **383 → 0** stop reading dark, **523 → 1** stop reading light (the
  one is a 70.0 → 69.7 crossing of a threshold, from the Accent's chroma taming, not the completion).
- **Deliberately-narrow palettes complete INSIDE their band**, detected from the colours' own spread
  and never from the theme's name. All-black, all-white and dove-grey-on-dove-grey get tonal
  variation, not a jump to the opposite pole.
- **The additions are per-THEME, not per-carrier.** They used to be a function of the hue carrier
  alone: 99 distinct hand-authored triples produced only **68** distinct added pairs, and
  `#F5EFDB + #E7D186` went byte-identically onto *Navy & Gold Ballroom Regal*, *Midnight Garden
  Regal*, *Moonlit Mangrove Heritage* AND *Full Black Modern Statement*. Now **87** of a possible 99,
  and those four differ.
- **An added colour never out-colours the palette it joined**, capped in C\*ab. This is what stops
  "All white, no accent color at all" receiving an accent and "nearly monochrome, one soft color kept
  to a minimum" receiving a second soft colour — from the colours, without reading the description.
  **0 of 100** hand-authored rows now contradict their own copy (the gallery card renders
  `description` directly above the chips).
- **The accent never invents a hue.** A midpoint is used only for hues within 40° of each other;
  beyond that it reuses a hue the palette already has. Amethyst-and-gold no longer receives a salmon
  45° off everything present. Worst-case Lab-hue outliers: `>60°` **53 → 0**, `>90°` **12 → 0**.

**Three things HSL was answering wrongly, all now measured in CIELAB.** (1) HSL `l` is not lightness —
`#19D393` sits at HSL l 46 and L\* 75, and five rows completed against the HSL number still flipped.
(2) A different hex is not a different colour: hex-inequality alone left **874** palettes with an added
chip nobody can tell from its neighbour, so placement now requires a real perceptual gap. (3) HSL
chroma is not C\*ab — 3 HSL points read as C\*ab 5 on a near-white and C\*ab 2 mid-scale, which is how
the whitest palette in the gallery received the most colourful chip in it.

Added near-duplicates (ΔE00 < 5) settle at **153 of 2,600**, of which **144 are rows whose own three
already contained a pair under ΔE00 10** — palettes that were tonal before anything was added. The
previous build's 3 was bought by jumping to the opposite pole, i.e. by the defect.

**Verification.** New `apps/web/lib/the-completion-cannot-invert-a-theme-s-mood.test.ts` reads both
shipped seed files and holds them to: no row stops reading dark or light, median drift ≤ 1 L\*, every
mood present in the reach table and inside its bound, no near-white in a `dark_moody` theme, no
near-black in a `romantic_ethereal` one, added pairs tracking distinct sources, no added colour
out-colouring its theme, and no hand-authored card contradicting its own description — plus a
row-count assertion and a regex-matched-something assertion so the file cannot go green by matching
nothing. Its CIELAB is written out locally rather than imported: a rule checked with the generator's
own helpers agrees with it by construction. **Sabotage-tested against the defective seeds it was
written for: 7 of its 9 tests go red.** Two generator tests that ENCODED the defect were replaced —
"gives an all-light palette something to stand on" / "…all-dark something to breathe" (a light palette
always lacks deep, so that rule *was* the inversion) and the 30-point span floor. Suites: **10,220 lib
+ 1,956 app pass / 0 fail**; `tsc --noEmit` exit 0. Lift is idempotent (second run: `0 lifted, 100
already had five`) and the seed regenerates byte-identically.

SPEC IMPACT: None — no schema change, no new column, no new migration; both seed migrations are still
unmerged and were edited in place.
