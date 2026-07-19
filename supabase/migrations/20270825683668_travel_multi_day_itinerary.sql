-- travel_multi_day_itinerary
-- ============================================================================
-- Travel multi-day itineraries (ai-travel-scheduling ·
-- Setnayan_AI_Gap_Leaves_Travel_Dinner_Date_2026-07-17.md Part B).
--
-- Travel events get a real itinerary on the EXISTING schedule spine
-- (`event_schedule_blocks`) — no new table:
--
--   1. Two new `schedule_block_type` enum values:
--        • 'lodging' — a hotel NIGHT-BLOCK: start_at = check-in,
--          end_at = check-out, spanning days. Multiple hotels = sequential
--          night-blocks (Hotel A nights 1–2, Hotel B nights 3–4). The
--          per-night expansion + lodging-gap guard live in
--          apps/web/lib/schedule-travel.ts (pure).
--        • 'tour' — a tour/activity TIME-BLOCK (the `tour_activity` taxonomy
--          leaf from the ai-gap-leaves migration is not just a vendor
--          category — it generates a schedule block on the trip). Overlapping
--          tour blocks are rejected at save and surfaced via the GRD-06
--          clash guard ("Two things land on {slot}…").
--      Only the travel schedule UI offers these types; the server action
--      rejects them on non-travel events, so every other type's schedule is
--      byte-identical.
--
--   2. Travel profile: multi_day = TRUE + layer_mode = 'roaming' — verified
--      and (re)set per the spec's "confirm and set". The composable
--      foundation (20270807254184) already UPDATEs travel to multi-day when
--      its row exists; this makes the trait self-sufficient even on a
--      database seeded after that migration, and repairs any drift. The
--      INSERT arm mirrors the 20270221005058 seed row exactly; the conflict
--      arm touches ONLY the two composable traits (never terminology or
--      surfaces an admin may have edited).
--
-- Idempotent. Safe to apply the moment the PR merges: nothing consumes the
-- new enum values until a travel host adds a lodging/tour block, and the
-- profile flags match what prod already holds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. schedule_block_type — add 'lodging' + 'tour'
--    ALTER TYPE … ADD VALUE cannot run inside an explicit transaction block,
--    so this part lives outside the BEGIN/COMMIT below (same pattern as
--    20260514100000). IF NOT EXISTS keeps it idempotent.
-- ----------------------------------------------------------------------------

ALTER TYPE public.schedule_block_type ADD VALUE IF NOT EXISTS 'lodging';
ALTER TYPE public.schedule_block_type ADD VALUE IF NOT EXISTS 'tour';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Travel event-type profile — multi_day TRUE · layer_mode 'roaming'
-- ----------------------------------------------------------------------------

INSERT INTO public.event_type_profiles (
  event_type, terminology, enabled_surfaces,
  onboarding_flow_key, role_set_key, template_pack_key, monogram_set_key,
  reveal_pack_key, budget_taxonomy_key, schedule_seed_key, statutory_pack_key,
  layer_mode, multi_day
) VALUES (
  'travel',
  '{"organizer_noun":"organizer","person_a":null,"person_b":null,"seat_word":"seat","event_word":"trip","vip_tier_label":"Travelers"}'::jsonb,
  ARRAY['seating','budget','schedule','day_of','gallery'],
  'travel','generic',NULL,NULL,NULL,NULL,NULL,NULL,
  'roaming', TRUE
)
ON CONFLICT (event_type) DO UPDATE
  SET layer_mode = 'roaming',
      multi_day  = TRUE;

COMMIT;
