-- event type onboarding content
--
-- Iteration 0053 — admin-editable per-type onboarding CONTENT for the generic
-- (non-wedding) onboarding flow. One row per event type holds the editable
-- onboarding spec as structured JSONB; ANY field left NULL falls back to the
-- code DEFAULT (the TS constants PER_TYPE_QUESTIONS / PERSONA_PACKS /
-- GENERIC_PERSONA_REVEAL / GENERIC_EXP_AXES — see lib/onboarding/onboarding-db.ts,
-- same SAFETY/fallback contract as event-types-db.ts / event_type_profiles).
-- A row is an OVERRIDE, not a requirement: with no row, every type still runs
-- its code-default flow. Wedding keeps its bespoke wizard and is NOT managed here.
--
-- JSONB shapes (mirror the TS types so seeding/editing is a lift-and-shift):
--   intro            { eyebrow, headline, subcopy }                        (welcome copy; NULL → generic)
--   questions        [{ id, eyebrow, question, options:[{ key, title, desc, adds:[catId] }] }]
--   persona_pack     { essentials:[catId], byPersona:{<persona>:[catId]}, servicesByPersona:{<persona>:[svcKey]} }
--   reveal_overrides { <persona>:{ name, tagline, feel } }                 (merged over GENERIC_PERSONA_REVEAL)
--   axis_overrides   { <axisId>:{ eyebrow?, question?, options:{<key>:{ title?, desc? }} } }  COPY ONLY — keys locked
--
-- KEEP IDEMPOTENT (may be re-applied).

CREATE TABLE IF NOT EXISTS public.event_type_onboarding (
  event_type       TEXT PRIMARY KEY
                     REFERENCES public.event_type_vocab(event_type)
                     ON UPDATE CASCADE ON DELETE CASCADE,
  intro            JSONB,
  questions        JSONB,
  persona_pack     JSONB,
  reveal_overrides JSONB,
  axis_overrides   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_type_onboarding ENABLE ROW LEVEL SECURITY;

-- Public read (the onboarding flow is anon-reachable); admin-only writes.
-- Same policy shape as event_type_profiles.
DROP POLICY IF EXISTS event_type_onboarding_select ON public.event_type_onboarding;
CREATE POLICY event_type_onboarding_select
  ON public.event_type_onboarding
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS event_type_onboarding_write ON public.event_type_onboarding;
CREATE POLICY event_type_onboarding_write
  ON public.event_type_onboarding
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
