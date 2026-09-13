-- MOOD BOARD "OVERALL THEME" — a couple-facing name + description for their
-- wedding's look, sitting at the top of the redesigned Mood Board canvas.
--
-- Confirmed by exhaustive search (2026-09-02) that no persisted, couple-facing
-- "theme" concept exists anywhere: the only near-hits are the unrelated
-- Save-the-Date `events.std_theme` film-style column, and a purely-local
-- TypeScript rendering-token type `StyleTheme` that lived inside the deleted
-- wedding-attire-guide.tsx and was never written to the database.
--
-- Two nullable columns on events, riding on events' EXISTING RLS (no new
-- policy needed — the couple/host already has UPDATE on their own event via
-- the same policy that lets role_palette / reception_design write).
--
-- CHECK caps keep these short enough to render as a card title/subtitle and
-- to fit the concept-PDF cover without truncation logic.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS moodboard_theme_name text,
  ADD COLUMN IF NOT EXISTS moodboard_theme_description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_moodboard_theme_name_len_chk'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_moodboard_theme_name_len_chk
      CHECK (moodboard_theme_name IS NULL OR char_length(moodboard_theme_name) <= 80);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_moodboard_theme_description_len_chk'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_moodboard_theme_description_len_chk
      CHECK (moodboard_theme_description IS NULL OR char_length(moodboard_theme_description) <= 280);
  END IF;
END $$;

-- ── COLUMN-LEVEL GRANTS — REQUIRED, NOT OPTIONAL ────────────────────────────
-- public.events revokes table-level SELECT (20271007100000) and table-level
-- UPDATE/INSERT (20271005100000), both re-granting a computed ALLOW-LIST at
-- apply time. A column added later carries NEITHER grant until one is written
-- explicitly (see the "MAINTENANCE NOTE FOR FUTURE MIGRATIONS" at the bottom of
-- 20271005100000) — without this block, saveMoodboardTheme's authenticated-
-- session `.update({ moodboard_theme_name, moodboard_theme_description })`
-- would fail for every couple with a permission error PostgREST reports as a
-- refused query, not a helpful one. `scripts/lint-events-column-grants.mjs`
-- also fails the build on any `ADD COLUMN` with no matching `GRANT SELECT (col)`
-- — this satisfies both that guard and the UPDATE half it doesn't check.
--
-- `authenticated` only — RLS (couple_can_update_event) is the real per-row
-- gate, but anon has no legitimate reason to write or read these columns
-- directly (a booked vendor reads the theme through get_vendor_mood_board, a
-- SECURITY DEFINER RPC, not a direct table grant), so this stays minimal
-- rather than following the older "authenticated, anon" boilerplate verbatim.
GRANT SELECT (moodboard_theme_name) ON public.events TO authenticated;
GRANT SELECT (moodboard_theme_description) ON public.events TO authenticated;
GRANT UPDATE (moodboard_theme_name) ON public.events TO authenticated;
GRANT UPDATE (moodboard_theme_description) ON public.events TO authenticated;

-- ── REBUILD `events_host` — the other half of the same obligation ──────────
-- public.events_host (20271008731642, last rebuilt 20271189680846) is a VIEW
-- with an EXPLICIT column projection computed from the SELECT allow-list at
-- apply time. It was DROPPED (not rebuilt) by the previous migration
-- (20271193010764) to unblock dropping attire_guide_palette, which it had
-- selected. Rebuilding it here — in the SAME migration that grants the two new
-- columns — both restores the view and picks up the new columns in one pass,
-- copied verbatim from 20271189680846 (only the private_columns array and the
-- projection differ structurally, and neither changed here).
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
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design. Rebuilt 20271193183599 after attire_guide_palette was dropped from the base table and moodboard_theme_name/_description were added.';
