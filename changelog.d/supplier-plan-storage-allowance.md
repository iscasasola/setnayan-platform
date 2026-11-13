## 2026-11-13 · feat(supplier-plans): the plan holds storage — Solo 5 GB · Pro 10 GB · Ultra 15 GB

Owner 2026-11-13 (specs DECISION_LOG, commit ce2d0a8 "plan storage"). Until now `storageAllowanceBytes()` returned
null for every plan, so no allowance was shown or enforced.

- **The number** — `TIER_CAPS[t].storageBytes` in `lib/vendor-tier-caps.ts`, next to the other caps: Solo 5 GB · Pro
  10 GB · Ultra 15 GB (decimal GB, the GB `storageWords` prints). Free and Free · Verified keep what they had: `null`,
  no allowance, nothing drawn. `storageAllowanceBytes()` now reads it (rule in `lib/supplier-storage.ts`).
- **SQL twin** — `vendor_tier_limit(…,'storage_gb')` 5 · 10 · 15, NULL for Free/Verified (migration
  `20271342883073_supplier_plan_storage_allowance`, copied verbatim from the latest definition plus the one arm).
- **What counts** — `vendor_storage_used_bytes(shop)` (service role only): each stored copy (`supplier_media`) that a
  filed `event_supplier_files` row still points at, once. Removing a file from its events makes room; nothing is deleted.
- **Shown** — the Plan gets a "Storage" row ("1.2 GB of 5 GB used"; "Couldn’t read what you store just now — nothing is
  lost" when the read fails, never 0) and a "Storage for your event files" line under "What <plan> gives you". The limits
  sheet's storage floor (built earlier, dormant) now draws for a downgrade into a smaller allowance.
- **Refused** — `/api/upload` checks before signing the PUT for `supplier-files/<shop>/…` (413 + the sentence + a link
  to the Plan; 503 when it cannot check — fail closed). The database refuses the same new bytes on every other path
  (`enforce_supplier_storage_allowance` on `event_supplier_files`), and the files action turns that into the same
  sentence. Grandfathered: a shop already over keeps every file. The files action now records the MEASURED size.
- The paid packs `vendor_storage_5/10/15gb` stay inactive; nothing offers or prices them.
- Tests: `lib/supplier-storage.test.ts` (numbers, refusal, failed read) · `tests/db/supplier-storage-allowance.db.test.ts`
  (parity with TIER_CAPS, refusal under RLS, links, room, grandfathering, grants).

SPEC IMPACT: None new — implements the 2026-11-13 DECISION_LOG ruling. Open for the owner: Free and Verified have no
allowance (unlimited) while Solo has 5 GB; the Plan copy for them reads "No limit on this plan today". The changed Plan
and files-board copy needs a Fable prototype and the owner's OK before it ships (before/after in the PR body).
