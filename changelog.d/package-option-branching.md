## 2026-07-27 · feat(packages): recursive package customization — schema + the save path that can actually write it

A vendor package is a flat list today: N lines, each optionally a CHOICE of alternatives. This lands the three axes that let it BRANCH, plus the only part of the save path that makes branching writable at all. **Rendering and pricing are deliberately untouched** — this is the foundation slice.

### Schema — `supabase/migrations/20271012816361_package_item_option_branching_followups_pick_range_and_extra_hour_cap.sql`

Three additions to `vendor_package_items`, **all nullable, all defaulting to today's behaviour**, so every existing row is byte-identical after the migration and every code path that has not been taught about them keeps working:

- **`parent_option_id`** → `vendor_package_item_options(option_id)` **`ON DELETE CASCADE`**, indexed (partial, `WHERE NOT NULL`). A *follow-up line*: the couple sees it only once a specific OPTION on another line is picked ("Fish fillet" reveals "Choose your side"). `NULL` = a normal top-level line, which is every row that exists. **CASCADE is the deliberate half.** `SET NULL` would *promote* an unreachable follow-up into a line every couple sees on every booking — and its `replacement_value_centavos` would enter the credit pool for couples who never picked the parent. Deleting the unreachable line is the safe direction.
- **`pick_min` / `pick_max`** — "choose 3 of 5". `NULL/NULL` = today's behaviour (exactly one option). The CHECK is **both-or-neither**, each `>= 1`, `pick_min <= pick_max`. Half-set is refused because "at least 2, no maximum" would have to be read off the option count, which lives in a different table; `pick_min = 0` is refused because "optional" is already spelled `is_required` / `is_default_included`, and two spellings of one fact is how two sources of truth start disagreeing.
- **`max_extra_hours`** — ⚠ **the design draft called this `max_qty`.** There is no generic quantity concept anywhere in this schema. The only quantity axis `vendor_package_items` has is the hourly model already on the row (`hour_base_centavos` / `min_hours` / `extra_hour_centavos`), so this **extends that** rather than inventing a second one: a ceiling on extra hours. `CHECK (… IS NULL OR >= 0)`. The reasoning is in the column comment, not just here, so the next author does not re-derive it.

**Cycle + depth guard — triggers, not constraints.** `parent_option_id` turns a package's lines into a tree, and a cycle would hang the couple-side renderer (it walks children to decide what to show). An FK cannot see a cycle and a CHECK cannot query another row. Four shapes are refused with named errors: `package_followup_self_parent`, `package_followup_cycle`, `package_followup_too_deep` (max **5** levels, stated in the message), and `package_followup_cross_package`. The last one is not paperwork — `parent_option_id` is a bare FK into an options table that spans every vendor, so without it one package could hang a line off another vendor's option: a cross-tenant link and a cascade delete nobody owns.

**THREE triggers, not one — the first draft of this migration had one and it was bypassable two ways.** Both were found by adversarial review; both are reachable with an ordinary authenticated UPDATE that RLS permits. `parent_option_id` is an edge with three movable endpoints, and guarding only the row that carries the column leaves the other two open:

| trigger | closes |
|---|---|
| `vendor_package_items_guard_followup` (BEFORE INSERT/UPDATE) | the row's own link |
| `vendor_package_item_options_guard_move` (AFTER INSERT/UPDATE OF `item_id`) | **the cycle built entirely from the options side.** Line A owns option `oa`; follow-up B hangs off `oa`; `UPDATE …options SET item_id = B WHERE option_id = oa` and B's parent option now lives on B itself — **without writing a byte to `vendor_package_items`**, so the items trigger never fires |
| `vendor_package_items_guard_repackage` (AFTER UPDATE OF `package_id`) | **the cross-package check bypassed from the parent side.** The same-package rule compares the parent's package to the CHILD row; moving the PARENT never re-validates its children |

Two design points carry the fix. The walk is factored into **one** shared function, `assert_package_followup_ok()` — three triggers enforcing one rule is only safe while there is one copy of the rule, and a DB test asserts none of the three re-implements it. And the two new triggers are **AFTER, not BEFORE**: a BEFORE trigger reads the statement's own snapshot, in which the row still holds its OLD `item_id`/`package_id`, so it would validate the state it is meant to prevent and pass. The option-move and re-package paths both re-validate the whole **subtree** (via `assert_package_followup_subtree_ok()`), not just the direct child, because either move can carry grandchildren across packages or past the depth cap.

All five functions are `REVOKE ALL … FROM PUBLIC, anon, authenticated`. `FROM PUBLIC` alone is a no-op against those two on Supabase — their EXECUTE comes from the platform's own default privileges, which are separate ACL entries. It matters most for the two `assert_*` helpers: they `RETURN VOID` rather than `trigger`, so PostgREST would publish them at `/rest/v1/rpc/` and they would land on the exposure surface. The trigger functions are `SECURITY DEFINER` with a pinned `search_path` — practically because a trigger's own EXECUTE is never checked but a `PERFORM` of a REVOKEd helper *inside* it is (an INVOKER trigger would fail "permission denied" on every vendor INSERT), and substantively because RLS would otherwise hide rungs of the chain from the walk. They only read and raise.

The migration ends with **two** post-condition blocks: the columns landed nullable, and all three triggers are installed.

**No new tables → no new RLS policies.** The columns inherit `vendor_package_items`' existing ones. The migration ends with a post-condition block asserting the four columns exist *and are nullable*, because `ADD COLUMN IF NOT EXISTS` no-ops silently against a differently-shaped table and this repo has been bitten by exactly that.

### The save path — the actual hard part

`savePackage` **replaces** a package's items and options wholesale (delete + re-insert), so every `option_id` is minted fresh on every save. A `parent_option_id` stored from a previous save would dangle instantly. So the draft speaks in **client refs**, not ids: `DraftItem` gains `parentRef?: { itemRef, optionRef }` alongside `pickMin` / `pickMax` / `maxExtraHours`, reusing the `ref` mechanism items and options already carry.

`writeItems` is no longer one INSERT. `planItemInsertOrder` groups the draft into **write levels** — level 0 items → level 0 options → level 1 items → level 1 options → … — and each follow-up's `parent_option_id` is resolved from the ids the previous level just returned. **Sorting one array by depth would not have been enough**, for a second and less obvious reason: a BEFORE-ROW trigger reads the statement's own snapshot, so rows inserted earlier in the *same* multi-row INSERT are invisible to it, and the database's own cycle guard would raise `package_followup_parent_missing` on a perfectly ordered array.

An unresolvable `parentRef` — dangling, or inside a cycle — **fails the save** with a `DraftProblem`. It is never written with a NULL parent, which is the same promotion bug as `SET NULL`, just spelled in TypeScript.

### The loader — a read failure was a DESTRUCTIVE WRITE

The editor page and the save action each ran their own copy of the package query and each destructured only `{ data }`. That is not a cosmetic omission. The item select now names four columns the database does not have until this migration lands (verified against the live project: `column "parent_option_id" does not exist`, and preview shares that project). So: PostgREST 400 → `data: null` → `(items ?? [])` → an **empty draft**. `validatePackageDraft` only objects to *zero* items, so the vendor adds one line, presses Save, and the `scope === 'full'` branch **deletes every existing item** and writes back the one. The UI reports success.

Both copies are replaced by one `lib/package-draft-loader.ts`, which returns a **result**, not a draft-or-null: `read_failed` is a distinct outcome from `not_found`, and the `ok: false` union member has **no `loaded` field at all**, so no caller can typecheck its way to a save on top of a failed read. The compiler now enforces at every call site what a discarded `error` variable never could. Consolidating the duplicate is half the fix — the duplicate is why the same defect existed twice.

The same fail-open shape one level out is fixed too: `activeBookingCount`'s `count ?? 0` meant an unreadable count read as **zero bookings**, which unfreezes a *booked* package and unlocks the very branch that deletes its item rows. It is now `countActiveBookings` returning `number | null`, and both callers refuse on `null`.

Nothing was at risk in production (0 packages, flag never on), but the shape had to go before anything authored a package.

Both loaders also read the branching columns back and re-express `parent_option_id` as its `(itemRef, optionRef)` pair. Dropping that would have **flattened every follow-up into a top-level line on the vendor's next save**, since `savePackage` rebuilds from the draft it is handed.

`validatePackageDraft` mirrors each DB rule so the vendor reads a sentence instead of a 23514 — five new `DraftProblem.code` members: `choice_pick_range_invalid`, `choice_pick_max_exceeds_options`, `item_max_extra_hours_invalid`, `followup_parent_unknown`, `followup_cycle`. `structuralChanges` now fingerprints the branching fields too, so re-parenting a line or widening "choose 2 of 5" to "choose 4 of 5" freezes on a booked package like any other re-price.

### Select constants

New `PACKAGE_ITEM_AUTHORING_COLUMNS` / `PACKAGE_ITEM_AUTHORING_SELECT`, kept **separate** from the shared `VENDOR_PACKAGE_ITEM_SELECT` on purpose: every reader of the new columns sits behind `packageAuthoringEnabled()` (OFF in prod), and folding brand-new column names into the couple-side lock path would turn a not-yet-applied migration into a PostgREST 400 on a money action. `writeItems` likewise omits a branching key entirely when the vendor did not set it, so a package with no branching produces the same SQL as before this change. `vendor-packages.columns.test.ts` now guards the item table as well as the options table, parsing both `CREATE TABLE` blocks plus every later `ALTER`.

### What is NOT in this slice

Pricing is untouched by design. **Known consequence, reported rather than patched:** `computeCustomization` / `keptItems` / the credit engine do not know about `parent_option_id`, so a follow-up line with `is_default_included = TRUE` would be priced and cascaded even when its parent option is unpicked. Nothing authors one outside the flag-dark authoring surface yet; the visibility rule belongs with the couple-side renderer.

### Tests

`tests/db/package-option-branching.db.test.ts` (22 tests) replays the full migration corpus into PGlite and proves: the columns exist nullable with no default; the CHECKs reject half-set / zero / inverted ranges and a negative hour cap; the guard rejects a self-parent, a 2-cycle, a 6-deep chain (and admits 5), and a cross-package parent; **an option move that closes a cycle, crosses packages, or pushes a subtree past the cap is refused while a legal move still succeeds**; **re-packaging a parent line re-validates its children and grandchildren while a childless line still moves**; deleting a parent option cascades the whole follow-up subtree away; all three triggers are installed; none of them re-implements the shared walk; and no guard function is EXECUTE-able by `anon` or `authenticated`. `lib/package-draft-loader.test.ts` (8 tests) drives the loader with a fake client and proves a failed read never becomes a saveable empty draft. 25 new unit tests cover the validator rules and topological insert-order resolution.

Every guard was verified by **neutralisation** — removing the fix and confirming the named test goes red: dropping the options-side trigger fails the four `FINDING 1` tests; dropping the re-package trigger fails the two `FINDING 2` tests; removing the `if (itemsErr)` guard makes the loader return `ok: true` with zero items; removing a helper `REVOKE` fails the EXECUTE test; removing the `@ts-expect-error` makes `tsc` fail with `Property 'loaded' does not exist`.

SPEC IMPACT: None — no SKU, no price, no public-surface change. Adds three nullable columns and one guard trigger behind the existing `packageAuthoringEnabled()` flag.
