## 2026-09-25 · fix(event-hub): the second draft save no longer fails — update first, insert only when new

Every Event Hub Maker save after the first one failed in production with 42501 "permission
denied for table event_site_drafts" (the owner pressing Hide, digest 456793547).
`writeHubDraft` used PostgREST's upsert, which compiles to `ON CONFLICT DO UPDATE SET
event_id = …`; `authenticated` holds UPDATE only on `(draft_json, applied_snapshot)` by
design. It now UPDATEs the allowed columns, INSERTs only when no row exists, and retries the
update on a unique-violation race. Grants unchanged. db-test pins both the refused upsert
shape and the allowed update.

SPEC IMPACT: None
