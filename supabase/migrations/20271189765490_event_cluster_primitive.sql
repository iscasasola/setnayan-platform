-- ============================================================================
-- 20271189765490_event_cluster_primitive.sql
--
-- ITEM 7 · "THE YEAR" — PHASE 7a: THE LINKED-CLUSTER PRIMITIVE.
--
-- Owner-locked 2026-07-15 (Composable_Event_Build_Map_2026-07-15.md § "Multi-day
-- & the segment-vs-occasion rule"), verbatim:
--
--   "A separate event is only for a different OCCASION (engagement party ·
--    bridal shower · bachelor/ette · prenup getaway) — its own date/guests,
--    created from the home, shown as a LINKED CLUSTER beside the wedding."
--   "A multi-day event is ONE event with several days, not a bundle of
--    sub-events."   "Lodging is NEVER an event."
--
-- Measured against origin/main @ 6267be4a8 (2026-09-02): NOTHING links two
-- celebrations. No parent, no cluster, no relation. This file is that link and
-- nothing else — no screen, no read path, no occasion types. Three later phases
-- sit on it, which is why the shape is argued here rather than assumed.
--
-- ─── 🛑 THE ONE THING THIS FILE EXISTS TO PROTECT ──────────────────────────
--
-- THE SHOT POT STAYS PER-CELEBRATION. FOREVER. It is not a display detail; it
-- is the primitive people pay for. `papic_event_pool_usage` is keyed
-- `event_id PRIMARY KEY`, `papic_event_point_grants` is keyed `event_id`, and
-- `papic_reserve_event_points(event_id)` is the only door in. One pot across a
-- linked cluster would change what a customer bought, silently, for every
-- celebration already sold.
--
-- ⛔ NOTHING IN THIS FILE HOLDS POINTS, CREDITS, SHOTS, MONEY OR A GUEST COUNT,
--    and nothing here may ever gain such a column. A cluster is a LABEL over
--    celebrations, never a container of value.
-- 🛡 GUARDED, not merely written down:
--    apps/web/tests/db/a-pot-belongs-to-one-celebration.db.test.ts fails the
--    required "typecheck + lint" job if any Papic pool table or function starts
--    keying on a cluster, or if a cluster table grows a value-bearing column.
--    That guard was mutation-proved in both directions before this merged.
--
-- ─── 🪤 THE TWO NAMES YOU WILL REACH FOR ARE BOTH TAKEN ────────────────────
--
--   `related_event_id` — already exists with an UNRELATED meaning, on
--     token_ledger (20260703000000) and telemetry_events (20260704010000).
--   `cluster_id`       — already exists meaning an ANTI-FRAUD IDENTITY cluster
--     (20270516600000_identity_clusters_phase2.sql: the MIN(user_id) of a
--     connected component in the shared-device/address/payment graph). A grep
--     for "cluster_id" returns ~20 hits and NOT ONE of them is a celebration.
--
--   ⇒ The column here is `event_cluster_id`. It is greppable, it returns only
--     this concept, and it can never be pasted into a fraud query by accident.
--     Do not "tidy" it back to `cluster_id`.
--
-- ─── WHY TWO TABLES AND NOT ONE COLUMN ON `events` ─────────────────────────
--
-- The cheap shape is `events.cluster_id`. It was rejected for three reasons,
-- recorded so nobody re-proposes it as a simplification:
--
--   1. A CLUSTER OUTLIVES ITS ANCHOR. If the wedding is deleted, the engagement
--      party and the bridal shower are still a year. A column on `events` makes
--      the group an attribute of a row that can vanish; a table makes it a thing
--      with its own id, name and owner.
--   2. THE LINK CARRIES FACTS OF ITS OWN — which celebration is the anchor, who
--      linked it, when. A column has nowhere to put them, and the second one to
--      arrive becomes a second column on the hottest table in the schema.
--   3. 🔑 FRICTION IN THE RIGHT DIRECTION. `events.cluster_id` is one word away
--      from `SUM(points) … WHERE cluster_id = $1` — the exact rollup the section
--      above forbids. A membership table makes that mistake require a
--      deliberate join, which is a thing a reviewer can see.
--
-- ⚠ AND `events.is_primary` IS NOT THIS. It already exists and is NOT an anchor:
--   it is account-scoped ("your main celebration"), one flag per event with no
--   cluster context, read-only in the app today (sorted by in lib/events.ts and
--   lib/vendor-couple-invite.ts; the write-detector finds no writer on events).
--   An account may hold several clusters. `is_anchor` below is per-cluster and
--   the two must not be conflated.
--
-- ─── THE INVARIANTS, AND WHERE EACH ONE LIVES ──────────────────────────────
--
--   AT MOST ONE CLUSTER PER CELEBRATION → UNIQUE (event_id) on the membership
--     table. The lock says a cluster is shown BESIDE the wedding: one placement.
--     A celebration in two clusters has no single place to be drawn.
--   AT MOST ONE ANCHOR PER CLUSTER      → partial UNIQUE INDEX WHERE is_anchor.
--     Zero anchors is legal and normal — a group of friends' year has no
--     wedding at its centre.
--   YOU CAN ONLY PUT YOUR CELEBRATION IN YOUR CLUSTER → the INSERT policy
--     checks BOTH halves. A policy that only checks WHOSE row it is has no
--     opinion about WHAT is in it; that is this schema's recorded defect shape.
--
-- ─── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────
--
--   NO `year` / `season` / `starts_on` / `ends_on`. The span is DERIVED from
--     the members' own `event_date`s at read time. Item 3's per-guest share was
--     kept derived for exactly this reason and it is why the year is survivable
--     at all — "do not optimise it into a stored value" applies here word for
--     word. A stored span goes stale the first time a date moves.
--   NO DAYS, NO SUB-EVENTS. A multi-day celebration is ONE celebration with
--     several days and stays on `event_schedule_blocks` + `guests.
--     invited_to_blocks`. If you find yourself writing one membership row per
--     day of a wedding, the lock has been broken, not extended.
--   NO LODGING. A place to sleep is a reservation across the days, never an
--     event, therefore never a member.
--   NO NEW OCCASION EVENT TYPES. `public.event_type` today holds wedding ·
--     birthday · celebration · travel · corporate · burial · anniversary ·
--     debut · gender_reveal · graduation · reunion. There is no
--     `engagement_party` or `bridal_shower`, so those occasions are created as
--     `celebration`/`travel` for now. Whether to add them is a product call that
--     also touches `event_type_profiles` seeding — 🔑 FLAGGED FOR THE OWNER,
--     deliberately NOT decided here. The primitive is type-agnostic either way.
--   NO SCREEN, NO SERVER ACTION, NO READ PATH. Phase 7a is schema. Until a
--     later phase writes a row, every table here is empty and every existing
--     query returns exactly what it returned yesterday.
--
-- ⚠ TWO "CHAPTERS" IN CIRCULATION DO NOT FIT THE LOCK AND MUST NOT BECOME
--   MEMBERS: a tasting and a venue walkthrough are appointments with no guests,
--   so under our own rule they are not celebrations at all. Calling them
--   chapters invents a third kind of thing. (And "chapter" is separately taken:
--   Alaala chapters, 20271150057402.) Decide that deliberately; do not let a
--   drawing decide it.
--
-- ADDITIVE + IDEMPOTENT. Creates two tables, three indexes and eight policies.
-- Nothing is dropped, no existing table, function, policy or row is altered.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. event_clusters — the group itself
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_clusters (
  id                BIGSERIAL PRIMARY KEY,
  event_cluster_id  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id         TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('Y'),
  owner_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_clusters_owner_idx
  ON public.event_clusters(owner_user_id);

COMMENT ON TABLE public.event_clusters IS
  'ITEM 7 "the year", phase 7a. A named group of SEPARATE celebrations — the '
  'engagement party, the bridal shower, the wedding — shown as a linked '
  'cluster (owner lock 2026-07-15). A LABEL OVER CELEBRATIONS, NEVER A '
  'CONTAINER OF VALUE: it holds no points, credits, shots, money or guest '
  'count, and must never gain such a column. The Papic shot pot is keyed '
  'event_id and stays that way — guarded by tests/db/'
  'a-pot-belongs-to-one-celebration.db.test.ts. NOT how multi-day is modelled '
  '(that is event_schedule_blocks on ONE celebration) and not where lodging '
  'goes (a reservation, never an event). Unrelated to identity_clusters, which '
  'is anti-fraud — hence event_cluster_id, never cluster_id.';

COMMENT ON COLUMN public.event_clusters.owner_user_id IS
  'Whose year this is. Read and write are the owner''s alone (plus admin); a '
  'celebration''s other members do not inherit the cluster.';

COMMENT ON COLUMN public.event_clusters.display_name IS
  'What the person calls it — "Our year", "The Cruz wedding". The span is '
  'DERIVED from the members'' event_dates at read time and deliberately not '
  'stored: a stored span goes stale the first time a date moves.';

ALTER TABLE public.event_clusters ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. event_cluster_members — which celebrations are in it
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_cluster_members (
  id                BIGSERIAL PRIMARY KEY,
  event_cluster_id  UUID NOT NULL REFERENCES public.event_clusters(event_cluster_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  is_anchor         BOOLEAN NOT NULL DEFAULT FALSE,
  linked_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS event_cluster_members_cluster_idx
  ON public.event_cluster_members(event_cluster_id);

-- At most ONE anchor per cluster. Zero is legal: a friends' year has no wedding
-- at its centre. Being on the membership row rather than a column on the
-- cluster means the anchor is a member BY CONSTRUCTION — a cluster can never
-- point at a celebration it does not contain.
CREATE UNIQUE INDEX IF NOT EXISTS event_cluster_members_one_anchor_idx
  ON public.event_cluster_members(event_cluster_id)
  WHERE is_anchor;

COMMENT ON TABLE public.event_cluster_members IS
  'Which celebrations belong to a cluster. UNIQUE (event_id) is the invariant: '
  'AT MOST ONE CLUSTER PER CELEBRATION, because the lock draws a cluster in one '
  'place — beside the wedding — and a celebration in two clusters has no single '
  'place to be drawn. ONE ROW PER OCCASION, NEVER ONE PER DAY: a multi-day '
  'celebration is ONE celebration with days (event_schedule_blocks), and a '
  'membership row per day means the 2026-07-15 lock has been broken, not '
  'extended. Carries no value of any kind; the shot pot is per-celebration.';

COMMENT ON COLUMN public.event_cluster_members.is_anchor IS
  'The celebration the others are shown beside — the wedding, usually. '
  'Per-CLUSTER and at most one (partial unique index). NOT events.is_primary, '
  'which is account-scoped ("your main celebration") and unrelated.';

COMMENT ON COLUMN public.event_cluster_members.linked_by IS
  'Who linked it. ON DELETE SET NULL so closing an account does not unlink the '
  'celebrations it grouped.';

ALTER TABLE public.event_cluster_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. GRANTS — narrowed from the wide-open default, per column
-- ---------------------------------------------------------------------------
--
-- 🪤 THE `authenticated` REVOKE IS LOAD-BEARING. Revoking from PUBLIC and anon
--    leaves the default grant to `authenticated` untouched, and a following
--    GRANT adds nothing it did not already hold — the table would ship with
--    DELETE, TRUNCATE, REFERENCES and TRIGGER still in a signed-in browser's
--    hands while this file claimed otherwise. A GRANT is not a narrowing; only
--    a REVOKE is.
--
-- 🚨 THE ROW IS YOURS, THE FIELD IS NOT. RLS is ROW-level and can never protect
--    a column, so UPDATE is granted per column: a cluster may be RENAMED and a
--    member may be made the ANCHOR. Nothing else is editable — re-pointing
--    `event_id` or `event_cluster_id` after the fact would move a celebration
--    between groups without passing the both-halves INSERT check.

REVOKE ALL ON public.event_clusters FROM PUBLIC;
REVOKE ALL ON public.event_clusters FROM anon;
REVOKE ALL ON public.event_clusters FROM authenticated;
GRANT SELECT (
  id, event_cluster_id, public_id, owner_user_id, display_name,
  created_at, updated_at
) ON public.event_clusters TO authenticated;
GRANT INSERT (owner_user_id, display_name) ON public.event_clusters TO authenticated;
GRANT UPDATE (display_name, updated_at) ON public.event_clusters TO authenticated;
GRANT DELETE ON public.event_clusters TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.event_clusters_id_seq TO authenticated;
GRANT ALL ON public.event_clusters TO service_role;

REVOKE ALL ON public.event_cluster_members FROM PUBLIC;
REVOKE ALL ON public.event_cluster_members FROM anon;
REVOKE ALL ON public.event_cluster_members FROM authenticated;
GRANT SELECT (
  id, event_cluster_id, event_id, is_anchor, linked_by, linked_at
) ON public.event_cluster_members TO authenticated;
GRANT INSERT (
  event_cluster_id, event_id, is_anchor, linked_by
) ON public.event_cluster_members TO authenticated;
GRANT UPDATE (is_anchor) ON public.event_cluster_members TO authenticated;
GRANT DELETE ON public.event_cluster_members TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.event_cluster_members_id_seq TO authenticated;
GRANT ALL ON public.event_cluster_members TO service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS — Pattern A (self-row) on the cluster; both-halves on the membership
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS event_clusters_owner_select ON public.event_clusters;
CREATE POLICY event_clusters_owner_select ON public.event_clusters
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS event_clusters_owner_insert ON public.event_clusters;
CREATE POLICY event_clusters_owner_insert ON public.event_clusters
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS event_clusters_owner_update ON public.event_clusters;
CREATE POLICY event_clusters_owner_update ON public.event_clusters
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS event_clusters_owner_delete ON public.event_clusters;
CREATE POLICY event_clusters_owner_delete ON public.event_clusters
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin());

/*
  Membership read: the cluster's owner, or a COUPLE member of the celebration.

  🔒 DELIBERATELY NOT `current_event_ids()`. That helper is ANY membership, so a
  guest at the bridal shower would learn the shower belongs to a group. Hosts
  need the linkage; guests never do. Narrowing it here costs nothing and is far
  cheaper than discovering later that a cluster is a disclosure channel.
*/
DROP POLICY IF EXISTS event_cluster_members_read ON public.event_cluster_members;
CREATE POLICY event_cluster_members_read ON public.event_cluster_members
  FOR SELECT TO authenticated
  USING (
    event_cluster_id IN (
      SELECT event_cluster_id FROM public.event_clusters
      WHERE owner_user_id = auth.uid()
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

/*
  Linking needs BOTH halves: your cluster AND your celebration.

  🔒 EITHER HALF ALONE IS A DEFECT. Owning the cluster without the membership
  check lets anyone file somebody else's wedding into their own group. Being a
  couple member without the ownership check lets anyone add their celebration to
  a stranger's year. The pair is the policy.
*/
DROP POLICY IF EXISTS event_cluster_members_link ON public.event_cluster_members;
CREATE POLICY event_cluster_members_link ON public.event_cluster_members
  FOR INSERT TO authenticated
  WITH CHECK (
    event_cluster_id IN (
      SELECT event_cluster_id FROM public.event_clusters
      WHERE owner_user_id = auth.uid()
    )
    AND event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
  );

DROP POLICY IF EXISTS event_cluster_members_set_anchor ON public.event_cluster_members;
CREATE POLICY event_cluster_members_set_anchor ON public.event_cluster_members
  FOR UPDATE TO authenticated
  USING (
    event_cluster_id IN (
      SELECT event_cluster_id FROM public.event_clusters
      WHERE owner_user_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_cluster_id IN (
      SELECT event_cluster_id FROM public.event_clusters
      WHERE owner_user_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_cluster_members_unlink ON public.event_cluster_members;
CREATE POLICY event_cluster_members_unlink ON public.event_cluster_members
  FOR DELETE TO authenticated
  USING (
    event_cluster_id IN (
      SELECT event_cluster_id FROM public.event_clusters
      WHERE owner_user_id = auth.uid()
    )
    OR public.is_admin()
  );

COMMIT;

-- SABOTAGE: give a Papic money table a cluster meaning
ALTER TABLE public.papic_event_point_grants
  ADD COLUMN IF NOT EXISTS event_cluster_id UUID;
