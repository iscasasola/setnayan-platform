-- Supabase places pgcrypto in the `extensions` schema; SECURITY DEFINER
-- functions don't see it on the default search_path. Schema-qualify all
-- gen_random_bytes() calls.

CREATE OR REPLACE FUNCTION public.generate_event_join_token()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT encode(extensions.gen_random_bytes(16), 'hex');
$$;

ALTER TABLE public.guests
  ALTER COLUMN qr_token SET DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

ALTER TABLE public.event_join_tokens
  ALTER COLUMN token DROP DEFAULT;
