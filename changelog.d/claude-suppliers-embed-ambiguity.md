## 2026-11-12 · fix(db): /suppliers and /explore fail — one embed path from a service card to its shop

Live /suppliers drew "Something on our end didn't work." (digest 1065388292) and /explore failed the same read.
Vercel log: `PGRST201 Could not embed because more than one relationship was found for 'vendor_services' and
'vendor_profiles'`. Cause: `20271337268841_service_card_opens.sql` gave `vendor_service_card_view_days` FKs to both
tables with both columns in its primary key, which PostgREST reads as a many-to-many junction — so every
`vendor_services → vendor_profiles(...)` embed in the app had two paths. Fix: a migration drops the ledger's
`vendor_profile_id` FK (the writer already pins the shop; deletion still cascades through `vendor_service_id`).
New guard `tests/db/one-embed-path-services-to-shops.db.test.ts` fails on any table whose PK holds FKs to both.

SPEC IMPACT: None
