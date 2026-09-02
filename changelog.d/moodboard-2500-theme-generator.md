## 2026-09-03 · feat(mood-board): 2,500 procedurally-generated themes, and two apply modes

**Taxonomy widened 5→10 style families, 6→10 moods.** Additive on both
axes — the original 5 `style_family` values and 6 `mood_tag` values are kept
verbatim (existing rows stay valid); 5 new style families (`boho beach`,
`vintage ilustrado`, `industrial loft`, `moody garden`, `destination
resort`) and 4 new moods (`romantic_ethereal`, `nostalgic_vintage`,
`glam_luxurious`, `organic_natural`) are appended. Backed by
`moodboard_theme_templates_style_family_check_v2` /
`_mood_tag_check_v2` (`20271195711446`), following this branch's own
established `_v2`-suffix widening pattern (already used twice for
`event_inspiration_assets.slot_key` and `event_moodboard_saves.pillar`).

**Theme content is now majority PROCEDURALLY GENERATED, not hand-authored.**
The original 100 rows (20 per family × 5 families, all hand-written) are
joined by 2,500 more — every (style, mood) combination across the new 10×10
grid gets ≥25 rows — produced by a real generator function
(`apps/web/lib/moodboard-theme-generator.ts`), not typed out by hand. For
each style family the generator defines a real anchor palette (3-6 signature
hex colors) and a curated slice of `RECEPTION_PARTS`' real option vocabulary
(reusing the same capiz/banig/bamboo/sampaguita/banana-leaf material options
this branch already added, plus the newer Walls/Photo Wall/Welcome & Signage
zones). Each mood applies a deterministic HSL transform to those anchors
(`dark_moody` lowers lightness + raises saturation, `minimalist` trims to
≤3 desaturated colors, `glam_luxurious` pushes toward a gold/silver accent,
`organic_natural` pulls hue toward earth tones, etc.) — variants within one
combination differ by which anchor leads, which reception materials are
cycled in, and a per-variant HSL jitter, never by a trivial 1-hex tweak.
Names are generated from per-style/per-mood emotional word banks (e.g. "A
Storybook" × "Timeless Vows") via an injective (prefix, noun) index mapping
that guarantees no duplicate name within a combination for up to 144
variants (25 required). Every one of the 2,500 rows is validated against the
REAL `sanitizeRolePalette`/`sanitizeReceptionDesign` functions
(`validateGeneratedTemplate`) before being written — a generator that
produces schema-invalid values is worse than no generator, same discipline
the original 100 hand-authored rows used, now automated and enforced by
`apps/web/lib/moodboard-theme-generator.test.ts`'s full-sweep test.

Re-run the generator (e.g. after tuning naming or adding a style/mood) with:
```
cd apps/web && npx tsx scripts/generate-moodboard-theme-seed.ts
```
It rewrites `supabase/migrations/20271196372720_moodboard_theme_templates_2500_seed.sql`
in place; generated rows' `sort_order` starts at 100 so they sort after the
100 hand-authored rows in the gallery's single `.order('sort_order')`.

**Feeling-first labels for the taxonomy itself.** `STYLE_FAMILY_LABELS` /
`MOOD_LABELS` (`apps/web/lib/moodboard-templates.ts`) map every internal key
to a warm, plain-language label (`dark_moody` → "Dramatic & Romantic",
`simple_understated` → "Quiet & Timeless", `moody garden` → "Moody Garden
Romance") — wired into `template-gallery.tsx`'s filter chips, replacing what
used to be a local, 5/6-entry-only copy of the same maps.

**Two apply modes.** `applyMoodboardTemplate(eventId, templateId, mode)`
now takes `mode: 'fill_empty' | 'replace_all'` (default `'fill_empty'`,
unchanged behavior). `'replace_all'` overwrites the couple's current
`role_palette` keys / `reception_design` zones / theme name+description with
the template's values regardless of what was already set
(`replaceRolePalette` / `replaceReceptionDesign` / `replaceTheme`,
`apps/web/lib/moodboard-templates.ts`) — but ONLY for keys/zones the
template actually defines (an older template missing a newer zone like
`walls` never blanks it out), and NEVER touches `room_dressing`,
`custom_roles`, or inspiration photos in either mode (templates don't author
the first two; overwriting a couple's own uploaded photos was judged out of
scope for a "replace my *look*" action). UI stayed to ONE visible button per
card (owner correction mid-build: a gallery of hundreds of cards can't
afford two full-size buttons) — "Apply" (safe, no confirm) plus a small
underlined "or replace everything instead" text link beneath it (mirrors the
existing small-secondary-link idiom in `event-card-menu.tsx`), gated behind
a native `window.confirm` since it's destructive.

SPEC IMPACT: the spec corpus should be updated to note that "theme
templates" in the Mood Board are no longer 100% hand-curated content — 96%
of the 2,600 total rows are procedurally generated from a small set of
real per-style anchor palettes/materials and per-mood HSL transforms, not
individually art-directed. Anyone auditing template *quality* going forward
should sample by (style, mood) combination and by the generator's word
banks/HSL transforms, not assume every row was manually reviewed the way the
original 100 were.
