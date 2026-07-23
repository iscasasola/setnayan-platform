-- ============================================================================
-- 20270920050000_open_browse_live_media_audience.sql
--
-- OPEN-BROWSE PR5 privacy — parts (c) audience + (e) live-media public gate.
--
-- 1. events.live_media_public BOOLEAN NOT NULL DEFAULT FALSE
--    Owner decision 2026-07-23: livestream + Live Photo Wall are GUESTS-ONLY by
--    default; the couple opts in to public. The site's ANONYMOUS render of
--    watch-live / live-wall (site-body.tsx, the cookie-less remote-relatives
--    path) is now gated on this column via resolveSiteBodyPlan's new
--    `liveMediaVisible` field (= guest OR live_media_public). LIVE on merge (not
--    flag-dark): every existing event defaults FALSE, so cookie-less viewers
--    stop seeing live media during the live window until the couple opts in.
--    The toggle UI lands in PR9; guests (cookie holders) are unaffected.
--
-- 2. invitation_widgets.audience TEXT NOT NULL DEFAULT 'public'
--    CHECK (audience IN ('public','guests_only'))
--    The per-widget who-can-see dial (owner decision 2026-07-23: PUBLIC for
--    everyone, per-couple dial, NO guests_only backfill). ZERO readers until
--    PR7 branches on it inside resolveSiteBodyPlan (public firewall). Sibling of
--    PR4's `mode` column (mode = show/hide; audience = who); PR7 ANDs them.
--    Inert at merge — no code reads or writes it yet, and no backfill runs.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS; DROP CONSTRAINT IF EXISTS + ADD.
-- ============================================================================

BEGIN;

-- 1. events.live_media_public — the couple's opt-in for anonymous live media.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS live_media_public BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.live_media_public IS
  'Open-browse PR5 (owner 2026-07-23): FALSE (default) = livestream + Live '
  'Photo Wall are guests-only; TRUE = the couple opted the ANONYMOUS (cookie-'
  'less) live-media render public. Read by resolveSiteBodyPlan (liveMediaVisible '
  '= guest OR live_media_public) — LIVE, not flag-dark. Toggle UI in PR9. Guests '
  '(cookie holders) always see live media regardless. Distinct from the '
  'landing_page_visibility private-until-launch wall, which stays the outer gate.';

-- 2. invitation_widgets.audience — inert per-widget who-can-see dial (PR7 reads).
ALTER TABLE public.invitation_widgets
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'public';

ALTER TABLE public.invitation_widgets
  DROP CONSTRAINT IF EXISTS invitation_widgets_audience_check;
ALTER TABLE public.invitation_widgets
  ADD CONSTRAINT invitation_widgets_audience_check
  CHECK (audience IN ('public', 'guests_only'));

COMMENT ON COLUMN public.invitation_widgets.audience IS
  'Open-browse PR5 (owner 2026-07-23): who can see this widget — public (default '
  '— PUBLIC for everyone, per-couple dial) or guests_only. NO guests_only '
  'backfill (owner override). ZERO readers until PR7 ANDs it with `mode` inside '
  'resolveSiteBodyPlan (mode = show/hide, audience = who). Inert at merge.';

COMMIT;
