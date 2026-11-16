-- material_tags_carry_the_piece — WHICH PIECE BROUGHT THE COUPLE (owner 2026-11-16).
-- Created via `pnpm migration:new`. Idempotent; ADD-ONLY.
--
-- DECISION_LOG 2026-11-16 "EVERY MATERIAL A SHOP HANDS OUT CARRIES ITS OWN TAG" (b8d39503): every printed / shared
-- material's QR or link carries `?via=<piece>` — card · standee · door · backdrop · tarp · rollup · table (the seven
-- print pieces) · sticker (the door sticker) · link (the shared link and the on-screen codes) · photo (the photo mark,
-- untagged by `src`, ruling b95998b3). The vocabulary lives in apps/web/lib/material-tags.ts (MATERIAL_VIAS); the CHECKs
-- below are the same ten words, pinned equal by apps/web/lib/material-tags.test.ts.
--
-- What this adds — nothing else:
--   1 · vendor_profile_views.via            the piece on the VIEW (its `utm` already kept the campaign tags)
--   2 · chat_threads.inquiry_via / _utm     carried onto the INQUIRY, stamped once beside inquiry_source
--   3 · event_vendors.source_via / _utm     carried onto the BOOKING, filled from the thread like `source`
--   4 · public.signup_attributions          NEW — the first piece that brought a just-made account (QR-stats
--                                           "Registered"). One row per user, written by the service role only.
--
-- 💳 MONEY-NEUTRAL BY CONSTRUCTION. No function, trigger or RLS policy that decides the booking fee reads any of these
-- columns; the fee still reads chat_threads.inquiry_source / event_vendors.source. The Ultra-only own rule (d2e360e4)
-- is decided in app code (arrivalInquirySourceOf, at inquiry time) and lands in inquiry_source as before.
--
-- NO WRITES TO EXISTING ROWS. Every new column is NULLABLE with no default, so adding it touches no row; the new table
-- starts empty. RLS on the new table is enabled at CREATE, and every browser role's grant is revoked: it is read and
-- written only through the service role (record-vendor-view.ts); a signed-in person may READ their own row
-- (own-row SELECT policy), so it can be exported to them. The three column groups mirror their siblings'
-- exposure (inquiry_source / source / utm are table-level SIU for anon + authenticated): each row is already readable
-- to whoever RLS admits, and the piece adds nothing that row does not already reveal.

-- 1 · the view -------------------------------------------------------------------------------------------------------
ALTER TABLE public.vendor_profile_views
  ADD COLUMN IF NOT EXISTS via TEXT
    CHECK (via IS NULL OR via IN ('card', 'standee', 'door', 'backdrop', 'tarp', 'rollup', 'table', 'sticker', 'link', 'photo'));
COMMENT ON COLUMN public.vendor_profile_views.via IS
  'The material tag (?via=) of the arrival — which piece the shop handed out brought this view (owner 2026-11-16, DECISION_LOG b8d39503). Vocabulary: apps/web/lib/material-tags.ts MATERIAL_VIAS. NULL = untagged.';

-- 2 · the inquiry ----------------------------------------------------------------------------------------------------
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS inquiry_via TEXT
    CHECK (inquiry_via IS NULL OR inquiry_via IN ('card', 'standee', 'door', 'backdrop', 'tarp', 'rollup', 'table', 'sticker', 'link', 'photo'));
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS inquiry_utm TEXT
    CHECK (inquiry_utm IS NULL OR char_length(inquiry_utm) <= 300);
COMMENT ON COLUMN public.chat_threads.inquiry_via IS
  'The material tag of the arrival that STARTED this thread, stamped once beside inquiry_source (owner 2026-11-16). Never read by the booking fee.';
COMMENT ON COLUMN public.chat_threads.inquiry_utm IS
  'The campaign tags (utm) of the arrival that started this thread, as one bounded string. Never read by the booking fee.';

-- 3 · the booking ----------------------------------------------------------------------------------------------------
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS source_via TEXT
    CHECK (source_via IS NULL OR source_via IN ('card', 'standee', 'door', 'backdrop', 'tarp', 'rollup', 'table', 'sticker', 'link', 'photo'));
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS source_utm TEXT
    CHECK (source_utm IS NULL OR char_length(source_utm) <= 300);
COMMENT ON COLUMN public.event_vendors.source_via IS
  'The material tag carried from the inquiry thread (chat_threads.inquiry_via), filled only while empty, like source (owner 2026-11-16). Never read by the booking fee.';
COMMENT ON COLUMN public.event_vendors.source_utm IS
  'The campaign tags carried from the inquiry thread (chat_threads.inquiry_utm), filled only while empty. Never read by the booking fee.';

-- 2+3 · READ GRANTS. chat_threads and event_vendors hold SELECT as a COLUMN-LEVEL allow-list (only INSERT/UPDATE are
-- table-level), so a new column there comes back writable but NOT readable — and PostgREST refuses the WHOLE select that
-- names it (app/v/[slug]/inquiry-actions.ts reads event_vendors.source_via/_utm under the couple's own session). Mirror
-- the siblings exactly: inquiry_source and source are SELECT for anon + authenticated, so the new columns are too.
GRANT SELECT (inquiry_via, inquiry_utm) ON public.chat_threads TO anon, authenticated;
GRANT SELECT (source_via, source_utm) ON public.event_vendors TO anon, authenticated;

-- 4 · the sign-up ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signup_attributions (
  user_id           UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  via               TEXT
    CHECK (via IS NULL OR via IN ('card', 'standee', 'door', 'backdrop', 'tarp', 'rollup', 'table', 'sticker', 'link', 'photo')),
  src               TEXT CHECK (src IS NULL OR char_length(src) <= 64),
  utm               TEXT CHECK (utm IS NULL OR char_length(utm) <= 300),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (via IS NOT NULL OR utm IS NOT NULL)
);
ALTER TABLE public.signup_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.signup_attributions FROM anon, authenticated;
GRANT ALL ON TABLE public.signup_attributions TO service_role;
-- The ONE browser reach: a signed-in person reads their OWN row (RA 10173 — it is exported to them by
-- lib/personal-data-export.ts under their own session). Never another person's; never a write.
GRANT SELECT ON TABLE public.signup_attributions TO authenticated;
DROP POLICY IF EXISTS signup_attributions_own_read ON public.signup_attributions;
CREATE POLICY signup_attributions_own_read ON public.signup_attributions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS signup_attributions_vendor_idx
  ON public.signup_attributions (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.signup_attributions IS
  'Which shop and piece (?via= / utm) brought a just-made account: written once per user, by the service role, on that account''s first tagged shop view within an hour of sign-up (apps/web/lib/record-vendor-view.ts, lib/material-tags.ts viewCountsAsSignup). Feeds the QR-stats "Registered" count (prototype qr_code_stats_2026-11-16_fable, not built). Closed to anon; authenticated reads only its own row (RA 10173 export); writes are service-role only. A user''s row dies with the user; a shop''s rows die with the shop.';

-- Post-conditions: the closed table stayed closed, and nothing was written into an existing row.
DO $post$
BEGIN
  IF has_table_privilege('anon', 'public.signup_attributions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.signup_attributions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.signup_attributions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.signup_attributions', 'DELETE') THEN
    RAISE EXCEPTION 'signup_attributions must be closed to anon, and read-only (own row) for authenticated';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.event_vendors', 'source_via', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.event_vendors', 'source_utm', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.chat_threads', 'inquiry_via', 'SELECT') THEN
    RAISE EXCEPTION 'the new columns must be readable like their siblings, or every select naming them is refused';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.signup_attributions'::regclass) THEN
    RAISE EXCEPTION 'signup_attributions must have RLS enabled';
  END IF;
END
$post$;
