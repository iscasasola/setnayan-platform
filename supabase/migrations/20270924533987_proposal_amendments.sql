-- ============================================================================
-- 20270924533987_proposal_amendments.sql
-- Bundled proposal AMENDMENTS for in-chat negotiation (Phase 3).
--
-- WHY THIS EXISTS
--   Owner 2026-07-24: "for proposals / price adjustments, show what the current
--   proposal is and what they want added"; a single request can BUNDLE multiple
--   items (discount + price adjustment + freebies + a specialized ask like
--   'upload raw photos'); the vendor can also offer freebies. This is a richer
--   object than the single-delta change_order: ONE amendment carries MANY items,
--   shown against the current proposal, that the counterparty accepts / counters
--   / declines as a bundle.
--
--   Two tables + a chat_messages.amendment_id FK (mirrors proposal_id /
--   appointment_id / change_order_id). State machine on the amendment row
--   (propose → accepted / declined / withdrawn) via a status='proposed'
--   precondition UPDATE — the SAME single-winner pattern as event_appointments
--   (no RPC). Specialized 'request' items are a checklist: the vendor stamps
--   delivered_at once an accepted request is done.
--
--   ⚠ Ledger settlement is NOT wired here — an accepted amendment is an
--   agreement record; writing the net money delta into event_vendor_line_items
--   is a tracked follow-up (kept out to land this slice safely). Off-platform
--   money, 0% commission — Setnayan never holds funds.
--
--   Gated behind NEXT_PUBLIC_CHAT_NEGOTIATION_V1 (ships dark). RLS at CREATE.
--   Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.proposal_amendments (
  amendment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('M'),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  event_vendor_id     UUID,   -- the booked event_vendors row (ledger context)
  vendor_profile_id   UUID,   -- denormalized for the vendor-side RLS + reads
  thread_id           UUID,   -- the chat thread it was raised in
  -- The proposal it amends (its total is the "current" baseline shown on the
  -- card). Nullable — an amendment can be raised before any proposal exists.
  base_proposal_id    UUID REFERENCES public.vendor_proposals(proposal_id) ON DELETE SET NULL,
  raised_by           TEXT NOT NULL CHECK (raised_by IN ('couple', 'vendor')),
  proposed_by_user_id UUID,
  note                TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  status              TEXT NOT NULL DEFAULT 'proposed'
                        CHECK (status IN ('proposed', 'accepted', 'declined', 'withdrawn')),
  decline_reason      TEXT CHECK (decline_reason IS NULL OR char_length(decline_reason) <= 500),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.proposal_amendment_items (
  item_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id  UUID NOT NULL REFERENCES public.proposal_amendments(amendment_id) ON DELETE CASCADE,
  -- Denormalized event/vendor for direct RLS (no join in the policy).
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID,
  -- discount (−) · addon/price adjustment (+) · freebie (₱0 included) ·
  -- request (₱0 specialized ask, tracked via delivered_at).
  item_kind     TEXT NOT NULL CHECK (item_kind IN ('discount', 'addon', 'freebie', 'request')),
  label         TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  -- Signed pesos for money lines; NULL for freebie/request (₱0). Discounts store
  -- a negative amount; add-ons positive.
  amount_php    NUMERIC(12, 2),
  -- Checklist: when the vendor marks an accepted 'request' item done.
  delivered_at  TIMESTAMPTZ,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposal_amendments_event_status_idx
  ON public.proposal_amendments (event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS proposal_amendment_items_amendment_idx
  ON public.proposal_amendment_items (amendment_id, sort_order);

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS amendment_id UUID
    REFERENCES public.proposal_amendments(amendment_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS chat_messages_amendment_id_idx
  ON public.chat_messages (amendment_id) WHERE amendment_id IS NOT NULL;

ALTER TABLE public.proposal_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_amendment_items ENABLE ROW LEVEL SECURITY;

-- Access = event member (couple/host/coordinator) OR the booked vendor org.
-- Mirrors event_appointments. Reads + writes flow under the caller's session;
-- app code enforces role/counterparty + the status='proposed' single-winner
-- precondition. proposed_by_user_id = auth.uid() is pinned on INSERT.
DROP POLICY IF EXISTS proposal_amendments_read ON public.proposal_amendments;
CREATE POLICY proposal_amendments_read ON public.proposal_amendments
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

DROP POLICY IF EXISTS proposal_amendments_insert ON public.proposal_amendments;
CREATE POLICY proposal_amendments_insert ON public.proposal_amendments
  FOR INSERT TO authenticated
  WITH CHECK (
    proposed_by_user_id = auth.uid()
    AND (
      event_id IN (SELECT public.current_event_ids())
      OR (
        event_id IN (SELECT public.current_vendor_booked_event_ids())
        AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      )
    )
  );

DROP POLICY IF EXISTS proposal_amendments_update ON public.proposal_amendments;
CREATE POLICY proposal_amendments_update ON public.proposal_amendments
  FOR UPDATE TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- Items follow the same access via their denormalized event/vendor.
DROP POLICY IF EXISTS proposal_amendment_items_read ON public.proposal_amendment_items;
CREATE POLICY proposal_amendment_items_read ON public.proposal_amendment_items
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

DROP POLICY IF EXISTS proposal_amendment_items_insert ON public.proposal_amendment_items;
CREATE POLICY proposal_amendment_items_insert ON public.proposal_amendment_items
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- Item UPDATE (checklist: vendor stamps delivered_at) — allowed for either
-- side; app restricts it to the vendor + accepted 'request' items.
DROP POLICY IF EXISTS proposal_amendment_items_update ON public.proposal_amendment_items;
CREATE POLICY proposal_amendment_items_update ON public.proposal_amendment_items
  FOR UPDATE TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR (
      event_id IN (SELECT public.current_vendor_booked_event_ids())
      AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

COMMENT ON TABLE public.proposal_amendments IS
  'Bundled in-chat proposal amendment (negotiation Phase 3) — one row carries '
  'many proposal_amendment_items (discount/addon/freebie/request) shown against '
  'the base proposal. Propose→accept/decline/withdraw via a status precondition '
  '(single-winner, no RPC). Ledger settlement is a follow-up. Gated by '
  'NEXT_PUBLIC_CHAT_NEGOTIATION_V1.';

COMMIT;
