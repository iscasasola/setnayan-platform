## 2026-08-24 · security(db): anon grant sweep batch 6 — the admin desk's twelve tables give up their public key

Migration `20271161191013_anon_grant_batch6.sql` revokes all `anon` privileges on
12 tables nothing anonymous ever uses: `chat_message_flags`,
`discount_code_eligible_users`, `discount_code_redemptions`, `discount_codes`,
`platform_compliance_facts`, `platform_expenses`, `social_evergreen_items`,
`social_posts`, `social_publish_settings`, `token_redemptions_log`,
`vendor_recommendation_feedback`, `vendor_review_appeals` — including the three
tables batch 4/5 notes explicitly held back for a then-open PR.

All six gates re-run against production 2026-08-24 (grant held · no anon policy ·
not a security_invoker view base · no anon-executable invoker function names them,
with the scan proved able to match · every query site admin-client or
authenticated-first · no object re-creation). Dry-run in a rolled-back prod
transaction moved all 12 SELECT true → false. Guarded forever by
`CLOSED_IN_BATCH_6` in `apps/web/tests/db/anon-table-grants-closed.db.test.ts`.

SPEC IMPACT: None
