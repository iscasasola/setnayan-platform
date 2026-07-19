-- ============================================================================
-- 20270331300000_realstory_sample_maria_jose_seed.sql
-- Light up the Maria & Jose SAMPLE as a Real Story + style-twin demo.
--
-- Owner ruling (2026-07-01, "seed it"): publish the curated Maria & Jose sample
-- event as ≥1 Real Story on /realstories AND credit its Pro vendors on the
-- /[slug] editorial "Team Behind the Day", WITHOUT inventing fake consent or
-- back-dating the future-dated (2026-12-12) sample. Decisions resolved:
--   • Decision A = HONEST-SAMPLE path (the loader admits is_sample events past
--     the RA 10173 consent/grace gates; the card keeps its "Sample" badge). The
--     loader change ships in apps/web/lib/showcase-db.ts in this same PR — this
--     migration only seeds DATA, no schema.
--   • Decision B = YES, bump the chosen DEMO vendors to tier_state='pro' so the
--     style-twin vendor chips (Pro/Enterprise-only by design) render.
--
-- This satisfies the three remaining DATA gates (the loader handles G4/G5):
--   • G3  events.landing_page_visibility <> 'private' — force 'public' (the
--          original seed omitted the column, so under the 2026-06-20 private-by-
--          default it could land 'private' and the card tap-through 404s).
--   • V1  event_vendors.linked_vendor_profile_id — backfill from the already-
--          written marketplace_vendor_id (the original seed wrote only the
--          latter; the credit batch + editorial both read linked_*).
--   • V2  vendor_profiles.tier_state — bump the 5 "chosen" demo vendors to
--          'pro' (the style-twin/editorial credit gate is Pro/Enterprise-only).
--
-- WHY a migration (not a scripts/ db-query seed): per the owner's build
-- conventions this lands via CI `supabase db push` on merge so prod picks it up
-- with the loader code in one shot — no manual `db query` step. It is pure DML
-- (UPDATE-only; every column already exists), keyed to the fixed demo batch
-- a1a1a1a1-0000-4000-8000-000000000a01 and slug 'maria-and-jose', so it is fully
-- idempotent and re-runnable. Touches ONLY is_demo / sample rows — no real
-- vendor billing, no real couple data.
--
-- Apply: CI `supabase db push --db-url "$SUPABASE_DB_URL"` on merge (do NOT
-- hand-apply / MCP-apply).
--
-- Rollback (manual, if ever needed):
--   UPDATE public.vendor_profiles SET tier_state='free'
--    WHERE demo_batch_id='a1a1a1a1-0000-4000-8000-000000000a01'
--      AND business_name IN ('Habi Photo Co.','Alon Films','Bulaklak & Co.',
--                            'Hain Catering','Araw Planners');
--   (visibility + linked_vendor_profile_id are intentionally left — they are the
--    correct steady state for the public sample.)
-- ============================================================================

BEGIN;

-- ---- G3: keep the sample page publicly reachable -----------------------------
-- Belt-and-suspenders against the private-by-default backfill / a future re-seed
-- of the original insert (which omits landing_page_visibility). is_sample is
-- exempt from the private-by-default privatization (20270206705422), but the
-- INSERT default would still land 'private' on a fresh seed — force 'public'.
UPDATE public.events
   SET landing_page_visibility = 'public'
 WHERE slug = 'maria-and-jose'
   AND is_sample = TRUE
   AND landing_page_visibility IS DISTINCT FROM 'public';

-- ---- V1: link the credited vendors (style-twin + editorial credit join) -------
-- The original seed wrote event_vendors.marketplace_vendor_id but never
-- linked_vendor_profile_id; both the /realstories style-twin batch and the
-- /[slug] editorial "Team Behind the Day" read linked_*. Backfill it from the
-- marketplace pick. Idempotent (only fills NULLs).
UPDATE public.event_vendors AS ev
   SET linked_vendor_profile_id = ev.marketplace_vendor_id
  FROM public.events e
 WHERE e.slug = 'maria-and-jose'
   AND e.is_sample = TRUE
   AND ev.event_id = e.event_id
   AND ev.linked_vendor_profile_id IS NULL
   AND ev.marketplace_vendor_id IS NOT NULL;

-- ---- V2: bump the 5 "chosen" demo vendors to Pro (Decision B) ----------------
-- Style-twin chips + editorial tagging credit ONLY Pro/Enterprise vendors (by
-- design). Bump the believable "team behind the day" — one per key category
-- (photo / video / florals / catering / planning) so the card shows a clean,
-- de-duped, ≤4-chip credit (chips cap at 4/card). Demo-only (is_demo=TRUE rows);
-- never touches real vendor billing or tier counts (admin/stats queries already
-- exclude is_demo).
UPDATE public.vendor_profiles
   SET tier_state = 'pro'
 WHERE demo_batch_id = 'a1a1a1a1-0000-4000-8000-000000000a01'
   AND is_demo = TRUE
   AND business_name IN (
     'Habi Photo Co.',   -- photographer
     'Alon Films',       -- videographer
     'Bulaklak & Co.',   -- florist
     'Hain Catering',    -- catering
     'Araw Planners'     -- planner_coordinator
   )
   AND tier_state IS DISTINCT FROM 'pro';

COMMIT;
