## 2026-11-13 · feat(taxonomy): T1 — the Philippine taxonomy (groups, categories and services in Filipino terms)

Applies `TAXONOMY_PH_FULL_2026-11-07.md` (owner-approved 7 Nov, "add all that we can") to the
one source, Admin › Categories, in one data migration
(`20271341706505_the_philippine_taxonomy_t1.sql`) plus the code fallback that mirrors it.

- **Groups:** 16 → 17. ✚ "Gifts, giveaways & souvenirs" (group 9b, id `gifts_giveaways` — `gifts` already names a page part in ~25 comparisons) takes the souvenirs category
  out of Invitations & prints. Seven groups renamed (Venues & simbahan · Coordinators · Catering &
  cakes · Gowns, barong & HMUA · Booths, food carts & bars · Invitations & prints · Bridal cars &
  transport). Ids and slugs unchanged, so every `?folder=` link still resolves.
- **Categories:** 81 → 83 rows (76 → 78 visible). ✚ Shoes (id `footwear`) · ✚ Staff, Security & Registration (id `event_staffing`, from the closed v2 seed #7355);
  ⛔ Tarot / palmistry hidden; 42 renamed (Make & Take, Kids' Party Entertainers, Dance
  Instructors & Choreographers, Photobooths, Food Carts, Lights & Sounds, Van / Coaster Rental …).
- **Services:** 300 → 373 rows (274 → 294 visible). ✚ 73 new (71 visible; house blessing and
  mass/novena filed hidden under Officiants), ⇢ 36 folded via `merge_canonical_service`
  (tombstones carrying `merged_into`, never deleted — every shop holder moves with them),
  ⛔ 15 hidden, ~200 display names in Philippine terms (Prenup shoot, SDE, Lechon, Host,
  On-the-day coordinator …).
- Keys reused from the closed v2 seed (#7355) wherever T1 adds the same thing: `event_staffing`,
  `ushers_event_staff`, `security_marshals`, `ticketing_registration`, `toga_rental`,
  `exhibit_booth_fabrication`, `videoke_rental`, `team_building_facilitator`. v2's 39/84 tree is not applied.
- Guards: `taxonomy-folder-counts` baseline re-derived (265 → 285); four `no-taxonomy-literals` baseline
  lines +1 with reasons (per-group `Record<WeddingFolder,…>` maps that must name the new group).
- Not in T1: whole-category merges (needs the closed #7348 mechanism), the ✚ inspiration parts,
  the Tags (filter-facet) renames, and the EVENTS_PH_REFINED event scopes.

SPEC IMPACT: TAXONOMY_PH_FULL_2026-11-07.md is now BUILT for groups/categories/services — the
corpus DECISION_LOG needs a "T1 built" row once the owner answers the PR's open questions
(category merges · officiants un-shut for house blessing / novena · "Event services" category).
