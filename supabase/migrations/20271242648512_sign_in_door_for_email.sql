-- sign in door for email
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ─────────────────────────────────────────────────────────────────────────────
-- sign_in_door_for_email — after a FAILED password sign-in, which door does
-- this email actually use?
--
-- Owner, 2026-09-23: "we also need to detect if they are a google account,
-- they just directly sign in via google icon?" Measured on prod the same day:
-- 3 of 11 real accounts (his own among them) are Google-only — auth.users.
-- encrypted_password IS NULL — and when any of them types a password the app
-- says "That email and password do not match." That sentence is false: the
-- password does not fail to match, it does not exist, and the advice it gives
-- (retry, or reset a password they never had) can never work.
--
-- WHAT IT ANSWERS: for one email, whether a password exists and which
-- providers the account signs in with — read off auth.users.raw_app_meta_data
-- ->'providers', the array GoTrue maintains on every identity link, so no
-- auth.identities join is needed (and the PGlite replay stub has no such
-- table). One row or none. Never anything else about the account.
--
-- WHO MAY ASK: service_role ONLY. The lookup runs inside app/login/actions.ts
-- (a server action) and ONLY after signInWithPassword has already refused —
-- owner's constraint: revealing a provider to anyone who merely types an
-- email confirms the account exists and leaks its provider to a prober; after
-- a failed attempt they have shown they know the address, so it gives a prober
-- nothing new. REVOKED from anon and authenticated so no client can ever call
-- it, and the action's own guard (lib/sign-in-door.test.ts) pins the ordering.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sign_in_door_for_email(p_email text)
RETURNS TABLE (has_password boolean, providers text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '') AS has_password,
    COALESCE(
      (SELECT array_agg(p) FROM jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(u.raw_app_meta_data -> 'providers') = 'array'
              THEN u.raw_app_meta_data -> 'providers' ELSE '[]'::jsonb END) AS p),
      '{}'::text[]
    ) AS providers
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
    AND u.deleted_at IS NULL
    AND NOT u.is_anonymous
  ORDER BY u.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.sign_in_door_for_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_in_door_for_email(text) TO service_role;

COMMENT ON FUNCTION public.sign_in_door_for_email(text) IS
  'Service-role only. After a FAILED password sign-in: does this email have a password, and which providers does it sign in with (auth.users.raw_app_meta_data->providers). Called by app/login/actions.ts only after signInWithPassword refused — never on blur/change, never before auth (owner 2026-09-23).';
