## 2026-11-16 · feat(taxonomy): build T1 — the app moves onto the owner-approved Philippine taxonomy

Owner, 2026-11-16: *"this is not my taxonomy"*. The approved tree (corpus `TAXONOMY_PH_FULL_2026-11-07.md`, "the ONE
spec for build T1"; DECISION_LOG 2026-11-07 "ALL ✚ TAXONOMY AND EVENT ADDITIONS APPROVED") is transcribed with
stable slugs into `supabase/data/taxonomy-ph-2026-11-07.json` and written by migration
`20271349743729_t1_philippine_taxonomy.sql` (idempotent, one transaction, refuses to commit unless the tables equal
the target).

- Groups and categories take their Philippine names (Venues & Simbahan, Catering & Cakes, Gowns, Barong & HMUA,
  Lights & Sounds, Photobooths, Make & Take…); a new group **Gifts, Giveaways & Souvenirs**; a new category
  **Event Staff & Security**; Shoes seeded where a database lacks it.
- Where the spec combines categories, the surviving id is reused, the services move onto it, and the folded category
  is **hidden, never deleted** (18 of them). No category merge mechanism is added (#7348 stays closed).
- 39 ⇢ folds through the existing `merge_canonical_service()` (tombstone + `merged_into`, never deleted). Measured in
  prod 2026-11-16: every source holds zero rows except `band_live_music` (one shop's services[]).
- 15 ⛔ services and the Tarot / palmistry category hidden. 68 ✚ services added, incl. all 20 approved on 7 Nov.
- Officiants shown again for house blessing + mass / novena only (open house + wake); every officiant row stays hidden.
- Code fallback (`lib/taxonomy.ts`), hub-tool seed labels (`lib/hub-tools.ts`), and module-load service names
  (`lib/taxonomy-service-names.ts`, read by `marketplace-category-options.ts`) follow.
- Guards: `lib/t1-taxonomy-is-the-spec.test.ts` (code = spec, migration embeds the JSON) and
  `tests/db/t1-taxonomy-is-the-spec.db.test.ts` (replayed tables = spec; re-applying changes nothing).
- NOT in this PR: the tag renames (filter_facets) and the ~6 new inspiration parts — follow-up.

SPEC IMPACT: None to the corpus wording — this implements `TAXONOMY_PH_FULL_2026-11-07.md`. Owner questions on
ambiguous items are listed in the PR body (they decide whether the corpus needs a clarifying row).
