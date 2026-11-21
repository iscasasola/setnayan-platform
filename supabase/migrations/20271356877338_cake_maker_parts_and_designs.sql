-- cake_maker_parts_and_designs
--
-- 🎂 THE CAKE MAKER (DECISION_LOG 2026-11-21 "CAKE MAKER — APPROVED TO BUILD" + the controller's v2 rulings: up to
-- 10 layers · real vs display tiers · per-tier accents · arrangement · flowing accent · monogram · cupcakes ·
-- "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP"). Additive only — every existing row reads exactly as before.
--
-- RULE 0 — what was checked before adding anything (supabase/security/prod-schema.snapshot.txt):
--   • Every cake choice is a SHIPPED choice line (vendor_package_items + vendor_package_item_options): the Standard
--     option at +0, extras in price_delta_centavos (>= 0), "Choose 1–3" = pick_min/pick_max. Flavour and accent are
--     one top-level line per tier, so the shipped pricer charges a flavour extra per tier with NO change.
--   • The message = a SHIPPED Form Maker short_answer question (vendor_questions, linked through
--     vendor_form_service_links).
--   • The plan gate = the shipped TIER_CAPS (lib/vendor-tier-caps.ts `specialTools`); its start date reuses the
--     platform_settings singleton (the booking_fee_free_until precedent) — no new settings table.
--   What NO existing column or table holds, and so is added here:
--   1. vendor_package_items.cake_part — which part of the cake a line is (a line's name is supplier-typed and
--      cannot be an identity).
--   2. vendor_package_item_options.look_key — which catalog look (lib/cake-config.ts) or tier count an option is.
--   3. vendor_questions.max_letters — the longest answer ("Up to 40 letters").
--   4. platform_settings.special_tools_paid_from — from when the special tools are Pro and up (NULL = open to all).
--   5. cake_designs — the design a couple SENT, stored once as the sanitized config + its estimate, so the received
--      card and the order read the design itself, never a re-parse of the chat text. Thread members read it (the
--      thread_service_interests pattern); only the server writes it, after lib/cake-config.ts sanitizeCakeConfig.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1 ─ the part tag
ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS cake_part TEXT;

ALTER TABLE public.vendor_package_items
  DROP CONSTRAINT IF EXISTS vendor_package_items_cake_part_ck;
ALTER TABLE public.vendor_package_items
  ADD CONSTRAINT vendor_package_items_cake_part_ck
  CHECK (cake_part IS NULL OR cake_part IN (
    'real_tiers', 'display_tiers', 'flavour', 'accent', 'arrangement', 'finish', 'flowing', 'topper',
    'monogram', 'colours', 'cupcakes', 'cupcake_flavour', 'cupcake_display'
  ));

COMMENT ON COLUMN public.vendor_package_items.cake_part IS
  'Cake Maker (2026-11-21): which part of a cake card''s "Your cake options" this line is (lib/cake-maker.ts CAKE_PARTS). NULL = an ordinary line (every row before this migration). Flavour and accent lines are one per tier, bottom tier first by display_order.';

-- 2 ─ the catalog key
ALTER TABLE public.vendor_package_item_options
  ADD COLUMN IF NOT EXISTS look_key TEXT;

ALTER TABLE public.vendor_package_item_options
  DROP CONSTRAINT IF EXISTS vendor_package_item_options_look_key_ck;
ALTER TABLE public.vendor_package_item_options
  ADD CONSTRAINT vendor_package_item_options_look_key_ck
  CHECK (look_key IS NULL OR look_key ~ '^[a-z_]{1,24}(:[0-9]{1,3})?$');

COMMENT ON COLUMN public.vendor_package_item_options.look_key IS
  'Cake Maker (2026-11-21): which catalog look (lib/cake-config.ts) or count this option is — e.g. drip, real:3, display:1, fl:2, pack:24. NULL = an ordinary option.';

-- 3 ─ the message cap
ALTER TABLE public.vendor_questions
  ADD COLUMN IF NOT EXISTS max_letters INT;

ALTER TABLE public.vendor_questions
  DROP CONSTRAINT IF EXISTS vendor_questions_max_letters_ck;
ALTER TABLE public.vendor_questions
  ADD CONSTRAINT vendor_questions_max_letters_ck
  CHECK (max_letters IS NULL OR max_letters BETWEEN 1 AND 200);

COMMENT ON COLUMN public.vendor_questions.max_letters IS
  'Cake Maker (2026-11-21): the longest answer a couple may write ("Message on the cake · up to 40 letters"). NULL = the shipped ANSWER_MAX.';

-- 4 ─ the special tools' start date
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS special_tools_paid_from TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.special_tools_paid_from IS
  'Special tools (the Cake Maker first) are included in Supplier Pro and up FROM this moment (owner: "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP"). NULL or a future date = open to every plan. Edited on /admin/launch-offer. Read by lib/special-tools.ts.';

-- 5 ─ the sent design
CREATE TABLE IF NOT EXISTS public.cake_designs (
  design_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          UUID        NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  vendor_service_id  UUID        NULL REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL,
  config             JSONB       NOT NULL CHECK (jsonb_typeof(config) = 'object' AND pg_column_size(config) <= 8192),
  estimate_centavos  BIGINT      NOT NULL CHECK (estimate_centavos >= 0),
  created_by         UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cake_designs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS cake_designs_thread_idx ON public.cake_designs (thread_id, created_at DESC);

COMMENT ON TABLE public.cake_designs IS
  'Cake Maker (2026-11-21): a design a couple sent from "Design your cake" — the sanitized config (lib/cake-config.ts) and the shipped pricer''s estimate at send time. The chat message names its design_id ("Design ref:"). Thread members read; only the server writes (service role, after sanitizeCakeConfig).';

-- Thread members read (couple via their event, supplier via their shop) — the thread_service_interests pattern.
DROP POLICY IF EXISTS cake_designs_member_read ON public.cake_designs;
CREATE POLICY cake_designs_member_read
  ON public.cake_designs
  FOR SELECT TO authenticated
  USING (
    thread_id IN (
      SELECT t.thread_id FROM public.chat_threads t
      WHERE t.event_id IN (SELECT public.current_couple_event_ids())
         OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- No browser writes: no INSERT/UPDATE/DELETE policy, and the grants say the same.
REVOKE ALL ON TABLE public.cake_designs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cake_designs TO authenticated;

COMMIT;
