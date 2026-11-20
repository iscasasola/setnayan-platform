-- ============================================================================
-- 🤝 THE SUPPLIER'S LOWEST PRICE IS PRIVATE (owner 19 Nov 2026 — DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS
-- EVERYTHING", the negotiation tools: "Yes, build it"; drawing S9ScH2Ps v3, screen 9).
--
-- A supplier may write down, ONCE per client, the lowest total they would take for this event. Only their own shop's
-- team ever reads it. When they are about to send a counter or a new version of the quote UNDER it, the app shows one
-- quiet line ("Under your lowest, ₱42,500") — never a pop-up, never a block: they decide.
--
-- WHY A TABLE OF ITS OWN, AND NOT A COLUMN ON vendor_proposals:
--   the hosts can read every sent quote row (`vendor_proposals_couple_read`), and a column grant is per ROLE — the
--   hosts and the supplier are both `authenticated`, so no grant can show a column to one and hide it from the other.
--   A row here is reachable ONLY through the shop-team policy below: there is NO host policy and NO admin policy, the
--   same shape as `vendor_client_notes` (private team CRM content, migration 20270507380212).
--
-- ONE ROW PER (shop, event) — the lowest is about the deal with this client, so it carries across every version of
-- the quote instead of being typed again on each one.
--
-- THE NUMBER IS THE SUPPLIER'S OWN INPUT. Nothing writes a default; nothing derives one. No row = no lowest set, and
-- the app then shows no line at all.
--
-- Idempotent / re-runnable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_proposal_lowest (
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The lowest TOTAL they would take, in centavos. Their own number: strictly positive, never defaulted.
  lowest_centavos    BIGINT NOT NULL CHECK (lowest_centavos > 0),
  -- Who last set it (display only — a departed member's number survives them).
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, event_id)
);

-- The event's side of the key (the primary key leads with the shop).
CREATE INDEX IF NOT EXISTS vendor_proposal_lowest_event_idx
  ON public.vendor_proposal_lowest(event_id);

ALTER TABLE public.vendor_proposal_lowest ENABLE ROW LEVEL SECURITY;

-- The shop's own team (owner + members) — read, set, change, clear. Nobody else.
DROP POLICY IF EXISTS vendor_proposal_lowest_org_all ON public.vendor_proposal_lowest;
CREATE POLICY vendor_proposal_lowest_org_all
  ON public.vendor_proposal_lowest FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- NOTE: intentionally NO host / couple policy and NO admin policy. The hosts must never be able to read the number
-- they are negotiating against; Setnayan HQ has no reason to.

-- A signed-out visitor has no business with this table at all.
REVOKE ALL ON public.vendor_proposal_lowest FROM anon;

COMMENT ON TABLE public.vendor_proposal_lowest IS
  'The lowest total a supplier would take from ONE client (shop × event) — their own typed number, private to the shop''s team. Shop-team-only RLS: no host policy, no admin policy. The app only ever uses it to show the supplier one quiet line when a counter or a new quote version is under it; nothing is blocked.';
