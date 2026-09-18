## 2026-09-18 · fix(services): the database refuses a card kind in no known vocabulary (SUP-21)

- `vendor_services.category` is plain TEXT, and `save_vendor_service` validates nothing, so `parseCategory()` was the only fence. New trigger `trg_before_vendor_services_kind_is_known` (migration `20271234232465`) refuses a kind that is not in the `vendor_category` enum, `canonical_service_taxonomy`, `service_categories` or `canonical_service_schemas`. Those are the sources the card-naming trigger already reads, plus the legacy enum.
- **A trigger, not a CHECK:** leaves are admin-managed and become card kinds with no deploy (owner 2026-08-28), and a CHECK cannot read a table. Nothing is hard-coded, so a later enum value or leaf can't be dropped.
- Checks run on INSERT, and on UPDATE only when `category` changes. Both live prod rows (`live_band`, `host_mc`) are legal. `host_mc` is a tree node only.
- Fixtures: `service-card-record` (`hair_makeup`, `coordination`, `lights_sounds`, `florist_2`) and `a-full-card-leaves-bench-search` (`caterer`, `hair_and_makeup`) used kinds in no vocabulary. They now use real enum keys. The full CI DB replay showed no other test inserting an unknown kind. The two tests that deliberately stand up an unmapped kind, to prove the naming fallback, switch the trigger off for that one insert. They now represent a row written before the fence.
- New `a-card-kind-must-be-a-known-word.db.test.ts`, including a drop-the-trigger sabotage case.
- That file also inserts every `VENDOR_CATEGORIES` key (imported, not re-typed) and requires none to be refused. That list and the live coverage leaves are the only kinds `parseCategory()` lets the app write. Neither `caterer` nor `hair_and_makeup` is written as a `vendor_services.category` anywhere in app code, and prod holds 0 rows the trigger would refuse (measured 2026-09-19). Sabotage-proved: with the enum arm disabled, the test goes red and lists the refused keys.

SPEC IMPACT: None
