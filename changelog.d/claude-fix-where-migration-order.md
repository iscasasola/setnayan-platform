## 2026-11-01 · fix(db): the Where migration alters event_vendors before the category update

`20271300598766` failed in production on deploy (SQLSTATE 55006, "cannot ALTER TABLE event_vendors because it has pending trigger events"): its `service_categories` UPDATE fires deferred triggers that queue events on `event_vendors`, then its ALTER TABLE on `event_vendors` ran in the same transaction. The push rolled back, so prod never applied it (verified: absent from `supabase_migrations.schema_migrations`), and every deploy since was blocked. The file now runs the ALTER TABLE first, the UPDATE after. No other change.

SPEC IMPACT: None
