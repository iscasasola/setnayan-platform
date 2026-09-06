-- live_studio_encoder_tokens — single-use nonce that AUTHORIZES a Tauri
-- encoder command invocation (S5 — build-sessions/encoder/S5.md).
--
-- WHY THIS EXISTS AND IS NOT live_studio_encoder_claims (S8, 20271207322067):
-- that table hands the Rust process the REAL hosted-channel stream key. This
-- one is a different concern entirely — `capabilities/default.json` grants
-- `allow-encoder-{start,config,push,stop}` to setnayan.com under the EXISTING
-- `remote.urls` capability (S5.md § ACL), and that capability is scoped to an
-- ORIGIN, not to an authenticated session: any XSS on setnayan.com can invoke
-- those commands too. `encoder_start(token)` closes that gap by requiring a
-- server-minted, single-use token bound to (user, event, broadcast) before
-- Rust will hold the session open for `encoder_config`/`encoder_push`/
-- `encoder_stop` — this is true for BOTH the own-channel (Part A, no
-- claims-table row ever exists) and hosted-channel (Part B) tiers alike,
-- which is exactly why this cannot just be a widened `live_studio_encoder_claims`.
--
-- PRECEDENT / POSTURE: same single-use, short-TTL, delete-on-read shape as
-- `live_studio_encoder_claims` (20271207322067) and
-- `live_studio_channel_oauth_state` (20271005481398). Same service-role-only
-- posture as `panood_broadcasts` (secret stream_key): RLS enabled, NO POLICY.
--
-- TTL is 60 SECONDS per S5.md — the round-trip from "webview mints it" to
-- "Rust's next reqwest verify call" happens within the same second on a local
-- machine; a short TTL shrinks the window a leaked token is worth anything.
--
-- KEEP THIS MIGRATION IDEMPOTENT (repo convention):
--   • CREATE TABLE IF NOT EXISTS …  (+ ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …

CREATE TABLE IF NOT EXISTS public.live_studio_encoder_tokens (
  id           bigserial PRIMARY KEY,
  token        text NOT NULL,             -- 48 hex chars CSPRNG, same shape as
                                           -- generateYoutubeStateToken() (lib/panood-youtube.ts)
  event_id     uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The specific panood_broadcasts row this token authorizes an encoder
  -- session against — a token from broadcast A cannot authorize broadcast B.
  broadcast_id bigint NOT NULL REFERENCES public.panood_broadcasts(id) ON DELETE CASCADE,
  -- Meaningless once its requester no longer exists — ON DELETE CASCADE, not
  -- the FK default of NO ACTION, same reasoning as live_studio_encoder_claims.
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '60 seconds')
);

ALTER TABLE public.live_studio_encoder_tokens ADD COLUMN IF NOT EXISTS token        text;
ALTER TABLE public.live_studio_encoder_tokens ADD COLUMN IF NOT EXISTS event_id     uuid;
ALTER TABLE public.live_studio_encoder_tokens ADD COLUMN IF NOT EXISTS broadcast_id bigint;
ALTER TABLE public.live_studio_encoder_tokens ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE public.live_studio_encoder_tokens ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_encoder_tokens ADD COLUMN IF NOT EXISTS expires_at   timestamptz NOT NULL DEFAULT (now() + interval '60 seconds');

-- Single-use: the verify route deletes the row it reads regardless of outcome
-- (mirrors live_studio_encoder_claims). UNIQUE index means a racing double-verify
-- can win at most once at the DB level too — belt-and-braces with the
-- delete-on-read application logic.
CREATE UNIQUE INDEX IF NOT EXISTS live_studio_encoder_tokens_token_idx
  ON public.live_studio_encoder_tokens (token);

-- Sweep predicate for a future cleanup job (minted but never verified tokens).
CREATE INDEX IF NOT EXISTS live_studio_encoder_tokens_expiry_idx
  ON public.live_studio_encoder_tokens (expires_at);

ALTER TABLE public.live_studio_encoder_tokens ENABLE ROW LEVEL SECURITY;
-- NO POLICY ON PURPOSE, same reasoning as live_studio_encoder_claims: a
-- readable token is a bypass of the whole point of this table (an attacker
-- who can SELECT a live token could authorize their own encoder_start call
-- before the legitimate desktop client does). Every read and write goes
-- through the service-role client — mint in the mint API route, consume in
-- the verify API route that Rust's reqwest client calls from encoder_start.

COMMENT ON TABLE public.live_studio_encoder_tokens IS
  'S5: single-use, 60s-TTL token binding (user, event, broadcast) that authorizes ONE Tauri encoder_start call, closing the gap that capabilities/default.json''s remote.urls grant (allow-encoder-*) is origin-scoped, not session-scoped. Minted by POST /api/live-studio/encoder/token (webview, host-gated); verified and deleted by Rust''s own reqwest call before encoder_config/push/stop are allowed to run. Service-role only: RLS enabled, NO policy. build-sessions/encoder/S5.md.';

-- Same stray-grant finding as live_studio_encoder_claims (20271207322067) and
-- moodboard_library_assets (20271205294346): a brand-new table inherits this
-- project's schema-level default privileges, which hand `anon` AND
-- `authenticated` full table-level SIUD regardless of RLS (RLS cannot gate
-- TRUNCATE at all). Zero legitimate anon/authenticated use here — revoke ALL.
REVOKE ALL ON TABLE public.live_studio_encoder_tokens FROM anon;
REVOKE ALL ON TABLE public.live_studio_encoder_tokens FROM authenticated;
REVOKE ALL ON SEQUENCE public.live_studio_encoder_tokens_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.live_studio_encoder_tokens_id_seq FROM authenticated;
