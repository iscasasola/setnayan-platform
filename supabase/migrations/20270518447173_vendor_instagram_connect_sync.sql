-- ============================================================================
-- 20270518447173_vendor_instagram_connect_sync.sql
-- Vendor "Connect Instagram + sync posts into the portfolio".
--
-- A vendor (Business/Creator IG account) connects their Instagram via the
-- Instagram Graph API OAuth flow, then manually syncs their recent posts into
-- the SAME unified public Portfolio gallery (alongside portfolio_r2_keys +
-- gallery_video_links). Manual "Sync now" only for v1 — no background polling.
--
-- FULLY INERT until Meta is configured (META_APP_ID / META_APP_SECRET unset):
-- the OAuth start route returns a friendly "not configured" 503 and the vendor
-- UI shows a "coming soon" state — no table access is required for the inert
-- path, so a pre-apply DB simply never sees a connection row.
--
-- Two RLS-enabled tables (RLS enabled at CREATE TABLE time):
--
--   1. vendor_ig_connections — one row per vendor. Holds the OAuth access token
--      (encrypted at-rest via lib/encryption AES-256-GCM, same helper as the
--      Photo-Delivery / integration secrets). The vendor may READ their
--      connection STATUS (username, connected_at, last_synced_at, status) but
--      NEVER the token: the token column is stripped from the vendor-readable
--      surface by column-level GRANT (see the REVOKE + column GRANT below), and
--      all writes go through the server-only callback/sync using the service
--      role. Admin can inspect for support.
--
--   2. vendor_ig_media — the synced items. Images are COPIED into
--      setnayan-media R2 (r2_key = r2://setnayan-media/…), so the public
--      profile serves a stable Setnayan-hosted URL (IG media URLs are
--      short-lived + CDN-signed). Videos are NOT re-hosted — we keep the
--      permalink + thumbnail and render a link-out. The vendor can toggle
--      show_on_profile per item; the public page reads show_on_profile=TRUE
--      rows server-side (service role) alongside the existing portfolio.
--
-- RLS pattern mirrors the canonical "vendor owns their rows" policy from
-- vendor_services_owner (migration 20260514010000):
--   vendor_profile_id IN (SELECT vendor_profile_id FROM vendor_profiles
--                         WHERE user_id = auth.uid())
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_ig_connections — one OAuth connection per vendor
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_ig_connections (
  vendor_ig_connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id       UUID NOT NULL
                            REFERENCES public.vendor_profiles(vendor_profile_id)
                            ON DELETE CASCADE,
  -- Instagram Graph identifiers
  ig_user_id              TEXT NOT NULL,
  ig_username             TEXT,
  -- OAuth token (AES-256-GCM ciphertext produced by lib/encryption.encryptToken).
  -- NEVER exposed to the vendor client — column-level GRANT below strips it from
  -- the authenticated role; only the service role reads it.
  access_token_enc        TEXT NOT NULL,
  token_expires_at        TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'connected'
                            CHECK (status IN ('connected', 'error', 'revoked')),
  status_detail           TEXT,
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vendor_ig_connections IS
  'One Instagram OAuth connection per vendor. access_token_enc is AES-256-GCM ciphertext, never exposed to the vendor client (service-role only).';
COMMENT ON COLUMN public.vendor_ig_connections.access_token_enc IS
  'Encrypted-at-rest (lib/encryption). Column-level GRANT strips it from the authenticated role; only the service role can read it.';

-- One connection per vendor.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_ig_connections_one_per_vendor
  ON public.vendor_ig_connections (vendor_profile_id);

ALTER TABLE public.vendor_ig_connections ENABLE ROW LEVEL SECURITY;

-- Vendor reads their OWN connection row (status only — the token column is
-- withheld by the column GRANT further down). Writes go through the service
-- role in the server-only OAuth callback / sync, so there is NO vendor
-- INSERT/UPDATE/DELETE policy.
DROP POLICY IF EXISTS vendor_ig_connections_owner_read ON public.vendor_ig_connections;
CREATE POLICY vendor_ig_connections_owner_read
  ON public.vendor_ig_connections FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Admin can inspect for support.
DROP POLICY IF EXISTS vendor_ig_connections_admin_all ON public.vendor_ig_connections;
CREATE POLICY vendor_ig_connections_admin_all
  ON public.vendor_ig_connections FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Column-level defense-in-depth: withhold the ciphertext from the authenticated
-- role entirely. Even though RLS gates the ROW, a SELECT * by a vendor must
-- never carry the token. Grant every column EXCEPT access_token_enc. The
-- service role (used by the server routes) bypasses these grants + RLS.
REVOKE ALL ON public.vendor_ig_connections FROM authenticated;
GRANT SELECT (
  vendor_ig_connection_id,
  vendor_profile_id,
  ig_user_id,
  ig_username,
  token_expires_at,
  status,
  status_detail,
  connected_at,
  last_synced_at,
  created_at,
  updated_at
) ON public.vendor_ig_connections TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. vendor_ig_media — synced posts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_ig_media (
  vendor_ig_media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id)
                       ON DELETE CASCADE,
  ig_media_id        TEXT NOT NULL,
  -- IMAGE | CAROUSEL_ALBUM (re-hosted) | VIDEO (link-out only, r2_key NULL)
  media_type         TEXT NOT NULL DEFAULT 'IMAGE'
                       CHECK (media_type IN ('IMAGE', 'CAROUSEL_ALBUM', 'VIDEO')),
  -- r2://setnayan-media/… ref for re-hosted images; NULL for VIDEO (we don't
  -- re-host video, only link out to the permalink + show its thumbnail).
  r2_key             TEXT,
  -- Thumbnail (for VIDEO link-out cards). r2://… ref when re-hosted, else NULL.
  thumbnail_r2_key   TEXT,
  permalink          TEXT,
  caption            TEXT,
  taken_at           TIMESTAMPTZ,
  show_on_profile    BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vendor_ig_media IS
  'Instagram posts synced into the vendor public Portfolio. Images are re-hosted in setnayan-media R2 (r2_key); videos link out (permalink + thumbnail). show_on_profile gates public render.';

-- Dedupe: one row per (vendor, ig_media_id) — re-sync upserts in place.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_ig_media_unique_media
  ON public.vendor_ig_media (vendor_profile_id, ig_media_id);
CREATE INDEX IF NOT EXISTS vendor_ig_media_profile_idx
  ON public.vendor_ig_media (vendor_profile_id);

ALTER TABLE public.vendor_ig_media ENABLE ROW LEVEL SECURITY;

-- Vendor reads their own synced media.
DROP POLICY IF EXISTS vendor_ig_media_owner_read ON public.vendor_ig_media;
CREATE POLICY vendor_ig_media_owner_read
  ON public.vendor_ig_media FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Vendor UPDATEs only their own rows (used to flip show_on_profile). INSERTs
-- (the sync) go through the service role, so there's no vendor INSERT policy;
-- constraining UPDATE to the owned rows + WITH CHECK keeps the vendor from
-- reassigning a row to another vendor.
DROP POLICY IF EXISTS vendor_ig_media_owner_update ON public.vendor_ig_media;
CREATE POLICY vendor_ig_media_owner_update
  ON public.vendor_ig_media FOR UPDATE
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Public read of shown items on a PUBLISHED vendor (marketplace discovery). The
-- page loader also reads server-side via the service role, but this policy lets
-- an anon/authenticated client read directly if ever needed, matching
-- vendor_services_public_read.
DROP POLICY IF EXISTS vendor_ig_media_public_read ON public.vendor_ig_media;
CREATE POLICY vendor_ig_media_public_read
  ON public.vendor_ig_media FOR SELECT
  TO anon, authenticated
  USING (
    show_on_profile = TRUE
    AND vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
  );

-- Admin full access.
DROP POLICY IF EXISTS vendor_ig_media_admin_all ON public.vendor_ig_media;
CREATE POLICY vendor_ig_media_admin_all
  ON public.vendor_ig_media FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. CSRF state for the OAuth start -> callback handshake (vendor-scoped)
-- ----------------------------------------------------------------------------
-- Random nonce we generate at /connect and verify on /callback (confirms the
-- code came back to OUR initiation + recovers vendor_profile_id). Only the
-- service role touches this; admin may inspect. Rows expire after 10 min.
CREATE TABLE IF NOT EXISTS public.vendor_ig_oauth_state (
  state_token       TEXT PRIMARY KEY,
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id)
                      ON DELETE CASCADE,
  initiated_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_ig_oauth_state_created_idx
  ON public.vendor_ig_oauth_state (created_at);

ALTER TABLE public.vendor_ig_oauth_state ENABLE ROW LEVEL SECURITY;

-- No vendor-readable policy — server-role only. Admin can inspect.
DROP POLICY IF EXISTS vendor_ig_oauth_state_admin_read ON public.vendor_ig_oauth_state;
CREATE POLICY vendor_ig_oauth_state_admin_read
  ON public.vendor_ig_oauth_state FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;
