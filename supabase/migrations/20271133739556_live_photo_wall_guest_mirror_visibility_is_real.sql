-- Live Photo Wall — the couple's guest-mirror choice becomes real.
--
-- events.live_photo_wall_visibility shipped on 2026-11-04 (migration
-- 20261104000959) and until today had ZERO readers, ZERO writers and ZERO
-- database consumers beyond its own CHECK constraint and the events_host
-- projection. It is the FIFTH "gate with no handle" here — a column that nothing
-- writes, or nothing reads, silently disabling a shipped feature. (Counted from
-- gates-have-handles.test.ts, which already tracked four; the task brief that
-- prompted this said "third", and the registry is the evidence.)
--
-- WHAT THE COLUMN IS FOR. The ₱2,500 SKU is titled "Live VENUE Photo Wall" and
-- the couple's control card only ever talked about a venue projection and
-- screen codes. But the same screened feed is ALSO mirrored onto every invited
-- guest's phone for the whole live window (owner 2026-06-12: the wall belongs
-- on the on-the-day page). A couple who revoked every venue screen code would
-- reasonably believe the wall was off; it was still running in every guest's
-- hand, because the guest surfaces gated on SKU ownership alone.
--
-- WHAT CHANGES HERE — data honesty only; no behaviour moves in this file.
--
-- 1. The DEFAULT becomes 'all_with_consent', which is what the product has
--    actually been doing since the mirror shipped. The old default,
--    'tagged_only', was aspirational: NOTHING anywhere filters the mirror down
--    to the photos a guest appears in. Storing 'tagged_only' while showing
--    everything is the `sponsored_included` disease — a stored value whose NAME
--    misleads every later reader. A comment does not travel with a value into a
--    query result, a log line or an audit; the stored value has to be true.
--
-- 2. The five production rows (all of them still on the untouched default, all
--    of them written by nothing) move with it. This is not a decision taken on
--    any couple's behalf: it records the behaviour they already have. Zero
--    events own LIVE_WALL in production today, so nothing visible changes for
--    anyone.
--
-- 'tagged_only' stays LEGAL in the CHECK because the per-guest filter is a real
-- future build the owner may ask for. It must not be WRITTEN until that filter
-- exists — the application writer emits only 'all_with_consent' | 'off', and
-- lib/live-wall-logic.ts resolves a legacy 'tagged_only' to "show everything"
-- deliberately and under test, so the fallback can never be mistaken for
-- working filtration.
--
-- The VENUE projection (/wall/[eventId] + /api/wall/[eventId]/feed) does NOT
-- read this column and is untouched: it projects regardless, owner-locked
-- 2026-06-11, gated by its own single-use screen code. This column has only
-- ever been about the guest PHONE mirror.
--
-- Idempotent + additive. No table is created, dropped or renamed.

-- ---------------------------------------------------------------------------
-- 1. The default tells the truth for every event created from now on.
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ALTER COLUMN live_photo_wall_visibility SET DEFAULT 'all_with_consent';

-- ---------------------------------------------------------------------------
-- 2. Existing rows stop storing a promise the product does not keep.
--    Scoped to 'tagged_only' ONLY, so a real couple choice ('off', or an
--    explicit 'all_with_consent') is never overwritten — including on a re-run.
-- ---------------------------------------------------------------------------
UPDATE public.events
   SET live_photo_wall_visibility = 'all_with_consent'
 WHERE live_photo_wall_visibility = 'tagged_only';

-- ---------------------------------------------------------------------------
-- 3. The comment names the surface it governs, in the words a person would use.
--    The old comment said "Guest PHONE-CARD global photo-wall toggle (0031)" —
--    accurate, and read by nobody for nine months.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.events.live_photo_wall_visibility IS
  'Does the live photo wall ALSO mirror onto every guest''s own phone during the celebration? '
  '''all_with_consent'' = yes, the same screened feed the venue screen shows (the default, and '
  'what the product has always done). ''off'' = the wall plays at the venue only. '
  'READ BY: lib/live-wall.ts guestWallMirrorActive(), the single gate every guest-facing wall '
  'surface calls — the slug page loader, the guest hub, and the /[slug]/live-wall poll route. '
  'WRITTEN BY: setWallGuestMirror() on the couple''s Papic page (couple-only). '
  'NOT read by the VENUE projection (/wall/[eventId]) — that projects regardless, owner-locked '
  '2026-06-11, and is gated by its own single-use screen code instead. '
  'WARNING: ''tagged_only'' is LEGAL but UNIMPLEMENTED — nothing anywhere filters the mirror to the '
  'photos a guest appears in. It resolves to "show everything" (deliberately, under test). Do NOT '
  'write it until that filter is built, or the stored value becomes a promise we do not keep.';
