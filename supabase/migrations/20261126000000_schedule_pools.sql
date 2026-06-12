-- ============================================================================
-- 20261126000000_schedule_pools.sql
--
-- PER-CATEGORY SCHEDULE POOLS + MULTI-POOL ATOMIC ACQUIRE — PR 1 (schema).
-- Canonical: Customer_Vendor_Marketplace_Architecture_2026-06-04.md § 4
-- (per-category pool bullets, 2026-06-12) + § 5a (inquiry lifecycle) +
-- DECISION_LOG 2026-06-12 "Schedule-pool + inquiry-lifecycle architecture".
--
-- Owner-locked rules this schema encodes:
--   1. The schedulable resource is the (org, leaf-category) POOL — every
--      service a vendor files under the same category draws from ONE shared
--      schedule (5 photo packages = 1 photo team). A new category = a new,
--      independent schedule (different materials/crew).
--      Org grain note: vendor_profiles.user_id is UNIQUE today, so
--      vendor_profile_id IS the org key — branches/agents/team members all
--      hang under one profile. If multi-profile orgs ever land, pools move
--      to the org table with them; nothing else changes.
--   2. Opt-in MERGE — two categories that share one crew (photo+video
--      studio) may map to the SAME pool. Modeled as the category→pool
--      mapping table: merge = two mapping rows pointing at one pool.
--      Per-category pools stay the default.
--   3. Bundles lock EVERY pool they span — acquire_schedule_pools() takes a
--      pool ARRAY and is all-or-nothing: deterministic-order row locks, any
--      pool full → nothing is consumed.
--   4. White is UNLIMITED; only BOOKED consumes. Pool bookings are written
--      by the acquire RPC on the capacity-consuming transition — never by
--      plain inquiries/soft-holds.
--   5. Status-flip, NEVER hard-delete — pool bookings release via
--      released_at (audit + revive substrate), and chat_threads gains the
--      displaced/withdrawn/expired lifecycle values.
--   6. External imported clients = category-scoped, capacity-consuming
--      calendar blocks with optional client metadata. NOT app clients (no
--      thread / funnel stats / review eligibility). Org-wide closure blocks
--      (vacation) stay pool_id NULL. Couples only ever see "unavailable"
--      (privacy lock — never who/why).
--
-- Apply BEFORE the code PRs (substrate-first pattern, cf. 20260627010000).
-- Idempotent: IF NOT EXISTS / OR REPLACE / guarded enum ADD VALUE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. chat_inquiry_status lifecycle values (outside the transaction — PG
--    forbids using a value added inside the same tx, and ADD VALUE has its
--    own transactional restrictions; nothing below reads these values).
--    'pending'   → vendor hasn't actioned (existing)
--    'accepted'  → vendor pursued/accepted (existing)
--    'declined'  → vendor declined w/ required reason (existing)
--    'displaced' → slot filled by another booking — REVIVABLE (new)
--    'withdrawn' → couple pulled the inquiry (new)
--    'expired'   → 30-day unanswered auto-expiry (new — replaces the
--                  "auto-deleted" wording; rows persist for the
--                  responsiveness-rate denominator + audit)
-- ----------------------------------------------------------------------------
ALTER TYPE public.chat_inquiry_status ADD VALUE IF NOT EXISTS 'displaced';
ALTER TYPE public.chat_inquiry_status ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE public.chat_inquiry_status ADD VALUE IF NOT EXISTS 'expired';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_schedule_pools — one row per independent schedule.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_schedule_pools (
  pool_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id       UUID NOT NULL
                          REFERENCES public.vendor_profiles(vendor_profile_id)
                          ON DELETE CASCADE,
  pool_label              TEXT NOT NULL DEFAULT ''
                          CHECK (length(pool_label) <= 80),
  -- Pool-grain daily capacity (supersedes the per-service
  -- vendor_services.daily_capacity grain for pooled categories; default 1/day
  -- per the locked slot model). Tier ceilings enforced app-side, mirroring
  -- daily_capacity's convention; SQL owns the structural bounds only.
  daily_booking_capacity  INT NOT NULL DEFAULT 1
                          CHECK (daily_booking_capacity BETWEEN 1 AND 50),
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_schedule_pools_vendor_idx
  ON public.vendor_schedule_pools(vendor_profile_id);

ALTER TABLE public.vendor_schedule_pools ENABLE ROW LEVEL SECURITY;

-- Pattern A: owning user manages their own pools (mirrors vendor_services).
DROP POLICY IF EXISTS vendor_schedule_pools_owner ON public.vendor_schedule_pools;
CREATE POLICY vendor_schedule_pools_owner
  ON public.vendor_schedule_pools FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Couples discovering vendors may read pool capacity for published vendors
-- (numbers only — no PII lives here; mirrors vendor_services_public_read).
DROP POLICY IF EXISTS vendor_schedule_pools_public_read ON public.vendor_schedule_pools;
CREATE POLICY vendor_schedule_pools_public_read
  ON public.vendor_schedule_pools FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
  );

COMMENT ON TABLE public.vendor_schedule_pools IS
  'Per-category schedule pools (owner lock 2026-06-12): the schedulable resource is the (org, leaf-category) pool, not the listing. All services in the same category share one pool; a new category = a new pool; opt-in merge = two categories mapped to one pool (vendor_schedule_pool_categories). Capacity attaches HERE (pool grain).';

-- ----------------------------------------------------------------------------
-- 2. vendor_schedule_pool_categories — category → pool mapping.
--    UNIQUE (vendor, category): every category resolves to exactly ONE pool.
--    Merge = several rows pointing at the same pool_id.
--    category_key uses the same canonical leaf vocabulary as
--    vendor_services.category (TEXT, taxonomy-keyed — never an enum, per the
--    expandable-taxonomy governance lock).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_schedule_pool_categories (
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  category_key       TEXT NOT NULL CHECK (length(category_key) > 0),
  pool_id            UUID NOT NULL
                     REFERENCES public.vendor_schedule_pools(pool_id)
                     ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, category_key)
);

CREATE INDEX IF NOT EXISTS vendor_schedule_pool_categories_pool_idx
  ON public.vendor_schedule_pool_categories(pool_id);

ALTER TABLE public.vendor_schedule_pool_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_schedule_pool_categories_owner ON public.vendor_schedule_pool_categories;
CREATE POLICY vendor_schedule_pool_categories_owner
  ON public.vendor_schedule_pool_categories FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vendor_schedule_pool_categories_public_read ON public.vendor_schedule_pool_categories;
CREATE POLICY vendor_schedule_pool_categories_public_read
  ON public.vendor_schedule_pool_categories FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
  );

COMMENT ON TABLE public.vendor_schedule_pool_categories IS
  'Category→pool resolution. One row per (vendor, leaf category); merge ("same team serves both", owner-delegated 2026-06-12) = multiple categories pointing at one pool_id. Default = one pool per category.';

-- ----------------------------------------------------------------------------
-- 3. vendor_schedule_pool_bookings — the capacity-consuming reservations.
--    Written ONLY by acquire_schedule_pools() (SECURITY DEFINER) on the
--    booked transition; released by release_schedule_pools() via released_at
--    (status-flip, never DELETE — revive + audit substrate).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_schedule_pool_bookings (
  pool_booking_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id            UUID NOT NULL
                     REFERENCES public.vendor_schedule_pools(pool_id)
                     ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id)
                     ON DELETE CASCADE,
  -- event_vendors.vendor_id is that table's PK (the couple↔vendor booking row).
  event_vendor_id    UUID NOT NULL
                     REFERENCES public.event_vendors(vendor_id)
                     ON DELETE CASCADE,
  event_id           UUID NOT NULL
                     REFERENCES public.events(event_id) ON DELETE CASCADE,
  booked_date        DATE NOT NULL,
  released_at        TIMESTAMPTZ,
  release_reason     TEXT
                     CHECK (release_reason IS NULL OR release_reason IN
                       ('host_cancelled', 'vendor_cancelled', 'force_majeure',
                        'status_downgrade', 'admin')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One LIVE reservation per (pool, booking row) — re-acquire is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_schedule_pool_bookings_live_uniq
  ON public.vendor_schedule_pool_bookings(pool_id, event_vendor_id)
  WHERE released_at IS NULL;

-- The capacity-count hot path: live bookings per pool per date.
CREATE INDEX IF NOT EXISTS vendor_schedule_pool_bookings_pool_date_idx
  ON public.vendor_schedule_pool_bookings(pool_id, booked_date)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS vendor_schedule_pool_bookings_event_vendor_idx
  ON public.vendor_schedule_pool_bookings(event_vendor_id);

ALTER TABLE public.vendor_schedule_pool_bookings ENABLE ROW LEVEL SECURITY;

-- Vendor owner reads their pools' bookings (calendar render).
DROP POLICY IF EXISTS vendor_schedule_pool_bookings_vendor_read ON public.vendor_schedule_pool_bookings;
CREATE POLICY vendor_schedule_pool_bookings_vendor_read
  ON public.vendor_schedule_pool_bookings FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Couple reads ONLY their own event's reservations (never other couples').
DROP POLICY IF EXISTS vendor_schedule_pool_bookings_couple_read ON public.vendor_schedule_pool_bookings;
CREATE POLICY vendor_schedule_pool_bookings_couple_read
  ON public.vendor_schedule_pool_bookings FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- No INSERT/UPDATE/DELETE policies on purpose: all writes go through the
-- SECURITY DEFINER RPCs below. App-level read-then-write cannot be made
-- race-safe (conflict-architecture audit 2026-06-04) — only the DB can
-- serialize the capacity decrement.

COMMENT ON TABLE public.vendor_schedule_pool_bookings IS
  'Capacity-consuming pool reservations. Written only by acquire_schedule_pools() (all-or-nothing across a bundle''s pools), released only via released_at (status-flip, never hard-delete — owner lock 2026-06-12). White inquiries/soft-holds never write here: only BOOKED consumes.';

-- ----------------------------------------------------------------------------
-- 4. vendor_calendar_blocks — pool scoping + external imported clients.
--    pool_id NULL  = org-wide block (vacation/closure → every pool).
--    pool_id set   = block scoped to that one category pool.
--    block_source 'external_client' = the vendor''s off-app booking: consumes
--    exactly 1 capacity unit in its pool per overlapping date (it is a real
--    job, not a closure) and MUST be pool-scoped. NOT an app client: no
--    thread, no funnel stats, no review eligibility — optional metadata only.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_calendar_blocks
  ADD COLUMN IF NOT EXISTS pool_id UUID
    REFERENCES public.vendor_schedule_pools(pool_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_name    TEXT CHECK (client_name    IS NULL OR length(client_name)    <= 120),
  ADD COLUMN IF NOT EXISTS client_contact TEXT CHECK (client_contact IS NULL OR length(client_contact) <= 160),
  ADD COLUMN IF NOT EXISTS client_note    TEXT CHECK (client_note    IS NULL OR length(client_note)    <= 500);

-- Widen the block_source vocabulary (inline CHECK from 20260518500000).
ALTER TABLE public.vendor_calendar_blocks
  DROP CONSTRAINT IF EXISTS vendor_calendar_blocks_block_source_check;
ALTER TABLE public.vendor_calendar_blocks
  ADD CONSTRAINT vendor_calendar_blocks_block_source_check
  CHECK (block_source IN ('manual', 'setnayan_booking', 'synced_calendar', 'external_client'));

-- External clients are category-scoped by definition (they consume one
-- category's materials/crew). NOT VALID keeps this instant on the existing
-- rows (none can violate it — the value didn't exist before this migration).
ALTER TABLE public.vendor_calendar_blocks
  DROP CONSTRAINT IF EXISTS vendor_calendar_blocks_external_needs_pool;
ALTER TABLE public.vendor_calendar_blocks
  ADD CONSTRAINT vendor_calendar_blocks_external_needs_pool
  CHECK (block_source <> 'external_client' OR pool_id IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS vendor_calendar_blocks_pool_idx
  ON public.vendor_calendar_blocks(pool_id)
  WHERE pool_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_calendar_blocks.pool_id IS
  'NULL = org-wide block (applies to every schedule pool — vacation/closure). Set = scoped to one category pool. external_client blocks MUST be pool-scoped (CHECK).';
COMMENT ON COLUMN public.vendor_calendar_blocks.client_name IS
  'External imported client (owner lock 2026-06-12): vendor''s off-app booking rendered as a named entry in their OWN book only. Never an app client — no thread/stats/reviews; couples see only "unavailable" (privacy lock).';

-- ----------------------------------------------------------------------------
-- 5. resolve_schedule_pool(vendor, category) — lazy pool bootstrap.
--    Returns the pool for a category, creating pool + mapping on first use.
--    Callable by the vendor owner OR by any authenticated user when the
--    category is one the vendor actually sells (couples resolving pools at
--    booking time) — junk-pool creation is therefore bounded by the vendor's
--    own published catalog.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_schedule_pool(
  p_vendor_profile_id UUID,
  p_category_key      TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id  UUID;
  v_is_owner BOOLEAN;
  v_sells    BOOLEAN;
BEGIN
  IF p_category_key IS NULL OR length(p_category_key) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT pool_id INTO v_pool_id
    FROM public.vendor_schedule_pool_categories
   WHERE vendor_profile_id = p_vendor_profile_id
     AND category_key = p_category_key;
  IF v_pool_id IS NOT NULL THEN
    RETURN v_pool_id;
  END IF;

  -- Creation guard: owner, or the category genuinely exists on the vendor's
  -- catalog (couple resolving at booking time / a service's linked category).
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles
     WHERE vendor_profile_id = p_vendor_profile_id AND user_id = auth.uid()
  ) INTO v_is_owner;
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_services
     WHERE vendor_profile_id = p_vendor_profile_id AND category = p_category_key
    UNION ALL
    SELECT 1 FROM public.vendor_service_links
     WHERE vendor_profile_id = p_vendor_profile_id
       AND linked_canonical_service = p_category_key
    LIMIT 1
  ) INTO v_sells;
  IF NOT v_is_owner AND NOT v_sells THEN
    RETURN NULL;
  END IF;

  -- Advisory lock serializes concurrent first-resolves of the same
  -- (vendor, category) so we never double-create.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_vendor_profile_id::text || ':pool:' || p_category_key, 0));

  SELECT pool_id INTO v_pool_id
    FROM public.vendor_schedule_pool_categories
   WHERE vendor_profile_id = p_vendor_profile_id
     AND category_key = p_category_key;
  IF v_pool_id IS NOT NULL THEN
    RETURN v_pool_id;
  END IF;

  INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label)
  VALUES (p_vendor_profile_id, p_category_key)
  RETURNING pool_id INTO v_pool_id;

  INSERT INTO public.vendor_schedule_pool_categories
    (vendor_profile_id, category_key, pool_id)
  VALUES (p_vendor_profile_id, p_category_key, v_pool_id);

  RETURN v_pool_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_schedule_pool(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_schedule_pool(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. acquire_schedule_pools — the multi-pool ALL-OR-NOTHING atomic acquire.
--
-- Owner verbatim (2026-06-12): "bundles mean they lock both schedules for
-- both category." A cross-category bundle passes every pool it spans; the
-- RPC locks the pool rows in deterministic order (no deadlock between two
-- concurrent bundles), checks every pool, and only then consumes — any pool
-- full/blocked → NOTHING is consumed.
--
-- Returns a JSONB envelope (same convention as acquire_service_time_slot):
--   { status:'ok', pool_ids:[...], booked_date }
--   { status:'full',    pool_id, pool_label }   -> capacity reached
--   { status:'blocked', pool_id }               -> manual/org block closes date
--   { status:'no_date' }                        -> degrade open (caller falls back)
--   { status:'not_authorized' } | { status:'no_pools' }
--
-- Date math: events.event_date is a civil DATE; blocks are TIMESTAMPTZ
-- ranges → compared in Asia/Manila civil time (PH-first product).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acquire_schedule_pools(
  p_event_id        UUID,
  p_event_vendor_id UUID,
  p_pool_ids        UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date      DATE;
  v_precision TEXT;
  v_pool      RECORD;
  v_used      INT;
  v_closed    BOOLEAN;
BEGIN
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  IF p_pool_ids IS NULL OR array_length(p_pool_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('status', 'no_pools');
  END IF;

  SELECT event_date, event_date_precision
    INTO v_date, v_precision
    FROM public.events
   WHERE event_id = p_event_id;

  -- Eventual-consistency doctrine: no day-precise date → degrade OPEN
  -- (the atomic gate engages the moment the couple locks a real day).
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN jsonb_build_object('status', 'no_date');
  END IF;

  -- Lock every pool row, DETERMINISTIC ORDER (pool_id) so two concurrent
  -- bundles spanning overlapping pool sets can never deadlock.
  FOR v_pool IN
    SELECT pool_id, pool_label, daily_booking_capacity, vendor_profile_id
      FROM public.vendor_schedule_pools
     WHERE pool_id = ANY (p_pool_ids)
       AND is_active
     ORDER BY pool_id
       FOR UPDATE
  LOOP
    -- (a) Closure blocks: a manual/synced block overlapping the date, either
    --     scoped to this pool or org-wide (pool_id IS NULL), closes the date
    --     outright regardless of capacity.
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_calendar_blocks b
       WHERE b.vendor_profile_id = v_pool.vendor_profile_id
         AND b.block_source IN ('manual', 'synced_calendar')
         AND (b.pool_id = v_pool.pool_id OR b.pool_id IS NULL)
         AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
         AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date
    ) INTO v_closed;
    IF v_closed THEN
      RETURN jsonb_build_object('status', 'blocked', 'pool_id', v_pool.pool_id);
    END IF;

    -- (b) Occupancy = live app reservations (other booking rows) +
    --     external-client jobs on this pool overlapping the date.
    SELECT
      (SELECT count(*) FROM public.vendor_schedule_pool_bookings pb
        WHERE pb.pool_id = v_pool.pool_id
          AND pb.booked_date = v_date
          AND pb.released_at IS NULL
          AND pb.event_vendor_id <> p_event_vendor_id)
      +
      (SELECT count(*) FROM public.vendor_calendar_blocks b
        WHERE b.pool_id = v_pool.pool_id
          AND b.block_source = 'external_client'
          AND (b.blocked_at    AT TIME ZONE 'Asia/Manila')::date <= v_date
          AND (b.blocked_until AT TIME ZONE 'Asia/Manila')::date >= v_date)
    INTO v_used;

    IF v_used >= v_pool.daily_booking_capacity THEN
      RETURN jsonb_build_object(
        'status', 'full',
        'pool_id', v_pool.pool_id,
        'pool_label', v_pool.pool_label);
    END IF;
  END LOOP;

  -- All pools clear under held locks → consume every one. Idempotent on
  -- re-acquire via the live-uniqueness partial index.
  INSERT INTO public.vendor_schedule_pool_bookings
    (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date)
  SELECT sp.pool_id, sp.vendor_profile_id, p_event_vendor_id, p_event_id, v_date
    FROM public.vendor_schedule_pools sp
   WHERE sp.pool_id = ANY (p_pool_ids)
  ON CONFLICT (pool_id, event_vendor_id) WHERE released_at IS NULL
  DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pool_ids', to_jsonb(p_pool_ids),
    'booked_date', v_date);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.acquire_schedule_pools(UUID, UUID, UUID[]) IS
  'Multi-pool all-or-nothing atomic acquire (owner 2026-06-12: "bundles lock both schedules for both category"). Deterministic-order FOR UPDATE on every pool row → closure-block check → occupancy check (live reservations + external-client jobs) → consume all pools or none. Couple-auth via current_couple_event_ids(); degrades open without a day-precise date.';

-- ----------------------------------------------------------------------------
-- 7. release_schedule_pools — the status-flip release (never DELETE).
--    Callable by the couple on the event OR the vendor who owns the pools
--    (cancel paths on both sides + force majeure + admin via service role).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_schedule_pools(
  p_event_vendor_id UUID,
  p_reason          TEXT DEFAULT 'host_cancelled'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_allowed  BOOLEAN;
  v_count    INT;
BEGIN
  SELECT event_id INTO v_event_id
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT (
    v_event_id IN (SELECT public.current_couple_event_ids())
    OR EXISTS (
      SELECT 1
        FROM public.vendor_schedule_pool_bookings pb
        JOIN public.vendor_profiles vp USING (vendor_profile_id)
       WHERE pb.event_vendor_id = p_event_vendor_id
         AND vp.user_id = auth.uid())
  ) INTO v_allowed;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  UPDATE public.vendor_schedule_pool_bookings
     SET released_at = NOW(),
         release_reason = CASE
           WHEN p_reason IN ('host_cancelled','vendor_cancelled',
                             'force_majeure','status_downgrade','admin')
           THEN p_reason ELSE 'host_cancelled' END
   WHERE event_vendor_id = p_event_vendor_id
     AND released_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('status', 'ok', 'released', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.release_schedule_pools(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_schedule_pools(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.release_schedule_pools(UUID, TEXT) IS
  'Status-flip release of all live pool reservations for a booking row (released_at + reason — never DELETE, owner lock 2026-06-12). Frees the date for revive-with-confirmation; rows persist for audit + the responsiveness-rate denominator.';

COMMIT;

-- =============================================================================
-- VERIFICATION (run via supabase db query):
--   \d public.vendor_schedule_pools
--   \d public.vendor_schedule_pool_categories
--   \d public.vendor_schedule_pool_bookings
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('resolve_schedule_pool','acquire_schedule_pools',
--                      'release_schedule_pools');
--   SELECT enumlabel FROM pg_enum
--    WHERE enumtypid = 'public.chat_inquiry_status'::regtype;
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'public.vendor_calendar_blocks'::regclass;
-- =============================================================================
