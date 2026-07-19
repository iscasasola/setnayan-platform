## 2026-07-07 · fix(db): document users.marketing_consent_at provenance

`public.users.marketing_consent_at` (RA 10173 marketing-consent timestamp) was live in
production but had **no committed migration anywhere in the repo** — it was applied directly
to the prod DB, and its orphan ledger row (`20270705000000`) was reverted on 2026-07-07 while
un-jamming the migration pipeline (see the Setnayan-specs DECISION_LOG 2026-07-07 entry). That
left a consent-related column with zero repo/corpus provenance — a compliance-hygiene gap.

Adds an idempotent, additive migration (`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS
marketing_consent_at TIMESTAMPTZ NULL`) that reconstructs the column's canonical definition —
matched exactly to `information_schema` on 2026-07-07 (`timestamptz`, nullable, no default,
identical to the sibling `public_summary_consent_at`). No-op in prod (column already exists);
creates it on fresh DBs (CI shadow, local, restore) so the repo/ledger matches prod.
Non-destructive; no backfill.

SPEC IMPACT: None — closes a documentation/provenance gap only; no product or behavior change.
The ROPA (DPS-01) already records marketing-consent processing.
