-- ═══════════════════════════════════════════════════════════════════════════
-- A SERVICE CARD CANNOT GO LIVE WITHOUT A NAME.
--
-- MEASURED IN PRODUCTION 2026-09-10, before a line of this was written:
--   SELECT count(*) FILTER (WHERE title IS NULL) FROM vendor_services  →  2
--   SELECT count(*)                              FROM vendor_services  →  2
-- Both are `is_active = true`. Every reader falls back to the kind
-- (`app/v/[slug]/page.tsx`: `s.title?.trim() || displayServiceLabel(s.category)`),
-- so a couple browsing the two live cards reads "Wedding Bands (full ensemble)"
-- and "Host Mc" where the shop's own name for that service should be.
--
-- ── WHY THIS FILLS AND DOES NOT REFUSE ────────────────────────────────────
-- Owner lock 2026-07-27: *"saving builds blank will make us autocreate a name"*.
-- The sibling trigger `enforce_service_publish_gate` REFUSES a blank price, and
-- copying its shape here would have been the wrong fix twice over: it would
-- demand the one thing the product promises to write, AND — because the legacy
-- card editor writes no title at all — it would have bounced the owner's own two
-- live cards with a raw Postgres sentence the moment he next changed a price.
-- A fill satisfies the invariant with nobody refused.
--
-- ── WHY THE DATABASE AND NOT ONLY TYPESCRIPT ──────────────────────────────
-- The rule is written in FOUR places and this is the only one that is a fence.
-- Read out of production by the object, not from a document:
--   • `authenticated` holds UPDATE on BOTH `vendor_services.title` and
--     `.is_active` (information_schema.column_privileges), and the table carries
--     a "this row is yours" policy — so a shop can PATCH a live card's title to
--     NULL straight through PostgREST and meet no TypeScript in this repo.
--   • `save_vendor_service` (SECURITY DEFINER, `pg_get_functiondef`) writes
--     `title = NULLIF(p_fields->>'title', '')` on UPDATE, so any payload that
--     omits the key BLANKS the column. The RPC can un-name a card.
-- The other three places (the maker's effect, `commitVendorService`, and the
-- shared rule in `lib/service-card-auto-title.ts`) decide what a PERSON sees.
-- This one decides what is true.
--
-- ── THE NAME, AND WHY IT IS THE SAME NAME TYPESCRIPT WOULD WRITE ──────────
-- `<kind> by <shop>`, clamped to 80 — the shape `canvas-maker.tsx` has written
-- since 2026-07-27 and the shape `autoServiceCardTitle()` reproduces. The kind
-- resolves through the SAME source the coverage tree labels leaves from
-- (`canonical_service_schemas.display_name_en`, see lib/vendor-coverages.ts),
-- else `initcap(replace(key,'_',' '))`, which is `humanizeKind()` in SQL.
-- ⚠ ONE STEP IS UNREACHABLE FROM SQL and is named rather than hidden: the 52
-- hardcoded `VENDOR_CATEGORY_LABEL` keys live in TypeScript. A key that is in
-- those 52 and NOT in `canonical_service_schemas` is humanised here where
-- TypeScript would have found a nicer word. That is a floor no app path reaches
-- — `commitVendorService` names the card before the write — so the degradation
-- only ever applies to a raw PostgREST write, which had no name at all before.
--
-- 🔒 THE SHOP NAME OBEYS HYBRID ANONYMITY. A stored title is rendered RAW, with
-- no anonymity filter downstream, so baking `business_name` in unconditionally
-- would publish an unverified shop's real name and freeze it there permanently.
-- The reveal test mirrors `isVendorNameRevealed` (lib/vendors.ts): verified —
-- the owner's own 2026-07-22 "open it up" lock, *"a vendor's NAME is never
-- gated"* — OR `name_revealed_at` stamped. Anything else is named by its kind
-- alone. Measured: SetnaProd is `verification_state='verified'` but
-- `name_revealed_at IS NULL`, and Saysay is verified and revealed, so today both
-- resolve through the VERIFIED arm and the hidden arm is exercised by tests only.
--
-- ⚠ SECURITY INVOKER ON PURPOSE (no `SECURITY DEFINER`). It opens no read path
-- that the writer did not already have, and both of its reads fail in the SAFE
-- direction: an unreadable profile drops the shop name (a plainer title), an
-- unreadable schema row drops to the humanised key. A naming trigger must never
-- be able to refuse somebody's card.
--
-- 🔢 SAFE BY ARITHMETIC AT APPLY TIME: this is a BEFORE trigger, so it changes
-- nothing already stored. The two nameless rows are the OWNER'S DATA and are NOT
-- rewritten by this migration — they gain their names the next time either is
-- saved through any path. Nothing is backfilled here on purpose: a backfill
-- would put words on a live public card without the shop ever seeing them.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fill_blank_service_card_title()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text;
  v_shop text;
  v_name text;
BEGIN
  -- The supplier's own words always win. The WHEN clause below already skips
  -- this call for a named card; this is the belt, because a future trigger
  -- definition that loses the WHEN must not start renaming people's cards.
  IF NULLIF(btrim(COALESCE(NEW.title, '')), '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(COALESCE(s.display_name_en, '')), '')
    INTO v_kind
    FROM public.canonical_service_schemas s
   WHERE s.canonical_service = NEW.category;

  IF v_kind IS NULL THEN
    v_kind := NULLIF(btrim(initcap(replace(COALESCE(NEW.category, ''), '_', ' '))), '');
  END IF;

  -- No kind to name it after → leave the column NULL rather than store an empty
  -- string. Every reader tests `title?.trim()`, so '' would be an absence
  -- wearing the costume of a value.
  IF v_kind IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(COALESCE(p.business_name, '')), '')
    INTO v_shop
    FROM public.vendor_profiles p
   WHERE p.vendor_profile_id = NEW.vendor_profile_id
     AND (p.verification_state = 'verified' OR p.name_revealed_at IS NOT NULL);

  v_name := left(
    CASE WHEN v_shop IS NULL THEN v_kind ELSE v_kind || ' by ' || v_shop END,
    80
  );

  NEW.title := NULLIF(btrim(v_name), '');
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fill_blank_service_card_title() IS
  'Names a service card whose title was left blank: "<kind> by <shop>", clamped '
  'to 80, the same shape lib/service-card-auto-title.ts writes. The shop name is '
  'included only when hybrid anonymity would already show it (verified, or '
  'name_revealed_at stamped). Fills, never refuses — owner lock 2026-07-27, '
  '"saving builds blank will make us autocreate a name".';

-- Fires BEFORE `trg_enforce_service_publish_gate` (BEFORE triggers run in NAME
-- order, and "b" sorts before "e"), so the gate always judges a row that has
-- already been named. The gate does not read `title` today; this ordering is so
-- that it safely could.
DROP TRIGGER IF EXISTS trg_before_enforce_fill_service_card_title ON public.vendor_services;
CREATE TRIGGER trg_before_enforce_fill_service_card_title
  BEFORE INSERT OR UPDATE ON public.vendor_services
  FOR EACH ROW
  WHEN (NULLIF(btrim(COALESCE(NEW.title, '')), '') IS NULL)
  EXECUTE FUNCTION public.fill_blank_service_card_title();
