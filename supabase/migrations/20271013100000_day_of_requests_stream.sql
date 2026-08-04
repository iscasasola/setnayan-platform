-- ═══════════════════════════════════════════════════════════════════════════
-- The day-of REQUESTS STREAM — one table behind one inbox.
-- Build plan §10 items #2 (vendor status updates) and #6 (requests inbox,
-- couple/host lanes). 2026-07-27.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS TABLE EXISTS AT ALL
-- `_components/issues-log.tsx` has always been localStorage-only, and its own
-- header named this migration as the follow-up: "A shared/synced issues log
-- that the couple can see is a follow-up (would need a table + booked-vendor
-- RLS)." This is that table. The device-local log is NOT forked and NOT
-- deleted — it stays the fallback while the control is dark, and the same
-- component renders this stream once the owner activates it.
--
-- ONE STREAM, FOUR LANES. `origin` is what makes a single inbox able to carry
-- the couple, a booked vendor, a host, and the coordinator without four
-- tables. Everything else about a row is identical across lanes, which is the
-- whole point: the coordinator triages one list.
--
-- ADDITIVE + BACKWARD-COMPATIBLE ON PURPOSE. Another session may read this
-- stream. Every column below is either NOT NULL with a DEFAULT or nullable,
-- so an INSERT that names only (event_id, origin, body) keeps working forever.
-- New lanes are added by extending the enum (ALTER TYPE ... ADD VALUE), never
-- by adding a column a reader must know about.
--
-- ⚠ DEFAULT ACL: every new relation in `public` ships OPEN on this project —
-- the default privileges grant arwdDxtm to anon AND authenticated at CREATE
-- time. The REVOKE ALL in § 4 is therefore load-bearing, not decoration:
-- without it RLS would be the ONLY thing standing between anon and this data.

-- ── 1 · The three enums ────────────────────────────────────────────────────
-- Idempotent: CREATE TYPE has no IF NOT EXISTS, so each is guarded.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_request_origin') THEN
    -- The four lanes one inbox carries. `coordinator` is the delegate
    -- moderator running the floor; `host` is a non-couple event member.
    CREATE TYPE public.day_request_origin AS ENUM
      ('couple', 'vendor', 'host', 'coordinator');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_request_kind') THEN
    -- `status_update` is the §10 #2 one-tap vendor preset ("On site",
    -- "Running late"). It shares the stream but must NOT inflate the open-
    -- issue count — a vendor saying "setup complete" is not a problem to fix.
    CREATE TYPE public.day_request_kind AS ENUM
      ('issue', 'request', 'status_update');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_request_status') THEN
    CREATE TYPE public.day_request_status AS ENUM
      ('open', 'acknowledged', 'resolved');
  END IF;
END $$;

-- ── 2 · The table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_day_requests (
  request_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,

  origin       public.day_request_origin NOT NULL,
  kind         public.day_request_kind   NOT NULL DEFAULT 'issue',
  status       public.day_request_status NOT NULL DEFAULT 'open',

  -- 240 matches the shipped IssuesLog input maxLength exactly, so a note the
  -- coordinator could type yesterday still saves today.
  body         TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 240),

  -- Which one-tap preset produced this row (NULL = free text). Kept as TEXT,
  -- not an enum: the preset catalogue is product copy that changes with the
  -- UI, and an unknown key must degrade to "just show the body", never break
  -- an INSERT.
  preset_key   TEXT CHECK (preset_key IS NULL OR char_length(preset_key) <= 40),

  author_user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Set only on the vendor lane, so the inbox can say WHICH supplier reported.
  author_vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- A vendor row must name its vendor; a non-vendor row must not claim one.
  CONSTRAINT event_day_requests_vendor_origin_has_profile CHECK (
    (origin = 'vendor' AND author_vendor_profile_id IS NOT NULL)
    OR (origin <> 'vendor' AND author_vendor_profile_id IS NULL)
  )
);

-- The inbox's only read pattern: this event, newest first.
CREATE INDEX IF NOT EXISTS event_day_requests_event_idx
  ON public.event_day_requests (event_id, created_at DESC);

COMMENT ON TABLE public.event_day_requests IS
  'The day-of requests/issues stream — ONE table behind ONE inbox. `origin` carries the couple, vendor, host and coordinator lanes; `kind` separates a real issue from a one-tap vendor status update so status pings never inflate the open count. Superset of the localStorage log in _components/issues-log.tsx, which remains the fallback while the coordinator_requests_inbox privacy control is inactive.';

COMMENT ON COLUMN public.event_day_requests.origin IS
  'Which lane raised this. Enforced by RLS at INSERT: a booked vendor can only write origin=vendor, an event member can only write couple/host/coordinator. Extend with ALTER TYPE ... ADD VALUE — never add a parallel column.';

COMMENT ON COLUMN public.event_day_requests.kind IS
  'issue = something to fix · request = an ask · status_update = a §10 #2 one-tap vendor preset. Only `issue` and `request` count as open work.';

-- ── 3 · updated_at trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_event_day_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  -- Stamp/clear the resolution the moment status crosses into or out of
  -- 'resolved', so no caller has to remember to keep the two in sync.
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    NEW.resolved_at := NOW();
  ELSIF NEW.status <> 'resolved' THEN
    NEW.resolved_at := NULL;
    NEW.resolved_by_user_id := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_day_requests_touch ON public.event_day_requests;
CREATE TRIGGER event_day_requests_touch
  BEFORE UPDATE ON public.event_day_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_event_day_requests();

-- ── 4 · Privileges — REVOKE FIRST, then grant back the minimum ─────────────
-- See the ⚠ at the top. anon gets NOTHING. authenticated gets no DELETE:
-- a shared coordination record is resolved, never quietly erased.

REVOKE ALL ON public.event_day_requests FROM PUBLIC;
REVOKE ALL ON public.event_day_requests FROM anon;
REVOKE ALL ON public.event_day_requests FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.event_day_requests TO authenticated;

-- A trigger function fires as the table owner regardless of who holds EXECUTE,
-- so nobody needs to call it directly. Roles named explicitly for the same
-- reason as above — `FROM PUBLIC` would leave anon's own grant in place.
REVOKE ALL ON FUNCTION public.touch_event_day_requests() FROM PUBLIC, anon, authenticated;

-- ── 5 · RLS ────────────────────────────────────────────────────────────────
-- Three audiences, not two:
--
--   • the EVENT SIDE (couple / host / delegate moderator) — reads and triages
--     everything on their event;
--   • the COORDINATOR VENDOR — the person the inbox is actually FOR. On this
--     surface the coordinator is a *booked vendor* carrying the `coordinator`
--     tile, NOT an event member, so `current_event_ids()` does not cover them.
--     Without the helper below they could not triage their own inbox;
--   • every OTHER booked vendor — own-rows-only. A supplier reports in and
--     sees their own reports, and never reads the couple's private log or
--     another supplier's problems.

-- Events where the caller is the booked COORDINATOR. Mirrors
-- current_vendor_booked_event_ids() (same booked statuses, same owner-or-team
-- identity) and narrows it to the coordinator tile.
CREATE OR REPLACE FUNCTION public.current_coordinator_booked_event_ids()
RETURNS SETOF UUID
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ev.event_id
  FROM public.event_vendors ev
  JOIN public.vendor_profiles vp
    ON vp.vendor_profile_id = ev.marketplace_vendor_id
  WHERE ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
    AND 'coordinator' = ANY (vp.services)
    AND (
      vp.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendor_team_members tm
        WHERE tm.vendor_profile_id = vp.vendor_profile_id
          AND tm.user_id = auth.uid()
      )
    );
$$;

COMMENT ON FUNCTION public.current_coordinator_booked_event_ids() IS
  'Events where the caller is the BOOKED COORDINATOR (a vendor carrying the coordinator tile). The day-of requests inbox is theirs to triage, and they are not an event member, so current_event_ids() does not reach them.';

-- Name the roles explicitly: Supabase's default privileges hand anon and
-- authenticated their OWN EXECUTE entries at CREATE time, and those are not
-- part of PUBLIC — `FROM PUBLIC` alone leaves the function anon-callable
-- (verified against prod 2026-07-26, supabase/security/README.md).
REVOKE ALL ON FUNCTION public.current_coordinator_booked_event_ids()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_coordinator_booked_event_ids() TO authenticated;

ALTER TABLE public.event_day_requests ENABLE ROW LEVEL SECURITY;

-- 5a · The event side AND the booked coordinator read everything on the event.
DROP POLICY IF EXISTS event_day_requests_event_read ON public.event_day_requests;
CREATE POLICY event_day_requests_event_read
  ON public.event_day_requests FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR event_id IN (SELECT public.current_coordinator_booked_event_ids())
    OR public.moderator_area_level(event_id, 'schedule') IS NOT NULL
    OR public.is_admin()
  );

-- 5b · The event side writes the couple / host / coordinator lanes. The
--      origin guard is what stops an event member from forging a row that
--      looks like it came from a supplier.
DROP POLICY IF EXISTS event_day_requests_event_insert ON public.event_day_requests;
CREATE POLICY event_day_requests_event_insert
  ON public.event_day_requests FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND origin IN ('couple', 'host', 'coordinator')
    AND (
      event_id IN (SELECT public.current_event_ids())
      OR public.moderator_area_level(event_id, 'schedule') = 'edit'
    )
  );

-- 5b2 · The booked coordinator files on their own lane (and may log a
--       supplier's problem on the vendor lane on their behalf is NOT allowed —
--       origin stays `coordinator` so the inbox never misattributes a report).
DROP POLICY IF EXISTS event_day_requests_coordinator_insert ON public.event_day_requests;
CREATE POLICY event_day_requests_coordinator_insert
  ON public.event_day_requests FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND origin = 'coordinator'
    AND event_id IN (SELECT public.current_coordinator_booked_event_ids())
  );

-- 5c · Triage — the event side and the booked coordinator move anything on
--      the event through the status machine (that IS the inbox).
DROP POLICY IF EXISTS event_day_requests_event_update ON public.event_day_requests;
CREATE POLICY event_day_requests_event_update
  ON public.event_day_requests FOR UPDATE TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR event_id IN (SELECT public.current_coordinator_booked_event_ids())
    OR public.moderator_area_level(event_id, 'schedule') = 'edit'
  )
  WITH CHECK (
    event_id IN (SELECT public.current_event_ids())
    OR event_id IN (SELECT public.current_coordinator_booked_event_ids())
    OR public.moderator_area_level(event_id, 'schedule') = 'edit'
  );

-- 5d · A booked vendor reads ONLY what they themselves reported.
DROP POLICY IF EXISTS event_day_requests_vendor_read ON public.event_day_requests;
CREATE POLICY event_day_requests_vendor_read
  ON public.event_day_requests FOR SELECT TO authenticated
  USING (
    author_user_id = auth.uid()
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- 5e · A booked vendor reports in on their own lane only.
DROP POLICY IF EXISTS event_day_requests_vendor_insert ON public.event_day_requests;
CREATE POLICY event_day_requests_vendor_insert
  ON public.event_day_requests FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND origin = 'vendor'
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- ── 6 · The activation control (flag-dark per §10) ─────────────────────────
-- Seeded 'inactive'. Nothing renders from this table until the owner flips it
-- at /admin/data-privacy — §10's "flag-dark PR, owner sign-off before flag
-- flip". Grouped as an activation switch, not a privacy control: the stream
-- carries operational notes between people already on the event, and adds no
-- new category of personal data.

INSERT INTO public.data_privacy_controls
  (control_key, title, description, category, risk_note, status, sort_order)
VALUES
  (
    'coordinator_requests_inbox',
    'Day-of requests inbox + vendor status updates',
    'The shared day-of stream behind one inbox: the coordinator''s issues log becomes couple/vendor/host/coordinator lanes, and booked vendors get one-tap status presets ("On site", "Running late") that report into it. While inactive the issues log stays device-local, exactly as shipped.',
    'Coordinator activation — not privacy-sensitive',
    'No new personal data is collected. Rows carry operational text between people already on the event; a booked vendor can read only their own reports, never the couple''s log or another supplier''s. Free-text bodies are author-entered, so the inbox inherits the same do-not-paste-PII guidance as chat.',
    'inactive',
    75
  )
ON CONFLICT (control_key) DO NOTHING;
