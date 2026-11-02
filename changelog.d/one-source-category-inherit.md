## 2026-10-26 · feat(taxonomy): a new category inherits its group's coarse category (③0-c part 2)

A category created in /admin/categories no longer files its shops under "Miscellaneous". The
BEFORE INSERT trigger `service_categories_inherit_coarse_category` (migration
`20271291542739_a_new_category_inherits_its_coarse_category`) gives a new tier-2 category with no
`coarse_category` its group's most common sibling value; ties go to the first sibling by
`sort_order`; a group with no sibling value leaves it NULL (still `misc`, for the Categories page's
"needs a look" check). An explicit value always wins, and nothing runs on UPDATE (moving a category
keeps what it is filed as). `createTaxonomyNode` leaves the column to the database and records the
stored value in its audit row. Controller decision 2026-10-26; the admin override ("Files shops as
▾") belongs to the Categories page build.

Guard: `apps/web/tests/db/one-source-category-key.db.test.ts` section 2b (most common wins, tie →
first by sort order, no value → NULL, explicit wins, no UPDATE effect, a real group's mode computed
independently) — replaces the part-1 "new category files under misc" pin.

SPEC IMPACT: Implements corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 8.3
step ③0-c (part 2 — the inheritance rule decided by the controller 2026-10-26). No spec text
changes.
