-- 20271026875375_interconnection_probe_ledger.sql
--
-- The interconnection probe ledger — where a joint records whether it still
-- carries traffic, and to whom.
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
-- The song desk shipped as 8 PRs. Every DB object in it was individually
-- verified. 64 DB tests were green. And the desk was UNREACHABLE in prod for
-- the entire build, because `vendor_profiles.services` speaks TILES
-- (`live_band`) while `get_vendor_event_brief().booked_categories` speaks
-- CATEGORIES (`band_dj`), and the surface intersected the two directly. The
-- requests inbox printed "no requests yet" over three real pending rows.
--
-- Nothing caught it because the defect did not live in a part. It lived in the
-- JOIN between two correct parts, and a test that verifies a part cannot see
-- there. This table is the other half: a place to write down, from live data,
-- whether a joint is actually connected — not whether its two ends compile.
--
-- ── THE FIVE-STATE VERDICT, AND WHY A BOOLEAN WOULD HAVE LIED ──────────────
-- The trap this ledger exists to escape is that an RLS denial and an empty read
-- are THE SAME VALUE: `count: 0`, no error. `fetchActSongRequests` documents the
-- collapse in its own header — "Returns [] rather than throwing on a denied
-- gate". So a boolean ledger would have recorded the broken desk as healthy.
--
--   ok      — the reader saw rows. The joint carries traffic.
--   empty   — the reader saw nothing AND service_role also sees nothing.
--             Truthfully empty. Not a fault.
--   lying   — the reader saw nothing but service_role SEES ROWS. The data is
--             there and the surface is hiding it. This is the song desk.
--   denied  — the gate refused before any read ran. Distinct from `empty`
--             on purpose: "not entitled" is not "nothing to show".
--   error   — the probe itself failed. Recorded, never swallowed, because a
--             probe that silently stops running reads exactly like a green one.
--
-- `truth_count` is stored next to `subject_count` so the `lying` verdict stays
-- re-derivable from the row instead of being a claim the writer made once.
--
-- ── NO PII, DELIBERATELY ───────────────────────────────────────────────────
-- Counts and ids only. `detail` is a short machine-written string. No guest
-- names, no song titles, no message bodies — RA 10173, and it keeps a table
-- that grows on every tick cheap to retain.
--
-- ── ACCESS: SERVICE-ROLE ONLY ──────────────────────────────────────────────
-- Every new table in `public` ships OPEN — the database's default ACL grants
-- arwdDxtm to anon + authenticated, so enabling RLS is not on its own a lane
-- closure. RLS is enabled here AND the grants are revoked. There are no
-- policies at all: the writer is the probe runner (service_role) and the reader
-- is the admin console (service_role, behind requireAdmin()). Nothing else has
-- business here, and no-policy + no-grant is the tightest posture available.
--
-- IDEMPOTENT — safe to re-run.

-- ── 1 · The ledger ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interconnection_probe_runs (
  run_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable key of the probe that wrote this row (see lib/interconnect/probes).
  probe_key     TEXT NOT NULL,

  -- The Ugat joint this probe watches, when it maps to one (`J41`). NULL for
  -- probes that watch something the map has not covered yet — of which there
  -- are many: the map is 11 types / 83 joints over ~380 tables, and
  -- ugat-concept.baseline.txt still carries 47 `map-backlog` subsystems.
  joint_id      TEXT,

  verdict       TEXT NOT NULL
                CHECK (verdict IN ('ok', 'empty', 'lying', 'denied', 'error')),

  -- What the READER saw, and what service_role sees. `lying` is exactly
  -- subject_count = 0 AND truth_count > 0.
  subject_count INTEGER NOT NULL DEFAULT 0 CHECK (subject_count >= 0),
  truth_count   INTEGER NOT NULL DEFAULT 0 CHECK (truth_count >= 0),

  -- Short, machine-written, no PII. The one-line "why" an operator reads first.
  detail        TEXT,

  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.interconnection_probe_runs IS
  'Runtime health of the joints between subsystems. verdict=lying means service_role sees rows the surface''s own reader does not — the shape that made the song desk unreachable for 8 PRs.';

-- ── 2 · The read patterns ──────────────────────────────────────────────────
-- The admin surface asks "what is each probe's CURRENT verdict", which is a
-- per-probe ORDER BY ran_at DESC LIMIT 1. DESC on ran_at so that scan walks the
-- index forward.
CREATE INDEX IF NOT EXISTS interconnection_probe_runs_probe_ran_idx
  ON public.interconnection_probe_runs (probe_key, ran_at DESC);

-- Faults across all probes, newest first — the "what is broken right now" list.
-- Partial, because healthy rows are the overwhelming majority and none of them
-- belong in this index.
CREATE INDEX IF NOT EXISTS interconnection_probe_runs_faults_idx
  ON public.interconnection_probe_runs (ran_at DESC)
  WHERE verdict IN ('lying', 'denied', 'error');

-- ── 3 · Lock it down ───────────────────────────────────────────────────────
ALTER TABLE public.interconnection_probe_runs ENABLE ROW LEVEL SECURITY;

-- The default-ACL revoke. Enabling RLS does not remove the inherited GRANT;
-- this does.
REVOKE ALL ON TABLE public.interconnection_probe_runs FROM PUBLIC, anon, authenticated;

-- No policies, deliberately — see the header. service_role bypasses RLS, and it
-- is the only writer and the only reader.

-- ── 4 · The booked-vocabulary read ─────────────────────────────────────────
-- Every (vendor, event) booking with BOTH vocabularies side by side, so the
-- probe can compare them in TypeScript using the shipped bridge.
--
-- WHY A FUNCTION AND NOT A PostgREST SELECT. `event_vendors` reaches
-- `vendor_profiles` through EITHER `linked_vendor_profile_id` OR
-- `marketplace_vendor_id` — two distinct real FKs to the same column. PostgREST
-- embedding picks ONE relationship, so a `.select()` here would silently drop
-- every booking that used the other column. That is not a hypothetical: both
-- are populated in prod.
--
-- ⚠ `event_vendors.vendor_id` is that table's OWN primary key, not a reference
-- to a vendor. `archived_by_lock_of` self-references it. Joining `vendor_id` to
-- anything vendor-shaped is a mistake the column name actively invites, and it
-- is why this join is written down once, here, instead of at each call site.
--
-- NOTE the deliberate ABSENCE of a translation: this returns the RAW category
-- strings. Mapping them to tiles is `tilesForVendorCategories()` in TypeScript,
-- and duplicating that mapping into SQL would create the second hand-maintained
-- copy this whole system exists to catch.
--
-- SECURITY DEFINER + service_role-only EXECUTE: it reads across every event, so
-- it must never be reachable from a session. STABLE — no writes.
CREATE OR REPLACE FUNCTION public.interconnect_booked_vocabularies()
RETURNS TABLE (
  event_id          UUID,
  vendor_profile_id UUID,
  services          TEXT[],
  booked_categories TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    b.event_id,
    b.vendor_profile_id,
    COALESCE(vp.services::TEXT[], ARRAY[]::TEXT[]) AS services,
    COALESCE(
      ARRAY_AGG(DISTINCT ev.category::TEXT) FILTER (WHERE ev.category IS NOT NULL),
      ARRAY[]::TEXT[]
    ) AS booked_categories
  FROM public.vendor_schedule_pool_bookings b
  JOIN public.vendor_profiles vp
    ON vp.vendor_profile_id = b.vendor_profile_id
  LEFT JOIN public.event_vendors ev
    ON ev.event_id = b.event_id
   AND (
        ev.linked_vendor_profile_id = b.vendor_profile_id
     OR ev.marketplace_vendor_id    = b.vendor_profile_id
   )
  GROUP BY b.event_id, b.vendor_profile_id, vp.services;
$$;

-- Off PUBLIC, off every session role. The probe runner holds service_role.
REVOKE ALL ON FUNCTION public.interconnect_booked_vocabularies() FROM PUBLIC, anon, authenticated;
