-- ═══════════════════════════════════════════════════════════════════════════
-- THE SEAT ROOMS BELONG TO THE KINDS THAT SEAT PEOPLE
--
-- Owner ruling 2026-08-28, verbatim: "only its own rooms". The grid he approved
-- on 2026-08-17 (EVENT_HUB_UNIVERSAL_DESIGN_2026-08-17.md § A) gives the four
-- seat-shaped rooms — the seat pass, find-my-seat, the table map and the 3D
-- venue walk — a "—" for exactly three kinds: travel, date and hangout. A trip's
-- venues change daily and its seats are on transport; a dinner date and a
-- hangout have no banquet floor at all. Those rooms could only ever have shown
-- their "not posted yet" plate forever.
--
-- This withdraws the 'seating' surface from those three rows. The app half —
-- the four guest routes, the seating room, the day-of Seats tab and the paid
-- CUSTOM_QR_GUEST add-on — ships in the SAME commit, deliberately: narrowing
-- the readers alone would let a host of one of these kinds build a seat plan and
-- buy the branded per-guest QR pass whose guests then land on "this page does
-- not exist", which is the exact defect app/[slug]/seat/page.tsx records having
-- already been repaired once.
--
-- ⚠ THESE ROWS WERE CREATED BY AN ADMIN, NOT BY A MIGRATION. The PGlite replay
-- seeds only a handful of event_type_profiles rows, so this UPDATE matches ZERO
-- rows in every local test and in CI — silently, with no error. That is
-- expected and is NOT evidence the statement is wrong. It was dry-run against
-- production inside BEGIN…ROLLBACK before being written: all three rows moved
-- 7 surfaces → 6, the wedding stayed at 9, and a re-query after the rollback
-- confirmed all three still carried 'seating'.
--
-- ⚠ DO NOT "FIX" THIS BY SEEDING THE ROWS HERE. Inventing profile rows in a
-- migration would fight the admin editor for ownership of the same table.
--
-- SAFE BY ARITHMETIC, MEASURED NOT ASSUMED (production, 2026-08-28): every
-- floor plan (2), every published floor plan (2) and every table (13) in the
-- database belongs to a WEDDING — the kind whose grid row keeps every room. The
-- only live `date` event and the only live `simple_event` hold zero of each and
-- zero e-gift methods. Nothing anybody has made is withdrawn.
--
-- IDEMPOTENT: array_remove on a value that is already gone is a no-op, and the
-- WHERE clause skips the row entirely on a second run.
--
-- NOT TOUCHED: simple_event, which the approved grid keeps all four seat rooms
-- for, and the other 13 kinds, which are all-✓ in that column.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.event_type_profiles
   SET enabled_surfaces = array_remove(enabled_surfaces, 'seating'),
       updated_at = now()
 WHERE event_type IN ('travel', 'date', 'hangout')
   AND 'seating' = ANY(enabled_surfaces);

-- The rule this migration is one row of, recorded where a reader of the table
-- will actually meet it. A migration comment is not evidence; a column comment
-- is queryable.
COMMENT ON COLUMN public.event_type_profiles.enabled_surfaces IS
  'Which product surfaces this kind of event offers. Read by surfaceEnabled() '
  'in lib/event-type-profile.ts and by public_venue_scene(). Owner 2026-08-28: '
  '"only its own rooms" — a kind is offered the rooms it can actually fill. '
  'travel/date/hangout carry no ''seating'' (no banquet floor). '
  'A surface value the code does not know is silently DROPPED when the row is '
  'parsed, so add new values to ALL_SURFACES and PROFILE_SURFACES first. '
  'These rows are admin-authored: a migration that UPDATEs them matches zero '
  'rows in the PGlite replay, so dry-run against production in BEGIN…ROLLBACK.';
