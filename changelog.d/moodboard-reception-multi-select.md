## 2026-09-03 · feat(reception-design): an attribute can hold MULTIPLE treatments — widened, not broken

Owner: *"on reception design, needs to be able to pick multiple as well."* Real receptions combine
treatments — a ceiling is draped fabric AND fairy lights; a backdrop is a floral wall AND greenery;
a welcome table carries a sign AND a seating chart AND a guestbook.

**The constraint this had to respect.** `ReceptionDesign` was
`Partial<Record<PartId, Record<string, string>>>` — one option id per attribute — and that shape is
load-bearing across `renderVenueSvg` · `buildPrompt` · `lib/concept-pdf.ts` ·
`lib/moodboard-printable.ts` · `lib/moodboard-templates.ts` · `lib/moodboard-theme-generator.ts` ·
`lib/theme-suggest.ts` · the Seat Plan 3D lab (`seating-lab-3d.tsx`, `venue-decor.tsx`,
`plan3d-scene.tsx`, `guest-venue-3d.tsx`) · the `get_vendor_mood_board` RPC. Above all,
`public.moodboard_theme_templates` holds **2,600 seeded rows** whose `reception_design` JSONB is
entirely in the single-string shape (migrations `20271194462267` = 100, `20271196372720` = 2,500).

**So the type was WIDENED, never replaced.** An attribute's value is now `string | string[]`
(`AttributeValue`), and a bare string still means exactly what it always meant. **No migration, no
backfill, no DDL** — `reception_design` was already JSONB. Measured, not asserted: a throwaway pass
ran every seeded blob in both migrations through `sanitizeReceptionDesign` — **2,600 rows /
41,300 part.attribute values, all survive byte-identical, in the same stored shape.**

- `sel()` is unchanged in meaning and return type — the PRIMARY id — so every caller that draws one
  thing kept compiling and kept rendering identically. New `selAll()` returns the whole list, with
  `selAll(...)[0] === sel(...)` as a tested invariant, so moving a call site can only ADD.
- **Multi is per-attribute and opt-in** (`Attribute.multi`), set on the 9 attributes where combining
  is what a real room does: ceiling treatment · backdrop style · backdrop florals · stage florals ·
  tunnel style · aisle runner · walls treatment · photo-wall style · welcome & signage. Left SINGLE
  where multiple is nonsense: table shape/chairs/linen/centerpiece/place setting (one table has one
  of each; the renderer draws one shape per spot), stage setup, and `people.who`.
- **Cap: 3** (`MAX_SELECTIONS_PER_ATTRIBUTE`). Two covers the owner's own examples, but a welcome
  area genuinely carries an easel sign, a framed seating chart AND a guestbook table at once. Three
  is still short of "everything": the smallest multi attribute has four options.
- **New `Option.exclusive`** marks the "nothing here" ids (None / Bare / No tunnel / Minimal /
  Uplighting only). Without it a couple could store `["none", "floral"]` and `buildPrompt` would
  send *"no entrance tunnel, a grand-entrance tunnel of floral arches"* to the paid render.
- `sanitizeReceptionDesign` enforces all of it — arrays only on `multi` attributes (otherwise
  collapsed to the first valid entry), unknown ids dropped inside an array exactly as outside one,
  duplicates dropped, the cap applied, an exclusive id dropped beside a real one, and a single
  surviving id written back as a **bare string** so one pick always stores in the legacy shape.
- `saveReceptionDesign` (`seating/actions.ts`) now **delegates** to that sanitizer instead of
  re-implementing the rules inline. One rule was survivable in two places; five is not.
- The Mood Board's read-only summary, the concept PDF and the printable board moved to `selAll`
  and join an attribute's labels with `+` (**"Ceiling: Draped canopy + Fairy lights"**). Showing
  only the first of two would have looked exactly like a board that was right. Those three read
  paths now also pass the stored blob through the sanitizer rather than casting it.
- The editor (`reception-design-editor.tsx`) renders a `multi` attribute's options as checkbox-style
  toggles in the SAME chip styling — with three refusals that keep the room describable: an
  exclusive option clears the rest (and is cleared by them), the last remaining selection can't be
  turned off (an empty attribute silently falls back to `DEFAULT_DESIGN`, i.e. the room would change
  to something nobody picked), and nothing is added past the cap (the blocked chip dims rather than
  swallowing the tap). Part chips read "Draped canopy +1".

⚠ **The 3D room still shows the PRIMARY selection only.** `venue-decor.tsx` and its three callers
stay on `sel()` deliberately: a 3D backdrop is one physical panel in one place, two would
interpenetrate — and those four files are being edited right now by PR #5123, so widening them
belongs with that work, not against it. The 2D preview, the PDFs and the AI brief carry the full
combination today.

Tests — `lib/reception-scene.test.ts` grew from 6 to 23 cases: both shapes through `sel`/`selAll`,
the `selAll[0] === sel` invariant swept over every part+attribute, the non-multi collapse, unknown
ids inside arrays, duplicates, the cap, exclusive-beside-real, the 9 multi attributes each having
≥2 combinable options, valid SVG for both shapes on every multi attribute, a render that proves
BOTH ceiling treatments are drawn (not just the primary), a prompt carrying all three welcome items
and neither half of a contradiction, and a byte-identity check that the legacy all-strings design
renders and prompts exactly as its one-element-array twin. Each new guard was mutation-checked
(reverting the ceiling to `[sel(...)]`, dropping the non-multi collapse, and widening the cap each
turn the matching test red). Full `lib/**/*.test.ts` suite green — **10,189 tests**. `tsc --noEmit`
clean; eslint + contrast/radius/legibility/dup-rule guards clean.

SPEC IMPACT: `events.reception_design` (and `moodboard_theme_templates.reception_design`) now accept
an ARRAY of option ids per attribute on the 9 `multi` attributes, capped at 3, while a bare string
remains valid and is still the canonical single-selection form. No schema change — JSONB already
allowed it. Corpus: reception-design taxonomy notes updated to record which attributes are
multi-select, the cap, and the "nothing here" exclusivity rule.
