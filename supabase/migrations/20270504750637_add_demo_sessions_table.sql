-- add demo sessions table
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Generic ephemeral scaffold for the homepage dock-tile live demos (Papic
-- today; Panood + 3D Plan reuse the same shape later — DECISION_LOG
-- 2026-07-03 "build it GENERIC as the program's PR-1"). A visitor opens a
-- demo overlay on the public homepage → this mints ONE row with two
-- unguessable tokens (QR "you" + QR "a friend"); each phone that scans joins
-- by token. Deliberately holds ONLY session bookkeeping — no photos, no face
-- descriptors, no PII ever land in this table (those are relayed peer-to-peer
-- over an ephemeral Supabase Realtime channel keyed by this row's id and are
-- never persisted anywhere, which is stricter than "auto-purge" — there is
-- nothing biometric to purge).
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_kind TEXT NOT NULL CHECK (demo_kind IN ('papic', 'panood', '3d_plan')),
  token_a TEXT NOT NULL UNIQUE,
  token_b TEXT NOT NULL UNIQUE,
  joined_a BOOLEAN NOT NULL DEFAULT FALSE,
  joined_b BOOLEAN NOT NULL DEFAULT FALSE,
  -- Photo COUNT only (never the photos themselves) — safe to persist, enforces
  -- the owner-locked 3-shots-per-session cap server-side across both phones.
  shot_count SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Short-lived by design (minted fresh on every overlay open, never reused).
  -- Application layer sets this to now() + 20 minutes at insert time.
  expires_at TIMESTAMPTZ NOT NULL
);

-- token_a / token_b are already UNIQUE-indexed via their column constraints
-- above (Postgres auto-creates the index) — only the lookup-by-expiry index
-- is net-new here.
CREATE INDEX IF NOT EXISTS demo_sessions_expires_at_idx ON public.demo_sessions (expires_at);

ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

-- No RLS policies (default-deny for the anon/authenticated roles): visitors
-- are unauthenticated by design (this is a public marketing-page demo, not a
-- real event), so there is no `auth.uid()` to scope a policy to. Every read
-- and write goes through Next.js Server Actions on the SERVICE-ROLE admin
-- client, which bypasses RLS — identical to the existing `/papic/join/[token]`
-- pattern (lib/papic-seats.ts), which resolves guest/seat tokens the same
-- way. A row only ever comes back to a caller who already holds one of its
-- two unguessable tokens.
