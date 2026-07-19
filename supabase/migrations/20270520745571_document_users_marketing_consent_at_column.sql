-- ============================================================================
-- 20270520745571_document_users_marketing_consent_at_column.sql
--
-- PROVENANCE RECONCILIATION — documents a column that ALREADY EXISTS in
-- production but had NO committed migration file anywhere in this repo.
--
-- Background: public.users.marketing_consent_at was applied DIRECTLY to the prod
-- database (bypassing the repo). Its ledger row (version 20270705000000) was
-- discovered as an ORPHAN and reverted on 2026-07-07 while un-jamming the
-- migration pipeline (see Setnayan-specs DECISION_LOG.md 2026-07-07
-- "Prod migration ledger UN-JAMMED"). That left a consent-related column
-- (RA 10173) live in prod with zero repo/corpus provenance — a compliance gap.
--
-- This migration closes that gap by recording the column's canonical definition
-- so the repo/ledger matches prod and any fresh database (CI shadow, local,
-- future restore) gets an identical column.
--
-- Observed prod definition (information_schema, 2026-07-07):
--   public.users.marketing_consent_at  timestamp with time zone  NULL  (no default)
--   — identical shape to the sibling public_summary_consent_at (20260519000000).
--
-- Idempotent + additive (ADD COLUMN IF NOT EXISTS): a NO-OP in prod where the
-- column already exists; creates it on databases that don't have it yet.
-- No backfill: NULL = no marketing consent recorded (consent is timestamped to
-- NOW() when the data subject opts in). Non-destructive — never drops or
-- rewrites any existing value.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.marketing_consent_at IS
  'When the user consented to marketing / promotional communications (RA 10173 § 12(a) consent; policy § 6.2 marketing opt-in; ROPA DPS-01). Timestamped to NOW() at opt-in; NULL = no marketing consent recorded. Provenance: the column was applied directly to prod with no repo migration; this migration (2026-07-07) reconstructs its definition after the orphan ledger row 20270705000000 was reverted during the migration-pipeline un-jam — see DECISION_LOG 2026-07-07. Mirrors the sibling public_summary_consent_at.';

COMMIT;
