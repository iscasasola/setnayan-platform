## 2026-09-02 · feat(mood-board): redesign into one canvas, add Overall Theme, retire dead attire/chapters schema

**Dead code + schema removed.** Deleted `_components/wedding-attire-guide.tsx`
(1231 lines, the old per-role attire color picker) and
`_components/moodboard-chapters.tsx` (340 lines, the old "4 chapters" UI) —
both confirmed unreachable from `page.tsx` before removal. Their only write
paths, `saveAttireGuidePaletteColor` and `saveMoodboardSelection`
(`actions.ts`), are removed with them. A new migration drops
`events.attire_guide_palette` and `public.event_moodboard_saves`.

**Fixed a silent-empty-palette bug.** `seating/export/route.ts` read its
"moodboard mode" palette from `event_moodboard_saves.palette_snapshot`, whose
only writer was the dead `moodboard-chapters.tsx` — so that table was never
populated for a real couple, and the seating PDF's moodboard export always
rendered as if the couple had no palette. It now reads `events.role_palette`,
the live source every other mood-board surface (palette editor, the 3D Plan,
the vendor mood-board view) already uses.

**New: Overall Theme.** Two new nullable `events` columns
(`moodboard_theme_name`, `moodboard_theme_description`, length-capped) let a
couple name and describe their wedding's look. `saveMoodboardTheme` follows
the same auth/RLS pattern as `saveRolePalette`/`saveReceptionDesign`. A pure,
deterministic "Suggest for me" helper (`lib/theme-suggest.ts`, no AI call)
derives a starter name/description from the couple's saved palette (nearest
named color) and reception design (backdrop/ceiling treatment). Wired into
the concept-PDF cover/intro and into the vendor-facing mood board view via an
updated `get_vendor_mood_board` RPC (additive — existing keys unchanged).

**Redesign: one scrollable canvas.** `page.tsx` now opens with the Theme card,
follows with a sticky jump-nav, places the inspiration grid and the palette
editor side-by-side inline (previously separate tabs), then "In your colors,"
"Design your reception," and "Share with vendors" as anchored sections, with
Share + both PDF exports pinned in a persistent bottom action bar. All
existing components' internal logic is reused unchanged — this only
restructures composition/layout. Added native HTML5 drag-and-drop (no new
dependency — none exists in this repo) to `inspiration-board.tsx` so photos
can be reordered between slot cells, backed by a new `reorderMoodboardSlot`
server action that swaps two `event_inspiration_assets` cells.

**Schema housekeeping required by the drop:** `public.events_host` (an
explicit-column view) selected `attire_guide_palette`, so the column drop
required dropping and rebuilding that view in the same PR (2 migrations); the
two new theme columns needed their own `GRANT SELECT`/`GRANT UPDATE` per
`scripts/lint-events-column-grants.mjs`, and the exposure-surface baseline was
regenerated to reflect the net change (2 new narrow `SU`-only grants, plus the
removal of the dropped table/column's exposure — net narrowing overall).

SPEC IMPACT: The Mood Board's "4 chapters" UI and the Wedding Attire Guide
mockup, if described anywhere in the spec corpus
(`~/Documents/Claude/Projects/Setnayan/`) as the current UI, are superseded by
this redesign and by the existing palette-editor/reception-designer/
moodboard-board flow. The new "Overall Theme" feature and the canvas layout
are not yet reflected in the corpus. This session could not edit that corpus
(different repo/worktree) — a human should apply the `DECISION_LOG.md` +
iteration-doc update per the `COWORK.md` sequence.
