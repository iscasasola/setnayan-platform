-- a_held_shop_name_holds_its_core
-- Created via `pnpm migration:new`. Idempotent: CREATE OR REPLACE FUNCTION · COMMENT · REVOKE/GRANT.
-- No table, no column, no policy — so no RLS to add (owner, DECISION_LOG 2026-11-06: "no new table").
--
-- ── WHY (owner, 2026-11-06, verbatim) ────────────────────────────────────────
-- *"there was a shop named Bulgogi Catering. and the shop was deactivated, banned, or deleted. we have a rule that
-- the name cannot be used for 1 year. then they created Bulgogi 1. that should also not be allowed."* → *"Yes, build
-- it"* on the controller proposal:
--   (1) compare a CORE NAME — lowercase, accents and punctuation stripped, numbers / roman numerals removed, trade
--       words removed (taken from our own taxonomy labels, plus Co · Inc · PH);
--   (2) the hold covers CLOSED (the 2026-08-10 `vendor_closed` row, until it expires), BANNED and SUSPENDED shops;
--   (3) a core under 3 letters, or made only of trade words, does not block;
--   (4) the refusal is never a dead end — "It's my business" sends it to admin with papers.
--
-- ── WHAT ALREADY EXISTED (RULE 0) ────────────────────────────────────────────
-- The 2026-08-10 lock holds a closed shop's EXACT ADDRESS (`slug_change_log`, entity_type `vendor_closed`,
-- `findSlugConflict`). Only the exact word is compared, so "Bulgogi 1" walked past a held "Bulgogi Catering". This
-- adds the ONE missing comparison on top of the same rows; it does not move or copy the hold.
--
-- 🔑 A CLOSED SHOP'S CORE IS READ FROM ITS HELD ADDRESS, NOT FROM A STORED NAME. Erasure blanks `business_name`
-- (the 2026-08-10 row's open owner question: a sole proprietor's shop is often their own name). Keeping the name —
-- or a "core" made from it — after a legal erasure request would quietly answer that question without the owner.
-- The ADDRESS is already kept by owner ruling, and an address IS the name in slug form (`slugify_business_name`), so
-- the core of the held address is the core of the closed shop's name. Since 2026-08-09 addresses drop separators
-- ("bulgogicatering"), which is why the core also peels trade words glued to either end (step 5 below).
--
-- ── THE TRADE WORDS ARE DERIVED, NEVER TYPED ─────────────────────────────────
-- Every word of every taxonomy label: `canonical_service_taxonomy.canonical_service` (snake_case keys) and
-- `service_categories.label_en` / `label_short` (the folder and tile labels). Read at call time, so an admin adding a
-- category adds its words here with no migration. The only typed words are the legal forms the owner named (Co · Inc
-- · PH, plus Corp from the controller brief) and two joining words, "and" and "the" — `slugify_business_name` turns
-- "&" into the WORD "and", so a glued address "bulgogiandco" could not otherwise be peeled back to "bulgogi".
--
-- ── WHERE IT IS ASKED ────────────────────────────────────────────────────────
-- `shop_name_core_hold` is the ONE question. The app asks it on every vendor-facing name write (open-shop wizard,
-- My Shop rename, the correction request) through `lib/shop-name-hold.ts`, and the wizard's live check asks the same
-- RPC — one answer, as `business_slug_is_available` made the mint and the wizard ask one question (20271132502763).
-- The database's own name-writer for a couple's link (`claim_ready_the_shop`) asks it below.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1 · The trade words, derived from the taxonomy ───────────────────────────
-- The legal forms are the ONE typed list, and it lives here only — the trade words and the glued-suffix peel below
-- both read it, so the two cannot disagree.
CREATE OR REPLACE FUNCTION public.shop_name_legal_forms()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT ARRAY['co', 'inc', 'ph', 'corp']::text[];
$function$;

CREATE OR REPLACE FUNCTION public.shop_name_trade_words()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(DISTINCT w ORDER BY w), ARRAY[]::text[])
    FROM (
      SELECT regexp_split_to_table(
               translate(
                 lower(src),
                 'áàâäãåéèêëíìîïóòôöõúùûüýñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÝÑÇ',
                 'aaaaaaeeeeiiiiooooouuuuyncaaaaaaeeeeiiiiooooouuuuync'
               ),
               '[^a-z]+'
             ) AS w
        FROM (
          SELECT canonical_service AS src FROM public.canonical_service_taxonomy
          UNION ALL SELECT label_en FROM public.service_categories
          UNION ALL SELECT label_short FROM public.service_categories WHERE label_short IS NOT NULL
          -- The legal forms the owner named, and the two joining words (see the header).
          UNION ALL SELECT unnest(public.shop_name_legal_forms())
          UNION ALL SELECT unnest(ARRAY['and', 'the'])
        ) labels
    ) words
   WHERE length(w) >= 2;
$function$;

COMMENT ON FUNCTION public.shop_name_trade_words() IS
  'Trade words for the shop-name core (owner 2026-11-06): every word of every taxonomy label '
  '(canonical_service_taxonomy keys + service_categories label_en/label_short), read live, plus '
  'co · inc · ph · corp and the joining words and · the. Derived, never a typed list.';

-- ── 2 · Is one word a trade word (singular or plural)? ───────────────────────
CREATE OR REPLACE FUNCTION public.shop_name_is_trade_word(p_word text, p_trade text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT p_word IS NOT NULL AND p_word <> '' AND (
       p_word = ANY (p_trade)
    -- "Events" when the label says "Event", "Florals" when it says "Floral" …
    OR (right(p_word, 1) = 's' AND left(p_word, -1) = ANY (p_trade))
    OR (right(p_word, 2) = 'es' AND left(p_word, -2) = ANY (p_trade))
    -- … and "Light" when the label says "Lights".
    OR (p_word || 's') = ANY (p_trade)
  );
$function$;

-- ── 3 · The core name ────────────────────────────────────────────────────────
-- NULL means "this name holds nothing and is held by nothing": empty, under 3 letters, or only trade words.
--
--   1. lowercase, then the SAME accent pairs `slugify_business_name` passes to translate();
--   2. split into words on anything that is not a letter or digit (punctuation and spaces go);
--   3. drop a word that is only digits, or an ordinal ("2nd", "3rd");
--   4. remove digits inside a word ("Bulgogi1" → "bulgogi"); drop a single letter (an initial, a possessive "s");
--      drop a standalone roman numeral up to XXXIX (II, IV, XX — the way a shop numbers a second branch; capped so
--      words like "mix" or "liv" survive);
--   5. drop trade words, then join what is left;
--   6. peel a trade word GLUED to either end of the joined core — four letters or more, and only while at least
--      three letters remain — so a held address with no separators ("bulgogicatering") meets the name that made it;
--      a legal form glued to the END ("bulgogieventsph") is peeled too, but only while five letters remain, because
--      two letters at the end of a word are often just the word ("Joseph" must not become "jose").
CREATE OR REPLACE FUNCTION public.shop_name_core(p_name text, p_trade text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_words text[];
  v_word  text;
  v_core  text := '';
  v_peel  text;
  v_turns int := 0;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_words := regexp_split_to_array(
    translate(
      lower(p_name),
      'áàâäãåéèêëíìîïóòôöõúùûüýñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÝÑÇ',
      'aaaaaaeeeeiiiiooooouuuuyncaaaaaaeeeeiiiiooooouuuuync'
    ),
    '[^a-z0-9]+'
  );

  FOREACH v_word IN ARRAY v_words LOOP
    CONTINUE WHEN v_word = '';
    CONTINUE WHEN v_word ~ '^[0-9]+(st|nd|rd|th)?$';
    v_word := regexp_replace(v_word, '[0-9]+', '', 'g');
    -- A single letter is an initial or the "s" of a possessive ("Maria's"), never a name on its own.
    CONTINUE WHEN length(v_word) < 2;
    CONTINUE WHEN v_word ~ '^x{0,3}(ix|iv|v?i{0,3})$';
    CONTINUE WHEN public.shop_name_is_trade_word(v_word, p_trade);
    v_core := v_core || v_word;
  END LOOP;

  -- Glued trade words. Longest first, so "catering" is peeled before "cater" could be; a suffix before a prefix of
  -- the same length. Bounded, because every turn removes at least two letters and there are at most eight turns.
  LOOP
    v_turns := v_turns + 1;
    EXIT WHEN v_turns > 8;
    -- A legal form glued to the end, first: it is what sits outermost ("…eventsph", "…cateringinc").
    SELECT t INTO v_peel
      FROM unnest(public.shop_name_legal_forms()) AS t
     WHERE length(v_core) - length(t) >= 5
       AND right(v_core, length(t)) = t
     ORDER BY length(t) DESC
     LIMIT 1;
    IF v_peel IS NOT NULL THEN
      v_core := left(v_core, length(v_core) - length(v_peel));
      v_peel := NULL;
      CONTINUE;
    END IF;
    SELECT t INTO v_peel
      FROM unnest(p_trade) AS t
     WHERE length(t) >= 4
       AND length(v_core) - length(t) >= 3
       AND (right(v_core, length(t)) = t OR left(v_core, length(t)) = t)
     ORDER BY length(t) DESC, (right(v_core, length(t)) = t) DESC, t
     LIMIT 1;
    EXIT WHEN v_peel IS NULL;
    IF right(v_core, length(v_peel)) = v_peel THEN
      v_core := left(v_core, length(v_core) - length(v_peel));
    ELSE
      v_core := right(v_core, length(v_core) - length(v_peel));
    END IF;
    v_peel := NULL;
  END LOOP;

  IF length(v_core) < 3 OR public.shop_name_is_trade_word(v_core, p_trade) THEN
    RETURN NULL;
  END IF;
  RETURN v_core;
END;
$function$;

-- The one-argument form every caller uses: the live trade words.
CREATE OR REPLACE FUNCTION public.shop_name_core(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT public.shop_name_core(p_name, public.shop_name_trade_words());
$function$;

COMMENT ON FUNCTION public.shop_name_core(text, text[]) IS
  'The core of a shop name (owner 2026-11-06): lowercase, accents folded (slugify_business_name''s pairs), '
  'punctuation and spaces gone, digits and standalone roman numerals (I–XXXIX) gone, trade words gone (also when '
  'glued to either end, 4+ letters, keeping 3+). NULL = under 3 letters or only trade words: holds nothing.';

-- ── 4 · THE ONE QUESTION: is this name's core held, and by what? ─────────────
-- SECURITY DEFINER: it reads `fraud_banned_at` / `fraud_suspended_at` and the ledger, which no vendor session can
-- see — under the caller's RLS a held core would read as free. service_role only; the app never forwards
-- `holder_vendor_profile_id` or `hold_reason` to the person typing (privacy: they must not learn why another shop
-- closed or was banned). The admin queue may show them.
--
-- p_vendor_profile_id = the shop asking (renaming itself, or the wizard re-run on a nameless shop):
--   · its OWN rows never hold against it (a suspended shop fixing a typo in its own name);
--   · a shop whose "It's my business" for this core was APPROVED by an admin is not held — the claim path is what
--     makes sure a real owner is never locked out, and the approval is the one record of it
--     (`vendor_correction_requests` row, field `business_name`, status `applied`).
CREATE OR REPLACE FUNCTION public.shop_name_core_hold(p_name text, p_vendor_profile_id uuid DEFAULT NULL)
RETURNS TABLE (core text, held boolean, holder_vendor_profile_id uuid, hold_reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trade  text[] := public.shop_name_trade_words();
  v_core   text   := public.shop_name_core(p_name, v_trade);
  v_holder uuid;
  v_reason text;
BEGIN
  IF v_core IS NULL THEN
    RETURN QUERY SELECT NULL::text, FALSE, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF p_vendor_profile_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.vendor_correction_requests r
     WHERE r.vendor_profile_id = p_vendor_profile_id
       AND r.field_key = 'business_name'
       AND r.status = 'applied'
       AND public.shop_name_core(r.requested_value, v_trade) = v_core
  ) THEN
    RETURN QUERY SELECT v_core, FALSE, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- BANNED, then SUSPENDED — by the name AND by the address, because the fraud wipe can rewrite one of them.
  SELECT vp.vendor_profile_id,
         CASE WHEN vp.fraud_banned_at IS NOT NULL THEN 'banned' ELSE 'suspended' END
    INTO v_holder, v_reason
    FROM public.vendor_profiles vp
   WHERE (vp.fraud_banned_at IS NOT NULL OR vp.fraud_suspended_at IS NOT NULL)
     AND vp.vendor_profile_id IS DISTINCT FROM p_vendor_profile_id
     AND (public.shop_name_core(vp.business_name, v_trade) = v_core
          OR public.shop_name_core(vp.business_slug, v_trade) = v_core)
   ORDER BY (vp.fraud_banned_at IS NOT NULL) DESC, vp.vendor_profile_id
   LIMIT 1;
  IF v_holder IS NOT NULL THEN
    RETURN QUERY SELECT v_core, TRUE, v_holder, v_reason;
    RETURN;
  END IF;

  -- CLOSED — the 2026-08-10 hold, for exactly as long as that row says. An expired row holds nothing, so the core
  -- releases itself on the same date the address does: no sweep, no scheduled job.
  SELECT scl.entity_id INTO v_holder
    FROM public.slug_change_log scl
   WHERE scl.entity_type = 'vendor_closed'
     AND scl.redirect_until > now()
     AND scl.entity_id IS DISTINCT FROM p_vendor_profile_id
     AND public.shop_name_core(scl.old_slug, v_trade) = v_core
   ORDER BY scl.redirect_until DESC
   LIMIT 1;
  IF v_holder IS NOT NULL THEN
    RETURN QUERY SELECT v_core, TRUE, v_holder, 'closed'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_core, FALSE, NULL::uuid, NULL::text;
END;
$function$;

COMMENT ON FUNCTION public.shop_name_core_hold(text, uuid) IS
  'THE question for a shop name (owner 2026-11-06, "A HELD SHOP NAME HOLDS ITS CORE"): is its core held by a '
  'closed shop (live vendor_closed row), a banned shop or a suspended shop? A live, normal shop holds nothing here '
  '(exact-address uniqueness covers it). Excludes the asking shop''s own rows and a core it won through an approved '
  '"It''s my business" claim. service_role only — never forward holder/reason to the person typing.';

-- The boolean the database's own writers use.
CREATE OR REPLACE FUNCTION public.shop_name_is_held(p_name text, p_vendor_profile_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce((SELECT h.held FROM public.shop_name_core_hold(p_name, p_vendor_profile_id) h LIMIT 1), FALSE);
$function$;

REVOKE ALL ON FUNCTION public.shop_name_legal_forms() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_name_trade_words() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_name_is_trade_word(text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_name_core(text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_name_core(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_name_core_hold(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_name_is_held(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_name_legal_forms() TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_name_trade_words() TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_name_is_trade_word(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_name_core(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_name_core(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_name_core_hold(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_name_is_held(text, uuid) TO service_role;

-- ── 5 · The couple's link no longer copies a held name onto a new shop ──────
-- `claim_ready_the_shop` fills a joining supplier's BLANK name from the couple's record (20271280303462). A couple
-- may well have booked "Bulgogi Catering" under that name, so without this the claim would be the one door that hands
-- a held core to a new shop. A held name is left BLANK instead — the supplier names the shop on My Shop, where the
-- same question is asked and "It's my business" is offered. Never a refusal: the claim itself still completes.
--
-- The body is 20271287347520's, byte for byte, except the marked block and the two
-- COALESCEs that keep a cleared name blank ('') instead of NULL.
-- (`claim_ready_the_invited_shop` — Setnayan's OWN invite — is untouched: an admin staged that name.)
CREATE OR REPLACE FUNCTION public.claim_ready_the_shop(p_user_id uuid, p_claim_token text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status   text;
  v_name     text;
  v_email    text;
  v_category text;
  v_services text[];
  v_shop     uuid;
  v_prepared uuid;
BEGIN
  IF p_user_id IS NULL OR p_claim_token IS NULL OR length(p_claim_token) = 0 THEN
    RAISE EXCEPTION 'claim_ready_the_shop: a user and a claim token are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT status::text, NULLIF(btrim(business_name), ''), email, NULLIF(btrim(service_category), ''),
         claimed_vendor_profile_id
    INTO v_status, v_name, v_email, v_category, v_prepared
    FROM public.vendor_invites
   WHERE claim_token = p_claim_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_ready_the_shop: no such link' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'claim_ready_the_shop: this link is %', v_status USING ERRCODE = '55000';
  END IF;

  v_services := CASE WHEN v_category IS NULL THEN ARRAY[]::text[] ELSE ARRAY[v_category] END;

  -- 🔒 PICKED EXPLICITLY (20271287347520): the invite's prepared shop if it is theirs, else their OLDEST — never
  -- "whichever row came first". One row today (`vendor_profiles.user_id` is UNIQUE); written down for the day it isn't.
  SELECT vendor_profile_id INTO v_shop FROM public.vendor_profiles
   WHERE user_id = p_user_id
   ORDER BY (vendor_profile_id = v_prepared) DESC NULLS LAST, created_at, vendor_profile_id
   LIMIT 1;

  -- ▼ 20271320018288 · A HELD CORE IS NOT COPIED (owner 2026-11-06). Left blank, never refused.
  IF v_name IS NOT NULL AND public.shop_name_is_held(v_name, v_shop) THEN
    v_name := NULL;
  END IF;
  -- ▲

  IF v_shop IS NULL THEN
    -- `business_name` is NOT NULL DEFAULT '' — blank is the empty string. (Unreachable today: the vendor sign-up
    -- trigger always opens a shop first. Kept honest now that v_name can be cleared just above.)
    INSERT INTO public.vendor_profiles (user_id, business_name, contact_email, services, is_published)
    VALUES (p_user_id, COALESCE(v_name, ''), v_email, v_services, FALSE)
    RETURNING vendor_profile_id INTO v_shop;
  ELSE
    -- Blanks only. A name or a service the supplier already set is theirs.
    -- (`, business_name` at the end: a cleared v_name must leave the blank '' standing, never write NULL into a
    -- NOT NULL column while the service or email arm runs the UPDATE.)
    UPDATE public.vendor_profiles
       SET business_name = COALESCE(NULLIF(btrim(business_name), ''), v_name, business_name),
           services      = CASE WHEN COALESCE(cardinality(services), 0) = 0 THEN v_services ELSE services END,
           contact_email = COALESCE(contact_email, v_email),
           updated_at    = NOW()
     WHERE vendor_profile_id = v_shop
       AND (
         (NULLIF(btrim(business_name), '') IS NULL AND v_name IS NOT NULL)
         OR (COALESCE(cardinality(services), 0) = 0 AND v_category IS NOT NULL)
         OR (contact_email IS NULL AND v_email IS NOT NULL)
       );
  END IF;

  INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
  VALUES (v_shop, p_user_id, 'admin')
  ON CONFLICT (vendor_profile_id, user_id) DO NOTHING;

  RETURN v_shop;
END;
$$;

COMMENT ON FUNCTION public.claim_ready_the_shop(uuid, text) IS
  'Finalize step 1 of a supplier joining from a couple''s link: find or open the '
  'user''s shop, fill ONLY its blank name and service from the couple''s record, '
  'and make sure it has its admin seat. Refuses a link that is not pending. '
  'A name whose core is held (shop_name_is_held, 2026-11-06) is left blank, not copied. '
  'Service role only (the finalize page, after proving the session user).';

REVOKE ALL ON FUNCTION public.claim_ready_the_shop(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ready_the_shop(uuid, text) TO service_role;

COMMIT;
