-- Phase H apply · forced re-execution because prior migration (20260704030000)
-- was recorded in supabase_migrations.schema_migrations but the actual SQL
-- never ran. Replays the same idempotent ops here under a fresh timestamp.
BEGIN;

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_token_able, description)
VALUES
  ('PAKULAY',
   'Pakulay',
   0.00,
   0.00,
   FALSE,
   'Free Mood Board · palette + visual identity for every account')
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able,
  description            = EXCLUDED.description;

UPDATE public.platform_retail_catalog_v2
   SET is_token_able = FALSE
 WHERE service_code = 'ANIMATED_MONOGRAM'
   AND is_token_able = TRUE;

COMMIT;
