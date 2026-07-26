-- events_private_details_guest_lock
-- ============================================================================
-- SEC-2b — the couple's birth dates, budget and wizard state come off the
--          guest-readable surface of public.events.
--
-- ── THE FINDING ─────────────────────────────────────────────────────────────
-- Verified against production:
--
--   SELECT column_name,
--          has_column_privilege('authenticated','public.events',column_name,'SELECT')
--     FROM information_schema.columns WHERE table_name='events';
--
-- returns TRUE for `authenticated` on partner_a/b_birth_date,
-- partner_a/b_birth_time, bazi_birthdata_consent_at, estimated_budget_centavos,
-- budget_band, wizard_state and the photo_delivery_folder_id / _folder_name /
-- _account_email trio.
--
-- A wedding GUEST holds the `authenticated` role and is admitted to the
-- couple's events row by public.current_event_ids() (20260512000000:178 — no
-- member_type filter) via event_member_can_read. The dashboard UI hides all of
-- this — app/dashboard/[eventId]/layout.tsx:115 notFounds anyone who is not
-- member_type='couple' or an accepted event_moderators row — but the guard is
-- in the UI, not the data layer. The anon key is public, so a guest with their
-- own session goes straight to PostgREST:
--
--   GET /rest/v1/events?event_id=eq.<event>
--       &select=partner_a_birth_date,estimated_budget_centavos,wizard_state
--
-- Owner intent, verbatim (2026-07-26): "guests cannot see budget and birthdate.
-- just event date."
--
-- This is the ROW-level follow-up that 20271007100000 (SEC-2) named in its
-- "WHAT IS DELIBERATELY *NOT* DENIED" section and deferred.
--
-- ── WHY THE OBVIOUS FIX DOES NOT WORK ───────────────────────────────────────
-- Postgres RLS is ROW-level. A policy can only answer "this session sees the
-- row / does not see the row" — never "this session sees 181 of the 192
-- columns". And the COUPLE reads these same columns with the SAME
-- `authenticated` role as the guest, so a role-level REVOKE alone blinds the
-- couple's own dashboard.
--
-- Three approaches were weighed:
--
--   (1) Move the columns to an `event_private_details` table with host-only
--       RLS. Cleanest conceptual boundary — but it is a data migration of 11
--       columns off a 192-column table with 152 FK'd children, it rewrites
--       every writer (17 read-modify-write sites on wizard_state alone), and it
--       leaves a dual-write/backfill window on a live database. Largest blast
--       radius by a wide margin, for a boundary the grant already gives.
--
--   (2) REVOKE the column grants, and give hosts the columns back through a
--       host-scoped object that does its own explicit membership check.
--       ← CHOSEN
--
--   (3) Re-scope event_member_can_read off current_event_ids() so guests lose
--       the events row entirely. Rejected: it breaks the guest's OWN surfaces
--       (the account switcher and library read the event row for every
--       member_type — see 20271007100000's analysis), it closes nothing the two
--       OTHER SELECT policies on this table do not re-open
--       (events_moderator_read; community_member_can_read_events, which hands
--       the full row to every member of the owning Samahan), and it leaves the
--       WHERE / ORDER BY oracles wide open.
--
-- (2) is chosen because a COLUMN PRIVILEGE is checked BEFORE and INDEPENDENTLY
-- of every policy. One REVOKE closes these columns against:
--   • all three SELECT policies at once, and every future one;
--   • PostgREST embeds from all 152 tables with an FK to events;
--   • `select=*`;
--   • the blind-search oracles — Postgres requires SELECT privilege on any
--     column named in a WHERE or ORDER BY, so `?estimated_budget_centavos=
--     gt.50000000` and `?order=partner_a_birth_date` fail too. A row-policy
--     re-scope would not have touched those.
--
-- Same mechanism, same table as 20271005100000 (writes) and 20271007100000
-- (reads): Postgres cannot subtract a column from a table-level grant, so the
-- table-level privilege is revoked and an explicit column list granted back.
--
-- ── THE UNION PROBLEM (why the allow-list is computed from live privileges) ─
-- 20271007100000 computed its allow-list as "every column in the catalog MINUS
-- its deny-set". Recomputing it that way here would RE-GRANT master_qr_token
-- and the Drive OAuth token — this migration would silently UNDO SEC-2.
--
-- So the allow-list here is "every column the role CAN ALREADY READ, minus my
-- deny-set" (has_column_privilege, evaluated per role, before the revoke). That
-- is a union by construction: it preserves every prior revoke and every column
-- added-and-granted between the two migrations, without naming either.
-- Post-condition (b) asserts the SEC-2 three are still denied afterwards.
--
-- ── WHERE HOSTS READ THEM NOW: public.events_host ───────────────────────────
-- A view over public.events, owned by postgres with security_invoker = FALSE
-- (definer semantics, so it is not subject to the invoker's column grants),
-- whose WHERE clause admits ONLY rows where the caller is member_type='couple'
-- or holds an accepted, non-removed event_moderators row.
--
-- That predicate is an exact mirror of the authorization the dashboard layout
-- already performs in app code (layout.tsx:115 + :122), so the set of people who
-- can read these columns is UNCHANGED — the check simply moves into the
-- database, where a page cannot forget it. A plain guest, a
-- member_type='coordinator', and a Samahan co-member are all excluded; none of
-- them can reach the surfaces that render these fields today either.
--
-- A VIEW rather than a SECURITY DEFINER function returning JSONB because the
-- host readers are spread over 13 files and 30-odd call sites that each select
-- a DIFFERENT mix of private and public columns. Against the view every one of
-- them is a one-token edit — `.from('events')` → `.from('events_host')` — with
-- the select string, the filters and the row shape untouched. An RPC would have
-- forced each of those call sites to split into two queries and re-assemble the
-- row, which is where the real regression risk lives.
--
-- The view projects EVERY column authenticated can read PLUS the twelve private
-- ones — i.e. "events minus the credentials" — computed, never hand-listed. It
-- deliberately does NOT re-expose master_qr_token or the Drive OAuth token:
-- 20271007100000 moved the one host reader of those to the service-role client
-- on purpose, and this migration must not build them a new door.
--
-- It is READ-ONLY: a single-table view with a simple WHERE is auto-updatable in
-- Postgres, and an auto-updatable definer view would let a host UPDATE straight
-- past couple_can_update_event. Only SELECT is granted (post-condition (g)).
--
-- ── WHAT IS UNAFFECTED ──────────────────────────────────────────────────────
--   • WRITES. This migration touches SELECT only. The UPDATE/INSERT column
--     grants from 20271005100000 are intact (post-condition (e)), and
--     couple_can_update_event (20260513040000:91) is already scoped to
--     current_couple_event_ids() — a guest could never write these. Every
--     writer does `.update({…}).eq('event_id', …)` with no RETURNING of a
--     private column, so no writer needs SELECT.
--   • INSERTs at event creation. All four events-INSERT sites narrow their
--     RETURNING to event_id / slug (onboarding/_shared/commit-event.ts:110,
--     onboarding/wedding/actions.ts, onboarding/simple/actions.ts:74,
--     create-event/actions.ts:563) — none returns a private column.
--   • Everything on the service-role client: the Drive pipeline
--     (lib/photo-delivery-release.ts, lib/drive-copy.ts, lib/papic-fullres-drop.ts,
--     the four OAuth callback/disconnect routes), the RA 10173 erasure in
--     app/admin/users/actions.ts, the audit before-image in
--     dashboard/[eventId]/actions.ts:636, checklist-actions.ts:196, the
--     Setnayan-AI digest, and the vendor auto-reply's select('*').
--   • public.vendor_event_brief() / admin_market_analytics() /
--     admin_lead_scores() — SECURITY DEFINER functions run as their owner, so
--     column privileges on the invoker do not apply. vendor_event_brief's own
--     share_budget_band opt-in gate and rounded-range projection are unchanged.
--   • The public guest site (app/[slug]/**) — service-role with explicit column
--     lists; never depended on this grant.
--   • Realtime: events is NOT in the supabase_realtime publication.
--   • RLS policy expressions reference only event_id / community_id, both of
--     which stay granted.
--
-- ── KNOWN BEHAVIOUR CHANGE ──────────────────────────────────────────────────
-- The four `select('*')` schema-drift fallbacks on events
-- (dashboard/[eventId]/layout.tsx:191, page.tsx:114,
--  _components/event-dashboard.tsx:228, budget/page.tsx:82) already raise 42501
-- rather than returning a row — 20271007100000 did that. This widens the
-- deny-set they trip over; it does not change their behaviour. All four already
-- funnel a null row into notFound(), and they only run when the schema is
-- ALREADY broken.
--
-- REVERSIBLE:
--   GRANT SELECT ON public.events TO authenticated, anon;  -- also re-opens the
--   -- SEC-2 columns; to revert THIS migration only, re-run 20271007100000
--   DROP VIEW IF EXISTS public.events_host;
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Take the twelve private columns off the authenticated + anon read surface.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  -- ── DENIED to authenticated + anon ────────────────────────────────────────
  private_columns TEXT[] := ARRAY[
    -- ▸ Opt-in BaZi birth data (Chinese weddings). Date and time of birth is
    --   sensitive personal information under RA 10173 and the single most
    --   useful field for identity fraud against a Philippine record. It is
    --   collected behind an explicit consent checkbox and rendered on exactly
    --   one surface — and it was readable by anyone who scanned the couple's QR.
    'partner_a_birth_date',
    'partner_a_birth_time',
    'partner_b_birth_date',
    'partner_b_birth_time',
    -- ▸ The consent timestamp. Leaking it discloses that the couple supplied
    --   birth data at all, and is the oracle for whether the four columns above
    --   are worth attacking.
    'bazi_birthdata_consent_at',

    -- ▸ The couple's exact budget in centavos, and its band. A vendor who is
    --   also a guest reads the number the couple is negotiating against.
    --   Setnayan already treats this as need-to-know: public.vendor_event_brief
    --   discloses only a ROUNDED RANGE, and only when the host has flipped
    --   events.share_budget_band (default FALSE, 20270508637171). The raw figure
    --   sitting one PostgREST call away made that gate decorative.
    'estimated_budget_centavos',
    'budget_band',

    -- ▸ wizard_state. The name undersells it. It is not a set of completion
    --   flags — every card stamps its payload in (wizard-actions.ts):
    --     set_wedding_date.date · set_estimated_budget.centavos (the budget
    --     again) · set_estimated_pax.pax · engagement_prenup_shoot
    --     .scheduled_date · monogram.initials (derived from both partners'
    --     names) · create_website.slug · draft_guest_list.last_added_count ·
    --     finalize_seatplan.assigned_count / total_rsvp_count · per-task
    --     event_vendor_id + marketplace_vendor_id + add_a_category.picks
    --   plus a completed_at / in_flight_since pair across 65 tasks — a
    --   timestamped activity log of the couple's planning.
    --   It also has an UNBOUNDED channel: markTaskInFlight / markTaskDone copy
    --   every `meta_*` form field verbatim into <taskId>.meta, and the task ids
    --   they were built for are cenomar_bride, cenomar_groom, church_paperwork,
    --   marriage_license — the design intent is to hold PSA/CENOMAR civil
    --   registry reference numbers. Dormant today; wired.
    'wizard_state',

    -- ▸ The couple's Google Drive identity. _account_email is their personal
    --   Google address (a login identifier); _folder_id addresses the folder the
    --   wedding photos land in. The OAuth token on the same row was closed by
    --   20271007100000 — this closes the account it belongs to and the folder it
    --   points at.
    'photo_delivery_folder_id',
    'photo_delivery_folder_name',
    'photo_delivery_account_email',

    -- ▸ setnayan_ai_tier_at_purchase (added 20271007917549, SEC-5). The price
    --   TIER (A–E) the couple's Setnayan AI entitlement was BOUGHT at. That is
    --   commercial information about the host: what they were charged. A guest
    --   attends the event; there is no product surface on which they need to
    --   know what the couple paid, and there is no read path — as of this
    --   migration NOTHING in apps/web reads this column from an authenticated
    --   client at all (only tests/db/setnayan-ai-tier-lock.db.test.ts, which
    --   reads it as service_role). Host-only is therefore the classification
    --   that costs nothing and the default the deny-set exists to enforce.
    --   Note it also carries a small oracle the live event_type does not: the
    --   column is NULL until the entitlement is first activated, and after an
    --   admin re-type it preserves the ORIGINAL tier — so it discloses both
    --   THAT the couple bought AI and what they bought it as, even once
    --   event_type has moved on.
    --   It arrives here already SELECT-denied: 20271007100000 revoked
    --   table-level SELECT, and a column added afterwards inherits no
    --   privilege (Postgres enumerates column privileges at GRANT time). This
    --   entry is what makes that state DELIBERATE rather than accidental —
    --   post-condition (h) fails the migration for any events column that is
    --   denied but in neither deny-set, which is exactly how this column was
    --   surfaced.
    'setnayan_ai_tier_at_purchase'
  ];
  role_name TEXT;
  allowed   TEXT;
  missing   TEXT[];
BEGIN
  -- 1a-i. Snapshot every WRITE privilege authenticated holds on this table
  --       BEFORE touching anything. Post-condition (e) diffs against this, so
  --       the "REVOKE SELECT did not disturb UPDATE/INSERT" invariant is proven
  --       against the real prior state instead of a hand-guessed column list.
  --       (The first draft of this file guessed, and asserted four columns were
  --       host-writable that 20271005100000 had already denied — the assert
  --       caught it. Hence: no guessing.)
  CREATE TEMP TABLE _sec2b_write_priv_before ON COMMIT DROP AS
  SELECT c.column_name,
         has_column_privilege('authenticated', 'public.events', c.column_name, 'UPDATE') AS can_update,
         has_column_privilege('authenticated', 'public.events', c.column_name, 'INSERT') AS can_insert
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'events';

  -- 1a. Fail loudly on a typo. A misspelled entry would deny nothing and the
  --     migration would "pass" vacuously.
  SELECT array_agg(c) INTO missing
  FROM unnest(private_columns) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'private_columns names non-existent events column(s): %',
      array_to_string(missing, ', ');
  END IF;

  -- 1b. Per role, compute "what this role can read TODAY, minus the deny-set".
  --     Reading the LIVE privilege state (rather than the whole catalog) is what
  --     makes this a union with 20271007100000 instead of a silent undo of it.
  FOREACH role_name IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO allowed
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'events'
      AND c.column_name <> ALL (private_columns)
      AND has_column_privilege(role_name, 'public.events', c.column_name, 'SELECT');

    IF allowed IS NULL THEN
      RAISE EXCEPTION 'refusing to apply: computed allow-list for % is empty', role_name;
    END IF;

    -- Table-level privilege must go first — Postgres cannot subtract a column
    -- from a table-level grant.
    EXECUTE format('REVOKE SELECT ON public.events FROM %I', role_name);
    EXECUTE format('GRANT SELECT (%s) ON public.events TO %I', allowed, role_name);
  END LOOP;

  -- 1c. Restate service_role's full read explicitly. Already true in prod via
  --     Supabase default privileges, so a no-op there — but it makes the
  --     migration self-sufficient on a freshly-built database and keeps
  --     post-condition (d) meaningful.
  EXECUTE 'GRANT SELECT ON public.events TO service_role';
END $$;

-- ----------------------------------------------------------------------------
-- 2. Give hosts the columns back — and ONLY hosts.
--
--    The column list is computed as "everything authenticated can now read"
--    ∪ "the twelve private columns" = every column of events EXCEPT the
--    credentials 20271007100000 revoked. Computed rather than enumerated, so a
--    future credential revoke on events is inherited here automatically and
--    this view can never become the door that re-opens one.
--
--    DROP + CREATE rather than CREATE OR REPLACE: the latter cannot change a
--    view's column list, which would make this migration non-idempotent the
--    first time an events column is added.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.events_host;

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          -- service_role sees every row. NOT a widening: service_role already
          -- holds unrestricted SELECT on the base table and bypasses RLS, so
          -- this grants it nothing it lacks. It exists so a shared helper that
          -- reads events_host cannot SILENTLY return zero rows when a caller
          -- hands it the admin client — auth.uid() is NULL there, so both
          -- membership arms would miss and the failure would look like "no
          -- such event" instead of an error. lib/budget-allocation-data.ts and
          -- lib/wedding-roadmap-signals.ts take their client as a parameter and
          -- live in files that import BOTH clients, which is exactly how that
          -- mistake gets made.
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

-- READ-ONLY, and closed to anon. A single-table view with a simple WHERE is
-- auto-updatable, and this one runs with definer rights — granting anything but
-- SELECT would hand hosts a write path straight past couple_can_update_event.
-- ⚠ THE `authenticated` REVOKE IS LOAD-BEARING, NOT BELT-AND-BRACES.
-- This project carries ALTER DEFAULT PRIVILEGES in `public` granting
-- arwdDxtm — i.e. INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER —
-- to BOTH anon and authenticated on every newly created relation (verify with
-- `select defaclacl from pg_default_acl d join pg_namespace n
--    on n.oid = d.defaclnamespace where n.nspname = 'public'`).
-- A view is a relation, so `CREATE VIEW` above already handed `authenticated`
-- the full set before this block runs, and `GRANT SELECT` ADDS a privilege —
-- it does not reduce the others. Revoking only PUBLIC and anon therefore left
-- authenticated holding UPDATE/INSERT/DELETE on an auto-updatable,
-- definer-rights view: a write path straight past couple_can_update_event AND
-- past RLS on public.events.
-- Post-condition (c) `events_host-is-writable` caught exactly this and refused
-- to apply the migration. Revoke from authenticated FIRST, then grant back the
-- single privilege it should have.
REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'SEC-2b. The host read surface for public.events: every column except the '
  'credentials 20271007100000 revoked (master_qr_token, the Drive OAuth token), '
  'restricted to rows where the caller is member_type=''couple'' or an accepted, '
  'non-removed event_moderator — the same predicate app/dashboard/[eventId]/'
  'layout.tsx enforces. security_invoker=false on purpose: it is what lets a host '
  'read the twelve private columns that are SELECT-denied to `authenticated` on '
  'the base table by 20271008731642. SELECT-only (see the REVOKE above). Plain '
  'guests, member_type=''coordinator'' and Samahan co-members see NO rows here. '
  'Read `public.events` for the guest-safe surface; use the service-role client '
  'for anything admin.';

-- ----------------------------------------------------------------------------
-- 3. Post-conditions — assert against the REAL catalog, so a half-applied or
--    silently-ineffective grant fails the migration instead of shipping.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad     TEXT[] := ARRAY[]::TEXT[];
  c       TEXT;
  n_ungranted INT;
BEGIN
  -- (a) every column this migration denies must be UN-readable by both roles
  FOREACH c IN ARRAY ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase'
  ] LOOP
    IF has_column_privilege('authenticated', 'public.events', c, 'SELECT')
       OR has_column_privilege('anon', 'public.events', c, 'SELECT') THEN
      bad := array_append(bad, 'still-readable:' || c);
    END IF;
  END LOOP;

  -- (b) THE UNION ASSERT. 20271007100000's deny-set must survive this
  --     migration's REVOKE-then-GRANT cycle. If the allow-list were ever
  --     recomputed from the full catalog instead of from live privileges, these
  --     three would silently come back and SEC-2 would be undone.
  FOREACH c IN ARRAY ARRAY[
    'master_qr_token',
    'photo_delivery_oauth_token_encrypted',
    'photo_delivery_oauth_expires_at'
  ] LOOP
    IF has_column_privilege('authenticated', 'public.events', c, 'SELECT')
       OR has_column_privilege('anon', 'public.events', c, 'SELECT') THEN
      bad := array_append(bad, 'sec2-regressed:' || c);
    END IF;
    -- ...and the new view must not be the door that re-opens them.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = c
    ) THEN
      bad := array_append(bad, 'events_host-reexposes:' || c);
    END IF;
  END LOOP;

  -- (c) the GUEST-VISIBLE surface must survive intact. These are the exact
  --     columns lib/events.ts fetchUserEvents embeds and the account switcher
  --     selects — the two paths a plain guest reads events through — plus the
  --     event date the owner explicitly wants guests to keep. If any of them
  --     lost SELECT, a guest's switcher and library go blank.
  FOREACH c IN ARRAY ARRAY[
    'event_id','public_id','event_type','display_name','event_date',
    'is_primary','archived','venue_name','venue_address',
    'monogram_text','monogram_color','monogram_frame_key','monogram_font_key',
    'monogram_style','monogram_custom_svg','monogram_uploaded_svg',
    'concierge_status','slug'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      bad := array_append(bad, 'lost-guest-read:' || c);
    END IF;
  END LOOP;

  -- (d) service_role must be entirely unaffected — it is the direct read path
  --     for the Drive pipeline, the vendor Event Brief and the admin console.
  IF NOT has_table_privilege('service_role', 'public.events', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.events',
                                 'estimated_budget_centavos', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.events',
                                 'wizard_state', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.events',
                                 'partner_a_birth_date', 'SELECT') THEN
    bad := array_append(bad, 'service_role-lost-select');
  END IF;

  -- (e) WRITES must be undisturbed — diffed against the pre-migration snapshot,
  --     not a guessed list. The couple still writes estimated_budget_centavos
  --     (budget planner + setEstimatedBudget) and wizard_state (17 wizard
  --     actions) through the authenticated client under couple_can_update_event;
  --     bazi_birthdata_consent_at and the three photo_delivery folder/account
  --     columns were already write-denied by 20271005100000 and are written by
  --     service-role only. REVOKE SELECT must change NEITHER group.
  FOR c IN
    SELECT b.column_name
      FROM _sec2b_write_priv_before b
     WHERE b.can_update IS DISTINCT FROM
             has_column_privilege('authenticated', 'public.events', b.column_name, 'UPDATE')
        OR b.can_insert IS DISTINCT FROM
             has_column_privilege('authenticated', 'public.events', b.column_name, 'INSERT')
  LOOP
    bad := array_append(bad, 'write-privilege-changed:' || c);
  END LOOP;

  -- ...and a spot-check that the two columns the couple genuinely writes are
  --    still writable, so an empty snapshot table could never make (e) vacuous.
  IF NOT has_column_privilege('authenticated', 'public.events', 'estimated_budget_centavos', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.events', 'wizard_state', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.events', 'display_name', 'UPDATE') THEN
    bad := array_append(bad, 'lost-host-write:budget/wizard/display_name');
  END IF;
  IF (SELECT count(*) FROM _sec2b_write_priv_before) = 0 THEN
    bad := array_append(bad, 'write-privilege snapshot is empty — assertion (e) would be vacuous');
  END IF;

  -- (f) the host read path must exist, be a DEFINER view, and carry every
  --     private column. A view built with security_invoker=true would be
  --     subject to the grants just revoked and would fail for everyone.
  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='events_host') THEN
    bad := array_append(bad, 'events_host-missing');
  ELSIF EXISTS (
    SELECT 1 FROM pg_class
     WHERE oid = 'public.events_host'::regclass
       AND reloptions @> ARRAY['security_invoker=true']
  ) THEN
    bad := array_append(bad, 'events_host-is-security-invoker');
  END IF;

  FOREACH c IN ARRAY ARRAY[
    'event_id',
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events_host', c, 'SELECT') THEN
      bad := array_append(bad, 'events_host-missing-host-read:' || c);
    END IF;
  END LOOP;

  -- (g) the view must be READ-ONLY and closed to anon. It is auto-updatable and
  --     runs with definer rights, so an UPDATE grant here would bypass
  --     couple_can_update_event entirely.
  IF has_table_privilege('authenticated', 'public.events_host', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.events_host', 'INSERT')
     OR has_table_privilege('authenticated', 'public.events_host', 'DELETE') THEN
    bad := array_append(bad, 'events_host-is-writable');
  END IF;
  IF has_table_privilege('anon', 'public.events_host', 'SELECT') THEN
    bad := array_append(bad, 'anon-can-read-events_host');
  END IF;

  -- (h) COVERAGE: every column of events must be accounted for — readable by
  --     authenticated, or in one of the two deny-sets. Catches a column added
  --     between 20271007100000 and this migration that nobody granted.
  SELECT count(*) INTO n_ungranted
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND NOT has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
    AND c.column_name NOT IN (
      'master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at',
      'partner_a_birth_date','partner_a_birth_time','partner_b_birth_date','partner_b_birth_time',
      'bazi_birthdata_consent_at','estimated_budget_centavos','budget_band','wizard_state',
      'photo_delivery_folder_id','photo_delivery_folder_name','photo_delivery_account_email',
      'setnayan_ai_tier_at_purchase'
    );
  IF n_ungranted > 0 THEN
    bad := array_append(bad, n_ungranted || ' events column(s) are SELECT-denied but in neither deny-set');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'events private-details post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;

COMMENT ON COLUMN public.events.estimated_budget_centavos IS
  'The couple''s total event budget, in PHP centavos. NOT readable by '
  'authenticated/anon since 20271008731642 (SEC-2b) — hosts read it through '
  'public.events_host; service_role reads it directly. Still host-WRITABLE '
  'under couple_can_update_event.';

COMMENT ON COLUMN public.events.wizard_state IS
  'Per-task state for the Concierge wizard. Despite the name this accumulates '
  'real personal data — wedding + prenup dates, the budget figure, pax and '
  'guest-list counts, monogram initials, the site slug, per-task vendor ids, '
  'and an unbounded <taskId>.meta channel intended for PSA/CENOMAR reference '
  'numbers. NOT readable by authenticated/anon since 20271008731642 (SEC-2b) — '
  'hosts read it through public.events_host. Keys are task ids from WIZARD_TASKS '
  'in apps/web/lib/wizard.ts.';

COMMENT ON COLUMN public.events.partner_a_birth_date IS
  'Opt-in BaZi birth data (RA 10173 sensitive personal information). NOT '
  'readable by authenticated/anon since 20271008731642 (SEC-2b) — hosts read it '
  'through public.events_host. Same for partner_a_birth_time, '
  'partner_b_birth_date, partner_b_birth_time and bazi_birthdata_consent_at.';

COMMENT ON COLUMN public.events.photo_delivery_account_email IS
  'The couple''s personal Google account address for Drive photo delivery. NOT '
  'readable by authenticated/anon since 20271008731642 (SEC-2b) — hosts read it '
  'through public.events_host. The OAuth token on this row was closed earlier by '
  '20271007100000.';

-- ⚠ This RESTATES 20271007917549's comment verbatim and appends the read
-- classification. COMMENT ON COLUMN replaces rather than appends, so the SEC-5
-- text is repeated in full deliberately — dropping it would erase the only
-- in-database record of what stamps this column and why.
COMMENT ON COLUMN public.events.setnayan_ai_tier_at_purchase IS
  'SEC-5: the Setnayan AI price tier (A-E) this event''s entitlement was BOUGHT '
  'at, stamped by trg_stamp_events_ai_tier_at_purchase when setnayan_ai_active '
  'first turns true. The entitlement boolean alone records THAT AI was bought, '
  'never at which tier - without this the delivered tier is whatever the live '
  'event_type happens to say. Not writable by authenticated/anon. '
  'SEC-2b (20271008731642): also NOT READABLE by authenticated/anon — it is '
  'commercial information about the host (what the couple was charged), and a '
  'guest has no product reason to see it. Hosts read it through '
  'public.events_host; service_role reads it directly.';

COMMIT;

-- ============================================================================
-- ⚠ MAINTENANCE NOTE FOR FUTURE MIGRATIONS
--
-- BOTH the grant list and the view projection are snapshots taken at apply time
-- — the same trap 20271005100000 documents for writes and 20271007100000 for
-- reads, now with a second face. A column added to public.events AFTER this
-- migration is neither SELECT-granted to authenticated/anon NOR present on
-- public.events_host.
--
-- Every `ALTER TABLE public.events ADD COLUMN` from here on must also carry:
--
--   -- a PUBLIC-to-members column:
--   GRANT SELECT (new_col) ON public.events TO authenticated, anon;
--   GRANT UPDATE (new_col), INSERT (new_col) ON public.events TO authenticated;
--   -- ...and rebuild the host view so hosts keep reading it:
--   --   (copy the DROP VIEW + DO block from section 2 of this file)
--
--   -- a PRIVATE column: skip the SELECT grant, add it to
--   --   PRIVATE_SELECT_COLUMNS in apps/web/lib/security/events-private-details.ts
--   --   and rebuild the view the same way.
--
-- This cannot rot silently. tests/db/events-private-details.db.test.ts replays
-- the FULL migration corpus and asserts, against the live catalog:
--   • every events column is either granted to authenticated or in a deny-set;
--   • every column authenticated can read on events also exists on events_host.
-- A new column that skips either step fails CI with that instruction.
--
-- ── AND THE OTHER DIRECTION: DROP COLUMN NOW NEEDS THE VIEW OUT OF THE WAY ──
-- public.events_host projects EVERY column of public.events, so it is a
-- dependent object of all of them. From this migration onward,
--
--   ALTER TABLE public.events DROP COLUMN whatever;
--
-- fails with 2BP01 "other objects depend on it". Do NOT reach for CASCADE — it
-- would drop events_host and leave every host reader 42P01ing with a green
-- migration. The sequence is: DROP VIEW public.events_host → DROP COLUMN →
-- rebuild the view (section 2 of this file). Two DB tests that simulate a
-- historical schema state by dropping an events column were updated for this
-- when SEC-2b landed: tests/db/facebook-watch-url-grant.db.test.ts and
-- tests/db/open-browse-schema.db.test.ts.
--
-- ── WORKED EXAMPLE: events.setnayan_ai_tier_at_purchase ─────────────────────
-- Migration 20271007917549 (SEC-5) added that column between this file being
-- written and it being merged. It arrived SELECT-denied (a column added after
-- 20271007100000's table-level REVOKE inherits no privilege), and
-- post-condition (h) refused to apply this migration until somebody DECIDED
-- which side it was on. It was classified PRIVATE — see the WHY block on the
-- section-1 deny-set. That is the mechanism working exactly as intended: the
-- default for a new column is not "guest-readable", it is "the build stops".
-- ============================================================================
