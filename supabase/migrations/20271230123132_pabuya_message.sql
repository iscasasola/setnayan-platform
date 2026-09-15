-- THE COUPLE'S OWN WORDS ON THEIR GIFTS PAGE — the field that did not exist.
--
-- Prefix allocated by `pnpm migration:new`. Idempotent throughout.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY
-- ═══════════════════════════════════════════════════════════════════════════
-- `/[slug]/pabuya` told every couple's guests the same sentence — "Pin your cash
-- on the couple — wherever you are in the world." There was nowhere for the
-- couple to say WHY they are asking, which is the only part a guest actually
-- weighs. Owner, 2026-09-15: *"We would love to receive monetary gift so we can
-- find the best suitable gift from everyone who loves us"* — and then, on how
-- it should work: *"so pick among 5 or create your own."*
--
-- So: one nullable text column. NULL means the page reads exactly as it does
-- today, which is what every existing event gets and why there is no backfill.
--
-- ⚠ A LENGTH CEILING, NOT A SHAPE. 600 characters is about a full paragraph —
-- enough for the five templates with room to edit, short enough that it cannot
-- become an essay that buries the QR codes underneath it. No format is imposed:
-- the couple's own words are the point.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pabuya_message text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_pabuya_message_chk'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_pabuya_message_chk
      CHECK (pabuya_message IS NULL OR char_length(pabuya_message) <= 600);
  END IF;
END $$;

COMMENT ON COLUMN public.events.pabuya_message IS
  'The couple''s own sentence above their e-gift methods on /[slug]/pabuya. NULL = the page''s default copy. Max 600 chars.';

-- ── THE GRANT — a column added to `events` gets none by default ────────────
-- `events` is per-column allowlisted. A new column with no matching
-- `GRANT SELECT (col)` makes PostgREST refuse the WHOLE query for any caller
-- that names it, which reads as "the page is broken" rather than "one column is
-- missing". `authenticated` only: the public gifts page reads through the
-- service-role admin client, so anon needs nothing here.
GRANT SELECT (pabuya_message) ON public.events TO authenticated;
GRANT UPDATE (pabuya_message) ON public.events TO authenticated;

-- ── REBUILD `events_host` — the other half of the same obligation ──────────
-- public.events_host is a VIEW with an EXPLICIT column projection computed from
-- the SELECT allow-list at apply time, so a column added to the base table is a
-- PHANTOM COLUMN on the view until it is rebuilt. Copied verbatim from
-- 20271197327520 (which last rebuilt it); the private_columns array is
-- unchanged.
DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  DROP VIEW IF EXISTS public.events_host;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design. Rebuilt 20271230123132 after pabuya_message was added.';
