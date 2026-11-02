## 2026-10-22 · fix(people): shops owned and named before the rule get their business alaga

Owner 2026-10-22 ("A"), following #6779: the shops that were already owned and named before
`ensureBusinessAlaga` shipped never pass through a door again, so their owners still had no
"For · <shop>" to pick and People said they cared for nothing.

- Migration `20271283792997_old_shops_get_their_business_alaga.sql` — ONE idempotent INSERT:
  every owned (`vendor_profiles.user_id` set, owner not deleted), named (non-blank
  `business_name`) shop with no `(owner, shop)` row in `dependents` gets exactly the row
  `buildBusinessAlagaInsert` builds — `dependent_kind = 'business'`, name trimmed and cut to 128,
  no birth date / sex / religion / relationship / consent stamp. Gated on the
  `dependent_minor_profiles` control being `active` (the DB half of `peopleGateOpen`; the env half
  `NEXT_PUBLIC_DEPENDENT_PEOPLE` is not readable from SQL). `NOT EXISTS` + `ON CONFLICT` on
  `dependents_owner_vendor_profile_key`, so a re-run is a no-op; never renames an existing record.
  Post-condition RAISEs if a gated-open run leaves a live owned, named shop without its record.
  Generic rule — no ids in the file.
- Guard: `apps/web/tests/db/old-shops-are-loved-ones-too.db.test.ts` (PGlite replay) — gate closed
  writes nothing; a shop with none gets one, field-for-field the helper's row; a shop that has one is
  untouched; empty / whitespace / ownerless / deleted-owner shops get none; a second run changes
  nothing. Five sabotages, each red.
- Prod (read-only SELECT, 2026-10-22): 3 owned named shops, 1 with its record, 2 without — both
  `is_demo`, from July, neither claimed. The migration is expected to write 2 rows.

SPEC IMPACT: None
