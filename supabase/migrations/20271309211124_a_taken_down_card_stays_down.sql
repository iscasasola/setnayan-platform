-- ═══════════════════════════════════════════════════════════════════════════
-- A TAKEN-DOWN SERVICE CARD STAYS DOWN UNTIL SETNAYAN PUTS IT BACK
--
-- Admin minimum for supplier registration (Sat 7 Nov 2026): from the admin
-- supplier page an admin can take a service card down — hidden from couples,
-- with a reason, reversible with "Put back".
--
-- ── WHY NO NEW VISIBILITY FLAG ───────────────────────────────────────────────
-- `vendor_services.is_active` IS the card's public switch already: the public
-- read policy (`vendor_services_public_read`), the shop page `/v/[slug]`
-- (`allServices.filter((s) => s.is_active)`), Find (`/explore`, its
-- `.eq('is_active', true)` and `vendor_services!inner(is_active)` joins) and
-- every booking path read it. A take-down therefore sets `is_active = false` —
-- every place that hides a draft hides a taken-down card for the same reason,
-- and no reader has to learn a second flag.
--
-- What `is_active` cannot do on its own is STAY off: the shop flips it with the
-- on/off switch on its Services list, with `save_vendor_service(... p_publish)`,
-- or by PATCHing it through PostgREST (`vendor_services_manage` is FOR ALL on
-- "this row is yours"). So this adds the hold, and only the hold:
--
--   • taken_down_at      — when Setnayan took it down; NULL = not taken down.
--   • taken_down_reason  — what the supplier is told (10–500 characters).
--
-- Who did it is NOT a column: it is `admin_audit_log.actor_user_id` on the
-- `vendor_service_taken_down` row, the same place every other admin action on a
-- shop records its actor (and no new user FK reaches the erasure map).
--
-- ── THE RULES (one trigger, every role) ─────────────────────────────────────
--   1. A card on hold cannot be live. Any writer — the shop's switch, the
--      maker's RPC (SECURITY DEFINER), a PATCH — that tries to set
--      `is_active = true` while `taken_down_at` is set is refused with a
--      sentence that carries Setnayan's reason.
--   2. Only Setnayan sets or lifts the hold. A browser session
--      (current_user authenticated/anon) that is not an admin may not change
--      `taken_down_at` / `taken_down_reason`. Server code acting for the shop
--      never writes these columns; the admin actions are the only writers.
--      Same caller test as 20271286262047 / 20271297090101.
--
-- RLS: unchanged. The supplier reads their own card's reason through
-- `vendor_services_manage`; `vendor_services_public_read` requires
-- `is_active = true`, which a held card never is, so the reason never reaches
-- a couple.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS taken_down_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS taken_down_reason TEXT;

COMMENT ON COLUMN public.vendor_services.taken_down_at IS
  'When Setnayan took this card down from the admin supplier page. NULL = not taken down. While set, the card cannot be live (trigger a_taken_down_card_stays_down); only an admin sets or clears it. The actor is admin_audit_log.actor_user_id (action vendor_service_taken_down / vendor_service_put_back).';
COMMENT ON COLUMN public.vendor_services.taken_down_reason IS
  'Why Setnayan took this card down — shown to the supplier (in-app notice + the refusal when they try to publish it). Never public: a held card is never is_active, which vendor_services_public_read requires.';

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_a_take_down_says_why;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_a_take_down_says_why CHECK (
    (taken_down_at IS NULL AND taken_down_reason IS NULL)
    OR (
      taken_down_at IS NOT NULL
      AND char_length(btrim(COALESCE(taken_down_reason, ''))) BETWEEN 10 AND 500
    )
  );

CREATE OR REPLACE FUNCTION public.a_taken_down_card_stays_down()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- 2 · Only Setnayan sets or lifts the hold.
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.taken_down_at IS NOT NULL OR NEW.taken_down_reason IS NOT NULL THEN
        RAISE EXCEPTION 'Only Setnayan can take a service card down.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.taken_down_at IS DISTINCT FROM OLD.taken_down_at
       OR NEW.taken_down_reason IS DISTINCT FROM OLD.taken_down_reason THEN
      RAISE EXCEPTION 'Only Setnayan can take a service card down or put it back.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- 1 · A card on hold cannot be live — whoever asks.
  IF NEW.taken_down_at IS NOT NULL AND NEW.is_active IS TRUE THEN
    RAISE EXCEPTION
      'Setnayan took this card down, so it cannot go live: %. You can still edit it and save it as a draft — once you have fixed it, reply to Setnayan and we will put it back.',
      btrim(NEW.taken_down_reason)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.a_taken_down_card_stays_down() IS
  'A service card Setnayan took down (taken_down_at set) cannot be made live by anyone, and only an admin may set or clear the hold. 20271309211124.';

DROP TRIGGER IF EXISTS a_taken_down_card_stays_down ON public.vendor_services;
CREATE TRIGGER a_taken_down_card_stays_down
  BEFORE INSERT OR UPDATE ON public.vendor_services
  FOR EACH ROW
  EXECUTE FUNCTION public.a_taken_down_card_stays_down();

REVOKE ALL ON FUNCTION public.a_taken_down_card_stays_down() FROM PUBLIC, anon, authenticated;

COMMIT;
