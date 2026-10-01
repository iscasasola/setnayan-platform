-- ============================================================================
-- 20271259024543_thin_event_types_are_scoped_to_the_categories_that_serve_them.sql
--
-- Owner, 2026-10-02: "yes scope it." Find a supplier shows ONLY the categories
-- an event's type is scoped to (`service_categories.applicable_event_types`,
-- Admin › Event type › Scope categories), and five types had almost nothing:
--
--   type          categories before   (audit 2026-10-01)
--   simple_event   1  (chairs_tents, added by 20271257951866; 0 before)
--   hangout        3
--   date           6
--   wake          11  (10 before chairs_tents)
--   birthday      30  (already wide; one gap closed)
--
-- WHAT THIS DOES
--   Appends a type to a CATEGORY (tier-2 tile). It never touches the 253
--   services: a service with a NULL list inherits its tile's list, which is
--   what keeps Admin › Event type › Scope categories the one place the owner
--   edits (see the header of 20271257951866 for why copying a list onto the
--   services would orphan every later edit).
--
-- WHAT IT NEVER DOES
--   • remove a type from any category (asserted below, element by element);
--   • change a wedding's list (asserted below: every category that reached a
--     wedding still does, and no category that did not reach a wedding now
--     does — only thin types are ever appended);
--   • touch a category whose list is NULL/empty (that means "every type" — the
--     two hidden tiles `livestream` and `everything_else` stay exactly so);
--   • invent a category: every id below is read from the replayed schema, and
--     a missing id RAISES rather than silently doing nothing.
--
-- Budget is never a filter here: this is which KINDS of supplier a type may
-- browse, not what any of them costs.
--
-- Idempotent: a type already in a list is skipped. Additive only.
-- The owner reviews every list in Admin › Event type › Scope categories.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _scope_before ON COMMIT DROP AS
  SELECT id, applicable_event_types AS types
    FROM public.service_categories
   WHERE tier = 2;

-- (category id, thin type to ADD). One row per addition, so the PR table and
-- this list are the same thing.
CREATE TEMP TABLE _scope_add (category_id TEXT NOT NULL, event_type TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO _scope_add (category_id, event_type) VALUES
  -- ── birthday: dinner out (the rest of its list was already wide) ────────
  ('restaurant_reservation', 'birthday'),

  -- ── hangout: a place, something to eat, a bit of music, a photo ─────────
  ('reception',              'hangout'),
  ('catering',               'hangout'),
  ('dessert',                'hangout'),
  ('mobile_bar',             'hangout'),
  ('florist',                'hangout'),
  ('dj',                     'hangout'),
  ('live_band',              'hangout'),
  ('photo_booth',            'hangout'),

  -- ── date: flowers, dessert, a serenade, a keepsake ──────────────────────
  ('dessert',                'date'),
  ('live_band',              'date'),
  ('jewelleries_accessories','date'),

  -- ── wake: the hall or chapel, and the coffee a family serves ───────────
  -- (Not `transfers_rentals`: its services are airport / charter transfers,
  -- all scoped to travel — a wake would find nothing there. Wake transport is
  -- `guest_shuttle`, already in its list. Not `av_production` for a birthday
  -- either: its services are scoped corporate / wedding / debut, and the
  -- tile-event-type-fillable guard refuses a tile no service can fill.)
  ('reception',              'wake'),
  ('ceremony_venue',         'wake'),
  ('coffee_espresso',        'wake'),

  -- ── simple_event / get-together: venue, food, cake, photo, decor, sound ─
  ('reception',              'simple_event'),
  ('catering',               'simple_event'),
  ('cake',                   'simple_event'),
  ('photo_video',            'simple_event'),
  ('stylist_decorator',      'simple_event'),
  ('florist',                'simple_event'),
  ('lights_sound',           'simple_event'),
  ('dj',                     'simple_event'),
  ('dessert',                'simple_event'),
  ('food_cart',              'simple_event'),
  ('photo_booth',            'simple_event'),
  ('restaurant_reservation', 'simple_event'),
  ('souvenir_giveaways',     'simple_event');

DO $pre$
DECLARE v_missing TEXT;
BEGIN
  SELECT string_agg(DISTINCT a.category_id, ', ') INTO v_missing
    FROM _scope_add a
    LEFT JOIN public.service_categories c
           ON c.id = a.category_id AND c.tier = 2 AND c.status = 'active'
   WHERE c.id IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: not an active tier-2 category: %', v_missing;
  END IF;
  IF EXISTS (
    SELECT 1 FROM _scope_add a
     WHERE a.event_type NOT IN ('birthday', 'hangout', 'date', 'wake', 'simple_event')
  ) THEN
    RAISE EXCEPTION 'refusing to apply: this migration only scopes the five thin types';
  END IF;
END;
$pre$;

-- Append, never replace. A NULL/empty list means "every type" and is left alone.
-- Only the types NOT already present are appended, so a list never duplicates.
UPDATE public.service_categories c
   SET applicable_event_types = c.applicable_event_types
         || ARRAY(SELECT t FROM unnest(n.to_add) AS t
                   WHERE NOT (t = ANY (c.applicable_event_types)))
  FROM (
    SELECT category_id, array_agg(event_type ORDER BY event_type) AS to_add
      FROM _scope_add
     GROUP BY category_id
  ) n
 WHERE c.id = n.category_id
   AND c.applicable_event_types IS NOT NULL
   AND cardinality(c.applicable_event_types) > 0
   AND NOT (c.applicable_event_types @> n.to_add);

-- ── REFUSE TO APPLY IF ANY OF IT IS NOT TRUE ───────────────────────────────
DO $guard$
DECLARE
  v_n INTEGER;
  v_t TEXT;
  v_min CONSTANT JSONB := '{"birthday":8,"wake":5,"simple_event":5,"hangout":3,"date":3}';
BEGIN
  -- 1 · No type was removed from any category, and none went NULL/empty.
  SELECT count(*) INTO v_n
    FROM _scope_before b
    JOIN public.service_categories c ON c.id = b.id
   WHERE b.types IS NOT NULL AND cardinality(b.types) > 0
     AND (c.applicable_event_types IS NULL
          OR NOT (c.applicable_event_types @> b.types));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'refusing to apply: % categories lost an event type', v_n;
  END IF;

  -- 2 · A NULL/empty ("every type") category stayed that way.
  SELECT count(*) INTO v_n
    FROM _scope_before b
    JOIN public.service_categories c ON c.id = b.id
   WHERE (b.types IS NULL OR cardinality(b.types) = 0)
     AND c.applicable_event_types IS NOT NULL AND cardinality(c.applicable_event_types) > 0;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'refusing to apply: % universal categories became scoped', v_n;
  END IF;

  -- 3 · 🔑 A wedding's list is exactly what it was: nothing lost, nothing gained.
  SELECT count(*) INTO v_n
    FROM _scope_before b
    JOIN public.service_categories c ON c.id = b.id
   WHERE (b.types IS NULL OR cardinality(b.types) = 0 OR 'wedding' = ANY (b.types))
     IS DISTINCT FROM
         (c.applicable_event_types IS NULL OR cardinality(c.applicable_event_types) = 0
          OR 'wedding' = ANY (c.applicable_event_types));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'refusing to apply: % categories changed whether they reach a wedding', v_n;
  END IF;

  -- 4 · Each thin type now reaches at least its floor of categories.
  FOR v_t IN SELECT jsonb_object_keys(v_min) LOOP
    SELECT count(*) INTO v_n
      FROM public.service_categories
     WHERE tier = 2 AND status = 'active' AND marketplace_hidden IS FALSE
       AND (applicable_event_types IS NULL OR cardinality(applicable_event_types) = 0
            OR v_t = ANY (applicable_event_types));
    IF v_n < (v_min ->> v_t)::int THEN
      RAISE EXCEPTION 'refusing to apply: % reaches only % categories (need %)', v_t, v_n, v_min ->> v_t;
    END IF;
  END LOOP;
END;
$guard$;

COMMIT;
