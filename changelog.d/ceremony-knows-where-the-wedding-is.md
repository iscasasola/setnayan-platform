## 2026-09-06 · feat(moodboard): the Ceremony card knows where the wedding is, and attire knows the couple's style

The Ceremony card in "In your colors" showed every couple MB25's church aisle —
a beach wedding, a mosque wedding, a civil registrar's desk, all the same
drawing. `events.ceremony_venue_setting` has carried the couple's real answer
since migration `20271197508087`, CHECK-constrained to nine values, and nothing
read it. The attire cards had the matching defect one row up: each role has one
figure per style family, and which of the five a couple saw was decided by
Postgres row order among those carrying a colour range.

- **Eight new ceremony drawings**, Recraft V4.1 vector, app-served from
  `public/moodboard-seed/venue_scene/<setting>/ceremony-aisle.svg`, one per
  remaining `ceremony_venue_setting` value. Seeded by migration
  `20271208519468` with `asset_subtype` = the setting string verbatim; the
  eight sha256 are recorded in the migration header and match
  `build-sessions/assets/mb28/MANIFEST.md`.
- **`pickCeremonyScene`** (new `lib/moodboard-board-picks.ts`) selects the live
  `venue_scene` whose subtype EQUALS the couple's validated setting, falling
  back to `church` — never to "any venue_scene", because MB14b's ten backdrop
  and ceiling decor layers are `venue_scene` rows too and the page's query has
  no `ORDER BY`. A null setting (every live event today) resolves exactly as
  before.
- **`pickFiguresByRole`** prefers, per role, the figure whose `style_theme`
  equals the couple's `events.moodboard_style_family` AND has a colour range;
  else the first with a range; else the first row. It uses the same
  validate-or-null resolver MB14b's `resolveDecorLayer` callers use — no second
  mapping. Family never outranks having a range, which is MB23's
  bride-with-no-range disease coming back by another door.
- **Guards extended, not duplicated.** `attire-recolours-because-the-query-asks.test.ts`
  now RUNS both picks over the real MB14b decor rows instead of re-implementing
  the predicate; `the-background-never-wears-the-palette.test.ts` grows from one
  ceremony scene to nine, with tolerances parsed out of the migration and every
  neutral — walls, floor, chairs, sky, sea, sand, lawn, driftwood — asserted to
  move by zero on the real 520px raster.

⚠ **Fifteen colour ranges, not sixteen — the beach fabric slot is unseedable.**
The beach arch is DRIFTWOOD (`#DDD6C8`), 3.536 from the fabric slot in the
recolour engine's own metric, and `tolerance_de` is CHECKed at a minimum of 5 —
so at the tightest legal value the whole arch wears the couple's second colour.
Following MB23 exactly (which deleted the modern-minimalist bride's false range
rather than inventing a tolerance), the beach ships slot 1 only: its flowers
recolour, its drapes stay at the artist's cream. Whether to re-cut the driftwood
and seed slot 2 in a follow-up is an owner decision, flagged not resolved.

⚠ **Every tolerance the brief specified was too wide.** The brief's per-file
ceilings (8–15) came from CIELAB ΔE; `colorDistance` is a weighted-RGB proxy,
the point MB25 already paid for. Re-measured by pixel, the clean values are
5–10, and each seeded value is the LARGEST integer at which no neutral moves —
asserted in both directions.

SPEC IMPACT: None. No locked decision changes: the nine `ceremony_venue_setting`
values, the five style families and the two-slot ceremony asset shape are all
already in the corpus; this migration and these two picks make the shipped app
read what the schema already stored.
