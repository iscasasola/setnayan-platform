-- person spine self claim trigger
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Person-spine · Phase 1 · self-claim (owner-locked 2026-07-04, "finish Phase 1
-- first" 2026-07-05). Every account IS a person: on user creation, mint the
-- account holder's own person node (claimed by them). Adults-only, additive,
-- no counsel gate. Establishes the 1:1 account↔person link that match-on-signup
-- and the connections graph (Phase 2, gated) build on.
-- ============================================================================

-- SECURITY DEFINER so the trigger can insert into public.people past its
-- owner-only RLS (it runs inside the auth→public.users insert path). search_path
-- pinned to public so public.generate_public_id / gen_random_uuid resolve and to
-- avoid search-path injection.
CREATE OR REPLACE FUNCTION public.ensure_person_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.people (
    claimed_by_user_id, created_by_user_id,
    display_name, email, phone, profile_photo_url, birth_date
  )
  VALUES (
    NEW.user_id, NEW.user_id,
    NEW.display_name, NEW.email, NEW.phone, NEW.profile_photo_url, NEW.birth_date
  )
  ON CONFLICT (claimed_by_user_id) DO NOTHING;  -- one person per account; re-fire is a no-op
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ensure_person_for_user() IS
  'Person-spine: on public.users INSERT, create the account holder''s own claimed person node (idempotent via the claimed_by_user_id UNIQUE constraint).';

DROP TRIGGER IF EXISTS ensure_person_for_user ON public.users;
CREATE TRIGGER ensure_person_for_user
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.ensure_person_for_user();

-- Backfill: mint a claimed person node for every existing (non-deleted) account.
-- Idempotent via ON CONFLICT (claimed_by_user_id) — safe to re-run.
INSERT INTO public.people (
  claimed_by_user_id, created_by_user_id,
  display_name, email, phone, profile_photo_url, birth_date
)
SELECT u.user_id, u.user_id,
       u.display_name, u.email, u.phone, u.profile_photo_url, u.birth_date
FROM public.users u
WHERE u.deleted_at IS NULL
ON CONFLICT (claimed_by_user_id) DO NOTHING;
