-- ceremony_essentials_category
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
-- ============================================================================
-- CEREMONY ESSENTIALS — THE ARRHAE, THE CORD, THE VEIL, THE CANDLES, THE BIBLE
-- ============================================================================
--
-- Owner, 2026-11-07: "do we have the wedding essentials taxonomy? for catholic
-- weddings? the bible the arrhea, the cord, the veil, the candles? where can
-- they be located?" → proposed a new category "Ceremony essentials" in the Look
-- group, beside Jewelleries & accessories → owner: "add that to the taxonomy".
-- Then: "most supplier sells them as a set" → a "Complete ceremony set" service,
-- sorted FIRST. Corpus DECISION_LOG row "Ceremony essentials" (2026-11-07).
-- Same day, same migration: "pabati is not a service" → step 4 hides the
-- retired `pabati` key (marketplace_hidden; the row is kept), and step 5 adds
-- the missing "Photoman (instant prints)" under Booths › Photo booth.
--
-- ── WHAT EXISTED (RULE 0) ───────────────────────────────────────────────────
-- Measured on the replay and in prod: none of these exist. The only near match
-- is `wedding_veil` (Look › Jewelleries & accessories), which is the BRIDE'S
-- veil — a different thing from the unity veil pinned over the couple. It is
-- left alone.
--
-- ── WHAT THIS ADDS ──────────────────────────────────────────────────────────
-- One tier-2 category under `look`, and eight services under it. Same shape as
-- `20271257951866` (Chairs & tents) and `20271028988594` (travel): rows in
-- service_categories + canonical_service_taxonomy + canonical_service_schemas,
-- ON CONFLICT DO NOTHING, guarded UPDATEs, and a post-condition block.
--
-- This seeds the one source, Admin › Categories; getTaxonomy() reads these
-- rows. The code FALLBACK snapshot (lib/taxonomy.ts TAXONOMY_MAP + tile maps,
-- vendor-branch-category, category-hints, taxonomy-icons, supplier-find,
-- booth-templates) gets the same rows in the same PR, because the one-source
-- guards (tests/db/one-source-buckets, one-source-category-key) require the
-- fallback to equal the seed — it is what getTaxonomy() serves if the read fails.
--
--   · coarse_category = 'rings' — the stored vendor_category a shop under this
--     category is filed as. Every live category needs one or its shops land in
--     `misc` (tests/db/no-service-lands-in-misc). 'rings' is what the neighbour
--     Jewelleries & accessories (veils, garters, headpieces, corsages) already
--     files under; there is no enum value closer. Admin-editable.
--   · applicable_event_types = wedding + anniversary. There is no vow-renewal
--     event type; a vow renewal is an anniversary with `renewal_of_vows`
--     (lib/schedule-run-of-show.ts). The services carry NULL and so INHERIT the
--     category's scope, so the owner's later edits in Admin reach them.
--   · Flags on every service: is_ph TRUE + is_tradition TRUE (the convention
--     for Filipino traditional items — filipiniana_terno, capiz_native_decor,
--     barong_tagalog_*), faith NULL, is_rental FALSE. faith is a SINGLE,
--     EXCLUSIVE filter (lib/taxonomy-filters.ts passesFaithFilter): tagging
--     'Catholic' would hide the cord, veil and arrhae from a Christian couple
--     who uses them too. Left NULL; Admin can tag one later.
--   · Service order: the set first (sort_order 0), then the order the owner
--     named them. Only /admin/categories reads sort_order today.
--
-- RLS / GRANTS: unchanged — rows in tables that already have RLS (public read,
-- admin write). No new table, function or view.
-- ============================================================================

BEGIN;

-- 1 ── the category, beside Jewelleries & accessories (sort 38) in Look.
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, status,
   service_nature, marketplace_hidden, applicable_event_types, coarse_category, icon_name, hint_en)
VALUES
  ('ceremony_essentials', 'look', 2, 'leaf', 'Ceremony essentials', NULL, 'ceremony-essentials',
   39, 'global', 'active', 'service', FALSE, ARRAY['wedding', 'anniversary']::text[],
   'rings', 'HeartHandshake',
   'The unity cord, unity veil, arrhae coins, candles, Bible, rosary and bearer pillows for a Filipino church wedding — most suppliers sell them as one set.')
ON CONFLICT (id) DO NOTHING;

-- 2 ── the eight services. NULL applicable_event_types = inherit the category.
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental, dietary,
   is_tradition, marketplace_hidden, secondary_tiles, sort_order)
VALUES
  ('ceremony_essentials_set', 'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 0),
  ('arrhae_arras',            'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 1),
  ('unity_cord',              'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 2),
  ('unity_veil',              'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 3),
  ('ceremony_candles',        'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 4),
  ('wedding_bible',           'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 5),
  ('ring_coin_bearer_pillow', 'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 6),
  ('wedding_rosary',          'look', 'ceremony_essentials', 'V1.2', NULL, TRUE, FALSE, FALSE, NULL, TRUE, FALSE, '{}'::TEXT[], 7)
ON CONFLICT (canonical_service) DO NOTHING;

-- 3 ── display names (canonical_service_schemas.display_name_en is NOT NULL;
--      without a row the pickers fall back to a title-cased key).
INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en)
VALUES
  ('ceremony_essentials_set', 'Complete ceremony set'),
  ('arrhae_arras',            'Arrhae (arras)'),
  ('unity_cord',              'Unity cord'),
  ('unity_veil',              'Unity veil'),
  ('ceremony_candles',        'Ceremony candles'),
  ('wedding_bible',           'Wedding Bible'),
  ('ring_coin_bearer_pillow', 'Ring & coin bearer pillows'),
  ('wedding_rosary',          'Wedding rosary')
ON CONFLICT (canonical_service) DO NOTHING;

-- 4 ── PABATI IS NOT A SERVICE (owner 2026-11-07: "pabati is not a service").
--      Pabati was RETIRED into Papic on 2026-08-21 (DECISION_LOG "Pabati is
--      RETIRED — it is part of Papic"; migration 20271159146115_retire_pabati),
--      but its taxonomy row stayed a VISIBLE supplier service under Booths ›
--      Photo booth — and, because it has no `setnayan_` prefix, it slipped past
--      the /open-shop first-party filter (lib/open-shop-service-vocab.ts
--      isFirstPartyService) and was offered to a new supplier as a trade.
--
--      ⚖ HIDDEN, NOT MERGED, NOT DELETED. `marketplace_hidden` is the table's
--      own mechanism for a key that must stay resolvable but never be offered
--      (25 rows use it, e.g. the officiants). `merged_into` is the TRADE-merge
--      forwarder (20271176753752): it would rewrite every holder of the key onto
--      another trade, and Pabati has no trade to forward to — it became a Papic
--      mission, not a service. The row stays because a shop's
--      `vendor_profiles.services` still holds the key (SetnaProd), and a deleted
--      row would leave that key unresolvable. Guarded, so a replay is a no-op
--      and an admin who un-hides it later is not overridden twice.
UPDATE public.canonical_service_taxonomy
   SET marketplace_hidden = TRUE,
       updated_at = now()
 WHERE canonical_service = 'pabati'
   AND marketplace_hidden IS DISTINCT FROM TRUE;

-- 5 ── THE PHOTOMAN (owner 2026-11-07). A roving photographer who shoots guests
--      at their tables and prints souvenir photos on the spot — not the main
--      wedding photographer. Measured: nothing like it existed. Filed under
--      Booths › Photo booth beside `polaroid_booth`, with EXACTLY its siblings'
--      flags (phase V1.1.6, every flag FALSE, sort_order 0 like every sibling)
--      and NULL applicable_event_types, so it inherits every event type the
--      Photo booth category allows, as its siblings do.
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental, dietary,
   is_tradition, marketplace_hidden, secondary_tiles, sort_order)
VALUES
  ('photoman', 'booths', 'photo_booth', 'V1.1.6', NULL, FALSE, FALSE, FALSE, NULL, FALSE, FALSE, '{}'::TEXT[], 0)
ON CONFLICT (canonical_service) DO NOTHING;

INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en)
VALUES ('photoman', 'Photoman (instant prints)')
ON CONFLICT (canonical_service) DO NOTHING;

-- ── post-conditions ─────────────────────────────────────────────────────────
DO $guard$
DECLARE
  v_n       INTEGER;
  v_missing TEXT;
BEGIN
  -- (1) a real, findable category: active tier-2, visible, under an active tier-1.
  IF NOT EXISTS (
    SELECT 1
      FROM public.service_categories c
      JOIN public.service_categories p ON p.id = c.parent_id
     WHERE c.id = 'ceremony_essentials' AND c.tier = 2 AND c.status = 'active'
       AND c.marketplace_hidden IS FALSE
       AND p.id = 'look' AND p.tier = 1 AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'refusing to apply: ceremony_essentials is not an active, visible tier-2 category under Look';
  END IF;

  -- (2) it reaches a wedding, and it has a coarse category (else its shops land in misc).
  IF NOT EXISTS (
    SELECT 1 FROM public.service_categories
     WHERE id = 'ceremony_essentials'
       AND 'wedding' = ANY (COALESCE(applicable_event_types, ARRAY[]::text[]))
       AND coarse_category IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'refusing to apply: ceremony_essentials does not reach a wedding or has no coarse category';
  END IF;

  -- (3) all eight services landed on it, each named, none hidden. A category with
  --     no services is a dead shelf: search short-circuits on it and the picker
  --     prunes it, with no error anywhere.
  SELECT count(*) INTO v_n
    FROM public.canonical_service_taxonomy c
    JOIN public.canonical_service_schemas s USING (canonical_service)
   WHERE c.tile_id = 'ceremony_essentials'
     AND c.marketplace_hidden IS FALSE
     AND c.canonical_service IN ('ceremony_essentials_set', 'arrhae_arras', 'unity_cord', 'unity_veil',
                                 'ceremony_candles', 'wedding_bible', 'ring_coin_bearer_pillow',
                                 'wedding_rosary');
  IF v_n <> 8 THEN
    RAISE EXCEPTION 'refusing to apply: expected 8 named, visible ceremony-essentials services, found %', v_n;
  END IF;

  -- (4) FILLABILITY (tests/db/tile-event-type-fillable.db.test.ts): every event
  --     type the category claims has at least one service resolving to it.
  SELECT string_agg(claims.event_type, ', ') INTO v_missing
    FROM (SELECT unnest(applicable_event_types) AS event_type
            FROM public.service_categories WHERE id = 'ceremony_essentials') claims
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.canonical_service_taxonomy c
       JOIN public.service_categories t ON t.id = c.tile_id
      WHERE c.tile_id = 'ceremony_essentials'
        AND c.marketplace_hidden IS FALSE
        AND (COALESCE(NULLIF(c.applicable_event_types, '{}'), t.applicable_event_types) IS NULL
             OR claims.event_type = ANY (COALESCE(NULLIF(c.applicable_event_types, '{}'), t.applicable_event_types)))
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: ceremony_essentials claims event type(s) no service can fill — %', v_missing;
  END IF;

  -- (5) the photoman is a visible, named Photo booth service that inherits the
  --     category's scope.
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_service_taxonomy c
      JOIN public.canonical_service_schemas s USING (canonical_service)
     WHERE c.canonical_service = 'photoman' AND c.tile_id = 'photo_booth'
       AND c.marketplace_hidden IS FALSE AND c.applicable_event_types IS NULL
  ) THEN
    RAISE EXCEPTION 'refusing to apply: photoman is not a visible, named Photo booth service inheriting its scope';
  END IF;

  -- (6) pabati is hidden, and the row is KEPT (a shop's services[] still holds it).
  --     Only asserted where the row exists — a database that never had it has
  --     nothing to hide.
  IF EXISTS (SELECT 1 FROM public.canonical_service_taxonomy
              WHERE canonical_service = 'pabati' AND marketplace_hidden IS DISTINCT FROM TRUE) THEN
    RAISE EXCEPTION 'refusing to apply: pabati is still a visible supplier service';
  END IF;
END;
$guard$;

COMMIT;
