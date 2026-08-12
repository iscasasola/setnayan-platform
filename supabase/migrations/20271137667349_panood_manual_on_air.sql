-- panood_manual_on_air
--
-- THE HOST WHO STREAMS BY HAND WAS INVISIBLE TO THEIR OWN CONTROL ROOM.
--
-- Three ways to go on air ship today: Setnayan's one-tap go-live (which creates a
-- YouTube broadcast and writes a panood_broadcasts row), pasting your own YouTube
-- watch link, and pasting a Facebook Live link. Only the FIRST leaves a trace the
-- controller can read: `isLive` is derived purely from an active panood_broadcasts
-- row, and panood_broadcasts has exactly ONE writer — inside the automatic
-- go-live. The two paste-a-link routes write only events.panood_watch_url[_facebook].
--
-- So a host who streamed by hand got:
--   • no red "On air" light on their programme monitor, and
--   • no ⚡ Moment button — a PAID Live Studio control, gated on canMarkHighlight()
--     which requires isLive.
-- …while the controller's own copy ("Start your broadcast on YouTube, then paste
-- the watch link") pushes them down exactly that route. Until Setnayan's own
-- YouTube channel exists and its app review clears, the manual route is the ONLY
-- one that works, so this is the path a first real customer takes.
--
-- This column is the missing trace: the instant the host said, by hand, "we are on
-- air". Null means off air.
--
--
-- ⚠ WHY A TIMESTAMP AND NOT A BOOLEAN — this is load-bearing, not a style choice.
--
-- `isLive` is an input to the PAID broadcast window (lib/live-studio-window.ts).
-- Its never-interrupt rule keeps multi-cam alive for a broadcast that was ALREADY
-- IN PROGRESS when a purchased event-day lapsed, and that rule is BOUNDED by
-- `broadcastStartedAt`. The module's own header spells out what happens without
-- that bound: "a host could let their day expire, press Go live again, and be
-- handed unlimited multi-cam for as long as they never pressed stop."
--
-- A boolean would supply `isLive` with NO start time, and decideBroadcastWindow
-- treats a missing start as PROTECTED (a deliberate fail-open so an unreadable
-- clock never cuts a running ceremony down to one camera). That fail-open is
-- correct for a real broadcast row and catastrophic for a self-set flag: it would
-- hand out free multi-cam for the price of one button press.
--
-- Storing the INSTANT means the existing bound applies unchanged — a manual on-air
-- set after the window lapsed is a new go-live and gets no protection. The column's
-- shape is what makes that guarantee un-forgettable at the call site.
--
--
-- 🔒 AND THE INSTANT MUST NOT BE CHOOSEABLE BY THE BROWSER.
--
-- If this value were writable and trusted, a host could BACKDATE it to just inside
-- a lapsed window and hold multi-cam open forever — the "the row is yours, the
-- field is not" defect, where a field recording a FACT rather than a preference
-- stays forgeable inside a row you legitimately own.
--
-- 🪤 NO REVOKE HERE, AND THAT IS DELIBERATE — the first draft of this migration had
-- one and it was a live grenade. On public.events the UPDATE privilege is held
-- COLUMN-BY-COLUMN (147 of 201 columns for `authenticated`, verified in prod
-- 2026-08-12); there is no table-level UPDATE. In Postgres a table-level
-- `REVOKE UPDATE` also drops every column-level grant, so the obvious defensive
-- line would have stripped all 147 and broken every write the app makes to events.
-- What is actually true is simpler: a NEWLY ADDED column inherits NO column grant,
-- which is why 54 existing columns here — papic_face_mode,
-- photo_delivery_oauth_token_encrypted, setnayan_ai_active among them — are already
-- unreachable from a browser session. This column joins them by construction.
-- `events-column-grants.db.test.ts` asserts it stays that way, because "it is not
-- granted today" is not a mechanism.
--
-- The trigger below is the second, independent barrier, and it is the one that can
-- be PROVEN in the PGlite replay: that replay runs as SUPERUSER, so a grant test
-- there proves nothing (lesson of 2026-08-12), while a trigger fires for superuser
-- too. Grants are verified against prod by the object instead.
--
-- Turning OFF (→ NULL) is always allowed: nobody is harmed by a host saying they
-- are off air, and a state you cannot leave is a gate with no handle.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS panood_manual_on_air_at timestamptz;

COMMENT ON COLUMN public.events.panood_manual_on_air_at IS
  'The instant the host declared "we are on air" by hand, for the paste-your-own-link '
  'livestream routes that leave no panood_broadcasts row. NULL = off air. Feeds isLive '
  '(red tally + the paid Moment button) AND, as broadcastStartedAt, the never-interrupt '
  'bound on the paid multi-cam window — so the value is stamped by trigger and never '
  'chosen by a caller. Deliberately carries NO column grant: written only by the '
  'service role behind a host check.';

/* -------------------------------------------------------------------------- */
/*  The stamp — off→on is always now(), never the caller's number.             */
/* -------------------------------------------------------------------------- */

-- ⚠ SECURITY INVOKER (the default), deliberately — the first cut of this said
-- SECURITY DEFINER out of habit and `anon-rpc-surface.db.test.ts` caught it. This
-- function reads and writes nothing but the NEW row it is handed; it needs no
-- elevated privileges, and a BEFORE trigger fires regardless of who the caller is.
-- Declaring DEFINER would have added a new anon-callable elevated function to the
-- surface for no benefit. Baselining it instead would have been paying a bill that
-- did not need to exist.
CREATE OR REPLACE FUNCTION public.enforce_panood_manual_on_air_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- INSERT: an event is never born on air. Anything supplied is discarded rather
  -- than trusted, so a seeded row cannot arrive pre-dated.
  IF TG_OP = 'INSERT' THEN
    IF NEW.panood_manual_on_air_at IS NOT NULL THEN
      NEW.panood_manual_on_air_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE, and the three cases are exhaustive on purpose.
  --
  --   off → on   stamp now(). The supplied value is IGNORED — this is the whole
  --              point of the trigger, and the only branch that can move money.
  --   on  → off  allowed as given (NULL). Leaving is never gated.
  --   on  → on'  pinned to the ORIGINAL instant. Re-pressing "we are on air" must
  --              not restart the clock that bounds the never-interrupt rule, and a
  --              re-stamp is indistinguishable from a backdate.
  IF OLD.panood_manual_on_air_at IS NULL AND NEW.panood_manual_on_air_at IS NOT NULL THEN
    NEW.panood_manual_on_air_at := now();
  ELSIF OLD.panood_manual_on_air_at IS NOT NULL AND NEW.panood_manual_on_air_at IS NOT NULL
        AND NEW.panood_manual_on_air_at IS DISTINCT FROM OLD.panood_manual_on_air_at THEN
    NEW.panood_manual_on_air_at := OLD.panood_manual_on_air_at;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_panood_manual_on_air_stamp() IS
  'Forces events.panood_manual_on_air_at to now() on any off→on transition and pins it '
  'thereafter, so the instant that bounds the paid multi-cam never-interrupt rule can '
  'never be backdated by a caller. Clearing to NULL is always permitted.';

-- Nothing should ever CALL this by hand — it is a trigger body. Postgres does not
-- check EXECUTE when a trigger fires, so removing the default PUBLIC grant costs
-- the trigger nothing and keeps the function off the callable surface entirely.
REVOKE ALL ON FUNCTION public.enforce_panood_manual_on_air_stamp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_panood_manual_on_air_stamp() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_panood_manual_on_air_stamp() FROM authenticated;

-- BEFORE INSERT OR UPDATE **OF** the column: an update that does not name it never
-- fires this, so every unrelated write to events stays a no-op here and a live
-- broadcast's start instant can never be rewritten out from under the resolver.
DROP TRIGGER IF EXISTS trg_panood_manual_on_air_stamp ON public.events;
CREATE TRIGGER trg_panood_manual_on_air_stamp
  BEFORE INSERT OR UPDATE OF panood_manual_on_air_at ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_panood_manual_on_air_stamp();
