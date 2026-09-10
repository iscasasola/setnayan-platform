-- live_studio_encoder_claims — single-use nonce for the desktop encoder's
-- HOSTED-CHANNEL stream-key handoff (S8 — build-sessions/encoder/S8.md).
--
-- WHY THIS EXISTS: the default tier streams on the couple's OWN YouTube channel
-- by hand (lib/live-studio-manual-air.ts) — the key is theirs, pasted straight
-- into the Rust encoder, and no Setnayan server ever holds it (Part A). Only the
-- Setnayan-hosted-channel add-on (the live_studio_roam_channel_pool path) has a
-- Setnayan-held key, and that key must never sit in the webview's React state or
-- cross the Tauri IPC boundary as a JSON payload the renderer can read back. The
-- webview instead asks for a single-use CLAIM NONCE bound to (user, event,
-- broadcast); the Rust process — never the page — exchanges that nonce for the
-- real `{rtmps_url, rtmps_backup_url, stream_key}` over its own `reqwest` TLS
-- connection. This table is the nonce store for that exchange.
--
-- PRECEDENT: same single-use, short-TTL, delete-on-read shape as
-- `live_studio_channel_oauth_state` (20271005481398) — see that migration's
-- header for why a dedicated table beats reusing something wider. Same
-- service-role-only posture as `panood_broadcasts` (secret stream_key) and
-- `live_studio_channel_grants` (secret refresh_token): RLS enabled, NO POLICY.
--
-- TTL is 60 SECONDS (not the 10 minutes of the OAuth state token) — this nonce
-- only has to survive the round-trip from "webview mints it" to "Rust's next
-- `reqwest` call", which happens within the same second on a local machine. A
-- short TTL shrinks the window in which a leaked nonce (e.g. in a Tauri IPC log
-- before redaction lands) is worth anything to an attacker.
--
-- KEEP THIS MIGRATION IDEMPOTENT (repo convention):
--   • CREATE TABLE IF NOT EXISTS …  (+ ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …

CREATE TABLE IF NOT EXISTS public.live_studio_encoder_claims (
  id           bigserial PRIMARY KEY,
  claim_token  text NOT NULL,             -- 48 hex chars CSPRNG, same shape as
                                           -- generateYoutubeStateToken() (lib/panood-youtube.ts)
  event_id     uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The specific panood_broadcasts row this claim may resolve — a claim from
  -- event A's broadcast cannot be replayed against event A's NEXT broadcast.
  broadcast_id bigint NOT NULL REFERENCES public.panood_broadcasts(id) ON DELETE CASCADE,
  -- This claim is meaningless once its author no longer exists — a 60-second
  -- nonce has no life to outlive its requester, unlike an authorship stamp on
  -- a durable record. ON DELETE CASCADE (not the FK default of NO ACTION):
  -- deleting the user should not be blocked by an ephemeral row like this one.
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '60 seconds')
);

ALTER TABLE public.live_studio_encoder_claims ADD COLUMN IF NOT EXISTS claim_token  text;
ALTER TABLE public.live_studio_encoder_claims ADD COLUMN IF NOT EXISTS event_id     uuid;
ALTER TABLE public.live_studio_encoder_claims ADD COLUMN IF NOT EXISTS broadcast_id bigint;
ALTER TABLE public.live_studio_encoder_claims ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE public.live_studio_encoder_claims ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.live_studio_encoder_claims ADD COLUMN IF NOT EXISTS expires_at   timestamptz NOT NULL DEFAULT (now() + interval '60 seconds');

-- Single-use: the exchange route deletes the row it reads (mirrors
-- live_studio_channel_oauth_state's callback). A UNIQUE index on the token
-- means a racing double-exchange can win at most once at the DB level too —
-- belt-and-braces with the delete-on-read application logic.
CREATE UNIQUE INDEX IF NOT EXISTS live_studio_encoder_claims_token_idx
  ON public.live_studio_encoder_claims (claim_token);

-- Sweep predicate for a future cleanup job (abandoned claims that were minted
-- but never exchanged). Nothing reads this index yet — it costs nothing to have
-- ready before the first cron job needs it.
CREATE INDEX IF NOT EXISTS live_studio_encoder_claims_expiry_idx
  ON public.live_studio_encoder_claims (expires_at);

ALTER TABLE public.live_studio_encoder_claims ENABLE ROW LEVEL SECURITY;
-- NO POLICY ON PURPOSE, same reasoning as live_studio_channel_oauth_state: a
-- readable claim_token is a bypass of the whole point of this table (an
-- attacker who can SELECT a live nonce can exchange it for the real stream key
-- before the legitimate desktop client does). Every read and write goes through
-- the service-role client — mint in the claim API route, consume in the
-- exchange API route that Rust's reqwest client calls.

COMMENT ON TABLE public.live_studio_encoder_claims IS
  'S8: single-use, 60s-TTL nonce binding (user, event, broadcast) for the desktop encoder''s hosted-channel stream-key handoff. The webview mints it and hands ONLY the nonce across the Tauri IPC boundary; Rust exchanges it server-side over reqwest for {rtmps_url, rtmps_backup_url, stream_key}. Service-role only: RLS enabled, NO policy. build-sessions/encoder/S8.md.';

-- Measured live against a full migration replay (tests/db/exposure-freeze.db.test.ts,
-- 2026-09-05): a brand-new table inherits this project's schema-level default
-- privileges, which hand `anon` AND `authenticated` full table-level SIUD plus
-- per-column SIU on every column — RLS-enabled-with-no-policy blocks PostgREST
-- row access, but (a) that is not true of TRUNCATE, which RLS cannot gate at
-- all, and (b) exposure-freeze.db.test.ts treats the raw GRANT itself, not
-- just what RLS currently does with it, as the thing to keep narrow — same
-- finding and same fix as the moodboard_library_assets stray-grant migration
-- (20271205294346). Unlike that table, this one has ZERO legitimate
-- anon/authenticated use (no policy exists, and no application code touches
-- it except through the service-role client in lib/live-studio-encoder-claims.ts),
-- so the fix here is ALL privileges, not a narrower list.
REVOKE ALL ON TABLE public.live_studio_encoder_claims FROM anon;
REVOKE ALL ON TABLE public.live_studio_encoder_claims FROM authenticated;
REVOKE ALL ON SEQUENCE public.live_studio_encoder_claims_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.live_studio_encoder_claims_id_seq FROM authenticated;
