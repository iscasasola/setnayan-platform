## 2026-06-20 · feat(seed): Maria & Jose public sample event — vendors + services

Builds the canonical public sample event (foundation flags shipped in #1893). Applied to prod via `supabase db query` (statement-by-statement, ledger-drift workflow); committed here as a re-runnable artifact.

- **`scripts/seed-sample-event-maria-jose.sql`** — idempotent, prod-safe (keyed to a fixed `demo_batch_id`; vendor block deletes-by-batch then re-inserts). Creates the `is_sample` event `maria-and-jose` (owner = couple/host → free services via comp rule) + **38 demo vendors / 39 services across 12 categories**, all `is_demo=TRUE` (vendors AND services — hidden from every search surface) and shortlisted to the event via `event_vendors`. Mix per the owner's ask: 36 single-service, 1 multi-service studio (photo+video), 1 all-in bundle.

Not searchable (the existing `is_demo` exclusion hides them from `/explore` + the in-dashboard couple search); present only inside Maria & Jose's shortlist. Next: guests/seating/budget/mood/Papic placeholders, then the curated public tour.

SPEC IMPACT: None (demo/sample data only; no SKU / schema / pricing / branding change).
