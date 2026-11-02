## 2026-09-03 · fix(mood-board): the theme gallery stops reading the whole table, and the board remembers its style family

Two related fixes in the Mood Board's theme-template feature.

### 1. The template query was unbounded — a real shipping regression

`app/dashboard/[eventId]/studio/mood-board/page.tsx` selected
`moodboard_theme_templates` with **no filter and no limit**, and handed the whole
array to `<TemplateGallery>` as a `templates` prop, which then filtered it
client-side in a `useMemo`. That was survivable at 100 rows and became a real
cost the moment the table reached **2,600** (`20271194462267` = 100 hand-authored
+ `20271196372720` = 2,500 generated): every couple, on every load of a page they
open constantly, pulled 2,600 rows — including **two JSONB blobs each**
(`role_palette`, `reception_design`) — into the RSC payload.

Fixed by fetching on demand, server-side and filtered, rather than by bolting a
`.limit()` onto an unbounded query:

- **New server action `fetchThemeTemplates({ styleFamily, moodTag, limit, offset })`**
  in the mood-board `actions.ts` — returns one page of matching rows plus the
  `total` for that (family, mood) pair. House auth shape: the user's own
  RLS-scoped client, never the admin client. No ownership check to make — this
  table is admin-authored, public-read reference content, identical for every
  couple.
- **Whitelisted, capped inputs.** `normalizeThemeTemplateQuery`
  (`lib/moodboard-templates.ts`, pure + unit-tested) accepts `styleFamily` /
  `moodTag` only when they are EXACTLY one of the shipped vocabulary strings —
  the same 10 + 10 the CHECK constraints in `20271195711446` enforce — and
  clamps `limit` to `THEME_TEMPLATE_MAX_LIMIT` (24) and `offset` to
  `THEME_TEMPLATE_MAX_OFFSET`. No caller-supplied string ever reaches the query.
- **`page.tsx` no longer reads the table at all** — not even a `select distinct`
  for the facets. The gallery's first screen is drawn from the STATIC vocabulary
  (`MOODBOARD_MOOD_TAGS` / `MOODBOARD_STYLE_FAMILIES` + `MOOD_LABELS` /
  `STYLE_FAMILY_LABELS`), so it costs zero queries. Its other parallel queries
  are untouched.
- **The gallery is now a narrowing conversation, not a catalogue.** One calm
  choice ("Start from a designed theme" vs "Start with a blank board" — blank
  loads nothing, ever), then a **feeling** (mood axis), then a **setting**
  (style-family axis), ~6 large choices per screen with the remaining 4 one tap
  away. Only after both answers does it fetch ~6 matching themes, with a quiet
  "Show more" that pages via `offset` and a small "Start over". Everything
  already built into the component is preserved: the single primary "Apply"
  (always the safe `fill_empty` mode), the small underlined "or replace
  everything instead" gated by `window.confirm`, the applying/applied states,
  and the swatch strip with `nearestColorName` labels. The badge and
  filter-chip rows are gone.

### 2. Nothing recorded WHICH style family a couple's board came from

The AI decor-layer pilot (`lib/reception-decor-layers.ts` + `-server.ts`) can
only choose a decor image when it knows the event's style family, and
`resolveDecorLayer` refuses to guess — a null family always falls back to the
flat SVG. Nothing anywhere stored one: `applyMoodboardTemplate` merged a
template's palette + reception_design onto the event and discarded the field
that says where they came from. **Every event resolved null, so the pilot was
dormant for everyone.**

- **New migration `20271197327520_events_moodboard_style_family.sql`** — nullable
  `events.moodboard_style_family TEXT`, CHECKed against the same 10 style-family
  strings as `moodboard_theme_templates_style_family_check_v2`, or NULL. Carries
  its own `GRANT SELECT (col)` + `GRANT UPDATE (col)` and rebuilds `events_host`
  in the same file, per `scripts/lint-events-column-grants.mjs`. Also
  `CREATE OR REPLACE`s `get_vendor_mood_board` to return one new additive
  `style_family` key.
- **`applyMoodboardTemplate` persists it in both modes**, via the pure
  `nextMoodboardStyleFamily`: `fill_empty` writes only into a NULL (an
  established family survives a fill, exactly like the couple's palette colors);
  `replace_all` always writes. It is deliberately excluded from `summaryIsEmpty`
  — it is provenance, not board content — and writing it alone does **not** bump
  `mood_board_updated_at`, so a fully-personalized couple is never told their
  board was saved when nothing on it moved.
- **Three read paths now pass a real value**: the couple's Reception Designer
  (`seating/lab/page.tsx` → `SeatingLab3D` → `Hud` → `ReceptionDesignEditor`,
  whose prop docblock previously said "currently never passed by any caller"),
  and the vendor read-only board, which had a hard-coded `null`. Both re-validate
  the stored string against the shipped vocabulary before use, so an unknown
  taxonomy degrades to "no family" rather than reaching the lookup as a stray key.

⚠ **THIS MAKES THE PATH READY, NOT LIVE — it does not render images today.** The
10 pilot asset rows (`20271194970382`) carry `approved_at = NULL` because the
generated files were never uploaded to R2, and the catalog read requires
approved. So `fetchDecorLayerCatalog` still returns EMPTY in production and every
zone still draws the flat SVG — now for the one remaining reason (no approved
images) instead of two. A human uploading + approving those files is the
remaining step, and it is not code.

### Verification

- `tsc --noEmit` clean (confirmed non-vacuous by a deliberate type error in the
  rewritten gallery, which it caught).
- `lib/moodboard-templates.test.ts` — 27/27, including the new whitelist tests
  (every one of the 100 real pairs accepted; casing / trailing-space / SQL-ish
  near-misses and non-string axes rejected), the limit + offset clamps, and both
  apply modes of `nextMoodboardStyleFamily`.
- `ugat-schema-claims.db.test.ts` + `ugat-concept-coverage.db.test.ts` pass; the
  replay was confirmed to actually apply the new migration by breaking it and
  watching the suite go red.
- Against a replayed database: the column is nullable text, `authenticated` holds
  SELECT + UPDATE on it, it is present in `events_host`, the CHECK accepts a real
  family and NULL and refuses an invented one, and the RPC projects
  `style_family`.
- `node apps/web/scripts/lint-events-column-grants.mjs` ✓ ·
  `node scripts/check-migration-timestamps.mjs` ✓
- Grep confirms no unbounded `from('moodboard_theme_templates')` select remains:
  the only two runtime reads are the new `.eq/.eq/.range` page and the existing
  `.eq('template_id').maybeSingle()` in `applyMoodboardTemplate`.

SPEC IMPACT: None. No locked decision changes — the 10×10 taxonomy, the
fill-empty-never-overwrites rule, and the two apply modes are all unchanged. The
new column records which existing style family was applied; it introduces no new
vocabulary and no new product concept. The decor-layer pilot's rollout gate
(draft/published on the asset rows) is untouched.
