-- composable_event_foundation
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- Composable-event foundation (owner session 2026-07-15 · "code what we already
-- finished here"). ADDITIVE + BEHAVIOR-NEUTRAL: nothing reads these columns yet.
-- They are the hooks the composable-event build (reservations · dining · goods ·
-- communities/Samahan · multi-day · coordination) reads in the next build
-- session. Corpus: Composable_Event_Coordination_and_Token_Model_2026-07-15.md +
-- Composable_Event_Build_Map_2026-07-15.md (spec corpus root).
--
--   1 · event_type_profiles.event_class — personal-only vs community-eligible.
--       Owner-locked: a community (Samahan) can NEVER own personal-milestone
--       types (wedding · debut · christening · gender reveal · birthday ·
--       graduation); it CAN own simple_event · corporate · travel · celebration ·
--       tournament · reunion · anniversary (anniversary splits by host).
--   2 · event_type_profiles.layer_mode — 'anchored' (a venue is fed: catering /
--       crew meals — food comes TO the event) vs 'roaming' (travel/lifestyle:
--       timed dining reservations — people go OUT to eat). The two food models
--       are not interchangeable; this flag routes them.
--   3 · event_type_profiles.multi_day — per-type switch for "one event, several
--       days" (wedding weekend · travel · reunion · corporate). A rehearsal
--       dinner or send-off brunch is a DAY on the one event's timeline, never a
--       separate event; lodging is NEVER an event — it's a reservation that
--       spans the days.
--   4 · service_categories.service_nature — the 4-class spine of the composable
--       stack: reservation | service | goods | in_app. Default 'service'
--       preserves today's world (all ~54 wedding tiles are services).
--   5 · events.event_end_date — the multi-day hook. Column name matches the one
--       lib/payouts.ts:364 already anticipates ("when event_end_date lands as a
--       schema column"). NULL = single-day (today's behavior, unchanged).
--
-- Defaults are deny-by-exception, copying the marketplace_enabled pattern
-- (20270307127948): every default preserves current behavior byte-for-byte.

-- 1–3 · event_type_profiles class columns ------------------------------------

ALTER TABLE public.event_type_profiles
  ADD COLUMN IF NOT EXISTS event_class TEXT NOT NULL DEFAULT 'personal'
    CHECK (event_class IN ('personal', 'community_eligible'));

ALTER TABLE public.event_type_profiles
  ADD COLUMN IF NOT EXISTS layer_mode TEXT NOT NULL DEFAULT 'anchored'
    CHECK (layer_mode IN ('anchored', 'roaming'));

ALTER TABLE public.event_type_profiles
  ADD COLUMN IF NOT EXISTS multi_day BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_type_profiles.event_class IS
  'personal = only a person may own events of this type; community_eligible = a community (Samahan) may also own them. Owner-locked 2026-07-15: communities can never own personal-milestone types.';
COMMENT ON COLUMN public.event_type_profiles.layer_mode IS
  'anchored = single-venue events fed by catering; roaming = travel/lifestyle events that use timed dining reservations instead. Routes the food layer of the composable-event stack.';
COMMENT ON COLUMN public.event_type_profiles.multi_day IS
  'TRUE = this type may span several days (events.event_end_date + day-aware schedule). One event with days — segments like a rehearsal dinner are schedule blocks, never separate events.';

-- Seeds — UPDATE-only, never INSERT. A fabricated profile row would carry
-- enabled_surfaces='{}' and silently DISABLE that type's surfaces (the code
-- falls back to full hard-coded profiles only when the ROW is missing). Types
-- without a profile row keep their code fallbacks, which ship matching values.
UPDATE public.event_type_profiles
   SET event_class = 'community_eligible'
 WHERE event_type IN
   ('simple_event', 'corporate', 'travel', 'celebration', 'tournament', 'reunion', 'anniversary')
   AND event_class <> 'community_eligible';

UPDATE public.event_type_profiles
   SET layer_mode = 'roaming'
 WHERE event_type = 'travel'
   AND layer_mode <> 'roaming';

UPDATE public.event_type_profiles
   SET multi_day = TRUE
 WHERE event_type IN ('wedding', 'travel', 'reunion', 'corporate')
   AND multi_day IS DISTINCT FROM TRUE;

-- 4 · service_categories.service_nature ---------------------------------------

ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS service_nature TEXT NOT NULL DEFAULT 'service'
    CHECK (service_nature IN ('reservation', 'service', 'goods', 'in_app'));

COMMENT ON COLUMN public.service_categories.service_nature IS
  'Composable-stack class: reservation (lodging/dining slots, settle on-site) | service (vendor performs, off-platform 0%) | goods (items single/bulk, off-platform, never an in-app store) | in_app (Setnayan''s own SKUs). Default service = pre-existing behavior.';

-- 5 · events.event_end_date ----------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_end_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'events_end_date_after_start'
       AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_end_date_after_start
      CHECK (event_end_date IS NULL OR event_date IS NULL OR event_end_date >= event_date);
  END IF;
END $$;

COMMENT ON COLUMN public.events.event_end_date IS
  'Last day of a multi-day event (inclusive). NULL = single-day (unchanged default). Only meaningful for types whose profile sets multi_day=TRUE. Anticipated by lib/payouts.ts back-fill note.';
