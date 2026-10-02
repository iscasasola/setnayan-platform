-- couple_media_cap_is_enforced
--
-- THE 100 MB ALLOWANCE BECOMES A CAP, AND A REMOVED PICTURE GIVES ITS BYTES BACK.
--
-- DECISION_LOG 2026-09-25 ("COUPLE UPLOADS: 100 MB PER EVENT, COMPRESSED"):
-- "that means they can only upload a total of 100MB compressed files". The
-- counter `events.couple_media_bytes` (20271245678627) was only ever INCREMENTED,
-- after the presign, by `increment_couple_media_bytes` — so nothing refused an
-- upload over the allowance, and a removed photo never freed anything (that
-- migration's own docblock: "Remove does not shrink it; it is a meter, not a cap").
--
-- WHY NEW SCHEMA (the counter had no decrement, and no way to refuse atomically):
--
--   · reserve_couple_media_bytes(event, bytes, cap) — adds the bytes ONLY when
--     the total stays within the cap, in one UPDATE … WHERE, and returns the new
--     total (NULL = refused). One statement, so two uploads racing for the last
--     megabytes cannot both get in — a read-then-increment in the route could.
--     It REPLACES increment_couple_media_bytes, which is dropped below (its one
--     caller, app/api/upload/route.ts, now reserves instead).
--
--   · set_couple_media_bytes(event, bytes) — the decrement. Nothing records which
--     object a removed ref pointed at or how large it was (removal is a draft/row
--     edit; no surface deletes couple media one object at a time), so the route
--     MEASURES instead: it lists the event's own folders in R2 (sizes from R2
--     itself) and counts only the objects the event still references
--     (lib/couple-media-allowance.ts), then writes that number here.
--
-- Both are SECURITY DEFINER (the column refuses UPDATE to every session role)
-- and EXECUTE-able by service_role ONLY — never authenticated/anon, so a couple
-- can neither raise their own cap nor zero their own counter through PostgREST.
-- No table, no column, no grant on `events` changes; `events_host` is untouched.

CREATE OR REPLACE FUNCTION public.reserve_couple_media_bytes(
  p_event_id UUID,
  p_bytes BIGINT,
  p_cap BIGINT
) RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events
     SET couple_media_bytes = couple_media_bytes + GREATEST(p_bytes, 0)
   WHERE event_id = p_event_id
     AND couple_media_bytes + GREATEST(p_bytes, 0) <= p_cap
  RETURNING couple_media_bytes;
$$;

REVOKE ALL ON FUNCTION public.reserve_couple_media_bytes(UUID, BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_couple_media_bytes(UUID, BIGINT, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_couple_media_bytes(UUID, BIGINT, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_couple_media_bytes(UUID, BIGINT, BIGINT) TO service_role;

COMMENT ON FUNCTION public.reserve_couple_media_bytes IS
  'Adds p_bytes to events.couple_media_bytes only when the total stays <= p_cap; returns the new '
  'total, or NULL when refused. Called by app/api/upload/route.ts BEFORE it signs a couple-media '
  'PUT (DECISION_LOG 2026-09-25, 100 MB per event). service_role only.';

CREATE OR REPLACE FUNCTION public.set_couple_media_bytes(
  p_event_id UUID,
  p_bytes BIGINT
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events
     SET couple_media_bytes = GREATEST(p_bytes, 0)
   WHERE event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.set_couple_media_bytes(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_couple_media_bytes(UUID, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.set_couple_media_bytes(UUID, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_couple_media_bytes(UUID, BIGINT) TO service_role;

COMMENT ON FUNCTION public.set_couple_media_bytes IS
  'Settles events.couple_media_bytes to the measured bytes the event still keeps (R2 sizes of the '
  'referenced objects in its own couple-media folders, lib/couple-media-allowance.ts) — how a removed '
  'picture frees its bytes. service_role only.';

-- Replaced by reserve_couple_media_bytes — a writer nobody calls is a second door.
DROP FUNCTION IF EXISTS public.increment_couple_media_bytes(UUID, BIGINT);

-- The column's own description said "it is a meter, not a cap" — no longer true.
COMMENT ON COLUMN public.events.couple_media_bytes IS
  'The couple''s OWN compressed Event Hub upload bytes against the 100 MB/event allowance '
  '(DECISION_LOG 2026-09-25). A CAP: app/api/upload/route.ts reserves each upload with '
  'reserve_couple_media_bytes() before signing the PUT and refuses one that would go over; '
  'set_couple_media_bytes() settles it to what the event still keeps, so a removed picture frees '
  'its bytes. Never Papic/guest captures, never supplier uploads. NOT couple-writable.';

-- ── PROVE IT ────────────────────────────────────────────────────────────────
-- Privileges only; the behaviour (refuse over the cap, count under it, settle
-- down) is proven in apps/web/tests/db/a-couple-upload-over-the-cap-is-refused.db.test.ts.
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.reserve_couple_media_bytes(uuid,bigint,bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reserve_couple_media_bytes(uuid,bigint,bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'reserve_couple_media_bytes must NOT be callable by a session role — a couple could raise their own cap';
  END IF;
  IF has_function_privilege('authenticated', 'public.set_couple_media_bytes(uuid,bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_couple_media_bytes(uuid,bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'set_couple_media_bytes must NOT be callable by a session role — a couple could zero their own counter';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.reserve_couple_media_bytes(uuid,bigint,bigint)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.set_couple_media_bytes(uuid,bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'the upload route (service_role) must be able to reserve and settle the counter';
  END IF;
  IF to_regprocedure('public.increment_couple_media_bytes(uuid,bigint)') IS NOT NULL THEN
    RAISE EXCEPTION 'increment_couple_media_bytes still exists — it would add bytes without the cap';
  END IF;
END $$;
