-- ============================================================================
-- 20270516600000_identity_clusters_phase2.sql
-- Anti-Fraud & Trust Integrity — Phase 2: identity-cluster dedup.
-- Spec: 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 3 rules 3–4,
--       § 6 Phase 2.
--
-- ⚠ PRIVACY (RA 10173): the objects in this migration process PERSONAL DATA —
--   device fingerprints (user_devices.device_hash), normalized home addresses
--   (users.address_normalized), and payment-sender identities
--   (payments.reference_number) — SOLELY for fraud prevention (legitimate
--   interest). Counsel (Claire) review PENDING. Every table / view here is
--   SERVICE-ROLE ONLY: NO anon, NO authenticated SELECT. Vendors and couples
--   must NEVER be able to read cluster membership — it would leak that two
--   accounts are believed to be the same person. RLS is enabled at CREATE
--   time and the grants are revoked from anon/authenticated below.
--
-- WHAT THIS BUILDS
--   1. `user_identity_signals` VIEW — one row per (user, strong-signal). Strong
--      signals: shared device_hash, shared normalized address, shared payment
--      sender (payments.reference_number). IP is intentionally OUT OF SCOPE —
--      no core identity table captures an IP (see § "IP" note below); IP
--      clustering is deferred to Phase 2.1.
--   2. `identity_clusters` MATERIALIZED VIEW — assigns every user a
--      `cluster_id` = the MIN(user_id) of the connected component it belongs to
--      in the "shares a strong signal" link graph. A user with no shared signal
--      is its own singleton cluster (cluster_id = own user_id). The connected
--      component is computed by a bounded, cycle-guarded recursive CTE
--      (transitive closure of the symmetric link edges). Refreshed by
--      `refresh_identity_clusters()`; service-role only.
--
-- WHY A RECURSIVE CTE (not a pg extension): the pilot is small (≤ a few hundred
--   vendors + their couples per the spec). Correctness over micro-optimization.
--   ⚠ SCALE CAVEAT: transitive closure is O(edges·depth); promote this to a
--   nightly union-find job (or pgRouting / a materialized components table) once
--   the graph grows past a few thousand users. The recursion is bounded by an
--   explicit hop counter + a visited-path cycle guard so it can never loop.
--
-- IDEMPOTENT. Migrations are FILES ONLY — CI (`supabase-migrations`) applies on
--   merge; do NOT run db push by hand. RLS at CREATE time.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. user_identity_signals — VIEW (normalized strong-signal source)
--
--    (user_id, signal_type, signal_value). One row per distinct strong signal
--    a user exposes. Two users are LINKED (see identity_clusters) iff they
--    share a (signal_type, signal_value) pair.
--
--    Signal types:
--      • 'device'  — user_devices.device_hash
--      • 'address' — users.address_normalized (non-empty)
--      • 'payment' — payments.reference_number (the payment SENDER identity;
--                    same handle/account number across accounts = same payer).
--                    All payment rows count (any status) — a shared sender is a
--                    fraud-linkage signal, not a "valid payment" signal.
--
--    Not a table: derived on demand, then folded into the matview below. It is
--    still SERVICE-ROLE ONLY (grants handled at the bottom) because it exposes
--    raw device/address/payment identity values.
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.user_identity_signals;
CREATE VIEW public.user_identity_signals AS
  -- Device fingerprint
  SELECT
    ud.user_id,
    'device'::TEXT AS signal_type,
    ud.device_hash AS signal_value
  FROM public.user_devices ud
  WHERE ud.device_hash IS NOT NULL
    AND length(ud.device_hash) > 0

  UNION

  -- Normalized household address
  SELECT
    u.user_id,
    'address'::TEXT AS signal_type,
    u.address_normalized AS signal_value
  FROM public.users u
  WHERE u.address_normalized IS NOT NULL
    AND length(u.address_normalized) > 0

  UNION

  -- Payment sender identity (reference_number). Linked to the paying user via
  -- payments.user_id (direct FK — the canonical paying-user column).
  SELECT
    p.user_id,
    'payment'::TEXT AS signal_type,
    p.reference_number AS signal_value
  FROM public.payments p
  WHERE p.reference_number IS NOT NULL
    AND length(p.reference_number) > 0;

COMMENT ON VIEW public.user_identity_signals IS
  'RA 10173 legitimate-interest fraud prevention; counsel (Claire) review pending; service-role only. (user_id, signal_type, signal_value) strong-identity signals: device_hash / address_normalized / payment reference_number. IP deferred to Phase 2.1 (no core table captures it).';

-- ----------------------------------------------------------------------------
-- 2. identity_clusters — MATERIALIZED VIEW (connected components)
--
--    cluster_id = MIN(user_id) over the connected component in the undirected
--    "shares a strong signal" graph. Algorithm:
--      (a) edges: symmetric pairs of users that share a (signal_type,
--          signal_value). Both directions materialized so the closure is
--          undirected. Self-pairs excluded.
--      (b) reachable(root, node): recursive transitive closure seeded from each
--          user as its own root, walking edges. Bounded by a hop counter
--          (<= 64 hops — far beyond any realistic ring depth at pilot scale)
--          AND a cycle guard (a node is never re-expanded within a path via the
--          `node = ANY(path)` check), so the recursion always terminates even
--          on cyclic graphs.
--      (c) cluster_id = MIN(reachable node) per root — the canonical component
--          label. A user reaches at least itself, so singletons get
--          cluster_id = own user_id.
--
--    NOTE: correctness relies on every user in a component reaching the same MIN
--    (each user is a root and the graph is undirected, so all roots in one
--    component discover the identical reachable set → identical MIN).
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.identity_clusters;
CREATE MATERIALIZED VIEW public.identity_clusters AS
WITH RECURSIVE
-- (a) Undirected link edges: users sharing a strong signal value.
link_edges AS (
  SELECT DISTINCT
    s1.user_id AS a,
    s2.user_id AS b
  FROM public.user_identity_signals s1
  JOIN public.user_identity_signals s2
    ON s1.signal_type = s2.signal_type
   AND s1.signal_value = s2.signal_value
   AND s1.user_id <> s2.user_id
),
-- Universe of all users (so every user gets a row, even signal-less singletons).
all_users AS (
  SELECT u.user_id FROM public.users u
),
-- (b) Transitive closure, seeded from each user as its own root.
reach AS (
  -- Base: each user reaches itself. path guards against cycles; hop bounds depth.
  SELECT
    au.user_id AS root,
    au.user_id AS node,
    ARRAY[au.user_id] AS path,
    0 AS hop
  FROM all_users au

  UNION ALL

  -- Step: expand to neighbours not already on this path (cycle guard) while
  -- under the hop ceiling (bound guard).
  SELECT
    r.root,
    e.b AS node,
    r.path || e.b,
    r.hop + 1
  FROM reach r
  JOIN link_edges e ON e.a = r.node
  WHERE r.hop < 64
    AND e.b <> ALL(r.path)
)
-- (c) Component label = smallest user_id reachable from the root.
--     Postgres has no min(uuid) aggregate, so we MIN the canonical uuid text
--     (byte-identical ordering to uuid) and cast back — same "smallest uuid".
SELECT
  root AS user_id,
  MIN(node::text)::uuid AS cluster_id
FROM reach
GROUP BY root;

-- Unique index on user_id — required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS identity_clusters_user_id_uidx
  ON public.identity_clusters(user_id);

-- Lookup index for the dedup joins (cluster_id grouping).
CREATE INDEX IF NOT EXISTS identity_clusters_cluster_id_idx
  ON public.identity_clusters(cluster_id);

COMMENT ON MATERIALIZED VIEW public.identity_clusters IS
  'RA 10173 legitimate-interest fraud prevention; counsel (Claire) review pending; service-role only. Per-user cluster_id = MIN(user_id) of its connected component in the shared-strong-signal graph (device/address/payment). Singletons = own user_id. Bounded cycle-guarded recursive closure; promote to nightly union-find at scale.';

-- ----------------------------------------------------------------------------
-- 3. refresh_identity_clusters() — service-role refresh entry point.
--    Fail-soft: a failing refresh never propagates. CONCURRENTLY keeps reads
--    non-blocking (the unique index above enables it). Not trigger-wired here —
--    clustering is expensive relative to a single write and the pilot refreshes
--    it out-of-band (on-demand / promote to nightly at scale per the caveat).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_identity_clusters()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.identity_clusters;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'refresh_identity_clusters failed: %', SQLERRM;
END;
$$;

-- Initial seed so the unique index has rows immediately and the first read of
-- the dedup views (below) returns real cluster labels rather than NULL.
REFRESH MATERIALIZED VIEW public.identity_clusters;

-- ----------------------------------------------------------------------------
-- 4. PRIVACY LOCKDOWN — service-role only.
--    Revoke the default grants on both objects from anon + authenticated so no
--    couple/vendor session can ever read cluster membership. The dedup views in
--    the NEXT migration section read these through SECURITY DEFINER matview
--    refresh, which runs as the definer/service role, so no public grant is
--    needed for the downstream aggregate stats to work.
-- ----------------------------------------------------------------------------

REVOKE ALL ON public.user_identity_signals FROM anon, authenticated;
REVOKE ALL ON public.identity_clusters      FROM anon, authenticated;

GRANT SELECT ON public.user_identity_signals TO service_role;
GRANT SELECT ON public.identity_clusters      TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_identity_clusters() TO service_role;

-- ============================================================================
-- 5. DEDUP the trusted review + completed-events stats BY DISTINCT CLUSTER,
--    and EXTEND the arm's-length exclusion with CLUSTER OVERLAP.
--
--    Both matviews are rebuilt here (DROP + CREATE) preserving EVERY existing
--    column name + consumer:
--      • vendor_trusted_review_stats(vendor_profile_id, trusted_avg_rating,
--        trusted_review_count) — unchanged column names + types.
--      • vendor_public_completed_events_stats(vendor_profile_id,
--        public_completed_count) — unchanged column name + type.
--
--    Only the COUNTING semantics change (COUNT(DISTINCT cluster) instead of
--    COUNT(row)) plus one added exclusion (cluster overlap with the vendor's
--    owner/team). All pre-existing exclusion subqueries are preserved verbatim.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5a. vendor_trusted_review_stats — dedup by reviewing-couple cluster.
--
--     trusted_review_count = COUNT(DISTINCT reviewing-couple cluster_id).
--       10 reviews from one identity cluster now count as 1.
--     trusted_avg_rating = AVG over the PER-CLUSTER AVERAGE (mean of means).
--       ANTI-INFLATION CHOICE: a ring that stacks 10 five-star reviews on one
--       cluster contributes a SINGLE 5.0 data-point to the vendor mean, not
--       ten. We first collapse each cluster to its own average rating, then
--       average those per-cluster averages. This makes one cluster's influence
--       on the headline average independent of how many sockpuppet reviews it
--       posts. (The simpler AVG(rating) would let a ring pull the mean by
--       sheer row count.)
--
--     Exclusions (unchanged from 20270516500000) PLUS the new cluster-overlap
--     exclusion (5c).
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_trusted_review_stats;
CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS
WITH trusted_reviews AS (
  SELECT
    vp.vendor_profile_id,
    -- The reviewing couple's identity cluster. couple_user_id references
    -- auth.users(id); identity_clusters is keyed on public.users.user_id,
    -- which equals auth.users.id. Fall back to the raw user id when the
    -- clusters matview has no row yet (treats it as its own singleton).
    COALESCE(ic.cluster_id, vr.couple_user_id) AS reviewer_cluster_id,
    vr.rating_overall
  FROM public.vendor_profiles vp
  JOIN public.vendor_reviews vr
    ON vr.vendor_profile_id = vp.vendor_profile_id
   -- Receipt-backed: only reviews from a couple who actually booked this
   -- vendor through Setnayan (platform-derived flag; couples can't set it).
   AND vr.booked_through_setnayan = TRUE
  LEFT JOIN public.identity_clusters ic
    ON ic.user_id = vr.couple_user_id
  WHERE
    -- Exclude archived events from the count.
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.event_id = vr.event_id
        AND e.archived = FALSE
    )
    AND NOT EXISTS (
      -- Exclude reviews on events where the vendor's owner is on the
      -- event's couple roster.
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = vr.event_id
        AND em.member_type = 'couple'
        AND em.user_id = vp.user_id
    )
    AND NOT EXISTS (
      -- Exclude reviews on events where any vendor team member sits on the
      -- event's couple roster.
      SELECT 1 FROM public.event_members em
      JOIN public.vendor_team_members vtm
        ON vtm.user_id = em.user_id
       AND vtm.vendor_profile_id = vp.vendor_profile_id
      WHERE em.event_id = vr.event_id
        AND em.member_type = 'couple'
    )
    AND NOT EXISTS (
      -- Exclude reviews on events where any internal account that owns or
      -- sits on this vendor's team is on the event's couple roster.
      SELECT 1 FROM public.event_members em
      JOIN public.users u ON u.user_id = em.user_id
      WHERE em.event_id = vr.event_id
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
      -- Exclude reviews flagged by an active vendor_self_comp grant.
      -- The full self-comp table ships separately; until then this predicate
      -- is a stable no-op (no rows match) which is the correct conservative
      -- behaviour.
      SELECT 1 FROM public.comp_grants cg
      WHERE cg.vendor_profile_id = vp.vendor_profile_id
        AND cg.source = 'vendor_self_comp'
        AND (
          EXISTS (
            SELECT 1 FROM public.event_members em3
            WHERE em3.event_id = vr.event_id
              AND em3.member_type = 'couple'
              AND em3.user_id = cg.created_by_user_id
          )
        )
    )
    -- (5c) NEW — cluster-overlap exclusion: exclude the review when the
    -- reviewing couple shares an identity cluster with the vendor OWNER or ANY
    -- vendor team member. Closes "vendor reviews from their own second account
    -- on a different device but same address/payment."
    AND NOT EXISTS (
      SELECT 1
      FROM public.identity_clusters rc            -- reviewing couple's cluster
      JOIN public.identity_clusters vc            -- a vendor-person's cluster
        ON vc.cluster_id = rc.cluster_id
      WHERE rc.user_id = vr.couple_user_id
        AND (
          vc.user_id = vp.user_id                 -- vendor owner
          OR EXISTS (
            SELECT 1 FROM public.vendor_team_members vtm3
            WHERE vtm3.vendor_profile_id = vp.vendor_profile_id
              AND vtm3.user_id = vc.user_id       -- vendor team member
          )
        )
    )
),
-- Collapse each reviewing cluster to a single average (anti-inflation).
per_cluster AS (
  SELECT
    vendor_profile_id,
    reviewer_cluster_id,
    AVG(rating_overall)::NUMERIC AS cluster_avg
  FROM trusted_reviews
  GROUP BY vendor_profile_id, reviewer_cluster_id
)
SELECT
  vp.vendor_profile_id,
  -- Mean of per-cluster means; 0 when the vendor has no trusted reviews.
  COALESCE(AVG(pc.cluster_avg)::NUMERIC(3,2), 0) AS trusted_avg_rating,
  -- Distinct reviewing clusters — a ring counts once.
  COUNT(pc.reviewer_cluster_id)::INT AS trusted_review_count
FROM public.vendor_profiles vp
LEFT JOIN per_cluster pc ON pc.vendor_profile_id = vp.vendor_profile_id
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_trusted_review_stats_vendor_profile_id_uidx
  ON public.vendor_trusted_review_stats(vendor_profile_id);

REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats;

-- Same public grant as before — aggregate counts only, no PII. (The cluster
-- membership stays sealed; only the deduped count/avg is exposed.)
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5b. vendor_public_completed_events_stats — dedup by booking-couple cluster.
--
--     public_completed_count = COUNT(DISTINCT booking-couple cluster_id).
--       An event's booking couple = its couple-roster members; the event's
--       "couple cluster" is the MIN cluster_id over those members (so a
--       two-account couple maps to one cluster deterministically).
--
--     Preserves the column name `public_completed_count` and every existing
--     consumer (lib/vendor-profile.ts, lib/vendor-badges.ts). Only the count
--     semantics change + the new cluster-overlap exclusion (5c).
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_public_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats AS
WITH qualifying_bookings AS (
  SELECT
    vp.vendor_profile_id,
    ev.event_id,
    -- The event's couple identity cluster = MIN cluster over its couple
    -- roster. Fallback to MIN couple user_id when clusters have no row yet.
    (
      SELECT MIN(COALESCE(ic.cluster_id, em.user_id)::text)::uuid
      FROM public.event_members em
      LEFT JOIN public.identity_clusters ic ON ic.user_id = em.user_id
      WHERE em.event_id = ev.event_id
        AND em.member_type = 'couple'
    ) AS booking_cluster_id
  FROM public.vendor_profiles vp
  JOIN public.event_vendors ev
    ON ev.linked_vendor_profile_id = vp.vendor_profile_id
   AND ev.status IN ('delivered', 'complete')
  WHERE
    -- Exclude archived events from the count.
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.event_id = ev.event_id
        AND e.archived = FALSE
    )
    AND NOT EXISTS (
      -- Exclude bookings where the vendor's owner is on the event's couple
      -- roster.
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = ev.event_id
        AND em.member_type = 'couple'
        AND em.user_id = vp.user_id
    )
    AND NOT EXISTS (
      -- Exclude bookings where any vendor team member sits on the event's
      -- couple roster.
      SELECT 1 FROM public.event_members em
      JOIN public.vendor_team_members vtm
        ON vtm.user_id = em.user_id
       AND vtm.vendor_profile_id = vp.vendor_profile_id
      WHERE em.event_id = ev.event_id
        AND em.member_type = 'couple'
    )
    AND NOT EXISTS (
      -- Exclude bookings where any internal account that owns or sits on this
      -- vendor's team is on the event's couple roster.
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
      SELECT 1 FROM public.comp_grants cg
      WHERE cg.vendor_profile_id = vp.vendor_profile_id
        AND cg.source = 'vendor_self_comp'
        AND (
          cg.order_id = ev.vendor_id
          OR EXISTS (
            SELECT 1 FROM public.event_members em3
            WHERE em3.event_id = ev.event_id
              AND em3.member_type = 'couple'
              AND em3.user_id = cg.created_by_user_id
          )
        )
    )
    -- (5c) NEW — cluster-overlap exclusion: exclude the booking when ANY
    -- couple-roster member of the event shares an identity cluster with the
    -- vendor OWNER or ANY vendor team member.
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_members em_c
      JOIN public.identity_clusters bc              -- booking member's cluster
        ON bc.user_id = em_c.user_id
      JOIN public.identity_clusters vc              -- vendor-person's cluster
        ON vc.cluster_id = bc.cluster_id
      WHERE em_c.event_id = ev.event_id
        AND em_c.member_type = 'couple'
        AND (
          vc.user_id = vp.user_id                   -- vendor owner
          OR EXISTS (
            SELECT 1 FROM public.vendor_team_members vtm3
            WHERE vtm3.vendor_profile_id = vp.vendor_profile_id
              AND vtm3.user_id = vc.user_id         -- vendor team member
          )
        )
    )
)
SELECT
  vp.vendor_profile_id,
  -- Distinct booking couple-clusters — a ring booking the same vendor many
  -- times from sockpuppets counts once. Events whose couple cluster resolves
  -- to NULL (no couple roster) are not counted.
  COUNT(DISTINCT qb.booking_cluster_id)::INT AS public_completed_count
FROM public.vendor_profiles vp
LEFT JOIN qualifying_bookings qb
  ON qb.vendor_profile_id = vp.vendor_profile_id
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_public_completed_events_stats_pk
  ON public.vendor_public_completed_events_stats(vendor_profile_id);

REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats;

GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Refresh dependency — the trusted-review + completed-events matviews now
--    depend on identity_clusters. Both existing trigger refresh functions are
--    unchanged (they REFRESH ... CONCURRENTLY the two stats matviews, which is
--    still correct). We ADD a refresh of identity_clusters ahead of the stat
--    refresh in each so a review/booking write picks up fresh clusters. Kept
--    fail-soft. (vendor_full_completed_events_stats is untouched — it is the
--    unfiltered sibling and intentionally does NOT dedup.)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_vendor_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.identity_clusters;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_review_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_trusted_review_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'refresh_vendor_review_stats failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_vendor_completed_events_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.identity_clusters;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_public_completed_events_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_full_completed_events_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'refresh_vendor_completed_events_stats failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

COMMIT;
