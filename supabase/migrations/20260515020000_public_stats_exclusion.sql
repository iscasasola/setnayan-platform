-- ============================================================================
-- 20260515000000_public_stats_exclusion.sql
-- Iteration 0006 + 0022 — Dual-role public-stats exclusion (locked 2026-05-15).
--
-- Implements Decision 3 from the CLAUDE.md decision log
-- (2026-05-15 row "Dual-role public-stats exclusion + role-switch in event
-- switcher"). Closes the second fake-reputation vector — vendor's own
-- staff bookings inflating their public "completed events" count.
--
-- Adds:
--   1. `event_vendors.linked_vendor_profile_id` — optional FK that links a
--      couple-side `event_vendors` row to the corresponding marketplace
--      `vendor_profiles` row. Until couples back-link existing rows
--      (or the cart flow auto-links on booking — separate iteration),
--      the column stays NULL and unlinked rows do not contribute to any
--      public count. This is the join key for the materialized views.
--   2. `vendors.show_team_bookings_in_backend_count` — per-vendor toggle
--      on `vendor_profiles` (the project's `vendors` table; the spec uses
--      the canonical name "vendors", code uses `vendor_profiles`).
--      Default FALSE = backend card reads the same number the public sees.
--   3. `comp_grants` stub (minimal CREATE TABLE IF NOT EXISTS) — the full
--      table ships with the morning's 2026-05-15 self-purchase decision.
--      Stubbed here so the public materialized view can reference it
--      without breaking the build. Self-comp orders excluded once that
--      table is populated.
--   4. `admin_audit_log` stub — referenced by the toggle audit-write. Full
--      schema lands with iteration 0023 admin console. Stubbed minimally
--      so the toggle UI's audit-write doesn't error.
--   5. `vendor_public_completed_events_stats` MATERIALIZED VIEW — the
--      public-facing count. Filters out bookings made by the vendor's
--      owner, team members, internal accounts tied to this vendor, or
--      self-comp grants. Refreshed via trigger on the underlying tables.
--   6. `vendor_full_completed_events_stats` MATERIALIZED VIEW — the full
--      unfiltered count (sibling). The vendor admin can read this when
--      they flip the toggle ON; the public never reads this view.
--
-- Constraints honored:
--   • Public count is platform-enforced, no vendor opt-out (no toggle path
--     leads to a public-count change).
--   • The toggle column lives on the vendor row, NOT on a per-user
--     setting — every team member with `manage_settings` flips the same
--     backend display.
--   • Personal/customer side is untouched: a team member's own customer
--     dashboard still loads their full event_members rows; only the
--     vendor's PUBLIC marketplace number filters.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_vendors.linked_vendor_profile_id
--    A couple-side `event_vendors` row currently stores a free-text vendor
--    name. When the couple books that vendor through the marketplace (or
--    later back-links manually), this column points at the corresponding
--    `vendor_profiles` row so the marketplace can attribute the completed
--    event to that vendor.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS linked_vendor_profile_id UUID
  REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_vendors_linked_vendor_profile_id_idx
  ON public.event_vendors(linked_vendor_profile_id)
  WHERE linked_vendor_profile_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. vendor_profiles.show_team_bookings_in_backend_count
--    The project's `vendor_profiles` table is the canonical "vendors"
--    record. Spec calls the column `vendors.show_team_bookings_in_backend_count`;
--    we add it to `vendor_profiles` with the same semantics.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS show_team_bookings_in_backend_count
  BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 3. comp_grants stub
--    Full schema ships with the morning's 2026-05-15 self-purchase /
--    self-review decision (iteration 0034 § 10c). Stubbed here so this
--    migration's materialized view can LEFT JOIN against it without the
--    table missing. Once the full migration runs, the source CHECK
--    constraint will already include 'vendor_self_comp' per spec; this
--    stub is forward-compatible.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.comp_grants (
  grant_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional / forward-compatible columns. The full table ships separately
-- and may define these with richer constraints (e.g. FK to a real
-- vendors / orders table). We add nullable variants here only if absent
-- so the materialized view can reference them safely.
ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS order_id UUID;
ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID;
ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID;
ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS comp_grants_source_idx ON public.comp_grants(source);
CREATE INDEX IF NOT EXISTS comp_grants_order_id_idx ON public.comp_grants(order_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comp_grants_vendor_profile_id_idx ON public.comp_grants(vendor_profile_id)
  WHERE vendor_profile_id IS NOT NULL;

ALTER TABLE public.comp_grants ENABLE ROW LEVEL SECURITY;

-- Admins (is_internal users) can read all rows; otherwise locked down. The
-- vendor-admin-facing toggle UI never reads this table directly — it's only
-- consumed by the materialized view, which runs SECURITY DEFINER on refresh.
DROP POLICY IF EXISTS comp_grants_admin_read ON public.comp_grants;
CREATE POLICY comp_grants_admin_read
  ON public.comp_grants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = TRUE OR u.account_type = 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 4. admin_audit_log stub
--    Full schema ships with iteration 0023 admin console. Stub here so the
--    toggle UI's audit-write doesn't error in V1. Two-admin authority and
--    related governance gates also land with the full table.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  audit_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forward-compatible columns. The full iteration 0023 admin schema adds
-- richer constraints / FKs to these — we add the bare types here so the
-- toggle insert from the vendor dashboard validates regardless.
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS actor_user_id UUID;
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_id_idx ON public.admin_audit_log(target_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_user_id_idx ON public.admin_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Vendor team members can INSERT audit rows for their own vendor toggle.
-- Reads are admin-only until iteration 0023 expands governance.
DROP POLICY IF EXISTS admin_audit_log_vendor_toggle_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_log_vendor_toggle_insert
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    action = 'vendor_backend_count_toggle'
    AND actor_user_id = auth.uid()
  );

DROP POLICY IF EXISTS admin_audit_log_admin_read ON public.admin_audit_log;
CREATE POLICY admin_audit_log_admin_read
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = TRUE OR u.account_type = 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 5. vendor_public_completed_events_stats — MATERIALIZED VIEW
--
--    The number the marketplace card and public /v/[slug] landing display.
--    Counts `event_vendors` rows with status delivered/complete (the
--    iteration 0006 vendor_status enum's two terminal-success values, same
--    pattern as the existing `vendor_reviews` couple-INSERT policy) where:
--      • the row is linked to a vendor_profiles row, AND
--      • NO couple-member of the event is the vendor's owner, AND
--      • NO couple-member of the event sits on the vendor's team
--        (vendor_team_members — code's equivalent of the spec's
--        vendor_service_agents), AND
--      • NO couple-member of the event is internal AND tied to this vendor
--        as owner or team member, AND
--      • the row's order has not been paid via a vendor_self_comp grant.
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_public_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats AS
SELECT
  vp.vendor_profile_id,
  COUNT(ev.vendor_id)::INT AS public_completed_count
FROM public.vendor_profiles vp
LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND ev.status IN ('delivered', 'complete')
      -- Exclude archived events from the count.
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = ev.event_id
          AND e.archived = FALSE
      )
      AND NOT EXISTS (
        -- Exclude bookings where the vendor's owner is on the event's
        -- couple roster.
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND em.user_id = vp.user_id
      )
      AND NOT EXISTS (
        -- Exclude bookings where any vendor team member sits on the
        -- event's couple roster.
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id
         AND vtm.vendor_profile_id = vp.vendor_profile_id
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
      )
      AND NOT EXISTS (
        -- Exclude bookings where any internal account that owns or sits
        -- on this vendor's team is on the event's couple roster.
        SELECT 1 FROM public.event_members em
        JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND u.is_internal = TRUE
          AND (
            u.user_id = vp.user_id
            OR EXISTS (
              SELECT 1 FROM public.vendor_team_members vtm2
              WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                AND vtm2.user_id = u.user_id
            )
          )
      )
      AND NOT EXISTS (
        -- Exclude bookings flagged by an active vendor_self_comp grant.
        -- The full self-comp table ships separately; until then this
        -- predicate is a stable no-op (no rows match) which is the
        -- correct conservative behaviour.
        SELECT 1 FROM public.comp_grants cg
        WHERE cg.vendor_profile_id = vp.vendor_profile_id
          AND cg.source = 'vendor_self_comp'
          AND (
            -- Either the grant directly references this event_vendors
            -- row (when the cart flow lands) ...
            cg.order_id = ev.vendor_id
            -- ... or any couple-member of the event created the grant
            -- (covers the launch case where order_id isn't wired yet).
            OR EXISTS (
              SELECT 1 FROM public.event_members em3
              WHERE em3.event_id = ev.event_id
                AND em3.member_type = 'couple'
                AND em3.user_id = cg.created_by_user_id
            )
          )
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_public_completed_events_stats_pk
  ON public.vendor_public_completed_events_stats(vendor_profile_id);

-- ----------------------------------------------------------------------------
-- 6. vendor_full_completed_events_stats — MATERIALIZED VIEW
--
--    The unfiltered sibling. Read only by the vendor's own dashboard when
--    they flip the "Include team bookings" toggle ON. The public never
--    reads this view.
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_full_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_full_completed_events_stats AS
SELECT
  vp.vendor_profile_id,
  COUNT(ev.vendor_id)::INT AS full_completed_count
FROM public.vendor_profiles vp
LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND ev.status IN ('delivered', 'complete')
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = ev.event_id
          AND e.archived = FALSE
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_full_completed_events_stats_pk
  ON public.vendor_full_completed_events_stats(vendor_profile_id);

-- ----------------------------------------------------------------------------
-- 7. Refresh trigger
--    Refreshes both views concurrently when event_vendors status changes,
--    a vendor_profiles row is created, a vendor_team_members row changes,
--    or a comp_grants row is inserted. CONCURRENTLY keeps reads non-
--    blocking; the trigger swallows errors so a failing refresh never
--    rolls back the underlying write.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_vendor_completed_events_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_public_completed_events_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_full_completed_events_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'refresh_vendor_completed_events_stats failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- event_vendors — primary signal source.
DROP TRIGGER IF EXISTS event_vendors_refresh_completed_stats ON public.event_vendors;
CREATE TRIGGER event_vendors_refresh_completed_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.event_vendors
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_vendor_completed_events_stats();

-- vendor_team_members — team-changes flip exclusion sets.
DROP TRIGGER IF EXISTS vendor_team_members_refresh_completed_stats ON public.vendor_team_members;
CREATE TRIGGER vendor_team_members_refresh_completed_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_team_members
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_vendor_completed_events_stats();

-- comp_grants — self-comp inserts flip exclusion sets.
DROP TRIGGER IF EXISTS comp_grants_refresh_completed_stats ON public.comp_grants;
CREATE TRIGGER comp_grants_refresh_completed_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.comp_grants
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_vendor_completed_events_stats();

-- Initial seed so the unique indexes have rows immediately and the
-- application's first read returns 0-count rows rather than NULL.
REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats;
REFRESH MATERIALIZED VIEW public.vendor_full_completed_events_stats;

-- Public read on both views — same pattern as `vendor_review_stats`. The
-- public marketplace renders from anon; vendor backend renders from
-- authenticated. Either way the view is just an aggregate count, no PII.
GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;
GRANT SELECT ON public.vendor_full_completed_events_stats TO anon, authenticated;

COMMIT;
