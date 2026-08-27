-- ============================================================================
-- 20271174085072_anniversary_mail_knows_the_occasion.sql
--
-- 🔒 NO SOLEMN EVENT EVER RECEIVES THE ANNIVERSARY MAIL — AND THE MAIL LEARNS
--    WHAT KIND OF DAY IT IS TALKING ABOUT.
--
-- ── WHAT WAS LIVE ───────────────────────────────────────────────────────────
-- `couples_with_anniversary_today()` picks the recipients for BOTH annual
-- emails (lib/daily-email-jobs.ts → runAnniversaryDigest and
-- runAnniversaryHeadsup). It filtered on month/day, "strictly in the past",
-- archived = FALSE, a reachable non-deleted address, and the once-a-year
-- idempotency lock.
--
-- 🚨 IT HAD NO event_type PREDICATE ANYWHERE, and the templates it feeds are
-- hardcoded wedding copy: *'N years ago today, you said "I do."'* and
-- *"Your first wedding anniversary is about 6 weeks away. A whole year already
-- — worth celebrating."*
--
-- The recipient is chosen by `em.member_type = 'couple'`, and that membership
-- type is LEGACY NAMING, not a wedding marker: measured against production,
-- BOTH non-wedding events carry a 'couple'-typed member. So this was live, not
-- latent. One year after a wake, a bereaved family would have received
-- *"1 year ago today, you said \"I do.\""* — and six weeks before it,
-- *"worth celebrating."*
--
-- ── THE GATE GOES HERE, NOT ONLY IN THE TEMPLATE ────────────────────────────
-- A predicate in the selector is stronger than a branch in a template, because
-- the NEXT template will not remember to check. The template is hardened too
-- (it refuses to render for a solemn register), but this is the fence.
--
-- ── THE FAILURE DIRECTION IS *CLOSED*, AND THE REASON IS MEASURED ───────────
-- The rule is "the type's profile row EXISTS and does not say solemn" — an
-- allow-list — rather than "no row says solemn", which is a deny-list.
--
-- 🔑 THE DECIDING FACT: `createEventTypeCore` (lib/event-types-mutations.ts)
-- inserts a row into `event_type_vocab` and NOTHING ELSE. A brand-new event
-- type therefore has NO `event_type_profiles` row at all until an admin opens
-- the profile editor and saves one. Under a deny-list, an admin who adds (say)
-- a "Memorial" type and has not yet set its register would have every such
-- event receive "you said I do" — the exact harm this migration exists to
-- stop. Under the allow-list it simply receives nothing until its tone is
-- known, and it loses nothing by waiting: a type with no profile row has no
-- terminology either, so the mail could only have addressed it in the generic
-- fallback words anyway.
--
-- ⚖ So: an unsent anniversary email costs one marketing touch. A wrongly-sent
-- one reaches a grieving family unprompted. We fail toward silence.
--
-- ⛔ AND IT NAMES NO EVENT TYPE, DELIBERATELY. An earlier cut of this predicate
-- also refused the solemn type BY NAME, as a belt for the one case the
-- allow-list misses: a solemn type whose profile row EXISTS but has lost its
-- `register` key. That case is real — the admin profile editor once rebuilt
-- `terminology` from its six form fields and silently dropped every key the
-- form has no input for, `register` among them.
--
-- 🔑 THE BELT WAS REMOVED BECAUSE THE TYPE KEY IS NOT A STABLE IDENTIFIER. The
-- owner renamed the solemn type on 2026-08-27 ("Wake is the viewing, funeral is
-- the ceremony until burial"), and a predicate hardcoding the old value would
-- have gone inert the moment that landed — still safe, but silently no longer
-- doing anything, which is this repo's most expensive shape.
--
-- ⚖ Nothing is lost. That case is caught in CODE instead, and by construction:
-- `toProfile` falls back to the TYPE'S OWN code profile when a row omits
-- `register`, and the solemn type's code profile is solemn. So a stripped
-- register still resolves solemn, `anniversaryWordsFor` returns null, and the
-- job declines to send. The register is the semantic property; the key is a
-- label that moves.
--
-- ── WHY DROP + CREATE RATHER THAN CREATE OR REPLACE ─────────────────────────
-- The RETURNS TABLE gains `event_type`, and Postgres refuses to REPLACE a
-- function whose return type changed. The column is what lets the job resolve
-- the event's OWN words (lib/[slug]/_lib/event-words) without a second query
-- per candidate — and reading `public.events` from the app for that would run
-- into this schema's per-column grant allowlist on that table.
--
-- ⚠ DEPLOY WINDOW: if the code ships before this migration applies, the old
-- function returns no `event_type` and the job SKIPS that candidate BEFORE
-- claiming its once-a-year lock, so the send is retried the next day rather
-- than being burned. That is the same fail-toward-silence choice.
--
-- Signature of the ARGUMENT is unchanged (p_today DATE), so every PostgREST
-- call site keeps resolving. Grants re-asserted: this function returns couple
-- EMAILS — service_role only.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.couples_with_anniversary_today(DATE);

CREATE FUNCTION public.couples_with_anniversary_today(p_today DATE)
RETURNS TABLE (
  event_id        UUID,
  display_name    TEXT,
  slug            TEXT,
  event_date      DATE,
  years_ago       INT,
  couple_user_id  UUID,
  couple_email    TEXT,
  couple_name     TEXT,
  event_type      TEXT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH ev AS (
    SELECT
      e.*,
      -- Effective anniversary date: a recurring anniversary celebrates its
      -- anchor_date; every other event (incl. weddings) uses event_date.
      CASE
        WHEN e.event_type = 'anniversary' AND e.recurs = TRUE AND e.anchor_date IS NOT NULL
          THEN e.anchor_date
        ELSE e.event_date
      END AS anniv_date
    FROM public.events e
  )
  SELECT
    e.event_id,
    e.display_name,
    e.slug,
    e.anniv_date AS event_date,
    (EXTRACT(YEAR FROM p_today)::INT - EXTRACT(YEAR FROM e.anniv_date)::INT) AS years_ago,
    u.user_id        AS couple_user_id,
    u.email          AS couple_email,
    COALESCE(NULLIF(TRIM(u.display_name), ''), e.display_name) AS couple_name,
    e.event_type     AS event_type
  FROM ev e
  -- The couple member is the recipient. The lateral pick collapses the rare
  -- two-couple-member event to a single email (oldest membership wins).
  --
  -- ⚠ `member_type = 'couple'` IS LEGACY NAMING AND NOT A WEDDING TEST. Every
  -- event type mints one; production's non-wedding events both carry one. It
  -- picks the RECIPIENT, never the tone — the tone is the predicate below.
  JOIN LATERAL (
    SELECT em.user_id
    FROM public.event_members em
    WHERE em.event_id = e.event_id
      AND em.member_type = 'couple'
    ORDER BY em.joined_at ASC, em.id ASC
    LIMIT 1
  ) cm ON TRUE
  JOIN public.users u ON u.user_id = cm.user_id
  WHERE e.anniv_date IS NOT NULL
    AND e.archived = FALSE
    -- Same calendar month/day as today …
    AND EXTRACT(MONTH FROM e.anniv_date) = EXTRACT(MONTH FROM p_today)
    AND EXTRACT(DAY   FROM e.anniv_date) = EXTRACT(DAY   FROM p_today)
    -- … and strictly in the past, so years_ago >= 1 (no same-year / future).
    AND e.anniv_date < p_today
    -- Reachable + not soft-deleted.
    AND u.email IS NOT NULL
    AND u.deleted_at IS NULL
    -- 🔒 THE OCCASION MUST BE ONE AN ANNIVERSARY EMAIL BELONGS ON.
    -- Allow-list, not deny-list — see the header. The type must have a profile
    -- row (so its tone is a thing somebody has decided) and that row must not
    -- say 'solemn'. NULL register = the 16 celebratory types, which is exactly
    -- what lib/event-type-profile.ts resolves a NULL register to.
    AND e.event_type IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.event_type_profiles p
      WHERE p.event_type = e.event_type
        AND COALESCE(p.terminology->>'register', 'celebratory') <> 'solemn'
    )
    -- Idempotency / consent gate: not already sent for THIS anniversary year.
    AND NOT EXISTS (
      SELECT 1
      FROM public.anniversary_email_log l
      WHERE l.event_id = e.event_id
        AND l.anniversary_year = EXTRACT(YEAR FROM p_today)::INT
    );
$$;

COMMENT ON FUNCTION public.couples_with_anniversary_today(DATE) IS
  'Recipients for the annual anniversary mail (digest + first-anniversary '
  'heads-up). Excludes SOLEMN event types by allow-list: the type must carry '
  'an event_type_profiles row whose terminology.register is not ''solemn''. '
  'No event-type KEY is named here — the key is a label that gets renamed, the '
  'register is the semantic property. A type with no profile row is '
  'refused — a new type has none until an admin sets its tone, and an unsent '
  'anniversary email is cheaper than one that reaches a bereaved family. '
  'Returns event_type so the caller can address the event in its own words.';

-- Re-assert the lock-down (Supabase default-grants anon/authenticated EXECUTE
-- on CREATE; this function returns couple EMAILS — service_role only).
REVOKE ALL ON FUNCTION public.couples_with_anniversary_today(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.couples_with_anniversary_today(DATE) TO service_role;

COMMIT;
