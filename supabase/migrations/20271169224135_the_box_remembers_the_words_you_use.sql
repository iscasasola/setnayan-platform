-- The box remembers the words you use (owner 2026-08-26).
--
-- WHY THIS TABLE EXISTS
-- The owner asked for an admin he can talk to, and then narrowed the memory to
-- exactly the useful half: *"not our decisions. but how to navigate, where to
-- go, what to open."* This is that memory, and it is what makes the assistant
-- get CHEAPER with use: the first time a phrasing reaches the AI it costs a few
-- centavos; the answer is written here, and every repeat is a table lookup that
-- costs nothing.
--
-- WHAT IT MAY HOLD, AND WHAT IT MAY NOT
-- A phrase and a destination. That is all. No rulings, no policy, no approvals —
-- the owner ruled those out explicitly, and the one-person admin plan
-- (2026-07-11) already binds the harder half: the machine may prepare and may
-- hold back, it may never be the thing that lets money, a price, an approval or
-- a publish through. Nothing in this table can move anything.
--
-- 🔑 THE DESTINATION IS NOT TRUSTED FROM HERE. The application validates every
-- stored href against the scanned route map before offering it, so a row that
-- goes stale when a page moves degrades to "no answer", never to a broken link.
-- A stored value whose truth nothing re-checks is how this project got a column
-- named `*_url` that held an `r2://` reference.

CREATE TABLE IF NOT EXISTS public.admin_search_phrases (
  id              bigserial PRIMARY KEY,
  -- The words a person typed, normalised (lowercased, collapsed whitespace).
  phrase          text NOT NULL,
  -- Where it should go. Validated against the route map at read time.
  href            text NOT NULL,
  -- What to call it on screen, so the row needs no second lookup to render.
  label           text NOT NULL,
  -- 'ai' = learned from a model's answer; 'admin' = a person taught it.
  learned_from    text NOT NULL DEFAULT 'ai',
  times_used      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz,
  CONSTRAINT admin_search_phrases_phrase_key UNIQUE (phrase),
  CONSTRAINT admin_search_phrases_source_chk CHECK (learned_from IN ('ai', 'admin')),
  -- An admin address or nothing. A model that answered with an outside URL must
  -- not be storable at all — the app validates too, and this is the floor under
  -- it, because the app-side check is one edit away from being removed.
  CONSTRAINT admin_search_phrases_href_chk CHECK (href LIKE '/admin%'),
  CONSTRAINT admin_search_phrases_phrase_len_chk CHECK (char_length(phrase) BETWEEN 2 AND 200)
);

COMMENT ON TABLE public.admin_search_phrases IS
  'Learned admin-search phrasings: a typed phrase and the admin destination it means. '
  'Navigation only — never decisions, rulings or approvals (owner 2026-08-26). '
  'Written after the AI resolves a phrase nothing matched, so every repeat is free.';

CREATE INDEX IF NOT EXISTS admin_search_phrases_phrase_idx
  ON public.admin_search_phrases (phrase);

-- RLS at CREATE TABLE time, per the house pattern.
ALTER TABLE public.admin_search_phrases ENABLE ROW LEVEL SECURITY;

-- 🔑 NO POLICY, AND NO GRANT — SERVICE ROLE ONLY, ON PURPOSE.
--
-- The first cut granted SELECT to `authenticated` behind an `is_admin()`
-- policy, and the exposure freeze refused it: ten new capabilities reachable
-- with the public anon key. It was right, and the honest fix was not to
-- baseline it — it was to notice that NOTHING IN A BROWSER READS THIS TABLE.
-- Every read and write goes through one admin-gated server action holding the
-- service role, which is outside RLS entirely.
--
-- So this table joins the documented "RLS on, no policy" set: reachable by the
-- service role, silently empty to everybody else. ⚠ DO NOT "FIX" THIS BY ADDING
-- A POLICY. A read policy here would hand every signed-in account the shape of
-- the admin's own navigation for no feature at all, and a PERMISSIVE `FOR ALL`
-- would hand them INSERT and DELETE with it — the exact shape behind eight
-- forgeries on 2026-08-12.
REVOKE ALL ON public.admin_search_phrases FROM anon, authenticated;
