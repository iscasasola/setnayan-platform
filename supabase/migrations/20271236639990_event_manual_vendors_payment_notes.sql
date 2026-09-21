-- ============================================================================
-- 20271236639990_event_manual_vendors_payment_notes.sql
--
-- WHERE THE COUPLE SENDS THE MONEY to a supplier they added themselves — as a
-- NOTE, and deliberately inert.
--
-- ⚠ THE PAYMENT *PLAN* IS NOT HERE, AND AN EARLIER DRAFT OF THIS MIGRATION HAD
-- IT AS A SECOND TEXT COLUMN (`payment_terms_note`). Owner, 2026-09-20:
-- "Payment Plan Must set date for until the payment is fully paid. just like
-- on our quote maker." A plan with due dates is something the couple is
-- TRACKED against — it belongs in `event_vendor_payment_plan`, the table that
-- already drives the Payments surface, written through the quote maker's own
-- `computePlanInstances`. Free text cannot carry a due date, and shipping one
-- beside a real schedule would be two sources for one fact. The column was
-- removed before it merged rather than deprecated after.
--
-- Owner, 2026-09-20, in three passes that each narrowed the shape:
--   1. "payment methods · payment options" — among the things a couple should
--      be able to record for a supplier they added.
--   2. "payment method and payment option can be entered manually. but this is
--      just manual, so nothing is searched added. meaning no connection to the
--      user's event. it needs to be imported to a vendor first."
--   3. "payment options doesn't need to be a qr. just a note so the user can
--      rely on the payment method."
--
-- ── WHY TWO TEXT COLUMNS AND NOT A TABLE ──────────────────────────────────
-- The obvious homes were both WRONG, and the owner's second message is what
-- ruled them out:
--
--   · `vendor_payment_methods` is keyed on `vendor_profile_id`. A self-added
--     supplier has no profile, so the couple cannot write there at all.
--   · `event_vendor_payment_plan` was the tempting one — it is host-writable
--     and per-booking — and it is exactly what "no connection to the user's
--     event" forbids. That table IS the event's money: it drives the Payments
--     schedule, what the couple is shown as owed, and the settle/clear path.
--     Writing a couple's private note into it would have turned a memo into an
--     obligation.
--
-- What is left is a note. Two nullable TEXT columns on the row that already
-- holds the couple's other notes about this supplier, inheriting its RLS
-- (`event_manual_vendors_host_all`) rather than opening a new surface.
--
-- ⚠ NO QR, NO ACCOUNT NUMBER PARSING, NO STRUCTURE. `vendor_payment_methods`
-- carries `qr_r2_key`, `decoded_destination`, `moderation_status` — because a
-- vendor PUBLISHES those to strangers and we moderate them. This is a couple
-- writing down what their own supplier told them. Structuring it would invite
-- exactly the platform behaviour the owner excluded, and a moderation column
-- nobody moderates is worse than plain text.
--
-- ── WHY THIS TABLE AND NOT `event_vendors` — AND A CORRECTION ────────────
-- `host_inclusions` / `covers_plan_groups` live on `event_vendors`, so that
-- looked like the obvious home, on the strength of a figure this codebase
-- repeats: "43 of 45 off-platform rows carry BOTH ids NULL"
-- (lib/supplier-invite-eligibility.ts, 2026-09-03). Read plainly, that says a
-- contact card is unreachable for almost every self-added supplier.
--
-- 🔑 IT DOES NOT. Re-measured 2026-09-20, grouped by creation instant:
--
--   2026-09-20 09:35:27   1 row   manual row: 1   source host_manual
--   2026-09-20 09:27:40   1 row   manual row: 1   source host_manual
--   2026-09-15 08:15:40   1 row   manual row: 0   source host_manual
--   2026-06-20 12:46:35   3 rows  manual row: 0   source NULL
--   2026-06-20 10:41:58   2 rows  manual row: 0   source NULL
--   2026-06-20 10:41:15  36 rows  manual row: 0   source NULL
--   2026-06-18 23:24:46   1 row   manual row: 0   source host_manual
--
-- FORTY-ONE of the forty-three are SEED FIXTURES — three identical timestamps,
-- `source` NULL. Among rows a couple actually created (`source =
-- 'host_manual'`) it is 2 with and 2 without, and both added through today's
-- Add-a-contact modal HAVE the row, because that modal's two-step always
-- creates it. Re-measure, never trust this block:
--
--   select date_trunc('second', created_at), count(*),
--          count(*) filter (where manual_vendor_id is not null), 
--          string_agg(distinct source, ',')
--     from public.event_vendors
--    where archived_at is null and marketplace_vendor_id is null
--    group by 1 order by 1 desc;
--
-- ⚖ The 2026-09-03 ruling it was cited for is STILL RIGHT — an invite must not
-- depend on a contact card. What is wrong is reading 43/45 as evidence about
-- real couples. So the service card stays on ONE row, here, beside the contact
-- details and the address it belongs with; and the save path CREATES this row
-- when a booking predates it, rather than the card silently not rendering.
--
-- ── WHEN IT STOPS BEING INERT ─────────────────────────────────────────────
-- "it needs to be imported to a vendor first." Once the supplier claims their
-- account (`applyClaimAutoLink` stamps `marketplace_vendor_id`), THEIR
-- published methods are the truth and these notes stop being shown as current.
-- Nothing in this migration does that — it is a render rule, in the couple's
-- workspace, next to the one predicate that already answers "do they have an
-- account" (`lib/supplier-invite-eligibility.ts`).
-- ============================================================================

BEGIN;

ALTER TABLE public.event_manual_vendors
  ADD COLUMN IF NOT EXISTS payment_method_note TEXT;

-- Idempotent, and the only thing the database can honestly enforce about a
-- free-text note: present means non-blank. Same shape as the address CHECK in
-- 20271236460588 and the three NOT NULL columns in 20260604080000.
ALTER TABLE public.event_manual_vendors
  DROP CONSTRAINT IF EXISTS event_manual_vendors_payment_method_note_not_blank;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_payment_method_note_not_blank
  CHECK (payment_method_note IS NULL OR length(trim(payment_method_note)) > 0);

COMMENT ON COLUMN public.event_manual_vendors.payment_method_note IS
  'Free text: where the couple sends money to a supplier THEY added (e.g. '
  '"GCash 0917 555 1234 — Maria Santos"). A NOTE, not a payment rail: nothing '
  'reads it to move money, create a payment, or fill a schedule. Superseded on '
  'screen once the supplier claims an account and publishes their own '
  'vendor_payment_methods. Owner 2026-09-20: "just a note so the user can rely '
  'on the payment method."';

COMMIT;
