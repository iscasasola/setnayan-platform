-- video_link_titles_and_a_refund_notice
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS ·
-- CREATE OR REPLACE FUNCTION · DROP CONSTRAINT IF EXISTS before ADD ·
-- ADD VALUE IF NOT EXISTS. ALTERs only — no row is written here.
--
-- Supplier Build 2, the leftovers (owner 9 Nov: "finish it"; refunds: "yes build this").
--
-- 1 · A VIDEO LINK CAN HAVE A TITLE — `vendor_profiles.gallery_video_titles`.
--     The approved prototype v118 draws a Title on every Portfolio › Video link
--     row; the shipped column `gallery_video_links` (TEXT[], ≤ 10) stores URLs
--     only (B2-B owner call (a), plans/supplier_build_2_2026-11-08).
--     ⚖ WHY A URL-KEYED jsonb MAP AND NOT A PARALLEL TEXT[] OF TITLES:
--       · a parallel array is matched by POSITION, so any writer that rewrites
--         the links without knowing about titles (an older editor, a sync, a
--         hand fix) silently moves every title onto the WRONG video;
--       · a map keyed by the link itself cannot mis-pair: a link with no key
--         simply has no title, and the row falls back to the link's host;
--       · `gallery_video_links` keeps its type, its CHECK and all nine of its
--         readers untouched — nothing that reads URLs today has to change.
--     The one writer (`updateVendorProfileField('gallery_videos')`) rewrites the
--     map with the links in the same UPDATE and drops keys for removed links.
--     NOT NULL DEFAULT '{}': every existing shop reads "no titles", which is
--     the truth — none was ever asked for.
--
-- 2 · THE COUPLE IS TOLD, IN THE APP, WHEN A SUPPLIER RECORDS A REFUND.
--     DECISION_LOG 2026-11-08 "A RECORDED REFUND LOWERS PAID" listed the couple
--     notice as not yet built. A label the enum has never heard of is REFUSED,
--     NOT THROWN (`emitNotification` logs and carries on), so the type lands
--     here, before the code that emits it. In-app only — it is NOT on the email
--     allowlist (owner 2026-10-11: no new emails without his word); held by
--     `lib/couple-supplier-notices.ts` (reach: 'app_only').
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Video link titles ───────────────────────────────────────────────────
-- An object of { "<link>": "<title>" }, each title a non-blank string of at most
-- 80 characters. IMMUTABLE + plain SQL so the CHECK can call it.
CREATE OR REPLACE FUNCTION public.video_titles_are_short(p_titles JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_typeof(p_titles) = 'object'
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_each(p_titles) AS e(k, v)
        WHERE jsonb_typeof(e.v) <> 'string'
           OR char_length(e.v #>> '{}') NOT BETWEEN 1 AND 80
           OR char_length(e.k) > 2000
     );
$$;

COMMENT ON FUNCTION public.video_titles_are_short(JSONB) IS
  'CHECK helper for vendor_profiles.gallery_video_titles: an object of link → title, each title 1–80 characters. 20271334860034.';

-- Exposure: a CHECK helper is evaluated as the writing role, so `authenticated` (the shop owner saving their videos)
-- keeps EXECUTE; `anon` never writes vendor_profiles and gets none (the change_request_payload_ok precedent).
REVOKE ALL ON FUNCTION public.video_titles_are_short(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.video_titles_are_short(JSONB) TO authenticated, service_role;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS gallery_video_titles JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_gallery_video_titles_shape;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_gallery_video_titles_shape
  CHECK (public.video_titles_are_short(gallery_video_titles));

COMMENT ON COLUMN public.vendor_profiles.gallery_video_titles IS
  'Optional title per Portfolio video link, keyed by the link exactly as stored in gallery_video_links ({"https://youtu.be/x": "Ana & Ben · same-day edit"}). A link with no key has no title (the row shows its host). Written only with the links, in one UPDATE. Supplier Build 2, 2026-11-09.';

-- Born readable by the shop (and the console) the way every post-lockdown column is (20271217955839's column
-- allowlist — lint-vendor-profiles-column-grants.mjs): its own SELECT grant to `authenticated`, none to anon (the
-- public shop page reads it on the service client), and `vendor_profiles_self` rebuilt so its frozen projection
-- carries it. The block below is 20271320303985's, word for word.
GRANT SELECT (gallery_video_titles) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (gallery_video_titles) ON public.vendor_profiles FROM anon;
-- Written by the shop's own session (the Video links editor, beside the links) — the venue-dimension columns' shape
-- (20271120090000). Row-level policy still decides WHICH row.
GRANT UPDATE (gallery_video_titles) ON public.vendor_profiles TO authenticated;

DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vendor_profiles';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0
     OR position('gallery_video_titles' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock or video-title columns';
  END IF;
  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;
REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';

-- ── 2 · The couple's refund notice ──────────────────────────────────────────
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'client_refund_recorded';
