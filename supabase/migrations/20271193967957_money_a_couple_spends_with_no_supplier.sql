-- money_a_couple_spends_with_no_supplier
-- ============================================================================
-- A COST CAN EXIST WITH NOBODY ON THE OTHER SIDE OF IT. (BA7, 2026-09-03.)
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────────
-- `event_vendor_line_items.vendor_id` is `UUID NOT NULL REFERENCES
-- event_vendors(vendor_id)` (20260513110000). Every peso the couple records
-- must hang off a supplier row, so a couple cannot write down their first ₱
-- until they invent one — and /budget says so out loud: "No vendors yet. Add a
-- vendor first, then come back here to itemize costs."
--
-- The taxonomy already NAMES costs the schema cannot hold. `rings`, `attire`,
-- `officiant`, `wedding_paperwork` and `travel_honeymoon` are live plan groups
-- in `lib/wedding-plan-groups.ts`; the budget page recommends a rings budget
-- (`budget_leaf_benchmarks.rings` = ₱40,000, measured in production
-- 2026-09-03) and offers no way at all to record buying rings. Nobody
-- supplies you a marriage licence fee, the tips you hand out on the day, or
-- the ang pao the Chinese-tradition card on that very page describes.
--
-- ⚠ THE BRIEF THAT ORDERED THIS OVERSTATED ONE HALF OF IT, so the correction
-- is written where the next session will look: of those five groups only
-- THREE carry a seeded benchmark (attire ₱40,000 · officiant ₱15,000 · rings
-- ₱40,000). `wedding_paperwork` and `travel_honeymoon` have no row in
-- `budget_leaf_benchmarks` AT ALL — not a NULL, no row. Re-measure with
--   select plan_group_id, benchmark_php from public.budget_leaf_benchmarks;
-- never from this comment. It does not change the defect (both are still
-- unrecordable) but it does change what the ledger can print beside them:
-- BA3's `plannedFrom()` folds them to `null`, i.e. "no typical price yet".
--
-- ── WHY A NEW TABLE AND NOT `vendor_id NULL` ───────────────────────────────
-- Relaxing the NOT NULL was the smaller diff and the wrong one:
--   · Ten shipped readers of `event_vendor_line_items` assume a vendor
--     (lib/budget.ts, preparation.ts, upcoming-items.ts, notifications.ts, the
--     vendor-dashboard client actions, the change-order settlement …). A NULL
--     would flow silently into every one of them.
--   · `event_vendor_payments.vendor_id` is NOT NULL too, so the paid half
--     would need the same relaxation and the same blast radius.
--   · A vendor-attached line takes its category from the VENDOR
--     (`bucketForVendor`). A `plan_group_id` column on that table would be a
--     SECOND source of truth for one fact on the same row, which is the exact
--     defect this repo keeps paying for.
-- So: a cost WITH a supplier keeps going down the existing event_vendors +
-- event_vendor_line_items path, a cost WITHOUT one lives here, and a peso can
-- never be in both. That is the counting law ("one peso, one row, one
-- costKey") kept structurally instead of by everyone remembering it.
--
-- ── WHY paid_php IS A COLUMN AND NOT A LEDGER OF PAYMENT ROWS ──────────────
-- `event_vendor_payments` exists because money to a SUPPLIER has a
-- counterparty who may dispute it, so it carries method, reference, proof and
-- an acknowledgement trail. A marriage licence fee has none of that: there is
-- nobody to reconcile with. Two numbers — what it cost, what has been handed
-- over — are exactly the two the four owner-locked ledger columns need
-- (Agreed · Paid, with Owed = Agreed − Paid). A second payment-log mechanism
-- for money that has no second party would be a copy of a money rule, and two
-- copies of a money rule always drift.
--
-- ── THE INVARIANT ──────────────────────────────────────────────────────────
--     committed + overpaid === paid + stillOwed
-- `budget-truth.ts` settles each of these rows NET, the same way it settles a
-- vendor: owed = max(0, amount − paid), overpaid = max(0, paid − amount).
-- max(0, c−p) + c ≡ max(0, p−c) + p for all real c, p, so the identity holds
-- for every sign of every input this table can hold.
--
-- RLS at CREATE TABLE. Pattern B (per-event collaborative data,
-- RLS_Policy_Pattern.md §3) narrowed to the couple, exactly as its nearest
-- sibling `event_vendor_line_items` is narrowed in production: couple read +
-- couple write via `current_couple_event_ids()`, plus the budget-area
-- moderator read via `moderator_area_level(event_id,'budget')`. What is
-- deliberately ABSENT is the fourth policy that table has — `vendor_read`.
-- There is no vendor here to grant it to, and a supplier has no business
-- reading what the couple spent on rings.
--
-- Idempotent + re-run safe. No enum change, so a plain transaction is fine.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_costs (
  cost_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL
                     REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- Where this lands in BA3's ledger. A `PLAN_GROUPS` id from
  -- lib/wedding-plan-groups.ts, or the resolver's `OTHER_BUCKET` ('other')
  -- when nothing fits. TEXT, not an enum or an FK, for the same reason
  -- `budget_leaf_benchmarks.plan_group_id` is TEXT: the taxonomy's home is
  -- TypeScript and a database enum would be a second copy of it that can
  -- disagree. `computeEventMoney` validates the value on the way out and
  -- falls back to 'other' rather than dropping the money -- an unmappable
  -- category must never make a peso disappear.
  plan_group_id      TEXT NOT NULL
                     CHECK (char_length(btrim(plan_group_id)) BETWEEN 1 AND 64),

  -- What it was for, in the couple's own words. 64 to match
  -- event_vendor_line_items.label, so the two read the same on one page.
  label              TEXT NOT NULL
                     CHECK (char_length(btrim(label)) BETWEEN 1 AND 64),

  -- What it cost. `>= 0`, matching event_vendor_line_items.amount_php: a
  -- credit is a thing a SUPPLIER issues you (that is what vendor_change_orders
  -- is for), and there is no supplier here to issue one.
  amount_php         NUMERIC(12,2) NOT NULL CHECK (amount_php >= 0),

  -- What has actually been handed over. NOT capped at amount_php on purpose:
  -- overpaying is a real thing that happens and the resolver's job is to SAY
  -- so (`overpaid`), never to clamp it silently. A clamp here would make the
  -- lie unrepresentable AND undetectable, which is worse.
  paid_php           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_php >= 0),

  due_date           DATE,

  note               TEXT
                     CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 280),

  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The resolver reads every cost for one event, ordered oldest-first, which is
-- the only access path this table has.
CREATE INDEX IF NOT EXISTS event_costs_event_idx
  ON public.event_costs (event_id, created_at);

ALTER TABLE public.event_costs ENABLE ROW LEVEL SECURITY;

-- 🔒 A NEW TABLE IN `public` IS BORN OPEN, NOT CLOSED. `ALTER DEFAULT
-- PRIVILEGES` in this schema grants the full `arwdDxtm` set to BOTH `anon` and
-- `authenticated` on every newly created relation -- the finding
-- 20271177403026 measured during its own rolled-back dry run. RLS with no anon
-- policy means anon reads zero rows, but a grant nobody revoked is debt
-- somebody pays later, and this table holds a couple's household spending.
--
-- 🔑 REVOKED AT TABLE LEVEL, which is what also drops column grants. A
-- column-by-column revoke leaves the NEXT column granted while
-- `has_table_privilege` answers FALSE -- a table-level audit then reads the
-- table as closed while it is open.
REVOKE ALL ON public.event_costs FROM PUBLIC;
REVOKE ALL ON public.event_costs FROM anon;
REVOKE ALL ON public.event_costs FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_costs TO authenticated;

-- COUPLE — read their own costs.
DROP POLICY IF EXISTS event_costs_couple_read ON public.event_costs;
CREATE POLICY event_costs_couple_read
  ON public.event_costs FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- COUPLE — write them. FOR ALL with the same predicate on both sides, the
-- shape `event_vendor_line_items_couple_write` already uses: without the WITH
-- CHECK half a couple could INSERT a row stamped with somebody else's
-- event_id and then be unable to see it.
DROP POLICY IF EXISTS event_costs_couple_write ON public.event_costs;
CREATE POLICY event_costs_couple_write
  ON public.event_costs FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- DELEGATE — read only, and only one holding the BUDGET area. Byte-identical
-- to `event_vendor_line_items_moderator_read`, because a coordinator who can
-- see what the couple owes their caterer and cannot see the ₱40,000 they spent
-- on rings is looking at a budget with a hole in it. A delegate never WRITES
-- the couple's money: there is no moderator write policy on the sibling table
-- and there is none here.
DROP POLICY IF EXISTS event_costs_moderator_read ON public.event_costs;
CREATE POLICY event_costs_moderator_read
  ON public.event_costs FOR SELECT TO authenticated
  USING (public.moderator_area_level(event_id, 'budget') = ANY (ARRAY['view', 'edit']));

-- ⛔ THERE IS NO VENDOR POLICY, ON PURPOSE. `event_vendor_line_items` carries a
-- fourth policy (`vendor_read`) so a booked supplier can see the milestones
-- that concern them. This table's whole subject is money with NO supplier;
-- there is nobody to grant it to, and granting it would show a caterer the
-- couple's ring budget.

COMMENT ON TABLE public.event_costs IS
  'A cost the couple records with NO supplier on the other side of it -- rings, the marriage licence fee, tips, ang pao, the honeymoon (BA7, 2026-09-03). Exists because event_vendor_line_items.vendor_id is NOT NULL, so before this a couple could not write down their first peso without first inventing a vendor row. A cost that DOES have a supplier still goes down the event_vendors + event_vendor_line_items path -- naming a supplier on the /budget form creates that vendor row LOCKED (status contracted), mirrors it into the couple''s Merkado and returns a claim QR -- so one peso is never in both places. Read by resolveEventMoney (lib/budget-truth.ts) as MoneySource ''event_cost'' and bucketed by plan_group_id into BA3''s per-category ledger.';

COMMENT ON COLUMN public.event_costs.plan_group_id IS
  'A PLAN_GROUPS id from lib/wedding-plan-groups.ts, or ''other''. TEXT rather than an enum for the same reason budget_leaf_benchmarks.plan_group_id is TEXT -- the taxonomy lives in TypeScript and a database copy of it would be a second definition that can disagree. An unrecognised value is bucketed to ''other'' by the resolver, never dropped: a mis-typed category must not make money disappear.';

COMMENT ON COLUMN public.event_costs.paid_php IS
  'What has actually been handed over against this cost. Deliberately NOT capped at amount_php: overpayment is real, and the resolver''s job is to report it (EventMoney.overpaid + the overpaid_cost warning), never to clamp it silently. Not a payment LOG -- money with no counterparty has nothing to reconcile, so it carries no method, reference or proof the way event_vendor_payments does.';

COMMIT;
