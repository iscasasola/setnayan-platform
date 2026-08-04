-- secret_rotation_board
-- ============================================================================
-- Secrets & Rotation board (/admin/secrets) — rotation bookkeeping.
-- ============================================================================
-- One row per registry secret id (lib/secrets/rotation-registry.ts) recording
-- WHEN it was last rotated, by whom, and an optional free-text note. That is
-- ALL it holds — this table NEVER stores a secret value, a ciphertext, or a
-- fingerprint of one. The values themselves live where they already lived:
-- Vercel project env vars, the encrypted platform_integration_secrets
-- singleton, or GitHub Actions secrets.
--
-- WHY a table at all: the board's age/alarm math needs a rotation timestamp for
-- secrets whose store can't tell us one. Vercel's env API reports `updatedAt`
-- per variable, so vercel-stored secrets self-report; DB-console secrets and
-- GitHub Actions secrets do not, and "when did I last change this?" is exactly
-- the question the board exists to answer. computeStatus() takes the MAX of
-- this row and the newest Vercel `updatedAt` across the secret's env vars.
--
-- RLS: enabled with NO policies → deny-by-default. Same posture as
-- platform_integration_secrets (migration 20270129275192): only the service
-- role (createAdminClient) can read or write, and every caller sits behind the
-- team-member-aware admin gate. No policy is missing here — its absence IS the
-- policy.
--
-- Idempotent.

-- ----------------------------------------------------------------------------
-- 1) platform_secret_rotations — rotation bookkeeping, one row per secret id
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_secret_rotations (
  secret_id       TEXT PRIMARY KEY,
  last_rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_by      TEXT,
  note            TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.platform_secret_rotations IS
  'Secrets & Rotation board (/admin/secrets) — WHEN each registry secret was last rotated. NEVER holds a secret value, ciphertext, or hash of one. RLS on, NO policies -> service-role-only (same deny-by-default posture as platform_integration_secrets).';

COMMENT ON COLUMN public.platform_secret_rotations.secret_id IS
  'Stable slug from lib/secrets/rotation-registry.ts (e.g. supabase_service_role). The registry is the ALLOWLIST — the server actions reject any id not in it, so a form value can never mint an arbitrary row.';

COMMENT ON COLUMN public.platform_secret_rotations.rotated_by IS
  'Admin user_id (or email) that performed the rotation — audit trail only.';

COMMENT ON COLUMN public.platform_secret_rotations.note IS
  'Optional free-text note the admin typed ("rolled after laptop loss"). Plain text — do NOT paste secret material here.';

-- RLS enabled, deliberately NO policies → deny-by-default for anon/authenticated.
-- Only the service-role key (createAdminClient) bypasses RLS to read/write.
ALTER TABLE public.platform_secret_rotations ENABLE ROW LEVEL SECURITY;
