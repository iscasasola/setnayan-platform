-- A SHOP SAVES A PAY PLAN ONCE AND USES IT ON OTHER CARDS — Card Maker HYBRID part 2 (schema).
--
-- Rulings (spec corpus DECISION_LOG + prototypes/service_card_maker_HYBRID_MAP_2026-11-17.md):
--   • 2026-11-17 "a supplier's own payment plan, made once, used on every card": name it · "Save as my plan" ·
--     "Use on other cards…" · editing a plan that is on more than one card asks ONCE: "Change it on all N cards,
--     or just this one?" · Templates › Payment Strategies lists it; Delete → "Cards keep their copy".
--   • 2026-11-17 "Card maker: wizard + form view + Saved library" (pay plans get a saved place in Shop).
--   • 2026-11-17 the four template kinds are named Quick Forms · Discounts and Promos · Payment Strategies ·
--     Availability — this table is the store behind "Payment Strategies".
--   • 2026-11-18 "extend the app's one-page maker" — the plan is picked inside the shipped CanvasMaker's
--     Payment schedule group, not in a step of the six-step drawing.
--
-- THE SHAPE, AND WHY NOTHING THAT READS A SCHEDULE CHANGES:
--   A card keeps its OWN rows in vendor_service_payment_schedules, exactly as today — the couple's plan, the
--   booking lock, the no-show terms and copy_vendor_service_to_branch all keep reading the card's rows. The plan
--   is the saved SOURCE those rows were copied from, and vendor_services.pay_plan_id says "this card follows
--   plan X". So:
--     • "All N cards"   → apply_vendor_pay_plan() rewrites the rows of every card that follows the plan;
--     • "Just this one" → the card's pay_plan_id is cleared; its rows stay as they are (its own copy);
--     • Delete          → retired_at is set (Undo clears it); cards keep their rows. ON DELETE SET NULL covers a
--                         hard delete too, so a card is never left pointing at nothing.
--   One fact, one home: the rows a couple pays by live only on the card. The plan never becomes a second answer
--   to "how does this card get paid".
--
-- RLS at CREATE TABLE time — Pattern C (vendor-team-scoped), the same helper vendor_services_manage uses
-- (current_vendor_profile_ids(): the owner always, plus team admins), plus the is_admin() lane. NOT public:
-- couples read the card's own schedule rows, never the shop's library.
--
-- Data: none. Ships EMPTY — every plan is one a supplier saves.
BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_pay_plans (
  pay_plan_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- "Name this plan, like My 3-step plan" (the drawing's box).
  name              TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- The rows, in order, in the SAME shape as vendor_service_payment_schedules (seq = array index):
  --   [{ "label": "Reservation fee", "amount_kind": "percent"|"fixed",
  --      "percent_bps": 3000 | null, "amount_centavos": 500000 | null,
  --      "due_anchor": "on_lock"|"before_event"|null, "due_offset_days": 30 | null,
  --      -- first row only (the no-show terms, as on seq 0 of a card):
  --      "cancellation_terms": "…", "downpayment_non_refundable": true,
  --      "refund_window_days": 7, "no_show_forfeit": true }, …]
  -- Validated row by row by the app's parsePaymentScheduleForm before it is written, and again by the CHECKs
  -- of vendor_service_payment_schedules when apply_vendor_pay_plan copies it onto a card.
  items             JSONB NOT NULL
                    CHECK (jsonb_typeof(items) = 'array'
                           AND jsonb_array_length(items) BETWEEN 1 AND 12),   -- MAX_SCHEDULE_ITEMS
  retired_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Two live plans of one shop never share a name (the picker lists them by name).
CREATE UNIQUE INDEX IF NOT EXISTS vendor_pay_plans_live_name_uidx
  ON public.vendor_pay_plans (vendor_profile_id, lower(btrim(name)))
  WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS vendor_pay_plans_vendor_idx
  ON public.vendor_pay_plans (vendor_profile_id);

ALTER TABLE public.vendor_pay_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_pay_plans_manage ON public.vendor_pay_plans;
CREATE POLICY vendor_pay_plans_manage
  ON public.vendor_pay_plans FOR ALL
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_pay_plans_admin_all ON public.vendor_pay_plans;
CREATE POLICY vendor_pay_plans_admin_all
  ON public.vendor_pay_plans FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.vendor_pay_plans FROM anon;
-- Retire, never delete, from a browser: Undo needs the row.
GRANT SELECT, INSERT, UPDATE ON public.vendor_pay_plans TO authenticated;

COMMENT ON TABLE public.vendor_pay_plans IS
  'A shop''s saved, named pay plans — "Payment Strategies" (DECISION_LOG 2026-11-17). The SOURCE a card''s schedule rows are copied from; the card keeps its own rows in vendor_service_payment_schedules. vendor_services.pay_plan_id marks the cards that follow a plan. retired_at = deleted from the library (Undo clears it); cards keep their copy.';

-- ── The card says which plan it follows ────────────────────────────────────
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS pay_plan_id UUID
    REFERENCES public.vendor_pay_plans(pay_plan_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_services_pay_plan_idx
  ON public.vendor_services (pay_plan_id)
  WHERE pay_plan_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_services.pay_plan_id IS
  'The saved pay plan (vendor_pay_plans) this card follows, or NULL = the card''s own schedule. The card''s rows in vendor_service_payment_schedules stay the truth a couple pays by; this only says where they came from, so "Change it on all N cards" can find the N. ON DELETE SET NULL: the card keeps its copy.';

-- A card may only follow a plan of ITS OWN shop. A trigger, not a CHECK: it reads another table.
CREATE OR REPLACE FUNCTION public.a_card_follows_only_its_own_shops_pay_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pay_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_pay_plans p
     WHERE p.pay_plan_id = NEW.pay_plan_id AND p.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'That pay plan belongs to another shop.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_card_follows_only_its_own_shops_pay_plan ON public.vendor_services;
CREATE TRIGGER a_card_follows_only_its_own_shops_pay_plan
  BEFORE INSERT OR UPDATE OF pay_plan_id, vendor_profile_id ON public.vendor_services
  FOR EACH ROW EXECUTE FUNCTION public.a_card_follows_only_its_own_shops_pay_plan();

-- ── "Use on other cards…" and "Change it on all N cards" — one call, one transaction ──
-- Copies the plan's rows onto each named card (replace-all, the same replace save_vendor_service does) and marks
-- the card as following the plan. Cards of another shop are skipped, never touched. Returns how many cards now
-- carry the plan. A booking already made keeps its own snapshot (a-card-price-edit-never-rewrites-a-booking).
CREATE OR REPLACE FUNCTION public.apply_vendor_pay_plan(
  p_vendor_profile_id UUID,
  p_pay_plan_id       UUID,
  p_service_ids       UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
  v_ids   UUID[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_vendor_profile_id NOT IN (SELECT public.current_vendor_profile_ids()) THEN
    RAISE EXCEPTION 'Only this shop can use its pay plans.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT items INTO v_items FROM public.vendor_pay_plans
   WHERE pay_plan_id = p_pay_plan_id AND vendor_profile_id = p_vendor_profile_id AND retired_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That pay plan is not one of yours.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COALESCE(array_agg(vendor_service_id), '{}') INTO v_ids
    FROM public.vendor_services
   WHERE vendor_service_id = ANY (COALESCE(p_service_ids, '{}'))
     AND vendor_profile_id = p_vendor_profile_id;
  IF cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.vendor_service_payment_schedules WHERE vendor_service_id = ANY (v_ids);

  INSERT INTO public.vendor_service_payment_schedules (
    vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos,
    due_anchor, due_offset_days, cancellation_terms, downpayment_non_refundable, refund_window_days, no_show_forfeit
  )
  SELECT s.id, p_vendor_profile_id, (e.ord - 1)::int,
         left(COALESCE(NULLIF(btrim(e.item->>'label'), ''), CASE WHEN e.ord = 1 THEN 'Reservation fee' ELSE 'Payment ' || (e.ord - 1) END), 80),
         e.item->>'amount_kind',
         NULLIF(e.item->>'percent_bps', '')::int,
         NULLIF(e.item->>'amount_centavos', '')::bigint,
         NULLIF(e.item->>'due_anchor', ''),
         NULLIF(e.item->>'due_offset_days', '')::int,
         CASE WHEN e.ord = 1 THEN NULLIF(btrim(e.item->>'cancellation_terms'), '') END,
         CASE WHEN e.ord = 1 THEN COALESCE((e.item->>'downpayment_non_refundable')::boolean, FALSE) ELSE FALSE END,
         CASE WHEN e.ord = 1 THEN NULLIF(e.item->>'refund_window_days', '')::int END,
         CASE WHEN e.ord = 1 THEN COALESCE((e.item->>'no_show_forfeit')::boolean, FALSE) ELSE FALSE END
    FROM unnest(v_ids) AS s(id)
   CROSS JOIN LATERAL jsonb_array_elements(v_items) WITH ORDINALITY AS e(item, ord);

  UPDATE public.vendor_services
     SET pay_plan_id = p_pay_plan_id, updated_at = now()
   WHERE vendor_service_id = ANY (v_ids);

  RETURN cardinality(v_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_vendor_pay_plan(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_vendor_pay_plan(UUID, UUID, UUID[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_vendor_pay_plan(UUID, UUID, UUID[]) IS
  'Payment Strategies (DECISION_LOG 2026-11-17): copies a saved pay plan''s rows onto each named card of the SAME shop (replace-all) and sets its pay_plan_id. Cards of another shop are skipped. Used by "Use on other cards…" and by "Change it on all N cards".';

COMMIT;
