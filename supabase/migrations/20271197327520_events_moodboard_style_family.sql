-- WHICH STYLE FAMILY A COUPLE'S BOARD CAME FROM — the fact nothing recorded.
--
-- Prefix allocated by `pnpm migration:new`. Idempotent throughout.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🛑 THE PILOT WAS DORMANT FOR EVERY EVENT, AND THIS IS THE REASON
-- ═══════════════════════════════════════════════════════════════════════════
-- The reception decor AI-image layer pilot (apps/web/lib/reception-decor-
-- layers.ts, seeded by 20271194970382) picks a decor image by (zone,
-- style_family). Its `resolveDecorLayer` refuses to guess: a NULL style family
-- always falls back to the flat hand-coded SVG. That refusal is correct — but
-- NOTHING ANYWHERE STORED A STYLE FAMILY FOR AN EVENT, so every zone on every
-- event resolved NULL and the pilot could never activate for anybody.
--
-- `applyMoodboardTemplate` merged a template's role_palette + reception_design
-- onto the event and threw away the one field that says which of the 10 style
-- families produced them. This column is that record; the action now writes it
-- in BOTH apply modes (fill_empty writes only into a NULL, replace_all always
-- writes — see `nextMoodboardStyleFamily` in lib/moodboard-templates.ts).
--
-- ⚠ THIS MAKES THE PATH READY, NOT LIVE. The 10 pilot asset rows were seeded
-- with approved_at = NULL on purpose (the generated files were never uploaded
-- to R2), and moodboard_library_assets_public_read requires approved_at IS NOT
-- NULL — so the catalog is still EMPTY in production and every zone still
-- renders the flat SVG. The draft/published gate IS the rollout mechanism; a
-- human uploading + approving those files is the remaining step, not code.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE CHECK MIRRORS moodboard_theme_templates' OWN VOCABULARY
-- ═══════════════════════════════════════════════════════════════════════════
-- Same 10 strings as moodboard_theme_templates_style_family_check_v2
-- (20271195711446), or NULL for "not established yet" — which is every event
-- until it applies a template. Copied verbatim rather than referenced: a CHECK
-- cannot read another table's constraint, and a widening of the taxonomy must
-- be a deliberate, reviewed edit on both sides, not an implicit follow.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS moodboard_style_family text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_moodboard_style_family_chk'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_moodboard_style_family_chk
      CHECK (
        moodboard_style_family IS NULL
        OR moodboard_style_family IN (
          -- original 5
          'elegant · simple · classic',
          'bridgerton · regal',
          'editorial cream',
          'tropical heritage',
          'modern minimalist',
          -- new 5 (2026-09-03 taxonomy expansion)
          'boho beach',
          'vintage ilustrado',
          'industrial loft',
          'moody garden',
          'destination resort'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.events.moodboard_style_family IS
  'Which moodboard_theme_templates.style_family produced this board (NULL until the couple applies a template). Read by the reception decor AI-image layer pilot — resolveDecorLayer falls back to the flat SVG when it is NULL. Vocabulary mirrors moodboard_theme_templates_style_family_check_v2 (20271195711446).';

-- ── COLUMN-LEVEL GRANTS — REQUIRED, NOT OPTIONAL ────────────────────────────
-- public.events revokes table-level SELECT (20271007100000) and table-level
-- UPDATE/INSERT (20271005100000), both re-granting a computed ALLOW-LIST at
-- apply time. A column added later carries NEITHER grant until one is written
-- explicitly (see the "MAINTENANCE NOTE FOR FUTURE MIGRATIONS" at the bottom of
-- 20271005100000) — without this block, applyMoodboardTemplate's authenticated-
-- session `.update({ moodboard_style_family })` would fail for every couple with
-- a permission error PostgREST reports as a refused query, not a helpful one,
-- and the seating lab's `.select(... moodboard_style_family)` would take the
-- WHOLE query down with it. `scripts/lint-events-column-grants.mjs` fails the
-- build on any `ADD COLUMN` with no matching `GRANT SELECT (col)` — this
-- satisfies both that guard and the UPDATE half it doesn't check.
--
-- `authenticated` only, exactly like moodboard_theme_name/_description
-- (20271193183599): anon has no legitimate reason to read or write it, and a
-- booked vendor reads it through get_vendor_mood_board, a SECURITY DEFINER RPC,
-- not a direct table grant.
GRANT SELECT (moodboard_style_family) ON public.events TO authenticated;
GRANT UPDATE (moodboard_style_family) ON public.events TO authenticated;

-- ── REBUILD `events_host` — the other half of the same obligation ──────────
-- public.events_host is a VIEW with an EXPLICIT column projection computed from
-- the SELECT allow-list at apply time, so a column added to the base table is a
-- PHANTOM COLUMN on the view until it is rebuilt. Copied verbatim from
-- 20271193183599 (which last rebuilt it), only the trailing COMMENT differs;
-- the private_columns array is unchanged. The DROP is explicit here because,
-- unlike in that migration, the view currently EXISTS.
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
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design. Rebuilt 20271197327520 after moodboard_style_family was added.';

-- ── get_vendor_mood_board — hand the vendor surface the same fact ──────────
-- CREATE OR REPLACE, additive: one new key (`style_family`) on the returned
-- jsonb; every existing key stays, so the one live caller
-- (apps/web/app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx) keeps
-- working unchanged. That page runs the SERVER half of the decor-layer pilot
-- (renderDecorLayerDataUrl) and was passing a hard-coded `null` style family
-- because there was nothing to pass; now there is.
-- Body otherwise copied verbatim from 20271193469029.
CREATE OR REPLACE FUNCTION public.get_vendor_mood_board(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_vendor_profile_id uuid;
  v_event record;
  v_inspirations jsonb;
BEGIN
  SELECT vp.vendor_profile_id INTO v_vendor_profile_id
  FROM vendor_profiles vp
  WHERE vp.user_id = auth.uid()
  LIMIT 1;

  IF v_vendor_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_a_vendor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = v_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'not_booked';
  END IF;

  SELECT
    e.display_name,
    e.role_palette,
    e.reception_design,
    e.mood_board_updated_at,
    e.moodboard_theme_name,
    e.moodboard_theme_description,
    e.moodboard_style_family
  INTO v_event
  FROM events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'slot_key',      ia.slot_key,
      'slot_position', ia.slot_position,
      'image_url',     ia.image_url
    ) ORDER BY ia.slot_position
  ) INTO v_inspirations
  FROM event_inspiration_assets ia
  WHERE ia.event_id = p_event_id
    AND ia.removed_at IS NULL;

  RETURN jsonb_build_object(
    'display_name',              v_event.display_name,
    'role_palette',              COALESCE(v_event.role_palette,     '{}'::jsonb),
    'reception_design',          COALESCE(v_event.reception_design, '{}'::jsonb),
    'mood_board_updated_at',     v_event.mood_board_updated_at,
    'theme_name',                v_event.moodboard_theme_name,
    'theme_description',         v_event.moodboard_theme_description,
    'style_family',              v_event.moodboard_style_family,
    'inspirations',              COALESCE(v_inspirations,           '[]'::jsonb)
  );
END;
$function$;
