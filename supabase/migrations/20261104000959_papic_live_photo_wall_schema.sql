-- ============================================================================
-- 20261104000959_papic_live_photo_wall_schema.sql
--
-- Iteration 0012 Papic · Phase-1 "Live Photo Wall" (Salamisim) — SCHEMA ONLY.
-- The in-venue real-time projection feeds off existing capture tables; this
-- migration adds the net-new wall-state columns + the durable public-broadcast
-- feed mirror + the guest-in-photo tag table + the venue display-claim table.
--
-- Design: 0012_papic.md "Phase 1 — Live Photo Wall (Salamisim)" (corpus).
-- This is the build-order P0 step. The privacy/moderation RPCs (wall_ingest,
-- wall_visible_photos reader, wall_retract, wall_cascade_guest, wall_approve_
-- caption, wall_claim_display, wall_freeze_recap) land in P1 — NOT here, because
-- a stub that skips the gate chain would be a liability. No frontend reads these
-- objects yet; the migration is additive + idempotent. No drops of shipped data.
--
-- Grounded against shipped origin/main (verified, NOT the corpus spec):
--   * Every UUID-keyed table uses a hidden `id BIGSERIAL PRIMARY KEY` + a separate
--     UUID business key; ALL FKs reference the UUID column (events(event_id),
--     guests(guest_id), …). New tables follow the same convention.
--   * `coordinator` IS a real value of the shipped `public.member_type` ENUM
--     ('couple','guest','vendor','coordinator', setnayan_base.sql:60) — so wall
--     control authority is `member_type IN ('couple','coordinator')` directly.
--     The corpus 0012/Kwento/Salamisim premise that coordinator is NOT a
--     member_type (→ a `thread_join_authorizations` table) is stale spec drift;
--     that table is intentionally NOT created here.
--   * `events` had no timezone column; one is added (PH-first default) for the
--     server-side day-of mode computation P1 needs.
--
-- Public-wall security (load-bearing): Supabase Realtime honors RLS and the
-- venue projection is an ANONYMOUS guest (custom JWT, no auth.uid()). NO table
-- here grants `TO anon`. The public `/wall` route reads the feed only through a
-- service-role server route (the shipped lib/papic-guest.ts + lib/supabase/
-- admin.ts pattern); only the couple/coordinator CONTROL strip subscribes to
-- wall_feed under its own authenticated RLS session.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Wall-state + moderation flags on the EXISTING capture tables.
--    wall_hidden_at = transient WALL-ONLY kill switch (reversible), DISTINCT
--    from the shipped `hidden_at` (durable gallery/recap suppression).
--    The wall reads ONLY wall_safe_r2_key (a gated/blurred derivative), never
--    the original r2_object_key.
-- ----------------------------------------------------------------------------
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS moderation_state TEXT NOT NULL DEFAULT 'unscreened'
    CHECK (moderation_state IN ('unscreened','clean','nsfw_blocked','consent_withheld','faceblock_withheld')),
  ADD COLUMN IF NOT EXISTS wall_safe_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS wall_hidden_at   TIMESTAMPTZ;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS moderation_state TEXT NOT NULL DEFAULT 'unscreened'
    CHECK (moderation_state IN ('unscreened','clean','nsfw_blocked','consent_withheld','faceblock_withheld')),
  ADD COLUMN IF NOT EXISTS wall_safe_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS wall_hidden_at   TIMESTAMPTZ;

COMMENT ON COLUMN public.papic_photos.wall_hidden_at IS
  'Transient wall-only kill switch (reversible). DISTINCT from hidden_at (durable gallery/recap suppression).';
COMMENT ON COLUMN public.papic_photos.wall_safe_r2_key IS
  'Gated/blurred derivative key the live wall reads. NEVER the original r2_object_key. NULL means not projection-eligible.';

-- ----------------------------------------------------------------------------
-- 2. FaceBlock primitive on guests (the multi-view rule had nothing to read).
-- ----------------------------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS faceblock_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.guests.faceblock_enabled IS
  'Guest opted to appear BLURRED on public surfaces (couple still sees clear). Distinct from photo_consent=FALSE (drop entirely).';

-- ----------------------------------------------------------------------------
-- 3. Day-of lifecycle + projection columns on events (+ the missing timezone).
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
  ADD COLUMN IF NOT EXISTS live_mode_override TEXT
    CHECK (live_mode_override IN ('coming_soon','pre_event','live','recap','archive')),
  ADD COLUMN IF NOT EXISTS live_photo_wall_visibility TEXT NOT NULL DEFAULT 'tagged_only'
    CHECK (live_photo_wall_visibility IN ('tagged_only','all_with_consent','off'));

COMMENT ON COLUMN public.events.timezone IS
  'IANA tz for server-side day-of mode computation (events had no tz before this). PH-first default.';
COMMENT ON COLUMN public.events.live_mode_override IS
  'Manual day-of mode override. NULL means computed from event_date + timezone.';
COMMENT ON COLUMN public.events.live_photo_wall_visibility IS
  'Guest PHONE-CARD global photo-wall toggle (0031). The VENUE PROJECTION (/wall) defaults to all_with_consent regardless (owner-locked 2026-06-11) — route behavior, not this column default.';

-- ----------------------------------------------------------------------------
-- 4. photo_tags — which guest is IN a photo (net-new; no such table shipped).
--    Polymorphic over both capture tables so a disposable-camera frame tags too.
--    Reads: couple/coordinator/admin. Writes: service-role / DEFINER RPC (P1) —
--    no user-facing write policy (zero-account guests have no auth.uid()).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photo_tags (
  id           BIGSERIAL PRIMARY KEY,
  tag_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  source_table TEXT NOT NULL CHECK (source_table IN ('papic_photos','papic_guest_captures')),
  source_id    UUID NOT NULL,                                       -- papic_photos.photo_id | papic_guest_captures.capture_id
  guest_id     UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  source       TEXT NOT NULL CHECK (source IN ('individual_qr','table_qr','auto_face','manual_pick')),
  confidence   NUMERIC(4,3),                                        -- face-match confidence (0.000-1.000); NULL for QR/manual
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_id, guest_id)
);
CREATE INDEX IF NOT EXISTS photo_tags_guest_idx ON public.photo_tags (guest_id);
CREATE INDEX IF NOT EXISTS photo_tags_src_idx   ON public.photo_tags (source_table, source_id);

ALTER TABLE public.photo_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS photo_tags_member_read ON public.photo_tags;
CREATE POLICY photo_tags_member_read ON public.photo_tags FOR SELECT
  TO authenticated
  USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.event_members em
             WHERE em.event_id = photo_tags.event_id
               AND em.user_id = auth.uid()
               AND em.member_type IN ('couple','coordinator'))
);
DROP POLICY IF EXISTS photo_tags_admin_all ON public.photo_tags;
CREATE POLICY photo_tags_admin_all ON public.photo_tags FOR ALL
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. wall_feed — the durable, public-broadcast projection mirror.
--    A row EXISTS only after the full gate cleared ⇒ its existence = cleared for
--    projection. Polymorphic anchor spans both capture tables. Carries ONLY the
--    safe derivative key + an approved caption — never the original key.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wall_feed (
  id                 BIGSERIAL PRIMARY KEY,
  feed_id            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  source_table       TEXT NOT NULL CHECK (source_table IN ('papic_photos','papic_guest_captures')),
  source_id          UUID NOT NULL,
  wall_safe_r2_key   TEXT NOT NULL,                                 -- gated/blurred derivative; NEVER the original key
  width_px           INTEGER,
  height_px          INTEGER,
  caption_text       TEXT,                                          -- approved Kwento lower-third (NULL until one-tap approve)
  caption_message_id UUID,                                          -- FK wired when photo_messages (Kwento) ships
  sort_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wall_hidden_at     TIMESTAMPTZ,                                   -- mirror of the source row's kill switch (derived)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_id)
);
CREATE INDEX IF NOT EXISTS wall_feed_event_live_idx
  ON public.wall_feed (event_id, sort_at DESC) WHERE wall_hidden_at IS NULL;

ALTER TABLE public.wall_feed ENABLE ROW LEVEL SECURITY;

-- Couple/coordinator CONTROL strip reads under its own authenticated session.
-- NO "TO anon" policy by design: a permissive anon SELECT would let any client
-- subscribe to any event's wall by guessing the id + leak a mis-gated row. The
-- public projection reaches wall_feed only via the service-role /api/wall route.
DROP POLICY IF EXISTS wall_feed_member_read ON public.wall_feed;
CREATE POLICY wall_feed_member_read ON public.wall_feed FOR SELECT
  TO authenticated
  USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.event_members em
             WHERE em.event_id = wall_feed.event_id
               AND em.user_id = auth.uid()
               AND em.member_type IN ('couple','coordinator'))
);
DROP POLICY IF EXISTS wall_feed_admin_all ON public.wall_feed;
CREATE POLICY wall_feed_admin_all ON public.wall_feed FOR ALL
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Writes (ingest / retract / approve-caption) go ONLY through SECURITY DEFINER RPCs (P1).

-- ----------------------------------------------------------------------------
-- 6. wall_display_sessions — venue-screen claim handshake (code/QR → display JWT).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wall_display_sessions (
  id           BIGSERIAL PRIMARY KEY,
  session_id   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  display_code TEXT NOT NULL,                                       -- rotating 6-char Crockford; printed beside the QR
  claimed_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wall_display_sessions_event_idx ON public.wall_display_sessions (event_id);

ALTER TABLE public.wall_display_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wall_display_sessions_member_manage ON public.wall_display_sessions;
CREATE POLICY wall_display_sessions_member_manage ON public.wall_display_sessions FOR ALL
  TO authenticated
  USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.event_members em
             WHERE em.event_id = wall_display_sessions.event_id
               AND em.user_id = auth.uid()
               AND em.member_type IN ('couple','coordinator'))
) WITH CHECK (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.event_members em
             WHERE em.event_id = wall_display_sessions.event_id
               AND em.user_id = auth.uid()
               AND em.member_type IN ('couple','coordinator'))
);
-- The /wall claim handshake validates the code + mints the display JWT via service-role (P1).

-- ----------------------------------------------------------------------------
-- 7. Realtime publication — ONLY the couple/coordinator control strip subscribes
--    to wall_feed under its own RLS session. The public projection uses
--    server-authorized BROADCAST, not this publication. (Idempotent guard per
--    20260514140000_enable_realtime_chat.sql.)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wall_feed'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_feed;
  END IF;
END $$;

COMMIT;
