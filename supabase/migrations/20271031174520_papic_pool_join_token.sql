-- Papic POOL JOIN TOKEN — the poster QR (owner-locked 2026-08-01).
--
-- One QR per event. Anyone scans it, gets a camera, shoots from the shared
-- pool. Owner's rule, verbatim: "No limit — first come, first served" — no
-- per-scanner allowance, no camera cap, no host approval. The pool's own
-- fail-closed fence (papic_reserve_event_points_for_seat) is the ONLY limit,
-- and it already refuses the shot that would overshoot.
--
-- ── WHY A NEW TOKEN AND NOT AN EXISTING ONE ─────────────────────────────────
-- Checked first (RULE 0). Neither fits:
--   • events.master_qr_token — VENDOR CREW device registration (fingerprinted,
--     5-device cap). Different actor, different job.
--   • event_join_tokens — self-join as a GUEST, which creates a guest row and
--     asks for a name. The poster promise is scan-and-shoot, no form.
--   • events.slug — PUBLIC and guessable. A slug-derived camera link would let
--     anyone who can read a URL bar shoot into a stranger's gallery.
--
-- So: a secret, rotatable, per-event token of its own.
--
-- ── SECURITY ────────────────────────────────────────────────────────────────
-- This token IS the capability — holding it earns a camera on the event. It is
-- therefore 24 random bytes (same generator shape as paparazzi_seats.
-- claim_qr_token), never derived from the event id or slug, and rotatable so a
-- poster photographed by a stranger can be invalidated without touching the
-- event.
--
-- NO new table, so no new RLS surface. The column lives on `events`, which is
-- already policy-covered; the public join route resolves it with the SERVICE
-- ROLE (the scanner is anonymous and has no read on events), exactly as the
-- seat claim path already does with claim_qr_token.

alter table public.events
  add column if not exists papic_pool_token text,
  add column if not exists papic_pool_token_rotated_at timestamptz;

-- Uniqueness is the lookup guarantee: the join route resolves an event BY this
-- token, so a duplicate would make the resolution ambiguous and hand a scanner
-- a camera on the wrong event. Partial — NULL means "not minted yet".
create unique index if not exists events_papic_pool_token_key
  on public.events (papic_pool_token)
  where papic_pool_token is not null;

comment on column public.events.papic_pool_token is
  'Papic poster-QR capability. Anyone holding it may claim a pool camera on this event (owner 2026-08-01: no limit, first come first served). Secret + rotatable; never derive it from event_id or slug.';

-- ⚠ NO BACKFILL, deliberately.
--
-- Minting a capability for all 3 existing events at migration time would create
-- live secrets nobody asked for, in a table an admin can read, before any host
-- has chosen to show a poster. The token is minted LAZILY the first time a host
-- opens the QR surface (ensurePapicPoolToken) — so a token exists exactly when
-- someone has decided to hand one out, and an event that never uses the poster
-- never carries one.

-- ── NO GRANT / REVOKE HERE, AND THAT IS THE CAREFUL CHOICE ──────────────────
--
-- The house rule is "every new table or view in `public` ships OPEN — REVOKE in
-- every migration", because the default ACL grants arwdDxtm to anon +
-- authenticated on NEW OBJECTS. That rule does not reach this migration: a
-- COLUMN inherits its table's existing grants, and no table or view is created
-- here.
--
-- ⚠ Applying the boilerplate anyway would have been a privilege WIDENING
-- wearing security clothing. Measured on prod before writing this:
--
--     anon           DELETE, REFERENCES, TRIGGER, TRUNCATE
--     authenticated  DELETE, REFERENCES, TRIGGER, TRUNCATE
--
-- `authenticated` holds NO select/insert/update on public.events — reads and
-- writes go through RLS-policied paths and the service role. A reflexive
-- `grant select, insert, update, delete ... to authenticated` would have handed
-- every signed-in user direct CRUD on the events table. Boilerplate is not
-- automatically safe; the grant you "restore" may never have existed.
--
-- The column's protection is therefore the one it inherits: anon cannot select
-- it, and the public join route resolves the token with the SERVICE ROLE, the
-- same posture paparazzi_seats.claim_qr_token already uses.
