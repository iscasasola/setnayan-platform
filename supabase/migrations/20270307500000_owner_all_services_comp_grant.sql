-- 20270307500000_owner_all_services_comp_grant.sql
--
-- Inserts a permanent all_services comp grant for the internal owner account
-- (iscasasolaii@gmail.com). The entitlements helpers (lib/entitlements.ts)
-- short-circuit every SKU gate when this grant exists and is not revoked,
-- so all paid features are immediately active on every event owned by this account.
--
-- Source: owner_internal — granted_by = owner themselves (self-referential).
-- No expiry — revoke via /admin/users if ever needed.
-- Idempotent: skips if a non-revoked all_services grant already exists.

BEGIN;

DO $$
DECLARE
  v_user_id  UUID;
  v_public_id TEXT;
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.users
   WHERE email = 'iscasasolaii@gmail.com'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'owner_all_services_comp_grant: owner user not found, skipping';
    RETURN;
  END IF;

  -- Skip if an active all_services grant already exists for this user.
  IF EXISTS (
    SELECT 1 FROM public.comp_grants
     WHERE user_id = v_user_id
       AND scope = 'all_services'
       AND revoked_at IS NULL
  ) THEN
    RAISE NOTICE 'owner_all_services_comp_grant: grant already exists, skipping';
    RETURN;
  END IF;

  v_public_id := public.generate_public_id('C');

  INSERT INTO public.comp_grants (
    public_id,
    user_id,
    source,
    scope,
    rationale,
    granted_by
  ) VALUES (
    v_public_id,
    v_user_id,
    'owner_internal',
    'all_services',
    'Permanent owner access — all paid SKUs active across every event',
    v_user_id
  );

  RAISE NOTICE 'owner_all_services_comp_grant: issued grant % for user %', v_public_id, v_user_id;
END;
$$;

COMMIT;
