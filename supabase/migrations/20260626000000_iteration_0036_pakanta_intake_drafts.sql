-- iteration 0036 Pakanta · Wizard Card 17 (order 9.7) intake form persistence.
--
-- Backs the inline 8-question intake form on the Concierge wizard Pakanta
-- card per owner directive 2026-05-25 (CLAUDE.md decision-log):
--   1. Story how you first met
--   2. Engagement Story
--   3. Memorable Story
--   4. What do you call each other
--   5. What story do you want added
--   6. Favorite Singer of Groom
--   7. Favorite Singer of Bride
--   8. Type of Music
--
-- WHY a separate `pakanta_intake_drafts` table (not extending an existing
-- pakanta_orders table):
--   - `pakanta_orders` does not yet exist in production (verified by
--     `grep pakanta_orders supabase/migrations/` returning zero hits)
--   - The wizard card collects intake BEFORE purchase (Skip + Purchase
--     both save the draft) · drafts pre-date orders by definition
--   - Once iteration 0036's full pakanta_orders pipeline lands V1.x,
--     the order flow can copy customer_brief from the matching draft row
--     keyed by event_id · keeps the wizard's "Save & continue later"
--     promise honest even if the host comes back days later
--
-- Shape — one row per (event_id) with the latest 8-question payload as
-- JSONB. Re-submits UPSERT on event_id so the host can iterate without
-- accumulating stale drafts.
--
-- Per [[feedback_setnayan_push_migrations_myself]] · push BEFORE merge so
-- the new server action finds the table on first deploy. This is purely
-- additive (new table · no existing-query risk).

CREATE TABLE IF NOT EXISTS public.pakanta_intake_drafts (
  draft_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  responses     JSONB NOT NULL,
  -- 'draft' = host clicked Skip · 'purchase_pending' = host clicked Purchase
  -- and was redirected to /orders/new but hasn't paid yet · 'purchased' =
  -- linked to a confirmed pakanta_orders row once that table lands V1.x
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'purchase_pending', 'purchased')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One draft per event · the wizard card always edits-in-place. The host
-- can submit again to overwrite their answers.
CREATE UNIQUE INDEX IF NOT EXISTS pakanta_intake_drafts_event_unique
  ON public.pakanta_intake_drafts (event_id);

-- Speed admin queries that scan recently-touched drafts.
CREATE INDEX IF NOT EXISTS pakanta_intake_drafts_updated_idx
  ON public.pakanta_intake_drafts (updated_at DESC);

-- RLS · hosts read + write their own event's draft. Admins read all rows
-- so the back-office Pakanta queue (V1.x) can scan for new intakes
-- without needing the host's session.
ALTER TABLE public.pakanta_intake_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pakanta_intake_drafts_select_host
  ON public.pakanta_intake_drafts;
CREATE POLICY pakanta_intake_drafts_select_host
  ON public.pakanta_intake_drafts
  FOR SELECT
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid()
        AND member_type IN ('couple', 'coordinator')
    )
  );

DROP POLICY IF EXISTS pakanta_intake_drafts_insert_host
  ON public.pakanta_intake_drafts;
CREATE POLICY pakanta_intake_drafts_insert_host
  ON public.pakanta_intake_drafts
  FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid()
        AND member_type IN ('couple', 'coordinator')
    )
  );

DROP POLICY IF EXISTS pakanta_intake_drafts_update_host
  ON public.pakanta_intake_drafts;
CREATE POLICY pakanta_intake_drafts_update_host
  ON public.pakanta_intake_drafts
  FOR UPDATE
  USING (
    event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid()
        AND member_type IN ('couple', 'coordinator')
    )
  );

-- Admin read-all policy (matches the pattern used by other admin-readable
-- iteration tables · e.g. order_refunds).
DROP POLICY IF EXISTS pakanta_intake_drafts_admin_select
  ON public.pakanta_intake_drafts;
CREATE POLICY pakanta_intake_drafts_admin_select
  ON public.pakanta_intake_drafts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND account_type = 'admin'
    )
  );

-- updated_at trigger · matches the canonical tg_set_updated_at pattern
-- used across the corpus (e.g. feature_reviews migration 20260517000000).
CREATE OR REPLACE FUNCTION public.tg_pakanta_intake_drafts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pakanta_intake_drafts_set_updated_at
  ON public.pakanta_intake_drafts;
CREATE TRIGGER pakanta_intake_drafts_set_updated_at
  BEFORE UPDATE ON public.pakanta_intake_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pakanta_intake_drafts_set_updated_at();
