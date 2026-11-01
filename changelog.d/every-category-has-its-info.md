## 2026-10-31 · feat(suppliers,admin): every category has its ⓘ — written in Admin, never hidden [migration]

Owner, live: *"I added a category shoes but there is not (i)"* · *"This means you need to add a place for me to write
an (i)"*.

**Cause.** Find's category row drew its ⓘ only when `categoryHintForTile` returned text, and that text came only
from code (`TILE_HINTS`, or a plan group's `hint`; a group's from `FOLDER_HINTS`). A category added in
Admin › Categories is in neither, so its ⓘ was hidden.

**Fix.**
- Migration `20271299134245_a_category_carries_its_own_info_text`: nullable `service_categories.hint_en`
  (≤280 chars). RLS and grants are unchanged (public read, admin write), and nothing is backfilled.
- Admin › Categories › a group or a category › Name › **ⓘ text**: a two-line field that saves in place (`mapWriteForm('info-text')`
  → `setInfoTextCore`, audited, +0 exported server actions). The Name fold says "ⓘ not written" until it is; the
  field's own ⓘ shows the line couples see meanwhile.
- One resolver per level, never blank: the owner's words → the old hard-coded line (fallback only) → a line built from
  Admin's data, "Shoes covers: Bridal shoes, Custom heels and Groom's shoes." (≤5 names, then "and N more"), else
  "Shoes: suppliers for this category." (`categoryInfoText`, `folderInfoText`, `coversLine`).
- `buildShortlistFolders` resolves `hint` on every tile and folder. The row and the group head draw it **with no
  branch**. The page reads the services' Admin names (`readServiceLabels`) only while some category needs the built
  line. `getTaxonomy` re-reads without `hint_en` if that column is refused, so a build that runs ahead of its
  migration never drops the whole tree to the fallback.
- Lab: `/dev/suppliers-lab?shoes=1` (a category no code map knows) and `&shoes=written`.
- Guard: `lib/every-category-has-its-info.test.ts`. It drives a category and a group that no code map knows, and
  holds the row to drawing the ⓘ unconditionally. A sabotage that put the `{t.hint ? (…) : null}` wrap back turned it red.

Other ⓘ surfaces checked: `categoryHintForTile` / `TILE_HINTS` / `FOLDER_HINTS` had no other callers (the supplier
service picker, "Add a category" and the public directory draw no per-category ⓘ).

SPEC IMPACT: DECISION_LOG.md row "A CATEGORY'S ⓘ IS WRITTEN IN ADMIN, AND NO ⓘ IS EVER HIDDEN" (2026-10-31), pushed
to the corpus. New column `service_categories.hint_en` (schema change, owner-authorised).
