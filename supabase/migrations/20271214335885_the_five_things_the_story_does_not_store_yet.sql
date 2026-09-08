-- THE FIVE THINGS THE STORY DOES NOT STORE YET — columns only, no readers.
--
-- Phase 0 step 0.5 of the by-the-minute story build
-- (Design_Editorial_By_The_Minute_2026-09-07, 03 §2.2/§2.5–2.7, 08 step 0.5).
-- Its whole job is to exist BEFORE the Story Maker and the cover screen are
-- built, so those two do not collide over one migration. Nothing reads these
-- columns in this change, and that is deliberate — a reader lands with the
-- screen that needs it.
--
-- ── WHAT WAS MEASURED, NOT READ ─────────────────────────────────────────────
-- Against PROD (njrupjnvkjkitfctetvi) and origin/main df0d78d16, 2026-09-09:
-- none of story_cover_kind, story_cover_ref, previous_event_id,
-- peak_concurrent_viewers or photo_messages.author_named_publicly existed
-- anywhere in supabase/migrations, apps/web/lib or apps/web/app, and prod's
-- information_schema agreed for all five.
--
-- ⚠ THE BRIEF NAMED THE WRONG FK TARGET AND IT HAPPENS TO WORK. It asked for
-- `REFERENCES events(event_id)`, and `events`' PRIMARY KEY is `id bigint` — the
-- hidden bigserial the canonical-ID lock keeps for internal joins. The
-- reference is still legal because `event_id uuid` carries its own UNIQUE index
-- (`events_event_id_key`, verified in prod), which is a valid FK target. It is
-- also the RIGHT target: `event_id` is the uuid every app-side event query
-- already passes around, and `events_host` itself filters on it. Recorded
-- because the next person to read the brief will have the same doubt.

-- ── 1 · THE STORY'S COVER (03 §2.6) ─────────────────────────────────────────
-- There is no story-cover concept today: the /realstories card and the OG card
-- both inherit the LIVING hero (landing_page_hero_image_url / hero_video_r2_key),
-- so a couple cannot choose the one picture their story is known by.
-- ⚠ showcase_photo_r2_key is on VENDOR SERVICES, a different table. Not this.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS story_cover_kind TEXT,
  ADD COLUMN IF NOT EXISTS story_cover_ref  TEXT;

-- The five candidates the design offers (02 §6): the living hero · any accepted
-- capture from a written minute · a supplier frame · the animated monogram ·
-- upload another. Closed vocabulary so a typo cannot become a silent no-cover.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_story_cover_kind_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_story_cover_kind_check
  CHECK (story_cover_kind IS NULL
         OR story_cover_kind IN ('hero','capture','vendor_frame','monogram','upload'));

COMMENT ON COLUMN public.events.story_cover_kind IS
  'Which of the five cover candidates the host chose (02 section 6): hero | capture | '
  'vendor_frame | monogram | upload. NULL means never chosen, which renders exactly as '
  'today (the living hero); ''hero'' means the host was asked and picked it. Written by '
  'the Story Maker cover screen; nothing reads it yet.';

COMMENT ON COLUMN public.events.story_cover_ref IS
  'Where the chosen cover lives: an R2 key for ''upload'', a capture id for ''capture'', '
  'the supplier frame''s key for ''vendor_frame''. NULL for ''hero'' and ''monogram'', which '
  'need no pointer. Deliberately NOT constrained against story_cover_kind here — the '
  'cover screen that writes the pair will add that CHECK once its shapes are fixed, and '
  'a pairing rule guessed now is a rule S7 would have to loosen. Not forgotten.';

-- ── 2 · ONE EVENT POINTS AT THE ONE BEFORE IT (03 §2.7) ─────────────────────
-- No parent_event_id, series_id, previous_event_id or chronicle column exists
-- anywhere. "Previously · No. 1" and the back cover's door both need one.
-- ON DELETE SET NULL, never CASCADE: an actor leaving keeps the record. The
-- successor survives its predecessor's deletion, having simply forgotten it.
-- Written ONLY on the host's go-signal tap (event-anchor.ts's own owner lock:
-- "an event exists only on the user's go-signal tap") — never derived, never
-- auto-created.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS previous_event_id UUID
    REFERENCES public.events(event_id) ON DELETE SET NULL;

-- An event cannot be its own predecessor. Structural, so no writer has to be careful.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_previous_event_id_not_self;
ALTER TABLE public.events
  ADD CONSTRAINT events_previous_event_id_not_self
  CHECK (previous_event_id IS NULL OR previous_event_id <> event_id);

-- ON DELETE SET NULL scans the referencing column on every event deletion, and
-- the back cover reads the other direction (who follows this one). Partial:
-- almost every event is nobody's sequel.
CREATE INDEX IF NOT EXISTS events_previous_event_id_idx
  ON public.events (previous_event_id)
  WHERE previous_event_id IS NOT NULL;

COMMENT ON COLUMN public.events.previous_event_id IS
  'The event this one continues, as events.event_id (uuid, UNIQUE — the PK is the hidden '
  'bigserial id). Powers "Previously - No. 1" and the back cover door. NULLABLE and '
  'ON DELETE SET NULL on purpose: an actor leaving keeps the record. Written only on the '
  'host''s explicit go-signal tap in the Story Maker, never derived and never auto-created.';

-- ── 3 · THE THREE NEW `events` COLUMNS MUST BE GRANTED, OR EVERY EVENTS QUERY DIES ──
-- 🛑 `public.events` REVOKES table-level SELECT and re-grants a computed
-- per-column allowlist (20271007100000 / 20271025120000). MEASURED IN PROD
-- 2026-09-09: has_table_privilege('authenticated','public.events','SELECT') is
-- FALSE and there are 191 per-column SELECT grants. A column added without its
-- own `GRANT SELECT (col)` is not merely invisible — PostgREST refuses the
-- ENTIRE query, so every signed-in read of `events` goes silently empty.
--
-- The three sibling tables in this migration are NOT like that: prod says
-- has_table_privilege('authenticated', …, 'SELECT') is TRUE for
-- panood_broadcasts, photo_messages and guest_columns, so their new columns
-- inherit the table grant and need no line here. Only `events` is the trap.
--
-- Caught by apps/web/scripts/lint-events-column-grants.mjs, which explains in
-- its own output why the db coverage tests CANNOT catch it: their before()
-- re-applies the lockdown, recomputing the allowlist over the brand-new column
-- and making the bug vanish exactly where it would be tested.
--
-- ✅ SELECT ONLY, AND `authenticated` ONLY — a decision, not a copied line.
--   · No GRANT UPDATE: the shipped editor writes `events` through
--     createAdminClient() (website/editorial/actions.ts), and the Story Maker
--     follows it, so a session-level write grant would widen the surface for a
--     writer that does not exist. The screen that writes these adds UPDATE if
--     it ever writes through a user session.
--   · No grant to `anon`: /[slug] renders with the admin client, so the public
--     story never needs an anon grant to read a cover.
GRANT SELECT (story_cover_kind)  ON public.events TO authenticated;
GRANT SELECT (story_cover_ref)   ON public.events TO authenticated;
GRANT SELECT (previous_event_id) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER THEM ───────────────────────────────
-- That view has an EXPLICIT column projection, so a new base-table column is a
-- phantom on it until the view is recreated — and /dashboard/[eventId]/details
-- THROWS on a query error, which would kill Personalization for every host.
--
-- The projection is COMPUTED from the grants (hence: after the GRANTs above),
-- so the block below is reproduced VERBATIM from 20271211125659 — extracted
-- from that file mechanically, not retyped — including its private-column list
-- and its refuse-if-empty guard.
--
-- 🔑 ITS 15-NAME PRIVATE LIST IS THE RIGHT LIST, AND I CHECKED RATHER THAN
-- ASSUMED. Prod has 22 events columns that `authenticated` cannot SELECT, which
-- is SEVEN more than this list. Projecting all 22 would newly expose
-- master_qr_token and the two photo_delivery OAuth token columns through
-- events_host — a real leak. The arithmetic confirms the 15 are correct:
-- 191 selectable + 15 private = 206, which is exactly what events_host projects
-- in prod today (events itself has 213 columns). The other four unreadable
-- columns (kwento_flash_auto_wall, last_kwento_notify_at,
-- papic_vendor_challenges_enabled, panood_manual_on_air_at) are absent from
-- events_host today; this migration deliberately does not change that, because
-- changing it is not this step's business.

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

-- ── 4 · THE LIVE VIEWER FIGURE (03 §2.2) ────────────────────────────────────
-- Nothing stores how many people watched a broadcast live, so the story cannot
-- say "1,140 watching". One nullable int, filled by extending the broadcast
-- controller's EXISTING during-broadcast poll with
-- videos.list?part=liveStreamingDetails and keeping a running max.
--
-- NULLABLE with no default, and that is the point: NULL means "we never
-- measured this broadcast" — an older broadcast, or one whose poll never ran —
-- which is a different fact from 0 ("nobody watched"). The reader omits a null
-- rather than printing zero, following the convention ImpactMetrics already
-- keeps for its own optional figures.
ALTER TABLE public.panood_broadcasts
  ADD COLUMN IF NOT EXISTS peak_concurrent_viewers INT;

ALTER TABLE public.panood_broadcasts
  DROP CONSTRAINT IF EXISTS panood_broadcasts_peak_concurrent_viewers_nonneg;
ALTER TABLE public.panood_broadcasts
  ADD CONSTRAINT panood_broadcasts_peak_concurrent_viewers_nonneg
  CHECK (peak_concurrent_viewers IS NULL OR peak_concurrent_viewers >= 0);

COMMENT ON COLUMN public.panood_broadcasts.peak_concurrent_viewers IS
  'Highest simultaneous live viewers seen during this broadcast, as a running max from '
  'the controller''s existing poll. NULL means never measured (not zero) and a reader '
  'omits it rather than printing 0. No grant line needed: panood_broadcasts holds '
  'table-level SELECT for authenticated, unlike events.';

-- ── 5 · A PHOTO MESSAGE CARRIES A NAME ONLY IF THE GUEST ASKED (07 Q2) ──────
-- ⚖ DPO RULING 2026-09-09, and the owner IS the registered DPO (NPC DPO system,
-- 2026-07-07) — so this is the ruling itself, NOT outside counsel, and must
-- never be written up as "counsel cleared". Question put: the DPO had ruled for
-- guest_columns that a byline is opt-in, and DECISION_LOG recorded plainly that
-- "whether the ruling extends to photo messages was never put to the DPO and is
-- NOT decided". Ruling: IT EXTENDS. A photo message runs unnamed unless the
-- guest asked to be named.
--
-- Modelled exactly on guest_columns.author_named_publicly (20271116990067):
-- BOOLEAN NOT NULL DEFAULT FALSE. The default IS the safe value — every row
-- that predates this column publishes unnamed, which is the ruling applied
-- retroactively for free rather than a backfill nobody would run.
--
-- ⚠ DISTINCT FROM THE COLUMN THAT ALREADY EXISTS, and the older one's name
-- misleads: photo_messages.author_publicly_hidden suppresses the ENTIRE message
-- from publication. It is not a byline switch. Reading it as one, in the
-- 2026-07-30 filing draft, is on record as a mistake — and flipping its default
-- would have unpublished every photo message rather than anonymising it.
ALTER TABLE public.photo_messages
  ADD COLUMN IF NOT EXISTS author_named_publicly BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.photo_messages.author_named_publicly IS
  'DPO ruling 2026-09-09 (owner is the registered DPO), extending the 2026-08-06 '
  'guest_columns ruling to photo messages: the guest OPTED IN to being named beside '
  'their published message. FALSE (the default) publishes it with no byline, so rows '
  'predating this column are unnamed without a backfill. Distinct from '
  'author_publicly_hidden, which suppresses the whole message from publication.';

-- ── PROVE IT, rather than assume the statements above did what they say ──────
-- Each check is the failure it prevents, stated as an exception. The events
-- ones matter most: without them a missing grant is invisible until every
-- signed-in person's page is empty.
DO $$
DECLARE
  missing TEXT;
BEGIN
  -- (a) the three new events columns are readable, or every events query is refused
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY['story_cover_kind','story_cover_ref','previous_event_id']) AS c
  WHERE NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'events columns not readable by authenticated (%) — every events query would be refused', missing;
  END IF;

  -- (b) events_host was rebuilt over all three, or the host's Personalization page throws
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY['story_cover_kind','story_cover_ref','previous_event_id']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'events_host was rebuilt without (%)', missing;
  END IF;

  -- (c) events_host did NOT gain the secrets. This is the check that would catch
  --     someone "fixing" the private list by pasting prod's 22 unreadable columns.
  SELECT string_agg(column_name, ', ') INTO missing
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'events_host'
    AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'events_host now projects secret column(s) (%) — the private list was widened', missing;
  END IF;

  -- (d) the other two tables' columns exist and carry the right shape
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='panood_broadcasts'
       AND column_name='peak_concurrent_viewers' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'panood_broadcasts.peak_concurrent_viewers is missing or NOT NULL — null must mean never measured';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='photo_messages'
       AND column_name='author_named_publicly'
       AND is_nullable='NO' AND column_default = 'false'
  ) THEN
    RAISE EXCEPTION 'photo_messages.author_named_publicly must be NOT NULL DEFAULT FALSE — the safe value is the default, so old rows publish unnamed';
  END IF;
END $$;
