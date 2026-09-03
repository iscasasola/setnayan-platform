## 2026-09-03 · feat(mood-board): a curated theme template gallery couples can start from

**New: 100-template gallery.** The Overall Theme section now offers a
browsable gallery of curated starter looks — 100 templates, 20 per existing
`moodboard_library_assets.style_theme` family (elegant · simple · classic /
bridgerton · regal / editorial cream / tropical heritage / modern
minimalist), each with a real name, description, role_palette, and
reception_design. A meaningful share draw on Filipino wedding material/motif
vocabulary (piña/jusi/abaca, capiz shell, banig weave, bamboo/rattan, narra
wood, sampaguita/ilang-ilang/waling-waling) across all 5 families, not only
"tropical heritage" — named looks include Rustic Filipiniana Heritage,
Tropical Garden Waling-Waling, Boho Beach Piña & Rattan, Vintage/Regal
Ilustrado, Glam & Gold Opulence, Modern Minimalist Ballroom, and Industrial
Loft Chic.

**Second filter axis: mood_tag.** Independent of style_family, every
template also carries one of 6 `mood_tag` values (`whimsical_storybook`,
`minimalist`, `dark_moody`, `bold_contrasting`, `simple_understated`,
`maximalist_complex`) reflecting its actual palette/character — e.g. a
'bridgerton · regal' template can be `dark_moody` or `whimsical_storybook`
depending on its colors. The gallery UI filters on both axes independently.

**New table `public.moodboard_theme_templates`**
(`20271194462267_moodboard_theme_templates.sql`) — admin-authored reference
content, RLS public-read (`USING (TRUE)`, matching
`platform_retail_catalog_v2`'s public-catalog pattern), admin-only writes.
Every seeded row was validated against the real `sanitizeRolePalette` /
`sanitizeReceptionDesign` functions before the migration was written, so
nothing in it gets silently dropped by either sanitizer.

**5 additive reception_design options** (owner directive: authentic Filipino
material vocabulary, not generic-Western only) added to
`apps/web/lib/reception-scene.ts`'s `RECEPTION_PARTS` + matching SVG render
branches: `backdrop.style` `'capiz'`, `ceiling.treatment` `'banana_leaf'`,
`tables.linen` `'banig'`, `tables.centerpiece` `'sampaguita'`, `tunnel.style`
`'bamboo'`. Purely additive — nothing renamed or removed, every couple gets
more choice in the existing reception designer too, not just template
consumers.

**Apply = fill-empty-only, always.** New `applyMoodboardTemplate(eventId,
templateId)` server action (`actions.ts`) fills ONLY currently-empty
`role_palette` keys, `reception_design` (part, attribute) zones,
`event_inspiration_assets` slots, and `moodboard_theme_name`/`_description` —
never overwrites anything the couple already set. The merge math is pure and
independently unit-tested in `apps/web/lib/moodboard-templates.ts` /
`.test.ts` (`mergeRolePalette`, `mergeReceptionDesign`, `mergeTheme`,
`summaryIsEmpty`). A couple who's already fully customized their board gets a
`nothingToFill` result; the UI (`_components/template-gallery.tsx`) shows
"already personalized — nothing to fill in" rather than a silent no-op.
Inspiration-slot seeding looks up a style-tagged `moodboard_library_assets`
row (same join pattern `page.tsx` already uses for "In your colors") for the
attire-adjacent slots only (bride/groom/entourage/principal_sponsor/guests) —
only `figure_attire` rows carry a `style_theme`, so venue/backdrop/ceiling/
flowers/cocktail/etc. slots are left for the couple's own upload, same as
today; if a matching asset has zero tagged colors, that slot is skipped
rather than inventing hex values.

**Swatches show real color names.** Template gallery cards import
`nearestColorName` from `apps/web/lib/color-names.ts` directly (not via
`theme-suggest.ts`'s re-export) so each palette swatch shows its name, not
just a hex.

**Fixed a privacy-register gap surfaced by the new table.** Added
`moodboard_theme_templates` to `NAME_COLUMNS_THAT_ARE_NOT_PEOPLE`
(`lib/data-subject-register.ts`) — its `name` column is a curated template's
display name ("Rustic Filipiniana Heritage"), not a person's name.

SPEC IMPACT: None — this is a UI/data addition inside the already-locked Mood
Board redesign; no product-spec decision changes.
