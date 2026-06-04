-- Teardown for the Setnayan virtual/scenario test accounts.
-- Removes the three tagged accounts + ALL their data (event, listing, thread,
-- messages, registry) via cascade. Single DO block = one command.
--
-- Run:
--   ~/.local/bin/supabase db query --db-url "$SUPABASE_DB_URL" \
--     --file apps/web/scripts/reset-test-accounts.sql
DO $$
BEGIN
  DELETE FROM public.events WHERE slug = 'test-maria-and-jose';
  DELETE FROM public.vendor_profiles
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'vendor.test@setnayan.com');
  DELETE FROM public.users
    WHERE email IN ('couple.test@setnayan.com','vendor.test@setnayan.com','admin.test@setnayan.com');
  DELETE FROM auth.users
    WHERE email IN ('couple.test@setnayan.com','vendor.test@setnayan.com','admin.test@setnayan.com');
  RAISE NOTICE 'Test accounts removed.';
END $$;
