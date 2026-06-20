-- ============================================================================
-- Anonymous-draft onboarding · null-email-tolerant auth-user trigger
-- (Usability 2-step-down · Wave 7 · 2026-06-20)
-- ============================================================================
--
-- WHY: anon-draft onboarding lets a visitor finish onboarding without an
-- account by minting a Supabase NATIVE anonymous session (a real auth.uid()).
-- Supabase anonymous users arrive with auth.users.email = NULL. The existing
-- handle_new_auth_user() trigger inserts NEW.email into public.users.email,
-- which is NOT NULL — so the very first anonymous sign-in would violate the
-- constraint, the trigger's INSERT would roll back, and signInAnonymously()
-- would return an error. This swaps the function body to synthesize a
-- deterministic placeholder email for null-email (anonymous) users.
--
-- The signup/convert flow (app/signup/actions.ts) overwrites the placeholder
-- with the visitor's real email when they secure their account — the auth uid
-- never changes, so their already-created event stays theirs (no claim/merge).
--
-- Everything else (the § 10a owner internal-flag, the account_type read from
-- raw_user_meta_data, the ON CONFLICT no-op) is byte-identical to the prior
-- definition in 20260513120000_iteration_0022_vendor_dashboard.sql. The trigger
-- binding (on_auth_user_created AFTER INSERT ON auth.users) is unchanged —
-- CREATE OR REPLACE FUNCTION swaps the body in place.
--
-- SAFE TO APPLY BEFORE the feature flips on: with anonymous sign-ins disabled
-- in the Supabase dashboard, no null-email rows ever reach this trigger, so the
-- new COALESCE branch is simply never exercised. Existing (email-bearing)
-- signups behave exactly as before.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_internal    BOOLEAN := FALSE;
  v_requested      TEXT;
  v_account_type   public.account_type := 'customer';
  v_email          TEXT;
BEGIN
  -- Anonymous users have a NULL email. public.users.email is NOT NULL, so
  -- synthesize a deterministic, per-uid placeholder. Overwritten with the real
  -- email by the convert-on-signup flow.
  v_email := COALESCE(NEW.email, 'anon+' || NEW.id::text || '@anon.setnayan.local');

  -- § 10a internal accounts auto-flag. Owner email hard-coded. For anonymous
  -- users NEW.email is NULL, so this comparison is NULL (never TRUE) and they
  -- are never flagged internal.
  IF NEW.email = 'iscasasolaii@gmail.com' THEN
    v_is_internal := TRUE;
  END IF;

  v_requested := NEW.raw_user_meta_data->>'account_type';
  IF v_requested IN ('customer', 'vendor') THEN
    v_account_type := v_requested::public.account_type;
  END IF;

  INSERT INTO public.users (user_id, email, account_type, is_internal)
  VALUES (NEW.id, v_email, v_account_type, v_is_internal)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
