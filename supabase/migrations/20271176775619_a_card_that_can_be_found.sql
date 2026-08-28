-- ═══════════════════════════════════════════════════════════════════════════
-- A CARD THAT CAN BE FOUND — a published service card must carry a price.
-- (owner-drawn 2026-08-28, prototypes/shop_rooms_made_easy_2026-08-28.html:
--  "Publish stays shut until the price is in")
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── WHY THIS IS A TRIGGER AND NOT A CHECK IN THE APP ──────────────────────
-- The publish rule was TypeScript in four places and one line of the
-- `save_vendor_service` RPC. None of them is the fence:
--
--   • `vendor_services` carries a PERMISSIVE `FOR ALL` policy
--     (`vendor_services_manage`) whose whole test is "this row is yours", and
--   • `authenticated` holds UPDATE on all 40 columns of it.
--
-- So a signed-in shop can PATCH `/rest/v1/vendor_services?...` with the public
-- anon key, set `is_active = true`, and meet no TypeScript at all — publishing
-- a card with no price AND no Setnayan Exclusive, which is the gate that has
-- shipped since day one. THE ROW IS YOURS, THE FIELD IS NOT: a policy that says
-- a row belongs to you has never had an opinion about what is in it.
--
-- ── WHAT IT REFUSES, AND WHAT IT DELIBERATELY DOES NOT ────────────────────
-- It fires ONLY when the card is being PUT in front of a couple, or when the
-- statement is itself emptying one of the two required fields on a live card:
--
--   ✔ refused   INSERT with is_active = true and no price
--   ✔ refused   UPDATE that turns is_active on and no price
--   ✔ refused   UPDATE that clears the price (or the Exclusive) of a live card
--   ✘ allowed   any other edit of an already-live row
--
-- That last line is not slack, it is the point. `merge_canonical_service()`
-- rewrites `category` on every live card when an admin folds one trade into
-- another, and production holds two live cards with no price and no Exclusive
-- (a hidden fixture shop, seeded straight into the table on 2026-08-01). A
-- blanket "every live row must be complete" rule would make a trade merge fail
-- on somebody else's legacy row — a gate that punishes an unrelated act.
-- Those two rows stay exactly as they are until somebody edits their price.
--
-- 🪤 NOTHING HERE ASSIGNS TO A COLUMN, on purpose. `scripts/lint-gates-have-
-- handles.mjs` reads `\mcolumn\M\s*=[^=]` inside a function body as a WRITE, and
-- a comparison written with `=` matches that scan as readily as an assignment.
-- Every test below is `IS NULL` / `IS NOT TRUE` / `IS DISTINCT FROM`.
--
-- 🔢 SAFE BY ARITHMETIC AT THE MERGE, read out of production, not assumed:
-- 2 service cards exist, both on a `public_visibility='hidden'` fixture shop,
-- both already live, neither being edited. Nobody is refused anything today and
-- no existing card is taken down. The rule starts working on the first card a
-- real shop publishes.
--
-- ⛔ ZERO IS NOT A PRICE. `starting_price_php` is a nullable INTEGER of PESOS
-- and the save path accepts a typed `0`, so the test is `> 0`, never NOT NULL.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_service_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_priced    boolean;
  v_exclusive boolean;
  v_judging   boolean;
BEGIN
  -- A draft is nobody's business. Every card is born one.
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Judge only the act of publishing, or of emptying what publishing required.
  IF TG_OP = 'INSERT' THEN
    v_judging := TRUE;
  ELSE
    v_judging := (OLD.is_active IS NOT TRUE)
              OR (NEW.starting_price_php IS DISTINCT FROM OLD.starting_price_php)
              OR (NEW.exclusive_perk_text IS DISTINCT FROM OLD.exclusive_perk_text);
  END IF;

  IF NOT v_judging THEN
    RETURN NEW;
  END IF;

  v_priced := NEW.starting_price_php IS NOT NULL AND NEW.starting_price_php > 0;
  v_exclusive := NULLIF(btrim(COALESCE(NEW.exclusive_perk_text, '')), '') IS NOT NULL;

  IF NOT v_priced THEN
    RAISE EXCEPTION
      'Set a starting price before you publish this card — it is how couples planning a budget find you. You can still save it as a draft.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT v_exclusive THEN
    RAISE EXCEPTION
      'A Setnayan Exclusive perk is required to publish this service.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_service_publish_gate() IS
  'Refuses a published vendor_services row that carries no starting price or no Setnayan Exclusive. The app-side checks are the polite version of this; THIS is the fence, because authenticated holds UPDATE on every column of vendor_services under a row-ownership policy. Fires only on the act of publishing, or on a statement that empties one of the two fields on a live card — an unrelated edit of a legacy row (e.g. merge_canonical_service rewriting category) is never refused.';

DROP TRIGGER IF EXISTS trg_enforce_service_publish_gate ON public.vendor_services;
CREATE TRIGGER trg_enforce_service_publish_gate
  BEFORE INSERT OR UPDATE ON public.vendor_services
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_publish_gate();

COMMENT ON COLUMN public.vendor_services.starting_price_php IS
  'The card''s "from ₱X" anchor in whole PESOS, synced from whichever pricing basis is active (fixed → the flat figure or the cheapest pax bracket · per_pax → rate × minimum pax · per_hour → the base). REQUIRED TO PUBLISH since 2026-08-28 and enforced by trg_enforce_service_publish_gate — it is what a couple''s budget is matched against, so a live card without it is a card nobody can find. NULL is a draft; 0 is not a price.';
