-- cake_maker_shop_and_designs
--
-- 🎂 THE CAKE MAKER (DECISION_LOG 2026-11-21 "CAKE MAKER — APPROVED TO BUILD", "THE CAKE MAKER LIVES IN THE CHAT, NOT ON
-- SERVICE CARDS", "CAKE MAKER v5 APPROVED", v6 = the build reference; "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND
-- UP"). Additive only — every existing row reads exactly as before.
--
-- RULE 0 — what was checked before adding anything:
--   • The shop's options are set ONCE PER SHOP (owner: "should not be available on service cards"). A shop-level
--     vendor_packages row (vendor_service_id NULL) was checked and REFUSED: about twenty readers list a shop's packages
--     with no card filter (the shop page /v/[slug], Packages, Proposals, the chat's compose options), so a Cake Maker
--     package would surface there as a bookable package. vendor_profiles has no settings jsonb. Hence one row per shop.
--   • The plan gate = the shipped TIER_CAPS (lib/vendor-tier-caps.ts `specialTools`); its start date reuses the
--     platform_settings singleton (the booking_fee_free_until precedent) — no new settings table.
--   What is added:
--   1. platform_settings.special_tools_paid_from — from when the special tools are Pro and up (NULL = open to all).
--   2. vendor_cake_makers — the shop's Cake Maker options (lib/cake-maker.ts CakeShopOptions, sanitized by
--      sanitizeCakeShopOptions before every write). The shop's own members read it; only the server writes.
--   3. cake_designs — the design a couple SENT in the chat, stored once as the sanitized config + its words + its estimate, so the
--      card and the order read the design itself, never a re-parse of the chat text. Thread members read it; only
--      the server writes it, after lib/cake-config.ts sanitizeCakeConfig.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1 ─ the special tools' start date
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS special_tools_paid_from TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.special_tools_paid_from IS
  'Special tools (the Cake Maker first) are included in Supplier Pro and up FROM this moment (owner: "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP"). NULL or a future date = open to every plan. Edited on /admin/launch-offer. Read by lib/special-tools.ts.';

-- 2 ─ the shop's options, once per shop
CREATE TABLE IF NOT EXISTS public.vendor_cake_makers (
  vendor_profile_id  UUID        PRIMARY KEY REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  options            JSONB       NOT NULL CHECK (jsonb_typeof(options) = 'object' AND pg_column_size(options) <= 16384),
  updated_by         UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_cake_makers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vendor_cake_makers IS
  'Cake Maker (2026-11-21): one shop''s Cake Maker options, set once on Shop › Specialized tools › Cake Maker (lib/cake-maker.ts CakeShopOptions). A row = the shop''s Cake Maker is set up. The shop''s own members read; only the server writes (service role, after sanitizeCakeShopOptions). A couple''s designer reads it server-side, scoped to the shop of their own chat.';

DROP POLICY IF EXISTS vendor_cake_makers_own_read ON public.vendor_cake_makers;
CREATE POLICY vendor_cake_makers_own_read
  ON public.vendor_cake_makers
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

REVOKE ALL ON TABLE public.vendor_cake_makers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vendor_cake_makers TO authenticated;

-- 3 ─ the sent design
CREATE TABLE IF NOT EXISTS public.cake_designs (
  design_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  vendor_service_id  UUID        NULL REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL,
  config             JSONB       NOT NULL CHECK (jsonb_typeof(config) = 'object' AND pg_column_size(config) <= 8192),
  design             JSONB       NOT NULL CHECK (jsonb_typeof(design) = 'object' AND pg_column_size(design) <= 16384),
  estimate_centavos  BIGINT      NULL CHECK (estimate_centavos IS NULL OR estimate_centavos >= 0),
  created_by         UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cake_designs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS cake_designs_thread_idx ON public.cake_designs (thread_id, created_at DESC);

COMMENT ON TABLE public.cake_designs IS
  'Cake Maker (2026-11-21): a design a couple sent from "Design a cake" in the chat — the sanitized config (lib/cake-config.ts), its words and priced lines as the couple saw them (design: lib/cake-maker.ts CakeDesign, so a later change to the shop''s options never rewrites a sent design) and its estimate at send time (NULL when the shop had no priced cake card). The chat message names its design_id ("Design ref:"). vendor_service_id = the cake card whose one price it was estimated from. Thread members read; only the server writes (service role, after sanitizeCakeConfig).';

DROP POLICY IF EXISTS cake_designs_member_read ON public.cake_designs;
CREATE POLICY cake_designs_member_read
  ON public.cake_designs
  FOR SELECT TO authenticated
  USING (
    thread_id IN (
      SELECT t.thread_id FROM public.chat_threads t
      WHERE t.event_id IN (SELECT public.current_couple_event_ids())
         OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
         -- An Account Manager (role agent) reads the cake cards in their OWN clients' chats — the same clause the
         -- chat itself uses (ship review 22 Nov).
         OR (
           t.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
           AND t.event_id IN (SELECT public.agent_customer_event_ids())
         )
    )
  );

REVOKE ALL ON TABLE public.cake_designs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cake_designs TO authenticated;

COMMIT;
