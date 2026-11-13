-- admin_team_areas_levels_and_owner_self_approval
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
--
-- Two owner rulings, DECISION_LOG 2026-11-13, built together because the second
-- needs the first's idea of "the owner":
--
--   1 · "ADMIN TEAM: AREAS × LEVELS — AI FIRST, THEN BASIC, THEN ESCALATED"
--       Owner: "i can add an admin and pick what they can handle … i want to see
--       who does the act as well … i can assign an admin for basic or for
--       escalated or both."
--       ⇒ admin_scopes(user_id, area, level) · admin_audit_log.area ·
--         work_escalations (a Basic admin sends an item up with a note).
--
--   2 · "THE OWNER APPROVES HIS OWN TWO-ADMIN ACTIONS — TYPED + 24 H"
--       Owner: "YES i should be able to handle it my own."
--       ⇒ admin_approval_requests.run_after + self_confirmed_at, a 'withdrawn'
--         status (Cancel), and the four-eyes CHECK relaxed for the OWNER ONLY,
--         once the 24 hours have passed. Staff admins still cannot decide their
--         own request.
--
-- ── Who "the owner" is ──────────────────────────────────────────────────────
-- The one account the signup trigger already singles out (§ 10a): the owner's
-- address AND is_internal. Both, because a user may edit their own email but
-- may NOT set is_internal (guard_users_privilege_columns), so neither half is
-- enough alone. The TypeScript twin is OWNER_EMAIL in lib/admin/owner.ts; a unit
-- test reads this file and fails if the two disagree.
--
-- ── Nothing changes for anyone on the day this lands ────────────────────────
-- Until now every admin could do everything. Every admin who is not the owner
-- is CARRIED OVER with every area at both levels (granted_by NULL), so the new
-- checks refuse nobody who could act yesterday. The owner then narrows people
-- on the Team screen. A brand-new admin starts with nothing.
--
-- ── admin_audit_log.area is NOT backfilled ──────────────────────────────────
-- The log is append-only (enforce_audit_append_only, migration 20271024595579):
-- an UPDATE to an existing row is refused for every role, by design. Old rows
-- keep area NULL and the Admin log derives their area from the action name at
-- read time (lib/admin/areas.ts → areaForAuditAction). New rows carry it.

-- ════════════════════════════════════════════════════════════════════════════
-- 0 · The area vocabulary — ONE list, used by every CHECK below.
--     Twin: ADMIN_AREAS in apps/web/lib/admin/areas.ts (a unit test compares).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_areas()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'payments',
    'verification',
    'disputes',
    'help',
    'chat_flags',
    'photo_reports',
    'refunds',
    'prices_promos',
    'plans',
    'gifts_comps',
    'fraud',
    'deletions',
    'catalogue',
    'insights',
    'receiving_accounts',
    'team'
  ]::TEXT[];
$$;

-- Not secret (it is the vocabulary), but nobody signed out needs it.
REVOKE ALL ON FUNCTION public.admin_areas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_areas() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_areas() TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_areas() IS
  'The 16 admin AREAS (DECISION_LOG 2026-11-13). Twin of ADMIN_AREAS in '
  'apps/web/lib/admin/areas.ts. Every area has two LEVELS: basic (answer, '
  'simple reversible steps that give nothing) and escalated (gives or takes '
  'something: money, refunds, comps, prices, bans, deletions, plan changes).';

-- ════════════════════════════════════════════════════════════════════════════
-- 1 · The owner.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_platform_owner(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.user_id = p_user_id
       AND u.is_internal IS TRUE
       AND lower(u.email) = 'iscasasolaii@gmail.com'
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_owner(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_platform_owner(UUID) IS
  'TRUE only for the owner (§ 10a): the owner address AND is_internal. The '
  'owner has every admin area at both levels, cannot be narrowed, and is the '
  'ONLY admin who may decide his own two-admin request (typed + 24 h).';

-- ════════════════════════════════════════════════════════════════════════════
-- 2 · admin_scopes — what each admin may handle.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_scopes (
  scope_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  area        TEXT NOT NULL CHECK (area = ANY (public.admin_areas())),
  level       TEXT NOT NULL CHECK (level IN ('basic', 'escalated')),
  -- NULL = carried over by this migration, or the granting admin was deleted.
  granted_by  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_scopes_one_row_per_grant UNIQUE (user_id, area, level)
);

ALTER TABLE public.admin_scopes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_scopes_user_idx ON public.admin_scopes(user_id);

COMMENT ON TABLE public.admin_scopes IS
  'Areas × levels per admin (DECISION_LOG 2026-11-13). isAdminProfile still '
  'decides who can open /admin; this decides what they may DO there, checked by '
  'can(area, level) in apps/web/lib/admin/can.server.ts. The owner needs no '
  'rows (is_platform_owner = everything). Written only by the service role '
  'after a Team · escalated check; giving escalated is a two-admin request '
  '(grant_admin_escalated), so the owner gives it typed + 24 h.';

DROP POLICY IF EXISTS admin_scopes_admin_read ON public.admin_scopes;
CREATE POLICY admin_scopes_admin_read
  ON public.admin_scopes FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()) OR user_id = (SELECT auth.uid()));

-- Writes are service-role only (after the app-level Team check). No INSERT /
-- UPDATE / DELETE policy exists, and the grants are revoked so a browser
-- client cannot even reach the policy check.
REVOKE ALL ON public.admin_scopes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_scopes FROM authenticated;
GRANT SELECT ON public.admin_scopes TO authenticated;

-- Carry over: every admin today who is not the owner keeps doing everything.
INSERT INTO public.admin_scopes (user_id, area, level, granted_by)
SELECT u.user_id, a.area, l.level, NULL
  FROM public.users u
 CROSS JOIN unnest(public.admin_areas()) AS a(area)
 CROSS JOIN (VALUES ('basic'), ('escalated')) AS l(level)
 WHERE (u.is_internal IS TRUE OR u.is_team_member IS TRUE OR u.account_type = 'admin')
   AND NOT public.is_platform_owner(u.user_id)
ON CONFLICT ON CONSTRAINT admin_scopes_one_row_per_grant DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 · admin_audit_log.area — which area an act was in.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS area TEXT;

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_area_known;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_area_known
  CHECK (area IS NULL OR area = ANY (public.admin_areas()));

CREATE INDEX IF NOT EXISTS admin_audit_log_area_created_idx
  ON public.admin_audit_log(area, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_created_idx
  ON public.admin_audit_log(actor_user_id, created_at DESC);

COMMENT ON COLUMN public.admin_audit_log.area IS
  'The admin area this act belongs to (public.admin_areas()). NULL on rows '
  'written before 2026-11-13 — the log is append-only, so they are never '
  'backfilled; the Admin log derives their area from the action name.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4 · work_escalations — a Basic admin sends an item up, with a note.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.work_escalations (
  escalation_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area             TEXT NOT NULL CHECK (area = ANY (public.admin_areas())),
  -- What the item is, in the console's own words: a queue key + its row id
  -- (e.g. 'help' + a ticket id). Free text on purpose — every queue already has
  -- its own id shape, and a typed FK per queue would be sixteen columns.
  item_kind        TEXT NOT NULL CHECK (char_length(item_kind) BETWEEN 1 AND 80),
  item_id          TEXT NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 200),
  item_label       TEXT CHECK (item_label IS NULL OR char_length(item_label) <= 300),
  note             TEXT NOT NULL CHECK (char_length(note) BETWEEN 3 AND 2000),
  escalated_by     UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000)
);

ALTER TABLE public.work_escalations ENABLE ROW LEVEL SECURITY;

-- One open escalation per item: escalating twice is the same "waiting" state.
CREATE UNIQUE INDEX IF NOT EXISTS work_escalations_one_open_per_item
  ON public.work_escalations(item_kind, item_id)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS work_escalations_open_area_idx
  ON public.work_escalations(area, created_at)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.work_escalations IS
  'Escalate ▸ (DECISION_LOG 2026-11-13): a Basic admin sends a work item to an '
  'Escalated admin in the same area, or the owner, with a note. Nothing is '
  'decided by escalating. Written by the service role after can(area, basic); '
  'resolved after can(area, escalated).';

DROP POLICY IF EXISTS work_escalations_admin_read ON public.work_escalations;
CREATE POLICY work_escalations_admin_read
  ON public.work_escalations FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON public.work_escalations FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.work_escalations FROM authenticated;
GRANT SELECT ON public.work_escalations TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5 · The owner decides his own request — typed, then 24 hours.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.admin_approval_requests
  ADD COLUMN IF NOT EXISTS self_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS run_after TIMESTAMPTZ;

COMMENT ON COLUMN public.admin_approval_requests.self_confirmed_at IS
  'When the OWNER typed the word on his own request. Set once; stamped by the '
  'database clock (a client cannot back-date it to skip the wait).';
COMMENT ON COLUMN public.admin_approval_requests.run_after IS
  'self_confirmed_at + 24 h. The owner''s own request runs at or after this '
  'moment (the runner in app/admin/approvals/actions.ts) unless he cancels.';

-- 'withdrawn' = the requester cancelled it. Re-listed in full.
ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_status_check;
ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'withdrawn'));

-- Four eyes, relaxed for exactly one shape. Structural half here; the "is it
-- the owner, and has the wait really passed" half is the trigger below,
-- because a CHECK cannot read another table or the clock reliably.
ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_four_eyes;
ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_four_eyes
  CHECK (
    decided_by IS NULL
    OR decided_by <> initiated_by
    OR status = 'withdrawn'
    OR (
      status = 'approved'
      AND self_confirmed_at IS NOT NULL
      AND run_after IS NOT NULL
      AND run_after >= self_confirmed_at + INTERVAL '24 hours'
      AND run_after >= created_at + INTERVAL '24 hours'
      AND decided_at IS NOT NULL
      AND decided_at >= run_after
    )
  );

ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_withdrawn_by_requester;
ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_withdrawn_by_requester
  CHECK (status <> 'withdrawn' OR decided_by IS NULL OR decided_by = initiated_by);

CREATE OR REPLACE FUNCTION public.guard_owner_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- (a) Typing the word: only on the owner's OWN request, stamped NOW by the
  --     database, and never rewritten afterwards.
  IF TG_OP = 'UPDATE' AND OLD.self_confirmed_at IS NOT NULL
     AND (NEW.self_confirmed_at IS DISTINCT FROM OLD.self_confirmed_at
          OR NEW.run_after IS DISTINCT FROM OLD.run_after) THEN
    RAISE EXCEPTION 'owner self-approval: the 24-hour wait cannot be moved once it has started'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.self_confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.self_confirmed_at IS NULL) THEN
    IF NOT public.is_platform_owner(NEW.initiated_by) THEN
      RAISE EXCEPTION 'owner self-approval: only the owner may approve his own request'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.self_confirmed_at := NOW();
    NEW.run_after := GREATEST(NOW(), NEW.created_at) + INTERVAL '24 hours';
  END IF;

  IF NEW.run_after IS NOT NULL AND NEW.self_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'owner self-approval: run_after needs the typed confirmation'
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) Deciding his own request (other than withdrawing it): the owner only,
  --     and only once the wait has really passed on the database clock.
  IF NEW.decided_by IS NOT NULL
     AND NEW.decided_by = NEW.initiated_by
     AND NEW.status <> 'withdrawn'
     AND (TG_OP = 'INSERT' OR OLD.decided_by IS DISTINCT FROM NEW.decided_by
          OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT public.is_platform_owner(NEW.decided_by) THEN
      RAISE EXCEPTION 'four eyes: a different admin must decide this request'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.run_after IS NULL OR NOW() < NEW.run_after THEN
      RAISE EXCEPTION 'owner self-approval: the 24-hour wait has not passed'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.decided_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_approval_requests_owner_self_approval
  ON public.admin_approval_requests;
CREATE TRIGGER admin_approval_requests_owner_self_approval
  BEFORE INSERT OR UPDATE ON public.admin_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_self_approval();

COMMENT ON FUNCTION public.guard_owner_self_approval() IS
  'DECISION_LOG 2026-11-13 "THE OWNER APPROVES HIS OWN TWO-ADMIN ACTIONS — '
  'TYPED + 24 H". Fires for every role incl. service_role. Only the owner may '
  'type the word on his own request; the database stamps the time; the request '
  'may be decided by its own initiator only by the owner, only after run_after.';

CREATE INDEX IF NOT EXISTS admin_approval_requests_due_idx
  ON public.admin_approval_requests(run_after)
  WHERE status = 'pending' AND run_after IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 6 · grant_admin_escalated — giving an Escalated level is a two-admin act.
--     Vocabulary re-listed from 20271309260178 (the latest) + the new value.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'approve_fraud_wipe_ban',
    'approve_journal_spotlight',
    'approve_comp_grant',
    'approve_large_refund',
    'approve_payment_account_change',
    'approve_retail_price_change',
    'grant_team_member',
    -- 2026-11-13 · giving an admin the Escalated level in one or more areas.
    'grant_admin_escalated'
  ));

COMMENT ON CONSTRAINT admin_approval_requests_action_type_check
  ON public.admin_approval_requests IS
  'The actions that require a second admin (or the owner, typed + 24 h). '
  'Privilege actions (grant_internal_account, grant_team_pool [retired '
  '2026-11-05, kept so old rows stay readable], promote_to_admin, '
  'grant_team_member, grant_admin_escalated [2026-11-13], '
  'approve_vendor_partnership, approve_fraud_wipe_ban, '
  'approve_journal_spotlight) and money actions (approve_comp_grant, '
  'approve_large_refund, approve_payment_account_change, '
  'approve_retail_price_change). Re-list from pg_get_constraintdef on '
  'PRODUCTION when adding a value — the migration history is not the list.';
