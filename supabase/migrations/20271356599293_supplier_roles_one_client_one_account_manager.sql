-- Supplier roles d–h (the #8013 Roles drawing, panels (e) (f) (g) (h)) — one client, one Account Manager;
-- the inquiry split a manager adjusted; a paused seat cannot come into the shop.
--
-- Rulings (do not re-ask):
--   · #8013 drawing "Decided 19 Nov" boxes — Branch → Card → Event type → Last name; fair split from the shop's own
--     past clients; ≤ 5 Account Managers per card per branch; each client has ONE Account Manager, even across two
--     cards; when that Account Manager is away: the next Account Manager in the branch, then the Branch Manager.
--   · Controller answers 21 Nov (rows 1–13, side-session notes roles-dh-open-rules.md).
--   · Owner 21 Nov (specs DECISION_LOG "YES TO ALL" item 3, specs 70d60ce5): on a smaller plan the extra staff
--     accounts PAUSE (cannot sign in; nothing deleted) until the shop upgrades. OVERTURNS shipped ruling 5683.
--
-- RULE 0 · rule 3 — a column on an existing table before a new table:
--   1. A CLIENT is one chat_threads row (UNIQUE (event_id, vendor_profile_id)), so "one client, one Account Manager"
--      is chat_threads.handled_by_member_id. hand_over_member_id marks "Hand over" (a second booking landed on
--      another Account Manager's card) until one of them gives the account to the other.
--      #8071 (Unichat H1) makes chat_shop_team_user_ids "the ONE rule" for who on the team is in a chat; it reads
--      this column once both land — one fact, one home.
--   2. vendor_inquiry_split_cuts holds ONLY the cuts a manager ADJUSTED. An unadjusted split is never stored: it is
--      worked out from the shop's past clients every time (lib/inquiry-split.ts), so a join or leave re-works it with
--      nothing to migrate, and "a split a manager adjusted is not re-worked" is exactly the rows here.
--   3. A paused seat is vendor_team_members.deactivated_at (20270511762904: "soft-locked (over the paid seat cap
--      after a downgrade/non-renewal) … NULL = active. Reactivate by clearing"). Nothing reads it as "removed" —
--      removal deletes the row. The six-roles helpers already skip it; the two older canonical helpers did not, so a
--      soft-locked member still passed every policy. They now skip it too (bodies copied exactly + one line).

SET LOCAL lock_timeout = '5s';

-- ── 1 · the client's Account Manager ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS handled_by_member_id UUID NULL
    REFERENCES public.vendor_team_members(vendor_team_member_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handled_by_set_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS hand_over_member_id UUID NULL
    REFERENCES public.vendor_team_members(vendor_team_member_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS covering_member_id UUID NULL
    REFERENCES public.vendor_team_members(vendor_team_member_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.chat_threads.handled_by_member_id IS
  'The ONE Account Manager who handles this client (supplier roles d–h, #8013 (e)/(f)). NULL = not given to a seat. Written only by the server after the duty check. Migration 20271356599293.';
COMMENT ON COLUMN public.chat_threads.hand_over_member_id IS
  'Set while a second booking sits on another Account Manager''s card ("Hand over", #8013 (f)); cleared when the account is given or kept. Migration 20271356599293.';
COMMENT ON COLUMN public.chat_threads.covering_member_id IS
  'Who handles the client FOR NOW while handled_by_member_id is paused (#8013 (g) ①②③); cleared when that seat returns. Migration 20271356599293.';

CREATE INDEX IF NOT EXISTS chat_threads_handled_by_idx
  ON public.chat_threads (handled_by_member_id)
  WHERE handled_by_member_id IS NOT NULL;

-- chat_threads reads are column-granted. These columns are NOT granted to anon/authenticated: the couple learns who
-- handles them from the Setnayan line in the chat (h); the shop reads them server-side.
REVOKE ALL (handled_by_member_id, handled_by_set_at, hand_over_member_id, covering_member_id)
  ON public.chat_threads FROM PUBLIC, anon, authenticated;

-- …but chat_threads carries TABLE-level INSERT/UPDATE for anon/authenticated (every column inherits it; writes are
-- gated by chat_threads_member_update, which lets the couple AND the shop update their own row). So, like the lock
-- and the agreed price (tg_chat_threads_guard_sides, 20271222263716), who handles a client is written only by the
-- server, after the duty check — a couple cannot pick their Account Manager and an Account Manager cannot take a
-- client. A companion trigger, so the long guard is not re-copied; same privileged bypass line.
CREATE OR REPLACE FUNCTION public.tg_chat_threads_handled_by_is_the_servers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.handled_by_member_id IS NOT NULL OR NEW.handled_by_set_at IS NOT NULL
       OR NEW.hand_over_member_id IS NOT NULL OR NEW.covering_member_id IS NOT NULL THEN
      RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: who handles a client is set by Setnayan, not written from a browser'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.handled_by_member_id IS DISTINCT FROM OLD.handled_by_member_id
     OR NEW.handled_by_set_at IS DISTINCT FROM OLD.handled_by_set_at
     OR NEW.hand_over_member_id IS DISTINCT FROM OLD.hand_over_member_id
     OR NEW.covering_member_id IS DISTINCT FROM OLD.covering_member_id THEN
    RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: who handles a client is set by Setnayan, not written from a browser'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_chat_threads_handled_by_is_the_servers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_threads_handled_by_is_the_servers ON public.chat_threads;
CREATE TRIGGER chat_threads_handled_by_is_the_servers
  BEFORE INSERT OR UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_threads_handled_by_is_the_servers();

-- ── 2 · the cuts a manager adjusted ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_inquiry_split_cuts (
  vendor_profile_id     UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  branch_id             UUID NULL REFERENCES public.vendor_branches(branch_id) ON DELETE CASCADE,
  vendor_service_id     UUID NOT NULL REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  event_type            TEXT NULL,
  vendor_team_member_id UUID NOT NULL REFERENCES public.vendor_team_members(vendor_team_member_id) ON DELETE CASCADE,
  from_prefix           TEXT NOT NULL CHECK (from_prefix ~ '^[A-Z]{2}$'),
  to_prefix             TEXT NULL CHECK (to_prefix IS NULL OR to_prefix ~ '^[A-Z]{2}$'),
  adjusted_by           UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  adjusted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (to_prefix IS NULL OR to_prefix > from_prefix),
  UNIQUE NULLS NOT DISTINCT (vendor_service_id, branch_id, event_type, vendor_team_member_id)
);

COMMENT ON TABLE public.vendor_inquiry_split_cuts IS
  'Only the inquiry cuts a Shop or Branch Manager ADJUSTED (#8013 (e) "Adjust"). branch_id NULL = the main shop; event_type NULL = "every other event". An unadjusted split is computed, never stored. Migration 20271356599293.';

CREATE INDEX IF NOT EXISTS vendor_inquiry_split_cuts_shop_idx
  ON public.vendor_inquiry_split_cuts (vendor_profile_id);

ALTER TABLE public.vendor_inquiry_split_cuts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vendor_inquiry_split_cuts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_inquiry_split_cuts TO authenticated;
GRANT ALL ON public.vendor_inquiry_split_cuts TO service_role;

-- Vendor-scoped read (the vendor_role_names shape) + admin read. Writes are server-only (service role) after the
-- Shop Manager / Branch Manager check in the action — a Branch Manager may change only their own branch's split,
-- which a plain current_vendor_ids() policy cannot express.
DROP POLICY IF EXISTS vendor_inquiry_split_cuts_member_read ON public.vendor_inquiry_split_cuts;
CREATE POLICY vendor_inquiry_split_cuts_member_read
  ON public.vendor_inquiry_split_cuts FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('viewer')));

DROP POLICY IF EXISTS vendor_inquiry_split_cuts_admin_read ON public.vendor_inquiry_split_cuts;
CREATE POLICY vendor_inquiry_split_cuts_admin_read
  ON public.vendor_inquiry_split_cuts FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ── 3 · a paused seat cannot come into the shop ──────────────────────────────────────────────────────────────────
-- Body of 20260514010000 copied exactly; the ONLY change is `AND deactivated_at IS NULL`.
CREATE OR REPLACE FUNCTION public.current_vendor_ids(min_role TEXT DEFAULT 'viewer')
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Role ordering: owner > admin > agent > viewer. CASE returns the rank
  -- of the membership; we compare against the rank of `min_role`.
  -- A paused seat (deactivated_at set — a smaller plan, owner 21 Nov) is not in the shop until it returns.
  SELECT vendor_profile_id
  FROM public.vendor_team_members
  WHERE user_id = auth.uid()
    AND deactivated_at IS NULL
    AND CASE role
          WHEN 'owner'  THEN 4
          WHEN 'admin'  THEN 3
          WHEN 'agent'  THEN 2
          WHEN 'viewer' THEN 1
        END
      >=
      CASE min_role
        WHEN 'owner'  THEN 4
        WHEN 'admin'  THEN 3
        WHEN 'agent'  THEN 2
        WHEN 'viewer' THEN 1
        ELSE 1
      END;
$$;

-- Body of 20260821000000 copied exactly; the ONLY change is `AND vtm.deactivated_at IS NULL`.
CREATE OR REPLACE FUNCTION public.agent_assigned_service_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT vsa.vendor_service_id
  FROM public.vendor_service_agents vsa
  JOIN public.vendor_team_members vtm
    ON vtm.vendor_team_member_id = vsa.vendor_team_member_id
  WHERE vtm.user_id = auth.uid()
    AND vtm.deactivated_at IS NULL;
$$;

-- ── 4 · "enough" past clients — an owner number, NOT SET (controller 21 Nov, row 4) ──────────────────────────────
-- A shop splits by its OWN past clients only once it has this many on that card + event type; until then (and while
-- this is NULL) every split reads the counts across all Setnayan inquiries. No number is seeded: rule 9, "don't guess".
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS inquiry_split_own_enough INTEGER;
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_inquiry_split_own_enough_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_inquiry_split_own_enough_range
  CHECK (inquiry_split_own_enough IS NULL OR (inquiry_split_own_enough > 0 AND inquiry_split_own_enough <= 100000));
COMMENT ON COLUMN public.platform_settings.inquiry_split_own_enough IS
  'Supplier roles (e): how many of its own past clients (on one card + event type) a shop needs before its inquiry split reads its own counts. NULL = not set: every split reads the all-Setnayan counts. Editable on Admin › Settings. Migration 20271356599293.';

-- ── 5 · the counts the fair split is cut from ────────────────────────────────────────────────────────────────────
-- The filing key matches lib/inquiry-split.ts surnameKey(): letters only, accents folded, upper-cased, filed as
-- written ("Dela Cruz" → DELACRUZ, under D); one letter pads with A. The last name is the SENDER's account last name —
-- events store celebrants as free-text full names, and splitting a surname off one ("Juan Dela Cruz") would be a
-- guess. p_vendor_service_id NULL = across all Setnayan inquiries of that event type. Numbers only, server only.
CREATE OR REPLACE FUNCTION public.inquiry_last_name_prefix_counts(p_vendor_service_id UUID, p_event_type TEXT)
RETURNS TABLE (prefix TEXT, n INTEGER)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT DISTINCT t.thread_id,
           regexp_replace(
             upper(translate(coalesce(u.last_name, ''), 'ñÑáéíóúÁÉÍÓÚüÜàèìòùÀÈÌÒÙ', 'nNaeiouAEIOUuUaeiouAEIOU')),
             '[^A-Z]', '', 'g') AS k
      FROM public.chat_threads t
      JOIN public.events e ON e.event_id = t.event_id
      JOIN public.users u ON u.user_id = t.created_by_user_id
     WHERE t.kind = 'supplier'
       AND (p_event_type IS NULL OR e.event_type::text = p_event_type)
       AND (p_vendor_service_id IS NULL OR EXISTS (
             SELECT 1 FROM public.event_vendors ev
              WHERE ev.event_id = t.event_id
                AND ev.service_id = p_vendor_service_id))
  )
  SELECT CASE WHEN length(k) = 1 THEN k || 'A' ELSE left(k, 2) END AS prefix, count(*)::int AS n
    FROM people
   WHERE k <> ''
   GROUP BY 1;
$$;

REVOKE ALL ON FUNCTION public.inquiry_last_name_prefix_counts(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inquiry_last_name_prefix_counts(UUID, TEXT) TO service_role;
