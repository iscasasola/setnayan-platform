# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(db): link guests to their person node by account (Phase 1)

Owner (2026-07-05): *"guest list can have names without links — that is fine. only those who created accounts will be linked."* The linking signal is **account association**, not email/name guessing. Additive, adults-only, no counsel gate.

- **`supabase/migrations/20270514584245_person_spine_link_guest_to_account_person.sql`**:
  - `public.link_guest_to_account_person()` + `AFTER INSERT OR UPDATE OF (user_id, guest_id, member_type)` trigger on `event_members`. When a guest **joins an event with an account** (`member_type='guest'` + `user_id` + `guest_id`), the guest's row gets `person_id` = that account holder's person node (from self-claim). **Name-only guests stay unlinked** — exactly the owner's rule.
  - Backfill for existing account-associated guests (0 today; future-proof, idempotent).

**Verified against prod in a rolled-back transaction:** fn + trigger + backfill applied; a fabricated "guest joins with an account" (`event_members` insert) fired the trigger and correctly set `guests.person_id` to the account's person (a `DO`-block assertion that `RAISE`s on mismatch — passed). `ROLLBACK` left prod clean (0 linked, trigger gone). Idempotent; complements the email-anchored resolver (`20270514555975`) — together they cover *email-matched* and *joined-with-account* guests, while name-only guests remain unlinked.

SPEC IMPACT: None new — Phase 1 of the locked person-spine plan; additive, account-signal linking.
