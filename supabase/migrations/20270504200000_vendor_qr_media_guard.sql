-- vendor_qr_media_guard
-- QR-in-media integrity guard (owner-locked 2026-07-03): the QR generators
-- (Shortlist/invite QR → /vendor-invite/<slug> · Locked QR → /vendor/lock/<token>)
-- are the ONLY free customer-import channel, and they are for in-person,
-- already-closed clients. A vendor who embeds their QR inside photos/videos on
-- their PUBLIC website (/v/[slug]) turns the marketplace page into a self-serve
-- import funnel — visitors scan and enter as `source='vendor_invite'` imports,
-- dodging the inquiry path and cheapening the "Verified booking" badge. Such
-- media is INVALID.
--
-- Enforcement is two-layer:
--   1. REJECT-AT-SAVE (owner-approved 2026-07-03): server actions that persist
--      vendor-website media refs scan the authoritative R2 bytes for a QR whose
--      payload targets a vendor-funnel path (directly, or after server-side
--      redirect resolution — closing the URL-shortener loophole) and refuse the
--      save. That layer is pure application code; no schema.
--   2. RETRO-SCAN → this table: an admin action sweeps ALREADY-uploaded media
--      and files a review row per hit. Flag-and-review — the sweep never
--      auto-deletes; an admin decides.
--
-- Deliberately scoped to VENDOR-FUNNEL payloads, not "any QR": genuine wedding
-- portfolio photos legitimately contain guest/table/event QR codes (Papic is
-- QR-heavy) and must never be invalidated.
--
-- RLS mirrors vendor_image_flags (migration 20270330665855): admin read +
-- update; all writes via the service-role admin client.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_qr_media_flags (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('N'),
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The exact stored TEXT value of the media column (an `r2://bucket/key` ref,
  -- or a legacy http(s) URL for old logos).
  r2_ref             TEXT NOT NULL,
  surface            TEXT NOT NULL CHECK (
                       surface IN (
                         'portfolio',
                         'logo',
                         'microsite_hero',
                         'service_primary',
                         'service_showcase'
                       )
                     ),
  -- What the embedded QR decoded to (the raw payload string).
  decoded_payload    TEXT NOT NULL,
  -- The final URL after server-side redirect resolution, when the payload was
  -- an off-platform URL (shortener) that landed on a vendor-funnel path. NULL
  -- when the payload itself was the funnel URL.
  resolved_url       TEXT,
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'cleared', 'removed')),
  resolution_notes   TEXT,
  reviewed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Dedup: one row per offending media object per vendor — re-scans never
  -- duplicate a flag.
  UNIQUE (vendor_profile_id, r2_ref)
);

CREATE INDEX IF NOT EXISTS vendor_qr_media_flags_status_idx
  ON public.vendor_qr_media_flags(status);
CREATE INDEX IF NOT EXISTS vendor_qr_media_flags_vendor_idx
  ON public.vendor_qr_media_flags(vendor_profile_id);

ALTER TABLE public.vendor_qr_media_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_qr_media_flags_admin_read ON public.vendor_qr_media_flags;
CREATE POLICY vendor_qr_media_flags_admin_read ON public.vendor_qr_media_flags
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS vendor_qr_media_flags_admin_update ON public.vendor_qr_media_flags;
CREATE POLICY vendor_qr_media_flags_admin_update ON public.vendor_qr_media_flags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT is done by the service-role admin client only (the retro-scan admin
-- action); RLS grants no INSERT to `authenticated`. Same honest caveat as the
-- repost-watch tables: deny-by-default blocks vendors, but the actual write
-- path bypasses RLS — the guard is "only trusted server code builds the admin
-- client".

COMMENT ON TABLE public.vendor_qr_media_flags IS
  'QR-in-media integrity review queue (owner-locked 2026-07-03). A row = a '
  'vendor-website media object (portfolio/logo/hero/service photo) containing '
  'a QR code that targets a vendor-funnel path (/vendor-invite/, /vendor/lock/) '
  'directly or after redirect resolution. New uploads are rejected at save '
  'time; this table holds RETRO-scan hits on already-uploaded media for admin '
  'review. Admin-read/update RLS; writes via the service-role admin client.';

COMMIT;
