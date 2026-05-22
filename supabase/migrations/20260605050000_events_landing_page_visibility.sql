-- Iteration 0002 · Landing-page visibility toggle (Public / Unlisted / Private)
-- ----------------------------------------------------------------------
-- Owner directive 2026-05-22: hosts need a way to control who can see
-- their wedding landing page (`setnayan.com/{slug}`). Today every URL
-- is publicly viewable as soon as a slug is picked — fine for the
-- common case, but couples with sensitive guest lists or family
-- circumstances need an opt-out.
--
-- Three-state model:
--   • 'public'    — default. Anyone with the slug URL can view.
--                   Search engines may index after the wedding day
--                   (per CLAUDE.md 2026-05-19 row 426 Phase 4 editorial
--                   public-by-default lock + 8 RA 10173 guardrails).
--   • 'unlisted'  — slug URL works for anyone the host shares it with,
--                   but search engines + future "browse weddings"
--                   surfaces exclude this event. Today renders
--                   identically to 'public' on the landing page; the
--                   value is persisted so V1.1 sitemap.xml + meta robots
--                   tags + public-browse surfaces can read it.
--   • 'private'   — only signed-in hosts AND signed-in guests (rows in
--                   event_members / event_moderators / guests linked to
--                   an authed user) can view. Everyone else sees a
--                   polite locked screen.
--
-- The toggle is the V1 minimum-viable privacy lever. The broader Phase 4
-- editorial RA 10173 guardrails (T+27d reminder email · pseudonymization
-- · private-always field allowlist · right-to-redact · onboarding-time
-- consent checkbox) live in V1.1 iteration 0046.
--
-- Idempotent via IF NOT EXISTS — safe to re-run.
-- ----------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS landing_page_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (landing_page_visibility IN ('public', 'unlisted', 'private'));

COMMENT ON COLUMN public.events.landing_page_visibility IS
  'public = anyone with the slug URL can view (default) · unlisted = slug URL works but page is not indexed or surfaced anywhere · private = only signed-in hosts + signed-in guests can view (anyone else sees a polite locked screen).';
