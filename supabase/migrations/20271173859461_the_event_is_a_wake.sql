-- ============================================================================
-- THE EVENT IS A WAKE. THE FUNERAL IS THE CEREMONY INSIDE IT.
-- ============================================================================
--
-- Owner ruling 2026-08-27, verbatim:
--   "Wake is the viewing (our event not funeral).
--    Funeral is the ceremony until burial.
--    So change it to Wake instead of Funeral."
--
-- ── WHY THIS IS A CORRECTION, NOT A RENAME ──────────────────────────────────
--
-- One word was doing two jobs. The **lamay** — the nights of viewing, held at a
-- chapel or in the family sala, running as long as the family needs — is the
-- thing a family actually plans with us: the guest list, the schedule, the food
-- through the nights, the photographs. The **funeral** is the ceremony on the
-- closing day, through to the interment.
--
-- Shipping the type as "Funeral" named the last day and called it the whole
-- stretch. This gives each word back its own meaning:
--
--   • the EVENT TYPE becomes `wake`
--   • `funeral` keeps meaning the ceremony — it stays the label of the service
--     on the run-of-show, the "funeral Mass" option in onboarding, the
--     "funeral home" a family arranges with, and the supplier category
--
-- ⛔ SO DO NOT SWEEP THE WORD "funeral" OUT OF THE PRODUCT. Almost every
-- surviving use of it is CORRECT and was correct before this migration. What was
-- wrong is exactly one thing: the name of the event type. A global find-and-
-- replace here would delete the distinction this migration exists to draw.
--
-- ── WHY NOW, AND WHY IT IS CHEAP ────────────────────────────────────────────
--
-- Measured against production before writing a line, not estimated:
--
--   events with event_type='funeral' ................... 0
--   event_type_vocab .................................... 1
--   event_type_profiles ................................. 1
--   event_type_onboarding ............................... 1
--   service_categories (applicable_event_types array) ... 7
--   every other event_type-carrying table ............... 0
--
-- Ten rows, four tables, and **not one family has created one**. The stored
-- value can move with nothing to migrate and nobody to strand. That is only true
-- today: the first real wake makes this a data migration with a grieving family
-- attached to it, and every week it waits the word spreads further into
-- screenshots, links and habits. `events.event_type` is TEXT with no CHECK
-- constraint and no enum naming the value, so nothing else has to be widened.
--
-- ⚠ AND THE SEVEN `service_categories` ROWS ARE THE POINT OF THE WHOLE THING.
-- They are the marketplace tiles scoped to this type. If the key moves and they
-- do not, a family planning a wake gets the UNSCOPED marketplace — which today
-- means mobile bars, photo booths and dessert spreads in front of them. The
-- guard at the bottom refuses to apply rather than leave that state.
-- ============================================================================

-- ── THE ORDER IS THE WHOLE DIFFICULTY, AND THE FIRST CUT GOT IT WRONG ───────
--
-- 🪤 I CHECKED FOR A `CHECK` CONSTRAINT, FOUND NONE, AND CALLED THE VALUE FREE.
-- It is not: `event_type_vocab.event_type` is a FOREIGN KEY parent for three
-- tables, and the replay caught what the survey missed —
--   events               → ON UPDATE **NO ACTION**  (will REFUSE the parent rename)
--   event_type_profiles  → ON UPDATE CASCADE · ON DELETE **CASCADE**
--   event_type_onboarding→ ON UPDATE CASCADE · ON DELETE **CASCADE**
-- "No CHECK constraint names the value" is a true sentence about the wrong
-- constraint class. Ask `pg_constraint` for contype='f' too.
--
-- Two traps follow from that table, in opposite directions:
--   · renaming the vocab row FIRST is refused the moment one real event exists,
--     because that FK does not cascade;
--   · deleting the old vocab row while its profile still points at it would
--     CASCADE-DELETE the profile — taking the wake's solemn register with it.
--
-- So this does not rename the parent at all. It ADDS the new row, moves every
-- child onto it, and only then removes the old one — correct whatever the
-- cascade rules are and whatever the row counts are, today or after the first
-- real wake.

-- 1 ── mint the wake, carrying the funeral's own settings across. ON CONFLICT so
--      a re-apply is a no-op rather than a duplicate-key failure.
INSERT INTO public.event_type_vocab
       (event_type, label_en, emoji, enabled, status, sort_order, onboarding_href, hero_photo_url, description)
SELECT 'wake', 'Wake', v.emoji, v.enabled, v.status, v.sort_order, v.onboarding_href, v.hero_photo_url,
       -- The old description read "A wake and funeral — a farewell, arranged
       -- with care", which is the exact conflation being corrected: it named
       -- both and committed to neither.
       'The lamay — the nights of viewing, through to the funeral and the burial.'
  FROM public.event_type_vocab v
 WHERE v.event_type = 'funeral'
    ON CONFLICT (event_type) DO NOTHING;

-- 2 ── move every child onto it BEFORE the old row goes. Profiles and onboarding
--      cascade on delete, so this order is what keeps them alive.
UPDATE public.event_type_profiles   SET event_type = 'wake' WHERE event_type = 'funeral';
UPDATE public.event_type_onboarding SET event_type = 'wake' WHERE event_type = 'funeral';

-- 3 ── the events themselves. Zero rows today; written anyway, because a
--      migration that only works on an empty table is a migration that silently
--      does nothing the day it matters. Legal now that the parent exists.
UPDATE public.events                SET event_type = 'wake' WHERE event_type = 'funeral';

-- 3 ── the marketplace tiles scoped to this type (7 rows). Array membership, so
--      the swap is element-wise and leaves every other type in place.
UPDATE public.service_categories
   SET applicable_event_types = array_replace(applicable_event_types, 'funeral', 'wake')
 WHERE 'funeral' = ANY(applicable_event_types);

-- 4 ── the same swap on the canonical taxonomy. ZERO rows carry it today (every
--      death-care leaf is still unbuilt), so this is a no-op — included so the
--      two taxonomies cannot drift apart the moment somebody adds the first one.
UPDATE public.canonical_service_taxonomy
   SET applicable_event_types = array_replace(applicable_event_types, 'funeral', 'wake')
 WHERE 'funeral' = ANY(applicable_event_types);

-- 5 ── and only now the old row, which by here is referenced by nothing. If any
--      child were still pointing at it, ON DELETE CASCADE would silently take
--      that child with it — which is why this is the last statement and not the
--      first.
DELETE FROM public.event_type_vocab WHERE event_type = 'funeral';

COMMENT ON COLUMN public.event_type_vocab.event_type IS
  'The stored key for an event type. NOTE (2026-08-27): `funeral` was renamed to '
  '`wake` — the wake is the viewing and is what a family plans here; the funeral '
  'is the ceremony on the closing day and keeps that name on the run-of-show, in '
  'onboarding and as a supplier category. Do not re-merge the two.';

-- ── REFUSE TO APPLY IF THE RENAME IS PARTIAL ────────────────────────────────
-- A half-done rename is worse than none: the type would exist under one name and
-- its tiles under another, and the symptom is a grieving family being offered a
-- photo booth. So this checks the ARRAY tables too, which a row-count check
-- would walk straight past.
DO $guard$
DECLARE
  v_left INTEGER;
BEGIN
  SELECT
      (SELECT count(*) FROM public.events                     WHERE event_type = 'funeral')
    + (SELECT count(*) FROM public.event_type_vocab           WHERE event_type = 'funeral')
    + (SELECT count(*) FROM public.event_type_profiles        WHERE event_type = 'funeral')
    + (SELECT count(*) FROM public.event_type_onboarding      WHERE event_type = 'funeral')
    + (SELECT count(*) FROM public.service_categories         WHERE 'funeral' = ANY(applicable_event_types))
    + (SELECT count(*) FROM public.canonical_service_taxonomy WHERE 'funeral' = ANY(applicable_event_types))
    INTO v_left;

  IF v_left <> 0 THEN
    RAISE EXCEPTION
      'refusing to apply: % row(s) still carry event_type ''funeral'' after the rename', v_left;
  END IF;

  -- …and the wake must actually EXIST afterwards. Without this, deleting the
  -- statements above would satisfy the check above perfectly.
  IF NOT EXISTS (SELECT 1 FROM public.event_type_vocab WHERE event_type = 'wake' AND label_en = 'Wake') THEN
    RAISE EXCEPTION 'refusing to apply: no enabled ''wake'' vocab row exists — the type would vanish from the picker';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_type_profiles WHERE event_type = 'wake') THEN
    RAISE EXCEPTION 'refusing to apply: the wake has no profile row — its solemn register would be lost';
  END IF;
END;
$guard$;
