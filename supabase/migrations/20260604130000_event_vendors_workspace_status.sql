-- ============================================================================
-- 20260604130000_event_vendors_workspace_status.sql
--
-- Adds `workspace_status` column to event_vendors so the per-vendor workspace
-- page (PR — claude/vendor-workspace-v2, 2026-05-22) can render the explicit
-- payment-stage stepper underneath the high-level VendorStatus enum.
--
-- Owner directive 2026-05-22 (verbatim):
--   "click finalized vendor → land on dedicated page with conversation +
--    payments + documents + schedules + status (plan_finalized →
--    downpayment → 2nd payment → final · etc.)"
--
-- The existing public.vendor_status enum (defined in 20260513100000_iteration_0006_vendors.sql)
-- captures the coarse-grained lifecycle (`considering` → `shortlisted` →
-- `contracted` → `deposit_paid` → `delivered` → `complete`). The workspace
-- page needs a finer-grained progress signal that tracks payment milestones
-- against the host's payment plan — distinct from the vendor's delivery
-- status. Two reasons for a separate column rather than expanding the enum:
--
--   1. Different cardinality. The workspace status reflects the host's
--      payment-plan progress (downpayment → second payment → final), which
--      can be 2-stage, 3-stage, or N-stage depending on what the host and
--      vendor agreed. The vendor_status enum is a fixed 6-state lifecycle.
--
--   2. Different ownership. Workspace status is host-controlled (the host
--      marks "we paid the downpayment"). Vendor status is a mix of host-set
--      ('considering' / 'shortlisted') and outcome-marked ('delivered' /
--      'complete'). Conflating them in one enum would force every
--      pre-2026-05-22 row to backfill — which we explicitly don't want.
--
-- Both columns are nullable. Pre-2026-05-22 rows stay NULL. The workspace
-- page falls back to the vendor_status enum for the stepper when
-- workspace_status IS NULL (renders the implied state — `contracted` →
-- "Plan finalized · payment pending", `deposit_paid` → "Downpayment paid",
-- `delivered` → "Delivered", `complete` → "Paid in full · delivered").
--
-- Status values (CHECK constraint):
--   - 'plan_finalized'        — host has locked the vendor (contract signed,
--                                no payment yet)
--   - 'downpayment_paid'      — first payment milestone settled
--   - 'second_payment_due'    — between downpayment and final (host can
--                                stamp this when the vendor invoices)
--   - 'second_payment_paid'   — second milestone settled
--   - 'final_payment_due'     — pre-event final-balance window
--   - 'paid_in_full'          — all milestones settled, awaiting delivery
--   - 'delivered'             — vendor delivered the service
--
-- The 7 values cover the most common Filipino-wedding payment patterns:
--   - 2-stage (downpayment + final): plan → downpayment → final_due → paid_in_full → delivered
--   - 3-stage (down + mid + final): plan → downpayment → second_due → second_paid → final_due → paid → delivered
--   - 1-stage (full upfront): plan → paid_in_full → delivered
--
-- Future patterns (4+ milestone plans) can advance through the same enum
-- values multiple times — the workspace UI reads the actual milestone
-- rows from event_vendor_line_items + event_vendor_payments and renders
-- the stepper from THOSE rows when present, falling back to this enum
-- column only when the host hasn't structured milestones yet.
--
-- No data migration. Idempotent. Safe to re-run.
--
-- Reversal recipe:
--   ALTER TABLE public.event_vendors DROP COLUMN workspace_status;
--   DROP INDEX IF EXISTS event_vendors_workspace_status_idx;
-- ============================================================================

BEGIN;

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS workspace_status TEXT
    CHECK (workspace_status IS NULL OR workspace_status IN (
      'plan_finalized',
      'downpayment_paid',
      'second_payment_due',
      'second_payment_paid',
      'final_payment_due',
      'paid_in_full',
      'delivered'
    ));

-- Partial index — only NON-NULL workspace_status rows are interesting for
-- "show all vendors in payment stage X" admin queries that V1.x may surface.
-- Pre-2026-05-22 rows stay NULL and don't bloat the index.
CREATE INDEX IF NOT EXISTS event_vendors_workspace_status_idx
  ON public.event_vendors(event_id, workspace_status)
  WHERE workspace_status IS NOT NULL;

COMMENT ON COLUMN public.event_vendors.workspace_status IS
  'Fine-grained payment-stage progress for the per-vendor workspace page (2026-05-22 owner directive). '
  'Distinct from vendor_status enum which tracks delivery lifecycle. NULL = unset (workspace page falls back to vendor_status). '
  'Known values: plan_finalized · downpayment_paid · second_payment_due · second_payment_paid · final_payment_due · paid_in_full · delivered.';

COMMIT;
