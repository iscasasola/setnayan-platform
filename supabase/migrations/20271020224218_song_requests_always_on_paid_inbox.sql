-- ============================================================================
-- REQUESTS ARE ALWAYS ON — and the paid line moves from the switch to the inbox.
--
-- Owner, 2026-07-30, answering the two blocking questions on Song Desk PR 5:
--   Q "Allow requests (anytime)" — a mode, or always-on?  → ALWAYS-ON.
--   Q so where is the paywall then?                       → SEEING the requests.
--   Q may the band still pause on the night?              → YES, a pause.
--
-- ⚠⚠ THIS REVERSES A LOCK FROM 2026-07-27 ("the band will open or close
-- accepting requests", migration 20271014100000) and it changes the meaning of
-- a column that shipped THREE HOURS EARLIER (20271020159662, PR #3876). Both
-- are deliberate and owner-answered; the reasoning lives in DECISION_LOG.md
-- 2026-07-30 (the song-desk rows) and Song_Desk_BUILD_ORDER_2026-07-27.md PR 1b.
--
-- ── WHAT SURVIVES FROM PR #3876, AND WHY THAT MATTERS ──────────────────────
--
-- PR #3876 withdrew INSERT/UPDATE column privilege on `song_requests_open` from
-- `authenticated`, making `setSongRequestsOpen` the sole write path. That work is
-- NOT wasted by always-on: the column stays, its meaning inverts to "not
-- paused", and a pause is still a paid control. So the column gate keeps doing
-- exactly its job and this migration deliberately touches no grants on it.
--
-- ── HALF 1 · ALWAYS ON MEANS ABSENT-ROW-IS-OPEN, NOT JUST A NEW DEFAULT ────
--
-- `vendor_dayof_configs` is SPARSE: an absent row means "code defaults", and a
-- vendor who never configures anything costs zero writes. So flipping the column
-- DEFAULT alone would change nothing for the overwhelming majority of bookings —
-- they have no row for a default to apply to. The GATE FUNCTION is what has to
-- invert, and it is rewritten below to read "open unless something says paused".
--
-- No backfill is needed: `vendor_dayof_configs` holds 0 rows in prod (verified
-- 2026-07-30 against the live DB, not assumed), so there is no historical FALSE
-- to reinterpret. The DEFAULT covers every row created from here on.
--
-- ── THE TWO-ACT EDGE, STATED RATHER THAN HIDDEN ────────────────────────────
--
-- The request pool is per-EVENT (one inbox, UNIQUE (event_id, song_id)) while
-- the pause lives per-(vendor × event). With TWO acts booked they can disagree,
-- and the old rule chose "the room is open if EITHER act is accepting". Its
-- faithful inverse would be "closed only if EVERY booked act has paused" — but
-- that needs a count of booked acts, and because rows are sparse an act that
-- never touched the toggle has no row to count, so that formulation silently
-- mis-reads exactly the case it exists for.
--
-- So this ships the simple rule: A PAUSE FROM ANY ACT PAUSES THE ROOM.
--   • one act (the overwhelming case) → identical under either formulation;
--   • two acts → a paused quartet also silences the band's inbox.
-- That degrades toward COLLECTING FEWER requests, which is the safe direction:
-- over-pausing disappoints a guest, under-pausing floods a band that explicitly
-- asked for silence. If the owner wants a per-act pause, the inbox has to split
-- per-act first — that is a schema question, not a predicate tweak.
--
-- ── HALF 2 · THE READ IS THE PAYWALL NOW, SO RLS STOPS PRETENDING TO BE IT ─
--
-- `event_song_requests_read`/`_decide` asked "are you BOOKED on this event"
-- (`current_vendor_booked_event_ids()`). Booked is not paid. With the switch
-- retired as the sale, that predicate would hand every free-tier booked band the
-- inbox we just decided to charge for — the SAME class of hole PR #3876 closed,
-- one table over. It was inert only because the window defaulted FALSE so no
-- request could exist; this migration removes that accidental safety, so the
-- gate has to land in the same change.
--
-- RLS is ROW-level and cannot express "did you pay", and PR #3876 settled where
-- entitlement lives: in TypeScript, because
-- `resolveVendorSpecializationAccessForVendor` folds in the admin free-window
-- promotion and the mid-event lapse, and a SQL copy of those rules would drift
-- from the copy every render path already uses. Copying them here would BE that
-- drift.
--
-- So the vendor leg is REMOVED from both policies rather than reworded. The act
-- reaches its inbox through `fetchActSongRequests` / `decideActSongRequest`
-- (apps/web/app/vendor-dashboard/on-the-day/actions.ts) — auth → booking →
-- `holdsSpecialization(access, 'song_desk')` → service_role. ONE path, chosen
-- explicitly, with no second door left ajar. The host keeps their own room
-- (`current_event_ids()`) and admin keeps oversight (`is_admin()`).
--
-- ⚠ AND IT TRIPS THE EXPOSURE FREEZE ANYWAY — worth knowing before you assume
-- otherwise, as the first draft of this header did. The guard is smarter than
-- "did a grant get added": it fingerprints POLICY PREDICATES, and it refuses to
-- mechanically classify any predicate change as a narrowing, because it cannot
-- prove one. Dropping a leg from a USING clause therefore fails the freeze until
-- a human reads it and regenerates `exposure-surface.baseline.txt` IN THIS PR —
-- which is done here, and the diff is exactly the two policy lines below,
-- 2 changed facts out of 6217, both removing
-- `current_vendor_booked_event_ids()`. That review step is the entire point of
-- the file, so it earns its noise.
-- ============================================================================

BEGIN;

-- ── HALF 1a · the default flips ────────────────────────────────────────────
ALTER TABLE public.vendor_dayof_configs
  ALTER COLUMN song_requests_open SET DEFAULT TRUE;

COMMENT ON COLUMN public.vendor_dayof_configs.song_requests_open IS
  'NOT PAUSED. Owner-locked 2026-07-30: guest song requests are ALWAYS ON, so '
  'this is no longer a window the act opens — it is a pause the act can apply on '
  'the night (a flood during dinner, a set they want undisturbed). TRUE = '
  'accepting, FALSE = paused. An ABSENT row also means accepting: the table is '
  'sparse and no-row means code defaults. Still write-gated to holders of the '
  'song_desk specialization by column privilege (20271020159662) — the pause is '
  'a paid control. Supersedes the 2026-07-27 open/close window (20271014100000).';

-- ── HALF 1b · the gate both guest lanes consult, inverted ──────────────────
-- Same signature, same SECURITY DEFINER posture, same "returns one boolean and
-- leaks nothing else" contract (not which act is open, not how many are booked).
-- Only the predicate changes: absence of a pause is now openness.
CREATE OR REPLACE FUNCTION public.song_requests_open_for_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.vendor_dayof_configs c
    WHERE c.event_id = p_event_id AND c.song_requests_open IS FALSE
  );
$$;

-- CREATE OR REPLACE keeps existing grants, and this function was REVOKEd from
-- PUBLIC/anon/authenticated at birth (20271014100000) — only the two SECURITY
-- DEFINER submit RPCs call it. Re-asserted so a future replace that forgets
-- cannot quietly widen it.
REVOKE ALL ON FUNCTION public.song_requests_open_for_event(UUID)
  FROM PUBLIC, anon, authenticated;

-- ── HALF 2 · the booked-vendor leg comes off both request policies ─────────
-- Host + admin only. The act's own access is the entitlement-checked
-- service_role path named in the header.
DROP POLICY IF EXISTS event_song_requests_read ON public.event_song_requests;
CREATE POLICY event_song_requests_read
  ON public.event_song_requests FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_song_requests_decide ON public.event_song_requests;
CREATE POLICY event_song_requests_decide
  ON public.event_song_requests FOR UPDATE
  TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

-- ── Post-conditions · a half-applied change fails the migration ────────────
-- Same discipline as 20271020159662: assert against the live catalog rather than
-- trusting that the statements above did what they read like.
DO $$
DECLARE
  v_default TEXT;
  v_policies INT;
BEGIN
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'vendor_dayof_configs'
    AND column_name = 'song_requests_open';
  IF v_default IS NULL OR v_default NOT LIKE 'true%' THEN
    RAISE EXCEPTION 'song_requests_open default is % — expected true (always-on)', v_default;
  END IF;

  -- Neither request policy may still gate on the booked-vendor helper.
  SELECT count(*) INTO v_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'event_song_requests'
    AND (coalesce(qual, '') LIKE '%current_vendor_booked_event_ids%'
      OR coalesce(with_check, '') LIKE '%current_vendor_booked_event_ids%');
  IF v_policies > 0 THEN
    RAISE EXCEPTION
      'event_song_requests still has % policy/policies gating on booked-vendor — booked is not paid',
      v_policies;
  END IF;

  -- An event nobody has configured must read as OPEN. This is the whole point of
  -- always-on, and it is the assertion a naive "flip the DEFAULT" change fails.
  IF public.song_requests_open_for_event('00000000-0000-0000-0000-000000000000'::UUID) IS NOT TRUE THEN
    RAISE EXCEPTION 'an event with no config row must read as OPEN under always-on';
  END IF;
END $$;

COMMIT;
