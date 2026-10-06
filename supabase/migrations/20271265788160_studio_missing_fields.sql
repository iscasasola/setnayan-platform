-- ============================================================================
-- 20271265788160_studio_missing_fields.sql
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, each
-- CHECK dropped before it is re-added, the view dropped before it is rebuilt).
--
-- 🧱 THE MISSING FIELDS ARE APPROVED — STEP 4c (owner 2026-10-07, verbatim
-- "approve all"; spec corpus DECISION_LOG row "THE MISSING FIELDS ARE APPROVED").
-- The Studio tools PR 4 (#6388) drew had nowhere to keep five things. Measured
-- in the tree before this file, three of them already HAVE a home and get no
-- column here:
--   · the Love Story's title and the couple's own order — each moment lives in
--     `events.love_story.moments[]` (lib/love-story-moments.ts: "NO NEW TABLE");
--     the two are keys of that moment, beside `line` and `place`;
--   · the Look extras (Pattern · Focus · Blur · Shade) — the main background is
--     `config_json.main` on the hero row (lib/hub-canvas.ts HUB_MAIN_GROUND_KEY,
--     "must not get a migration"); the extras ride on it;
--   · one main colour — `events.role_palette.reception[slot]`, the Mood Board's
--     five main colours (lib/mood-board-palette-set.ts).
-- What has no home, and is added here:
--
-- ── 1. event_schedule_blocks.audience — Schedule "For ▾" ────────────────────
-- Everyone · Entourage · Sponsors · Family · Suppliers (DECISION_LOG 2026-10-06
-- "STUDIO › SCHEDULE AND LOVE STORY"): a moment for a role is shown only to that
-- role (it IS their Arrive by on Invitation › Me); the guests' schedule shows
-- only the Everyone moments. NULL = Everyone — exactly today's behaviour, so no
-- default and no backfill ("a NOT NULL DEFAULT is a write nobody made");
-- 'everyone' is never stored.
--   GRANTS: `event_schedule_blocks` holds Supabase's table-level grants, so the
--   column inherits SELECT/INSERT/UPDATE for anon and authenticated exactly like
--   its siblings (label, location, is_public). RLS is row-level and already
--   admits who may read and write a moment; the CHECK closes the value. Nothing
--   here is more private than the row's label, so the inherited grant is the
--   right one — stated, and asserted below, rather than re-cut.
--
-- ── 2. events.gift_registry_url — E-Gifts "Paste a link to your registry" ───
-- Optional. http(s) only, one line, at most 500 characters — the CHECK holds it
-- whatever the writer (`savePabuyaMessage` also validates, in words). Written
-- LIVE through the host's own session, like every E-Gifts write (the E-Gifts tool
-- says so); shown on the guest Gifts page when set. NULL = no link.
--
-- ── 3. events.qr_shown — Info › Your Event Hub › QR on/off ──────────────────
-- FALSE hides the event QR from the prints and the guest page. NULL (and TRUE)
-- = shown — today's behaviour, no default, no backfill. Drafted in the Maker and
-- written at Apply through the host's own session (lib/hub-draft.ts answers).
--
-- ── GRANTS on events (lint-events-column-grants) ────────────────────────────
-- SELECT + UPDATE to `authenticated` for both; `anon` NOTHING — the guest page
-- reads events through the service role (app/[slug]/_lib/loaders.ts). Then
-- `events_host` is rebuilt over them, the recipe of 20271263730696 (the latest
-- carrier), extracted mechanically, not retyped.
-- ============================================================================

BEGIN;

-- ── 1. Schedule "For ▾" ─────────────────────────────────────────────────────
ALTER TABLE public.event_schedule_blocks ADD COLUMN IF NOT EXISTS audience TEXT;

ALTER TABLE public.event_schedule_blocks
  DROP CONSTRAINT IF EXISTS event_schedule_blocks_audience_check;
ALTER TABLE public.event_schedule_blocks
  ADD CONSTRAINT event_schedule_blocks_audience_check
  CHECK (audience IS NULL OR audience IN ('entourage', 'sponsors', 'family', 'suppliers'));

COMMENT ON COLUMN public.event_schedule_blocks.audience IS
  'Schedule › For ▾ (owner 2026-10-06/07): who this moment is for — entourage · sponsors · family · '
  'suppliers. NULL = Everyone (never stored as a word). A role''s moment is that role''s Arrive by and '
  'is left off the guests'' schedule (apps/web/lib/schedule-audience.ts).';

-- ── 2. E-Gifts registry link ────────────────────────────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gift_registry_url TEXT;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_gift_registry_url_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_gift_registry_url_check
  CHECK (
    gift_registry_url IS NULL
    OR (gift_registry_url ~ '^https?://[^[:space:]]+$' AND char_length(gift_registry_url) <= 500)
  );

COMMENT ON COLUMN public.events.gift_registry_url IS
  'E-Gifts › Registry link (owner 2026-10-07): an optional http(s) link to the couple''s gift registry, '
  'shown on the guest Gifts page when set. NULL = none. Written live by savePabuyaMessage.';

-- ── 3. QR on/off ────────────────────────────────────────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS qr_shown BOOLEAN;

COMMENT ON COLUMN public.events.qr_shown IS
  'Info › Your Event Hub › QR (owner 2026-10-07): FALSE hides the event QR from the prints and the '
  'guest page. NULL or TRUE = shown (today''s behaviour). Drafted in the Maker, written at Apply.';

GRANT SELECT (gift_registry_url) ON public.events TO authenticated;
GRANT UPDATE (gift_registry_url) ON public.events TO authenticated;
GRANT SELECT (qr_shown) ON public.events TO authenticated;
GRANT UPDATE (qr_shown) ON public.events TO authenticated;

DROP VIEW IF EXISTS public.events_host;

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
          -- service_role only, named EXPLICITLY. NOT `auth.uid() IS NULL` —
          -- that is also true for anon, which would hand every row to an
          -- unauthenticated caller. Reproduced verbatim from 20271008731642.
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';

DO $$
DECLARE
  c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['gift_registry_url', 'qr_shown'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'events.% is not readable by authenticated — every Maker query naming it would be refused', c;
    END IF;
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'UPDATE') THEN
      RAISE EXCEPTION 'events.% is not writable by authenticated — the E-Gifts link and Apply''s QR switch could not be written', c;
    END IF;
    IF has_column_privilege('anon', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'events.% is readable by anon — every guest-facing read goes through the admin client', c;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = c
    ) THEN
      RAISE EXCEPTION 'events_host was rebuilt without %', c;
    END IF;
  END LOOP;
  -- The private columns must STILL project for hosts — a DROP VIEW + recompute
  -- can silently lose them, and that failure renders exactly like a couple who
  -- never filled those fields in.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('partner_a_birth_date','estimated_budget_centavos','wizard_state',
                             'signature_details','honoree_label')) <> 5 THEN
    RAISE EXCEPTION 'events_host lost a host-only private column in the rebuild';
  END IF;
  -- Its neighbours must have survived the view rebuild: EVERY events column a
  -- couple's session may read is projected (named by privilege, never by a
  -- list — a replay that skips another migration has fewer columns, not a loss).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'events'
       AND has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns v
          WHERE v.table_schema = 'public' AND v.table_name = 'events_host' AND v.column_name = c.column_name
       )
  ) THEN
    RAISE EXCEPTION 'events_host lost a neighbouring column in the rebuild';
  END IF;
  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;
END $$;

-- ── The schedule column: inherited exactly like its siblings, asserted ─────
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.event_schedule_blocks', 'label', 'UPDATE')
     AND NOT has_column_privilege('authenticated', 'public.event_schedule_blocks', 'audience', 'UPDATE') THEN
    RAISE EXCEPTION 'event_schedule_blocks.audience is not writable where label is — For ▾ could not save';
  END IF;
  IF has_column_privilege('anon', 'public.event_schedule_blocks', 'label', 'SELECT')
     AND NOT has_column_privilege('anon', 'public.event_schedule_blocks', 'audience', 'SELECT') THEN
    RAISE EXCEPTION 'event_schedule_blocks.audience is not readable where label is — the guests'' schedule filter would be refused';
  END IF;
END $$;

COMMIT;
