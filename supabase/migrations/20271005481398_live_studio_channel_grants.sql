-- live_studio_channel_grants — the PLATFORM-LEVEL (channel-keyed) YouTube OAuth
-- grant for the Setnayan-owned channel pool.
--
-- WAVE 9 · owner-confirmed 2026-07-26 ("so we connect to our setnayan youtube
-- account?" → YES). Live_Studio_Unified_Spec_2026-07-25.md § 4h.
--
-- ── WHY A NEW TABLE AND NOT `oauth_grants` ──────────────────────────────────
-- `oauth_grants` (20260516261000) is per-COUPLE by construction and cannot host
-- this grant without being damaged for its existing users:
--   • `event_id uuid NOT NULL REFERENCES events(event_id)` — a Setnayan pool
--     channel belongs to NO event. It serves many, sequentially. Dropping the
--     NOT NULL would weaken a live, selling table (Cast BYO + Papic Drive) for
--     the benefit of a flag-dark one.
--   • `UNIQUE (event_id, provider)` — one grant per event. The pool model is the
--     mirror image: one grant per CHANNEL, many events over its life.
--   • ⚠ THE SHARP ONE — RLS policy `event_member_reads_oauth_grants` grants
--     `SELECT` on the WHOLE ROW (RLS is row-level, not column-level) to any
--     authenticated member of the event, and the row carries `refresh_token` +
--     `access_token` in plaintext. That is tolerable for a BYO grant (it is the
--     couple's own Google account, and only their own row is reachable). It
--     would be a CREDENTIAL LEAK here: these tokens control a SETNAYAN channel
--     that other couples' weddings also stream on. Reusing the table would mean
--     betting the platform channel on a NULL `event_id` never matching
--     `current_event_ids()` — a correct bet today, and exactly the kind of
--     bet that a future policy edit silently loses.
--
-- So: a dedicated table with **RLS enabled and NO POLICY AT ALL** — service-role
-- only, the same posture as `live_studio_roam_streams` (secret stream keys) and
-- `panood_broadcasts`. No couple, no coordinator, no admin session, and no anon
-- key can read a row here through PostgREST. The only reader is
-- `lib/live-studio-channel-grants.ts` behind the service role.
--
-- The BYO path (`oauth_grants` provider='youtube') is left completely untouched
-- and keeps working exactly as today.
--
-- KEEP THIS MIGRATION IDEMPOTENT (repo convention):
--   • CREATE TABLE IF NOT EXISTS …  (+ ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …

-- ===========================================================================
-- 1. live_studio_channel_grants — one OAuth grant per POOL CHANNEL.
--    Keyed on live_studio_roam_channel_pool.id, so "which channel does this
--    token drive" is a foreign key rather than a convention. ON DELETE CASCADE:
--    removing a channel from the pool must not leave its credentials behind.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.live_studio_channel_grants (
  id                      bigserial PRIMARY KEY,
  channel_pool_id         bigint NOT NULL UNIQUE
                            REFERENCES public.live_studio_roam_channel_pool(id) ON DELETE CASCADE,
  -- Denormalised copy of the channel this grant was minted for. Not the join key
  -- (that is channel_pool_id) — it exists so a re-consent can be REFUSED when the
  -- owner accidentally authorises a different Google account than the pool row
  -- expects, instead of silently repointing a pool channel at someone else's
  -- YouTube.
  youtube_channel_id      text NOT NULL,
  scopes                  text[] NOT NULL DEFAULT '{}',
  -- ⚠ CREDENTIALS. Plaintext for V1, matching oauth_grants' documented posture
  -- (Supabase Postgres at-rest encryption + no RLS policy on this table). The
  -- pgcrypto column-encryption follow-up tracked on oauth_grants covers this
  -- table too.
  refresh_token           text NOT NULL,
  access_token            text,
  access_token_expires_at timestamptz,
  external_account_display text,
  -- Mirrors oauth_grants.connection_health (20270110000000) so the admin board
  -- and the cron worker speak one vocabulary.
  connection_health       text NOT NULL DEFAULT 'ok'
                            CHECK (connection_health IN ('ok', 'needs_reauth')),
  granted_at              timestamptz NOT NULL DEFAULT now(),
  revoked_at              timestamptz,
  last_refreshed_at       timestamptz,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS channel_pool_id          bigint;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS youtube_channel_id       text;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS scopes                   text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS refresh_token            text;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS access_token             text;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS access_token_expires_at  timestamptz;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS external_account_display text;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS connection_health        text NOT NULL DEFAULT 'ok';
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS granted_at               timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS revoked_at               timestamptz;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS last_refreshed_at        timestamptz;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS created_at               timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_channel_grants ADD COLUMN IF NOT EXISTS updated_at               timestamptz NOT NULL DEFAULT now();

-- The refresh worker's sweep predicate: live grants whose access token is stale.
CREATE INDEX IF NOT EXISTS live_studio_channel_grants_expiry_idx
  ON public.live_studio_channel_grants (access_token_expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.live_studio_channel_grants ENABLE ROW LEVEL SECURITY;
-- NO POLICY ON PURPOSE. This table holds the refresh token for a SETNAYAN-owned
-- YouTube channel that many couples' ceremonies stream on. Every read and write
-- goes through the service-role client (lib/live-studio-channel-grants.ts).
-- Adding any `TO authenticated` policy here — including an is_admin() one —
-- would put a platform credential on the PostgREST wire. Don't.

COMMENT ON TABLE public.live_studio_channel_grants IS
  'Live Studio WAVE 9: PLATFORM-LEVEL (channel-keyed) YouTube OAuth grant for the Setnayan-owned channel pool. One row per live_studio_roam_channel_pool channel, serving MANY events over its life — unlike oauth_grants, which is per-(event,provider) BYO. Service-role only: RLS enabled, NO policy (carries refresh_token for a Setnayan channel). lib/live-studio-channel-grants.ts.';

-- ===========================================================================
-- 2. live_studio_channel_oauth_state — CSRF nonce for the POOL connect flow.
--    The shared `oauth_state` table cannot carry it: its `event_id` is
--    NOT NULL REFERENCES events, and a pool connect has no event. Same
--    single-use, 10-minute-TTL semantics; the callback deletes on read.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.live_studio_channel_oauth_state (
  state_token     text PRIMARY KEY,
  -- Set when re-connecting an EXISTING pool channel (repair a needs_reauth grant);
  -- NULL when connecting a brand-new channel, whose pool row the callback creates
  -- from whatever channel Google reports.
  channel_pool_id bigint REFERENCES public.live_studio_roam_channel_pool(id) ON DELETE CASCADE,
  initiated_by    uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_studio_channel_oauth_state ADD COLUMN IF NOT EXISTS channel_pool_id bigint;
ALTER TABLE public.live_studio_channel_oauth_state ADD COLUMN IF NOT EXISTS initiated_by    uuid;
ALTER TABLE public.live_studio_channel_oauth_state ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS live_studio_channel_oauth_state_created_idx
  ON public.live_studio_channel_oauth_state (created_at);

ALTER TABLE public.live_studio_channel_oauth_state ENABLE ROW LEVEL SECURITY;
-- NO POLICY: a readable state token is a CSRF bypass. Service-role only.

COMMENT ON TABLE public.live_studio_channel_oauth_state IS
  'Live Studio WAVE 9: single-use CSRF nonce for the ADMIN pool-channel OAuth connect flow (the shared oauth_state table requires an event_id, which a platform-level grant does not have). Service-role only: RLS enabled, NO policy.';
