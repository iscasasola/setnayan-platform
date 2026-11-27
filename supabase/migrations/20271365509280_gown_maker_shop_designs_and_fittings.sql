-- gown_maker_shop_designs_and_fittings
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 👗 THE GOWN MAKER JOINS THE PLATFORM — step B1 of corpus WHATS_NEXT_Gown_Maker_Port_2026-11-27.md (§ 3).
-- DECISION_LOG 2026-11-27 "Gown maker joins the platform", "Gown maker port: the build plan" and
-- "Gown maker port — owner answers" (the Toolkit's paid "Attire Maker", wedding gown first; #8387's QR share is
-- folded in as a SECOND way to send a design, on these thread-keyed tables). Additive only.
--
-- RULE 0 — built the way the cake maker is (migration 20271356877338): one options row per shop, one design row per
-- sent design keyed to the chat thread, RLS on at create, REVOKE ALL then GRANT SELECT, only the server writes
-- (service role inside the gown_tool op of supplierScan, step B3). What is NEW against the cake maker:
--   • fabrics, laces and looks carry photos, so they are ROWS, not keys inside the options jsonb;
--   • a fabric-type REGISTRY every shop's fabric points at (admin-edited; the code fallback is lib/gown-config.ts
--     GOWN_STOCK_FABRICS);
--   • her body numbers are personal data: stored only when she presses Send, on that one design, read only by the
--     event's hosts and that shop; the designer's own tape lives apart, in gown_fittings, which only the shop reads;
--   • NO COST LINE IS STORED ANYWHERE A BRIDE CAN READ. Designers see costs; the bride sees the estimate or the quote
--     (owner). The cost lines are computed on the server, for the shop, at read time (step B3) — so this file stores
--     quantities and the one estimate only, and the per-metre price lives on a shop-only table.
--
-- What is added:
--   1. gown_fabric_types   — the registry (seeded with the prototype's 15 at the v186 values). Read by everyone signed
--                             in; written by Setnayan admin only (owner Q4), never by a shop.
--   2. vendor_gown_makers  — the shop's options (price list in centavos, pricing mode, labour hours, seam allowances).
--   3. vendor_gown_fabrics — the shop's fabrics and laces (per-metre price NULL = unpriced, never zero).
--   4. vendor_gown_looks   — the shop's collection looks (a saved GownConfig plus a photo).
--   5. gown_designs        — a sent design. Keyed to the chat thread; room for the QR share (share_code, share_as,
--                             locked_token), whose design exists before any thread does.
--   6. gown_fittings       — the designer's tape for one design. The shop only.
--   7. The Toolkit SKU vendor_tool_attire_tool, priced by COPYING the Cake Maker row (DECISION_LOG 2026-11-23
--      "Top-band tools": one price for every top-band tool) — no amount is typed in this file.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1 ─ the fabric-type registry ────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gown_fabric_types (
  type_id     TEXT        PRIMARY KEY CHECK (type_id ~ '^[a-z][a-z0-9_]{1,39}$'),
  name        TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  aliases     TEXT[]      NOT NULL DEFAULT '{}' CHECK (cardinality(aliases) <= 12),
  family      TEXT        NOT NULL CHECK (family IN ('satins', 'structured', 'crepes', 'sheers', 'laces', 'knits', 'suitings', 'handwoven', 'linings')),
  gsm         INTEGER     NOT NULL CHECK (gsm BETWEEN 5 AND 600),
  stiff       NUMERIC(3,2) NOT NULL CHECK (stiff BETWEEN 0 AND 1),
  sheen       NUMERIC(3,2) NOT NULL CHECK (sheen BETWEEN 0 AND 1),
  sheer       NUMERIC(3,2) NOT NULL CHECK (sheer BETWEEN 0 AND 1),
  stretch     TEXT        NOT NULL CHECK (stretch IN ('none', '2way', '4way')),
  used_for    TEXT[]      NOT NULL CHECK (
                cardinality(used_for) BETWEEN 1 AND 7
                AND used_for <@ ARRAY['gown_body', 'skirt', 'sleeves_accents', 'lining', 'mens_suit', 'barong', 'entourage']::TEXT[]
              ),
  -- Which stock type's light tuning it borrows (corpus fabric-types-research.md "Rendering fallback"). NULL = the
  -- family default; the code never falls back to satin (a false shine is the bigger error).
  render_as   TEXT        NULL REFERENCES public.gown_fabric_types(type_id) ON DELETE SET NULL,
  -- Hide, never delete: a type a shop's fabric points at cannot be deleted (vendor_gown_fabrics.type_id RESTRICT).
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  sort        INTEGER     NOT NULL DEFAULT 0,
  -- FALSE until the numbers are checked against a source (corpus D26 / step B16). The seed below is FALSE throughout.
  verified    BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_by  UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gown_fabric_types ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.gown_fabric_types IS
  'Gown maker (2026-11-27): the fabric-type registry every shop''s fabric points at — how a cloth hangs and shines (gsm, stiff, sheen, sheer, stretch), its family, what it is used for, and which stock type it renders as. Seeded with the prototype''s 15 (v186 FABRICS; family and used_for from corpus fabric-types-research.md), all verified = FALSE. Everyone signed in reads it; Setnayan admin only edits it (owner Q4, 2026-11-27) — through the service role from the admin console, never a shop. Code fallback: lib/gown-config.ts GOWN_STOCK_FABRICS. Hide (active = FALSE), never delete.';

DROP POLICY IF EXISTS gown_fabric_types_signed_in_read ON public.gown_fabric_types;
CREATE POLICY gown_fabric_types_signed_in_read
  ON public.gown_fabric_types
  FOR SELECT TO authenticated
  USING (TRUE);

REVOKE ALL ON TABLE public.gown_fabric_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gown_fabric_types TO authenticated;

-- The prototype's 15 at today's values (owner: "seeded with the prototype's 15 at today's values"; the research's
-- corrections wait for D3 / B16). ON CONFLICT DO NOTHING: a row the admin already edited is never overwritten.
INSERT INTO public.gown_fabric_types (type_id, name, aliases, family, gsm, stiff, sheen, sheer, stretch, used_for, render_as, sort)
VALUES
  ('satin',                'Satin',                ARRAY['bridal satin', 'duchess satin', 'duchesse'], 'satins',     100, 0.35, 0.80, 0.00, 'none', ARRAY['gown_body', 'skirt', 'entourage'],                         NULL, 10),
  ('mikado',               'Mikado',               ARRAY['silk mikado', 'twill mikado'],               'structured', 260, 0.85, 0.55, 0.00, 'none', ARRAY['gown_body', 'skirt'],                                      NULL, 20),
  ('crepe',                'Crepe',                ARRAY['moss crepe', 'triple crepe'],                'crepes',     170, 0.40, 0.10, 0.00, 'none', ARRAY['gown_body', 'entourage'],                                  NULL, 30),
  ('chiffon',              'Chiffon',              ARRAY['silk chiffon'],                              'sheers',      40, 0.10, 0.20, 0.55, 'none', ARRAY['skirt', 'sleeves_accents', 'entourage'],                   NULL, 40),
  ('georgette',            'Georgette',            ARRAY['double georgette'],                          'sheers',      75, 0.20, 0.10, 0.40, 'none', ARRAY['skirt', 'sleeves_accents', 'entourage'],                   NULL, 50),
  ('tulle',                'Tulle',                ARRAY['illusion', 'soft tulle'],                    'sheers',      30, 0.45, 0.15, 0.70, '2way', ARRAY['skirt', 'sleeves_accents'],                                NULL, 60),
  ('organza',              'Organza',              ARRAY['crystal organza', 'silk organza'],           'sheers',      55, 0.70, 0.50, 0.60, 'none', ARRAY['skirt', 'sleeves_accents', 'barong', 'lining'],            NULL, 70),
  ('lace',                 'Lace',                 ARRAY['chantilly', 'corded lace', 'guipure'],       'laces',      120, 0.50, 0.10, 0.50, '2way', ARRAY['gown_body', 'sleeves_accents', 'entourage'],               NULL, 80),
  ('sequin',               'Sequin',               ARRAY['sequinned mesh', 'beaded lace'],             'laces',      380, 0.55, 0.95, 0.10, '2way', ARRAY['gown_body', 'sleeves_accents', 'entourage'],               NULL, 90),
  ('pina',                 'Piña',                 ARRAY['pure piña', 'pina'],                         'handwoven',   35, 0.70, 0.25, 0.65, 'none', ARRAY['barong', 'sleeves_accents', 'gown_body'],                  NULL, 100),
  ('jusi',                 'Jusi',                 ARRAY['jusilyn', 'piña-jusi'],                      'handwoven',   55, 0.55, 0.30, 0.50, 'none', ARRAY['barong', 'sleeves_accents', 'entourage'],                  NULL, 110),
  ('wool_suiting',         'Wool suiting',         ARRAY['worsted'],                                   'suitings',   270, 0.60, 0.10, 0.00, 'none', ARRAY['mens_suit'],                                              NULL, 120),
  ('linen',                'Linen',                ARRAY[]::TEXT[],                                    'suitings',   170, 0.50, 0.05, 0.05, 'none', ARRAY['mens_suit', 'barong', 'entourage'],                       NULL, 130),
  ('velvet',               'Velvet',               ARRAY['stretch velvet', 'crushed velvet'],          'structured', 300, 0.50, 0.50, 0.00, 'none', ARRAY['gown_body', 'sleeves_accents', 'mens_suit', 'entourage'], NULL, 140),
  ('stretch_crepe_jersey', 'Stretch crepe jersey', ARRAY['matte jersey', 'ITY'],                       'knits',      220, 0.30, 0.10, 0.00, '4way', ARRAY['gown_body', 'entourage'],                                  NULL, 150)
ON CONFLICT (type_id) DO NOTHING;

-- 2 ─ the shop's options, once per shop ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_gown_makers (
  vendor_profile_id  UUID        PRIMARY KEY REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  options            JSONB       NOT NULL CHECK (jsonb_typeof(options) = 'object' AND pg_column_size(options) <= 16384),
  updated_by         UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_gown_makers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vendor_gown_makers IS
  'Gown maker (2026-11-27): one shop''s Attire Maker options, set once on Shop › Specialized tools — its own price list (centavos; an unpriced line stays unpriced), how it prices (covers-until-it-costs-more or base-plus-extras), labour hours, what is in the base, seam-allowance defaults (lib/gown-maker.ts GownShopOptions, sanitized before every write). A row = the shop set it up. The shop''s own members read; only the server writes (service role, gown_tool op save). A bride never reads it: her estimate is priced on the server.';

DROP POLICY IF EXISTS vendor_gown_makers_own_read ON public.vendor_gown_makers;
CREATE POLICY vendor_gown_makers_own_read
  ON public.vendor_gown_makers
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

REVOKE ALL ON TABLE public.vendor_gown_makers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vendor_gown_makers TO authenticated;

-- 3 ─ the shop's fabrics and laces ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_gown_fabrics (
  fabric_id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id         UUID        NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  kind                      TEXT        NOT NULL CHECK (kind IN ('fabric', 'lace')),
  name                      TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  -- The shop's own stock code (printed on the swatch book). Optional.
  code                      TEXT        NULL CHECK (code IS NULL OR char_length(code) <= 40),
  -- RESTRICT: a type a fabric uses can be hidden, never deleted. NULL = the shop did not say (renders as crepe).
  type_id                   TEXT        NULL REFERENCES public.gown_fabric_types(type_id) ON DELETE RESTRICT,
  -- The colours this fabric comes in: an array of {name?, hex}.
  colours                   JSONB       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(colours) = 'array' AND pg_column_size(colours) <= 4096),
  -- The shop's cost per metre. NULL = unpriced (stays unpriced in a quote, never zero). Never sent to a bride.
  price_per_metre_centavos  BIGINT      NULL CHECK (price_per_metre_centavos IS NULL OR price_per_metre_centavos >= 0),
  -- The four tune sliders (sheen, sheer, stiff, scale offsets) the designer set against the photo.
  tune                      JSONB       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(tune) = 'object' AND pg_column_size(tune) <= 1024),
  -- R2 keys in the public setnayan-media bucket under gown/<shop>/…: a 64 px thumbnail, and a repeat tile only for a
  -- patterned cloth (a plain one makes no tile request).
  thumb_key                 TEXT        NULL CHECK (thumb_key IS NULL OR char_length(thumb_key) <= 300),
  tile_key                  TEXT        NULL CHECK (tile_key IS NULL OR char_length(tile_key) <= 300),
  active                    BOOLEAN     NOT NULL DEFAULT TRUE,
  sort                      INTEGER     NOT NULL DEFAULT 0,
  updated_by                UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_gown_fabrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vendor_gown_fabrics_shop_idx ON public.vendor_gown_fabrics (vendor_profile_id, kind, sort);
CREATE INDEX IF NOT EXISTS vendor_gown_fabrics_type_idx ON public.vendor_gown_fabrics (type_id);

COMMENT ON TABLE public.vendor_gown_fabrics IS
  'Gown maker (2026-11-27): one fabric or lace a shop stocks — name, code, type (gown_fabric_types), colours, the four tune offsets, a 64 px thumbnail and, for a patterned cloth only, a repeat tile (R2 setnayan-media, gown/<shop>/…). price_per_metre_centavos NULL = unpriced. The shop''s own members read every column; a bride in that shop''s chat sees the public columns only, through the server''s gown_tool op open — the price never leaves the server for a client. Only the server writes (gown_tool op fabric_save).';

DROP POLICY IF EXISTS vendor_gown_fabrics_own_read ON public.vendor_gown_fabrics;
CREATE POLICY vendor_gown_fabrics_own_read
  ON public.vendor_gown_fabrics
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

REVOKE ALL ON TABLE public.vendor_gown_fabrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vendor_gown_fabrics TO authenticated;

-- 4 ─ the shop's collection looks ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_gown_looks (
  look_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID        NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  name               TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  photo_key          TEXT        NULL CHECK (photo_key IS NULL OR char_length(photo_key) <= 300),
  -- A GownConfig (lib/gown-config.ts, sanitizeGownConfig before every write); the same cap as a sent design's config.
  config             JSONB       NOT NULL CHECK (jsonb_typeof(config) = 'object' AND pg_column_size(config) <= 8192),
  active             BOOLEAN     NOT NULL DEFAULT TRUE,
  sort               INTEGER     NOT NULL DEFAULT 0,
  updated_by         UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_gown_looks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vendor_gown_looks_shop_idx ON public.vendor_gown_looks (vendor_profile_id, sort);

COMMENT ON TABLE public.vendor_gown_looks IS
  'Gown maker (2026-11-27): one look in a shop''s collection — a name, an optional photo (R2 setnayan-media, gown/<shop>/…) and a saved GownConfig a bride can start from. The shop''s own members read; a bride in that shop''s chat sees the active looks through the server''s gown_tool op open. Only the server writes (gown_tool op look_save).';

DROP POLICY IF EXISTS vendor_gown_looks_own_read ON public.vendor_gown_looks;
CREATE POLICY vendor_gown_looks_own_read
  ON public.vendor_gown_looks
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

REVOKE ALL ON TABLE public.vendor_gown_looks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vendor_gown_looks TO authenticated;

-- 5 ─ a sent design ───────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gown_designs (
  design_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The shop the design is for. Always set; when the thread is set it is that thread's shop (trigger below).
  vendor_profile_id  UUID        NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The chat it was sent in. NULL only for a design the shop shared as a QR that nobody has scanned yet.
  thread_id          UUID        NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  vendor_service_id  UUID        NULL REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL,
  config             JSONB       NOT NULL CHECK (jsonb_typeof(config) = 'object' AND pg_column_size(config) <= 8192),
  -- Her numbers (GownBody) and the estimate of every gown measurement (GownMeasures) — personal data, stored only
  -- when she presses Send. NULL on a shop's own QR share (there is no bride yet).
  body               JSONB       NULL CHECK (body IS NULL OR (jsonb_typeof(body) = 'object' AND pg_column_size(body) <= 2048)),
  measures           JSONB       NULL CHECK (measures IS NULL OR (jsonb_typeof(measures) = 'object' AND pg_column_size(measures) <= 4096)),
  -- What the design needs (GownQuantities), with NO money in it. The server prices it for the shop at read time.
  quantities         JSONB       NULL CHECK (quantities IS NULL OR (jsonb_typeof(quantities) = 'object' AND pg_column_size(quantities) <= 4096)),
  -- The one number the bride saw at send. NULL = "Ask for a quote" (no priced line). Never a cost line.
  estimate_centavos  BIGINT      NULL CHECK (estimate_centavos IS NULL OR estimate_centavos >= 0),
  -- Room for the QR share (#8387, folded in by the owner 2026-11-27): a Shortlist code rides /{shop}/invite?gown=…;
  -- a Booked share is linked to its one Booked QR. All three NULL for a design sent in the chat.
  share_code         TEXT        NULL UNIQUE CHECK (share_code IS NULL OR share_code ~ '^[0-9a-f]{24,64}$'),
  share_as           TEXT        NULL CHECK (share_as IS NULL OR share_as IN ('shortlist', 'booked')),
  locked_token       TEXT        NULL UNIQUE REFERENCES public.vendor_locked_qr_tokens(token) ON DELETE SET NULL,
  created_by         UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gown_designs_in_a_chat_or_shared CHECK (thread_id IS NOT NULL OR share_code IS NOT NULL),
  CONSTRAINT gown_designs_share_code_has_a_kind CHECK ((share_code IS NULL) = (share_as IS NULL)),
  CONSTRAINT gown_designs_only_booked_has_a_code CHECK (locked_token IS NULL OR share_as = 'booked')
);

ALTER TABLE public.gown_designs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS gown_designs_thread_idx ON public.gown_designs (thread_id, created_at DESC) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gown_designs_shop_idx ON public.gown_designs (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.gown_designs IS
  'Gown maker (2026-11-27): a gown design. Sent by a bride from her chat with a shop (thread_id set): the sanitized GownConfig, her body numbers and measurement estimates (personal data, stored only on Send), the quantities the design needs (no money) and the one estimate she saw (NULL = ask for a quote). NO COST LINE IS STORED HERE — the server prices quantities for the shop at read time. Or shared by the shop as a QR (share_code / share_as / locked_token, thread_id NULL until a scan posts it into a chat). Readers: the chat''s members (the event''s hosts, that shop, its Account Manager on their own clients — the cake_designs policy shape) and the shop itself. Only the server writes (gown_tool op send, after lib/gown-config.ts sanitize*).';

-- A design's shop is its thread's shop. The shop arm of the read policy rests on this, so it is held here and not
-- only by the server that writes the row.
CREATE OR REPLACE FUNCTION public.gown_designs_shop_is_the_threads()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chat_threads t
     WHERE t.thread_id = NEW.thread_id
       AND t.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'gown_designs: the design''s shop must be its chat''s shop'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gown_designs_shop_is_the_threads ON public.gown_designs;
CREATE TRIGGER gown_designs_shop_is_the_threads
  BEFORE INSERT OR UPDATE OF thread_id, vendor_profile_id ON public.gown_designs
  FOR EACH ROW EXECUTE FUNCTION public.gown_designs_shop_is_the_threads();

REVOKE ALL ON FUNCTION public.gown_designs_shop_is_the_threads() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS gown_designs_member_read ON public.gown_designs;
CREATE POLICY gown_designs_member_read
  ON public.gown_designs
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR thread_id IN (
      SELECT t.thread_id FROM public.chat_threads t
      WHERE t.event_id IN (SELECT public.current_couple_event_ids())
         OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
         -- An Account Manager (role agent) reads the designs in their OWN clients' chats — the clause the chat and
         -- cake_designs use.
         OR (
           t.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
           AND t.event_id IN (SELECT public.agent_customer_event_ids())
         )
    )
  );

REVOKE ALL ON TABLE public.gown_designs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gown_designs TO authenticated;

-- 6 ─ the designer's tape ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gown_fittings (
  design_id   UUID        PRIMARY KEY REFERENCES public.gown_designs(design_id) ON DELETE CASCADE,
  -- Each number the designer measured, by GownMeasures key (cm). A tape number outranks typed, typed outranks an
  -- estimate (the cutting blocks read it in that order, step B6).
  fit         JSONB       NOT NULL CHECK (jsonb_typeof(fit) = 'object' AND pg_column_size(fit) <= 4096),
  fit_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.gown_fittings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.gown_fittings IS
  'Gown maker (2026-11-27): the designer''s own tape for one design — the numbers measured at a fitting, by GownMeasures key. The shop only: a bride, her co-hosts and any other shop read nothing here. Only the server writes (gown_tool op fit, Save tape on Clients › the event › Details).';

DROP POLICY IF EXISTS gown_fittings_shop_read ON public.gown_fittings;
CREATE POLICY gown_fittings_shop_read
  ON public.gown_fittings
  FOR SELECT TO authenticated
  USING (
    design_id IN (
      SELECT d.design_id FROM public.gown_designs d
      WHERE d.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

REVOKE ALL ON TABLE public.gown_fittings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gown_fittings TO authenticated;

-- 7 ─ the Toolkit SKU ─────────────────────────────────────────────────────────────────────────────────────────────
-- The Attire Maker is a top-band tool (DECISION_LOG 2026-11-23 "Top-band tools": one price for all of them; owner
-- 2026-11-27 "paid"). Its price is COPIED from the Cake Maker's row, so no amount is typed here; a row the owner
-- already edited in admin is never overwritten. No Cake Maker row (a bare replay) = no Attire Maker row: the store
-- refuses a sale with no row (order-price-authority), it never invents one.
INSERT INTO public.vendor_billing_catalog (sku_code, title, price_php, offering_type, is_active, display_order, description)
SELECT 'vendor_tool_attire_tool',
       'Attire Maker',
       c.price_php,
       c.offering_type,
       TRUE,
       c.display_order + 4,
       'Specialized tool, one-time. Clients design their gown in your chat. Owned forever, never renews.'
  FROM public.vendor_billing_catalog c
 WHERE c.sku_code = 'vendor_tool_cake_tool'
ON CONFLICT (sku_code) DO NOTHING;

COMMIT;
