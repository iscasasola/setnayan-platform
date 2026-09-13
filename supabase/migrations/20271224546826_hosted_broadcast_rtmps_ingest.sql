-- DSK-3 (ENC-RTMPS) — carry YouTube's RTMPS ingest pair on the hosted broadcast.
--
-- ── WHAT A PERSON GETS ──────────────────────────────────────────────────────
-- A hosted-channel broadcast goes out ENCRYPTED on 443 instead of plain RTMP on
-- 1935 — the port a venue's Wi-Fi, a hotel captive portal and a hotel's
-- corporate firewall routinely block — and when the primary ingest dies it has a
-- second address to fail over to instead of retrying the dead one forever.
--
-- ── WHY COLUMNS, AND WHY NOW ────────────────────────────────────────────────
-- `createYoutubeStream` has RETURNED `rtmpsIngestionAddress` and
-- `rtmpsBackupIngestionAddress` since the RTMPS-ingest change (pinned by
-- lib/panood-youtube-rtmps-ingest.test.ts) and NOTHING HAS EVER PERSISTED THEM:
-- both writers store only `ingestion_url`, the plain-RTMP primary. YouTube hands
-- these addresses back exactly once, at `liveStreams.insert` — by broadcast time
-- we are not calling the Data API again — so an address not stored at creation is
-- an address gone for that wedding. That is why this is a column and not a
-- lookup.
--
-- The encoder's transport ALREADY speaks TLS: `sender.rs` wraps the socket with
-- rustls whenever the endpoint is `rtmps://`, and `reconnect.rs` already
-- alternates to a backup after three consecutive primary failures
-- (`ingest_for_attempt`). Both were built, tested and merged. Neither has ever
-- been reachable, because the only address ever stored was `rtmp://…:1935`.
--
-- ── NULLABLE ON PURPOSE ─────────────────────────────────────────────────────
-- Every row that already exists has neither, and YouTube is not contractually
-- obliged to return them (the .ts type has them optional for that reason). A
-- NOT NULL or a DEFAULT here would either fail against existing rows or invent an
-- address for a stream that was never provisioned one — and a fabricated ingest
-- address is how a wedding gets published to a host that does not exist. Readers
-- fall back to `ingestion_url`; see `resolveEncoderIngest`.
--
-- ── NO GRANT CHANGES, DELIBERATELY ──────────────────────────────────────────
-- `panood_broadcasts` is service-role only: RLS is ENABLED with NO policy and
-- `anon` was revoked wholesale (20271148202591_anon_grant_batch5.sql), because
-- the table already carries the secret `stream_key`. New columns inherit exactly
-- that, which is what we want — these addresses are not secret, but they sit
-- beside one that is, and the row is reached only through the service-role
-- exchange. Verified by supabase/security/exposure-surface.baseline.txt rather
-- than asserted here: a migration comment is not evidence.

ALTER TABLE public.panood_broadcasts
  ADD COLUMN IF NOT EXISTS rtmps_ingestion_url        text,
  ADD COLUMN IF NOT EXISTS rtmps_backup_ingestion_url text;

COMMENT ON COLUMN public.panood_broadcasts.rtmps_ingestion_url IS
  'DSK-3: YouTube cdn.ingestionInfo.rtmpsIngestionAddress — the TLS ingest (443) the desktop encoder publishes to. NULL for rows created before this shipped, and whenever YouTube omits it; readers fall back to ingestion_url. Not secret, but stored beside stream_key on a service-role-only table.';

COMMENT ON COLUMN public.panood_broadcasts.rtmps_backup_ingestion_url IS
  'DSK-3: YouTube cdn.ingestionInfo.rtmpsBackupIngestionAddress — the second address reconnect::supervise alternates to after three consecutive primary failures. NULL means NO backup: the encoder then retries the primary only. Never synthesise one from the primary — a backup host that was never provisioned is a wedding published to nowhere.';
