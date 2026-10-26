## 2026-10-26 · fix(taxonomy): ③0-b — the parts have one source; the SQL suggestion door reads the tables

The parts snapshot is no longer a default parameter. Twelve helpers in `lib/moodboard-gallery.ts`,
`lib/moodboard-gallery-upload.ts`, `lib/inspiration-slots.ts` and `lib/moodboard-library-access.ts` used to
default `parts` to `fallbackInspirationParts()`. Every caller that left it out read the seed, so after an admin
re-homed, renamed or hid a part, sign-off, supplier suggestions and the library's nav gate kept the old answer
while the couple's picker moved (audit A17). `parts` is now REQUIRED. The finalization chain
(`tradesForPart` → `finalizeBlocker`), `bookedZoneCandidates`, `suggestablePartsForShop` and `supplierTradeWord`
take it too. Every server call site passes `await getInspirationParts()`: sign-off (`finalization-actions.ts`,
`mood-board-editor.tsx`), suggestions (`clients/[eventId]/mood-board/page.tsx` and `suggestion-actions.ts`), the
library nav gate (vendor-dashboard Today, Settings, Shop, collections, first steps) and the reception zones
(`seating/lab/page.tsx`). `MoodBoardStudio.inspirationParts` is a required prop.

The seed is still named in a few places on purpose (audit class C):
- the reader's own fallback (`inspiration-parts-db.ts`);
- the seed generator;
- the module-load structural assert in `moodboard-finalization.ts`;
- the dev labs, which never touch the database.

`lib/no-part-reader-silently-reads-the-seed.test.ts` keeps that list closed and stops the default from coming back.

`inspiration_suggestion_services(slot)` used to be a frozen CASE generated from the TS map (audit A18). Migration
`20271290389661` rewrites it as a JOIN: the part's home plus `inspiration_part_categories`, each expanded by the
new `inspiration_category_services(category)`, which uses the same rule as `deriveBuckets`. On today's data it
answers exactly what the CASE answered, checked two ways: on the replay against the TS map, and read-only on prod,
where 29 of 29 parts match. Two things stay written in it on purpose:
- which parts take a suggestion at all — the couple Studio's photo parts, which is code structure, not admin data;
- the ten Filipiniana & Barongs cross-view keys, until ③0-a writes them as `secondary_tiles` rows. Drop that UNION
  branch when ③0-a lands.

`a-supplier-suggests-only-to-its-own-parts.db.test.ts` now checks the function against the TABLES as well as the
TS map. A new test 6 simulates admin edits and checks that the function and the florist's door follow each one:
re-home, link a category, unlink it, add a service, retire a part.

SPEC IMPACT: None. This implements PLAN `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 8.3 step ③0-b,
under the corpus DECISION_LOG row "2026-10-26 · APPROVED — BUILD THE TAXONOMY". No new product decision.
