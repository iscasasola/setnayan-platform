-- ============================================================================
-- 20271201395665_moodboard_paid_render_pipeline.sql
--
-- Mood Board "Make it real" — MB8, the paid path. MB2 built the substrate
-- (`20271199871696` ledger + config + SKU, `20271200273322` event_renders);
-- MB7 built the free surface. This migration adds the three things the paid
-- path needs that MB2 deliberately did not build, because none of them means
-- anything until a provider call exists:
--
--   1. `moodboard_begin_render` / `finish` / `fail` — the DEBIT AND THE RENDER
--      ROW, WELDED INTO ONE TRANSACTION.
--   2. The event-level share consent + the +1 bonus render it buys.
--   3. `featured_at` on a render, and the admin-only toggle that sets it.
--
-- ── 1. WHY `begin_render` EXISTS AT ALL — THE SEAM, NAMED ──────────────────
-- MB2 shipped `moodboard_reserve_render_credits` and
-- `moodboard_release_render_credits` and stopped there, correctly: a reserve
-- with no render to reserve FOR is untestable. But two separate calls from a
-- server action leave a seam wide enough to drive the whole disease through,
-- in BOTH directions:
--
--   · reserve() succeeds → the action throws / the lambda is killed / the
--     deploy rolls → NO event_renders ROW EVER EXISTS. The couple's credit is
--     gone and there is not one row anywhere saying a render was attempted.
--     Invisible. Unrefundable. Indistinguishable from a credit they spent
--     last week.
--   · the action inserts an event_renders row with `credits_debited = 1`
--     WITHOUT reserving — a free render that every reader, every gallery and
--     every future audit reports as paid for.
--
-- 🔑 NEITHER OF THOSE IS REACHABLE HERE, BECAUSE THERE IS NO ORDER OF
-- OPERATIONS THAT PRODUCES ONE. `begin_render` bumps the usage counter and
-- INSERTs the render row inside a single plpgsql function body, i.e. one
-- transaction: if the INSERT raises, the counter bump rolls back with it; if
-- the reserve refuses, the function RETURNS NULL before the INSERT is reached.
-- A reservation without a row and a paid row without a reservation are not
-- guarded against — they are unrepresentable. Held by
-- tests/db/a-render-and-its-debit-are-one-transaction.db.test.ts, which
-- asserts the pair moves together in both directions.
--
-- ⚠ AND THE ROW IS INSERTED **BEFORE** THE MODEL IS CALLED, with
-- `image_key = NULL`. That is the point. The row is the receipt for the
-- reservation, not the record of a success — so a provider call that never
-- returns leaves a row a human can find, refund and explain, instead of a
-- silent hole in a ledger. `credits_debited` on that row is what
-- `fail_render` refunds, so the amount refunded is always the amount taken,
-- read from the same row rather than re-derived from config that an admin may
-- have edited in between.
--
-- ── THE FAILURE PATH IS THE PRODUCT ────────────────────────────────────────
-- `moodboard_fail_render` marks the row failed AND releases the credits in one
-- transaction, and it is the ONLY way to do either. So:
--   · a failure cannot be recorded without refunding (a charge for nothing);
--   · a refund cannot be issued without recording the failure (a free render);
--   · it REFUSES when `image_key IS NOT NULL` — a delivered render can never
--     be refunded by calling this;
--   · it is IDEMPOTENT on `failed_at` — a retry, a double-submit or a racing
--     watchdog cannot refund twice and mint credits.
--
-- ── 2. CONSENT: +1 RENDER, AND IT GATES ONLY THE SHOWCASE ─────────────────
-- Owner design lock 2026-06-09 (DECISION_LOG.md, "consent-for-share + bonus
-- render"), re-affirmed unchanged by the 2026-09-03 price rows: an event-level
-- share-consent flag + timestamp; consenting earns ONE extra render; and
--
--   🔒 CONSENT GATES SHOWCASE ELIGIBILITY **ONLY**. It never gates whether the
--   admin can see or keep the render. Owner, same session: admin visibility of
--   every render exists to compile Setnayan's own content database. A
--   non-consented render is still retained and still admin-visible; consent
--   decides only whether it may ever be FEATURED publicly.
--
-- That is why `moodboard_set_render_featured` below refuses on a non-consented
-- event, while the admin READ path is not filtered by consent anywhere.
--
-- ⚠ THE BONUS IS DENOMINATED IN CONFIG, NOT IN A CONSTANT. The lock says
-- "+1 render". One render is `moodboard_render_config.credits_per_part` — read
-- at grant time, not hardcoded as 1 — for the same reason MB2 put 1/5/50 in a
-- table: a number that governs what a couple may spend must not be a literal
-- in a function body an admin cannot edit. (The lock's "6 total" was arithmetic
-- against the retired 5-render pack; the surviving pack is 50, so the *ratio*
-- was never the decision — "one extra render" was.)
--
-- Idempotency is structural: a partial UNIQUE index means a second consent
-- bonus for one event cannot be inserted, so a double-click, a retry or two
-- concurrent toggles cannot mint a second render. Not checked-then-inserted —
-- that races.
--
-- ── NO TRIGGERS, AGAIN ON PURPOSE ─────────────────────────────────────────
-- Every invariant here is a CHECK, a UNIQUE index, or logic inside an explicit
-- function. A BEFORE INSERT trigger testing IS NOT NULL on a defaulted column
-- refused every insert for five weeks on this repo (the supplier-add outage).
--
-- ADDITIVE + IDEMPOTENT. Nothing is dropped; no existing row changes. The
-- widened `source` CHECK is a strict superset of the old one.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge; a direct apply stamps the
-- prod ledger with a version that has no file on `main` and jams `db push` for
-- every subsequent merge (2026-09-02: seven PRs stranded three hours).
-- ============================================================================

BEGIN;

-- ---- 1. admin curation lands on the render itself --------------------------

ALTER TABLE public.event_renders
  ADD COLUMN IF NOT EXISTS featured_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_by_user_id UUID
    REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_renders.featured_at IS
  'Set by an admin via moodboard_set_render_featured (MB8). NULL = not '
  'featured. The function REFUSES on an event that has not given share '
  'consent, so the featured set is consent-clean by construction rather than '
  'by a filter somebody has to remember to apply at read time.';

-- The admin gallery''s "featured first" ordering, and the future public
-- showcase''s only read. Partial: unfeatured renders are the overwhelming
-- majority and are not in the index at all.
CREATE INDEX IF NOT EXISTS event_renders_featured_idx
  ON public.event_renders (featured_at DESC)
  WHERE featured_at IS NOT NULL;

-- In-flight / stalled sweep: rows that took a credit and hold no image yet.
-- This is what makes a stuck render FINDABLE instead of a silent hole.
CREATE INDEX IF NOT EXISTS event_renders_in_flight_idx
  ON public.event_renders (created_at)
  WHERE image_key IS NULL AND failed_at IS NULL;

-- ---- 2. event-level share consent ------------------------------------------
--
-- Its own table rather than a column on `events`: the lock says "event-level
-- flag (+timestamp)" and names `events.render_share_consent` **or on the
-- order** as the file, so the shape was left open. A dedicated table keeps
-- `events`'s column grants untouched (that table has a dedicated CI lint for
-- exactly this reason — scripts/lint-events-column-grants.mjs), and gives the
-- consent somewhere to record WHO gave it and WHEN it was withdrawn.
--
-- WITHDRAWAL IS SUPPORTED AND IS NOT A DELETE: `consented` flips to FALSE and
-- `withdrawn_at` is stamped, so the fact that consent once existed survives —
-- a render featured while consent stood is a thing that happened, and erasing
-- the record of the permission would make it unexplainable. Un-featuring on
-- withdrawal is a product step, not a cascade: see the function below.

CREATE TABLE IF NOT EXISTS public.event_render_share_consent (
  event_id            UUID PRIMARY KEY
                        REFERENCES public.events(event_id) ON DELETE CASCADE,
  consented           BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at        TIMESTAMPTZ,
  consented_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  withdrawn_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A consenting row must carry the timestamp that makes it auditable. Named,
  -- because the Ugat schema-claims guard asserts constraints BY NAME and an
  -- autonamed CHECK renumbers the moment a second one lands on the table.
  CONSTRAINT event_render_share_consent_timestamped
    CHECK (consented = FALSE OR consented_at IS NOT NULL)
);

COMMENT ON TABLE public.event_render_share_consent IS
  'Event-level "let Setnayan feature your creation" consent (owner design lock '
  '2026-06-09). Consenting earns +1 render (moodboard_grant_consent_bonus). '
  '🔒 Consent gates SHOWCASE ELIGIBILITY ONLY — it never gates admin '
  'visibility or internal retention of a render, which are separately locked '
  'and deliberately unconditional.';

ALTER TABLE public.event_render_share_consent ENABLE ROW LEVEL SECURITY;

-- Pattern B, read half. Any event member may see whether their event consented.
DROP POLICY IF EXISTS event_render_share_consent_member_read
  ON public.event_render_share_consent;
CREATE POLICY event_render_share_consent_member_read
  ON public.event_render_share_consent
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );
-- No write policy: consent is written only through the SECURITY DEFINER
-- function below, because giving it also GRANTS CREDITS and the two must not
-- be separable by a client that can issue an UPDATE.

-- ---- 3. the consent bonus is a grant source, and it is unique per event ----

ALTER TABLE public.event_render_credit_grants
  DROP CONSTRAINT IF EXISTS event_render_credit_grants_source_allowed;
ALTER TABLE public.event_render_credit_grants
  ADD CONSTRAINT event_render_credit_grants_source_allowed
  CHECK (source IN ('pack_order', 'admin', 'comp', 'migration', 'consent_bonus'));

-- ONE consent bonus per event, FOREVER — enforced by the index, not by a
-- read-then-write in application code, which races two concurrent toggles into
-- two free renders.
CREATE UNIQUE INDEX IF NOT EXISTS event_render_credit_grants_consent_bonus_once
  ON public.event_render_credit_grants (event_id)
  WHERE source = 'consent_bonus';

-- ---- 4. begin: reserve AND record, or neither ------------------------------
--
-- Returns the new render_id, or NULL when the event cannot pay / may not act.
-- NULL is the caller's cue to offer the pack — never to proceed.

CREATE OR REPLACE FUNCTION public.moodboard_begin_render(
  p_event_id              UUID,
  p_part_id               TEXT,
  p_prompt                TEXT,
  p_design_snapshot       JSONB,
  p_config_digest         TEXT,
  p_credits               INTEGER,
  p_note                  TEXT DEFAULT NULL,
  p_inspiration_asset_ids UUID[] DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_render_id UUID;
BEGIN
  IF p_event_id IS NULL OR p_credits IS NULL OR p_credits < 0 THEN
    RETURN NULL;
  END IF;

  -- The SAME gate the reserve uses. Checked here too so a caller who may not
  -- act on this event cannot even leave a row behind.
  IF NOT public.moodboard_render_caller_may_act(p_event_id) THEN
    RETURN NULL;
  END IF;

  -- 🔑 THE WELD. Reserve first: if the event cannot pay, we return before any
  -- row exists. If it can, the counter is already bumped inside THIS
  -- transaction, so the INSERT below either lands with it or rolls back with
  -- it. There is no third outcome.
  IF NOT public.moodboard_reserve_render_credits(p_event_id, p_credits) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.event_renders (
    event_id, part_id, image_key, design_snapshot, prompt,
    inspiration_asset_ids, note, credits_debited, config_digest,
    created_by_user_id
  ) VALUES (
    p_event_id,
    p_part_id,
    NULL,                              -- in flight. An image that does not
                                       -- exist must be absent, never ''.
    COALESCE(p_design_snapshot, '{}'::jsonb),
    p_prompt,
    COALESCE(p_inspiration_asset_ids, '{}'::uuid[]),
    -- A blank note is NOT a note. `event_renders.note` refuses '' by CHECK
    -- and `reusable` is GENERATED on `note IS NULL`, so normalising here is
    -- what keeps an all-whitespace note from silently poisoning the reuse
    -- pool's admission test.
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    p_credits,
    p_config_digest,
    auth.uid()
  )
  RETURNING render_id INTO v_render_id;

  RETURN v_render_id;
END;
$$;

COMMENT ON FUNCTION public.moodboard_begin_render(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, TEXT, UUID[]) IS
  'MB8. Atomically spends p_credits AND records the in-flight render row, or '
  'does neither. Returns render_id, or NULL when the event cannot pay (offer '
  'the pack) or the caller may not act. The row is written BEFORE the model is '
  'called, with image_key NULL, so a provider call that never returns leaves a '
  'refundable, explainable row rather than a silent hole in the ledger.';

-- ---- 5. finish: the image arrived ------------------------------------------
--
-- Idempotent and one-way: refuses on a row already failed, and refuses to
-- overwrite an image already attached. A "success" that lands on a refunded
-- row would be a free render; a second finish overwriting the first would
-- orphan an R2 object nobody can reach.

CREATE OR REPLACE FUNCTION public.moodboard_finish_render(
  p_render_id UUID,
  p_image_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_render_id IS NULL OR btrim(COALESCE(p_image_key, '')) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT r.event_id INTO v_event_id
    FROM public.event_renders r
   WHERE r.render_id = p_render_id
     FOR UPDATE;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(v_event_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.event_renders
     SET image_key    = btrim(p_image_key),
         completed_at = NOW()
   WHERE render_id    = p_render_id
     AND image_key    IS NULL          -- never overwrite a delivered image
     AND failed_at    IS NULL;         -- never revive a refunded render

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.moodboard_finish_render(UUID, TEXT) IS
  'MB8. Attaches the R2 key to an in-flight render. Refuses on a row that '
  'already has an image (a second finish would orphan an object) or that has '
  'been failed and refunded (that would be a free render). Idempotent: the '
  'second call returns FALSE and changes nothing.';

-- ---- 6. fail: mark AND refund, or neither ---------------------------------

CREATE OR REPLACE FUNCTION public.moodboard_fail_render(
  p_render_id UUID,
  p_reason    TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_credits  INTEGER;
  v_image    TEXT;
  v_failed   TIMESTAMPTZ;
BEGIN
  IF p_render_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Lock the row: the refund amount is READ FROM IT, so nothing may change it
  -- between the read and the release.
  SELECT r.event_id, r.credits_debited, r.image_key, r.failed_at
    INTO v_event_id, v_credits, v_image, v_failed
    FROM public.event_renders r
   WHERE r.render_id = p_render_id
     FOR UPDATE;

  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(v_event_id) THEN
    RETURN FALSE;
  END IF;

  -- 🔑 A DELIVERED RENDER IS NOT REFUNDABLE THROUGH THIS DOOR. Without this,
  -- "fail" would be a free-render button for anyone who could call it.
  IF v_image IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- 🔑 IDEMPOTENT. A retry, a double-submit, or a watchdog racing the action
  -- must not refund twice — that mints credits out of one failure.
  IF v_failed IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.event_renders
     SET failed_at       = NOW(),
         failure_reason  = LEFT(COALESCE(p_reason, 'unknown'), 500),
         -- Zeroed so no reader can ever total this row into "credits spent on
         -- images". The amount taken is refunded on the next line; leaving the
         -- figure here as well would double-count it in every audit.
         credits_debited = 0
   WHERE render_id = p_render_id;

  IF COALESCE(v_credits, 0) > 0 THEN
    PERFORM public.moodboard_release_render_credits(v_event_id, v_credits);
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.moodboard_fail_render(UUID, TEXT) IS
  'MB8. Marks a render failed AND releases exactly the credits that row took, '
  'in one transaction — the only way to do either. Refuses on a delivered '
  'render (would be a free-render button) and on an already-failed one '
  '(a second refund mints credits). The refund amount is read from the locked '
  'row, never re-derived from config an admin may have edited since.';

-- ---- 7. consent: the flag and the bonus move together ---------------------

CREATE OR REPLACE FUNCTION public.moodboard_set_share_consent(
  p_event_id  UUID,
  p_consented BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus INTEGER;
BEGIN
  IF p_event_id IS NULL OR p_consented IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(p_event_id) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.event_render_share_consent AS c
    (event_id, consented, consented_at, consented_by_user_id, withdrawn_at)
  VALUES (
    p_event_id,
    p_consented,
    CASE WHEN p_consented THEN NOW() ELSE NULL END,
    CASE WHEN p_consented THEN auth.uid() ELSE NULL END,
    CASE WHEN p_consented THEN NULL ELSE NOW() END
  )
  ON CONFLICT (event_id) DO UPDATE SET
    consented    = p_consented,
    -- Keep the ORIGINAL consented_at when consent is re-given: the audit
    -- question is "when did they first allow this", and a render featured
    -- under the first grant must stay explainable.
    consented_at = CASE
                     WHEN p_consented THEN COALESCE(c.consented_at, NOW())
                     ELSE c.consented_at
                   END,
    consented_by_user_id = CASE
                     WHEN p_consented THEN COALESCE(c.consented_by_user_id, auth.uid())
                     ELSE c.consented_by_user_id
                   END,
    withdrawn_at = CASE WHEN p_consented THEN NULL ELSE NOW() END,
    updated_at   = NOW();

  IF p_consented THEN
    -- +1 RENDER, priced from config rather than written as 1. See the header.
    SELECT credits_per_part INTO v_bonus
      FROM public.moodboard_render_config
     WHERE config_key = 'default' AND is_active;

    IF COALESCE(v_bonus, 0) > 0 THEN
      -- The partial UNIQUE index is what makes this once-per-event. ON
      -- CONFLICT DO NOTHING is the idempotent read of that index — not a
      -- check-then-insert, which two concurrent toggles both pass.
      INSERT INTO public.event_render_credit_grants
        (event_id, credits, source, note)
      VALUES (p_event_id, v_bonus, 'consent_bonus',
              'Bonus render for allowing Setnayan to feature this creation.')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- Withdrawal un-features every render of this event, immediately. Leaving
    -- them featured would keep publishing a creation whose permission has been
    -- taken back — and the couple would have no way to see that it was still
    -- out there. The bonus credit is NOT clawed back: it was earned by a
    -- consent that really was given, and reversing it would make withdrawal
    -- cost money.
    UPDATE public.event_renders
       SET featured_at = NULL, featured_by_user_id = NULL
     WHERE event_id = p_event_id AND featured_at IS NOT NULL;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.moodboard_set_share_consent(UUID, BOOLEAN) IS
  'MB8. Sets the event-level share consent and, on the first YES, grants the '
  '+1 bonus render (credits_per_part, read from config). Once-per-event is '
  'enforced by a partial UNIQUE index, not by a racy check-then-insert. '
  'Withdrawing consent un-features every render of the event but does NOT '
  'claw back the bonus — withdrawal must not cost money.';

-- ---- 8. featured: admin only, and consent-clean by construction -----------

CREATE OR REPLACE FUNCTION public.moodboard_set_render_featured(
  p_render_id UUID,
  p_featured  BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id  UUID;
  v_image     TEXT;
  v_consented BOOLEAN;
BEGIN
  IF p_render_id IS NULL OR p_featured IS NULL THEN
    RETURN FALSE;
  END IF;
  -- Curation is an ADMIN act. Note this is a stricter gate than
  -- moodboard_render_caller_may_act: a couple must never be able to feature
  -- its own creation, and a NULL auth.uid() (server context) is not enough.
  IF NOT public.is_admin() THEN
    RETURN FALSE;
  END IF;

  SELECT r.event_id, r.image_key INTO v_event_id, v_image
    FROM public.event_renders r
   WHERE r.render_id = p_render_id
     FOR UPDATE;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_featured THEN
    -- Nothing to show, nothing to feature.
    IF v_image IS NULL THEN
      RETURN FALSE;
    END IF;

    -- 🔒 THE CONSENT GATE, AND ITS ONLY LOCATION. Owner lock: the featured set
    -- is drawn only from consented creations, so a public gallery turned on
    -- later is already consent-clean with no retroactive consent-chasing.
    -- Refusing HERE — at the write — is why no read anywhere has to remember
    -- to filter. Admin VISIBILITY is deliberately not gated by this; see the
    -- table comment.
    SELECT c.consented INTO v_consented
      FROM public.event_render_share_consent c
     WHERE c.event_id = v_event_id;
    IF COALESCE(v_consented, FALSE) IS NOT TRUE THEN
      RETURN FALSE;
    END IF;

    UPDATE public.event_renders
       SET featured_at = COALESCE(featured_at, NOW()),
           featured_by_user_id = auth.uid()
     WHERE render_id = p_render_id;
  ELSE
    UPDATE public.event_renders
       SET featured_at = NULL, featured_by_user_id = NULL
     WHERE render_id = p_render_id;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.moodboard_set_render_featured(UUID, BOOLEAN) IS
  'MB8. Admin-only featured toggle. REFUSES to feature a render whose event '
  'has not given share consent, and refuses one with no image — so the '
  'featured set is consent-clean by construction and no read path has to '
  'remember to filter. Admin visibility of renders is deliberately NOT gated '
  'by consent (owner lock): consent governs publication, not retention.';

-- ---- 8b. the reuse-pool quarantine handle ---------------------------------
--
-- `event_renders.reusable` is GENERATED and the database refuses every write to
-- it, on purpose. `reuse_blocked` is its one escape hatch: withdraw a single
-- render from the cross-couple reuse pool WITHOUT deleting the couple's own
-- copy of it. MB2 recorded it in tests/db/gates-have-handles.baseline.txt as a
-- gate with no control, and named MB8 as the change that owes one — because
-- MB8 is where the pool first holds anything, and a quarantine switch nobody
-- can reach is the same as no quarantine at all.

CREATE OR REPLACE FUNCTION public.moodboard_set_render_reuse_blocked(
  p_render_id UUID,
  p_blocked   BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_render_id IS NULL OR p_blocked IS NULL THEN
    RETURN FALSE;
  END IF;
  -- Admin only. A couple withdrawing its OWN render from a pool it cannot see
  -- is meaningless, and a couple withdrawing anyone else's is the hole.
  IF NOT public.is_admin() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.event_renders
     SET reuse_blocked = p_blocked
   WHERE render_id = p_render_id;

  -- `reusable` recomputes itself from this: it is GENERATED on
  -- `… AND NOT reuse_blocked`, so there is no second flag to keep in step and
  -- no way for the two to disagree.
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.moodboard_set_render_reuse_blocked(UUID, BOOLEAN) IS
  'MB8. Admin quarantine for the cross-couple render reuse pool. Sets '
  'event_renders.reuse_blocked; `reusable` is GENERATED from it and recomputes '
  'itself, so there is no second flag that can drift. Withdraws a render from '
  'reuse WITHOUT deleting the couple''s own copy.';

-- ---- 9. the admin all-creations read --------------------------------------
--
-- `event_renders`'s member-read policy already lets `is_admin()` see every
-- row, so the admin gallery needs no new policy — but it does need the couple
-- and event NAMES beside each image, and joining `events`/`users` from the
-- client would need those tables' own reads. One function, admin-gated, so the
-- gallery is a single call and the gate lives in one place.
--
-- ⚠ NOT FILTERED BY CONSENT, ON PURPOSE, PER THE LOCK. Every render is
-- returned; `share_consented` is returned ALONGSIDE so the surface can badge
-- what is shareable rather than hide what is not.

CREATE OR REPLACE FUNCTION public.moodboard_admin_all_renders(
  p_limit  INTEGER DEFAULT 200,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  render_id       UUID,
  event_id        UUID,
  event_name      TEXT,
  part_id         TEXT,
  image_key       TEXT,
  note            TEXT,
  credits_debited INTEGER,
  config_digest   TEXT,
  reusable        BOOLEAN,
  reuse_blocked   BOOLEAN,
  featured_at     TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_reason  TEXT,
  share_consented BOOLEAN,
  created_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;                            -- zero rows, and the caller says so
  END IF;

  RETURN QUERY
    SELECT r.render_id,
           r.event_id,
           e.display_name::TEXT,
           r.part_id,
           r.image_key,
           r.note,
           r.credits_debited,
           r.config_digest,
           r.reusable,
           r.reuse_blocked,
           r.featured_at,
           r.failed_at,
           r.failure_reason,
           COALESCE(c.consented, FALSE),
           r.created_at,
           r.completed_at
      FROM public.event_renders r
      JOIN public.events e ON e.event_id = r.event_id
      LEFT JOIN public.event_render_share_consent c ON c.event_id = r.event_id
     ORDER BY r.created_at DESC
     LIMIT GREATEST(LEAST(COALESCE(p_limit, 200), 500), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

COMMENT ON FUNCTION public.moodboard_admin_all_renders(INTEGER, INTEGER) IS
  'MB8. The admin all-creations gallery. Returns EVERY render regardless of '
  'consent (owner lock — this feed is how Setnayan compiles its own content '
  'database), with share_consented returned alongside so the surface can badge '
  'what may be featured instead of hiding what may not. Zero rows to a '
  'non-admin.';

-- ---- 10. grants — REVOKE FIRST, because CREATE FUNCTION already granted ---
--
-- 🛑 `CREATE FUNCTION` GRANTS EXECUTE TO PUBLIC BY DEFAULT AND `anon` INHERITS
-- IT. For these six that is not theoretical: `moodboard_render_caller_may_act`
-- reads a NULL auth.uid() as "the server is asking", which is exactly what an
-- anonymous caller has — so `begin_render` alone would let anyone with curl
-- burn a couple's credits, and `fail_render` would let them refund at will.
-- The REVOKE is what closes it; the GRANT list alone never did. Caught by
-- tests/db/anon-rpc-surface.db.test.ts.
REVOKE ALL ON FUNCTION public.moodboard_begin_render(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_finish_render(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_fail_render(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_set_share_consent(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_set_render_featured(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_set_render_reuse_blocked(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_admin_all_renders(INTEGER, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.moodboard_begin_render(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, TEXT, UUID[])
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_finish_render(UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_fail_render(UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_set_share_consent(UUID, BOOLEAN)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_set_render_featured(UUID, BOOLEAN)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_set_render_reuse_blocked(UUID, BOOLEAN)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_admin_all_renders(INTEGER, INTEGER)
  TO authenticated, service_role;

-- ---- 11. table grants — Supabase's default is wider than this wants -------
--
-- Every new `public` table is granted ALL to `anon` and `authenticated` and
-- published as a REST endpoint. RLS is ROW-level and can never hide a COLUMN,
-- so the capability has to be taken away rather than merely policed.
--
-- ⚠ AND THE POLICY ABOVE SAYS `TO authenticated` FOR THE SAME REASON. A policy
-- with no TO clause is written for PUBLIC, which includes `anon` — revoking
-- anon's grant would otherwise strand a rule nothing could ever fire again
-- (tests/db/anon-table-grants-closed.db.test.ts). The two halves move together.
REVOKE ALL ON TABLE public.event_render_share_consent FROM anon;

-- ---- 12. event_renders: authenticated may READ, and write NOTHING ---------
--
-- 🛑 CAUGHT BY THE EXPOSURE FREEZE, AND IT WAS REAL. MB2 created event_renders
-- with `REVOKE ALL … FROM anon` and stopped there, which left `authenticated`
-- holding Supabase's default INSERT/UPDATE/DELETE on every column, policed only
-- by the couple_insert / couple_update / couple_delete policies. That was inert
-- while nothing read or wrote the table. MB8 is the first writer AND the first
-- reader, so it is MB8 that makes all of the following reachable with nothing
-- but curl, the publishable key and a couple's own login:
--
--   1. `UPDATE event_renders SET featured_at = now()` on their own render —
--      featuring their creation without consent and without an admin, walking
--      straight past moodboard_set_render_featured's whole reason to exist.
--   2. `UPDATE … SET image_key = 'payment-proof/…'`. Renders live in the
--      PRIVATE thread-files bucket, which also holds payment screenshots, and
--      the couple's gallery mints a presigned GET from whatever image_key says.
--      A couple could point their own row at somebody else's bank screenshot
--      and be handed a signed URL for it. RLS restricts which ROW they can
--      touch; it has nothing to say about what they put IN it.
--   3. `UPDATE … SET credits_debited = 0`, or INSERT a finished render row
--      outright — a free render the ledger agrees was free.
--
-- 🔑 RLS IS ROW-LEVEL. It answers "which rows" and never "which values", so a
-- policy can admit a couple to their own row and still let them write a value
-- that means something about somebody else's. The grant is the only thing that
-- can say no here.
--
-- Every legitimate write already goes through a SECURITY DEFINER function
-- (begin / finish / fail / set_featured), exactly as the credit ledger's writes
-- do and for the same reason. So the capability is removed rather than policed.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON TABLE public.event_renders FROM authenticated;

-- ⚠ AND THE POLICIES GO WITH THE GRANT. Leaving couple_insert/update/delete in
-- the catalog after revoking the capability they govern would strand three
-- rules that can never fire again — a reader would take them as evidence that
-- couples write this table, and the next person to "fix" the resulting
-- permission error would restore the grant and silently reopen all three holes
-- above. The repo's own rule: the grant and the policy's audience move
-- together (tests/db/anon-table-grants-closed.db.test.ts makes the same
-- argument for anon).
DROP POLICY IF EXISTS event_renders_couple_insert ON public.event_renders;
DROP POLICY IF EXISTS event_renders_couple_update ON public.event_renders;
DROP POLICY IF EXISTS event_renders_couple_delete ON public.event_renders;

COMMENT ON TABLE public.event_renders IS
  'One row per Mood Board "Make it real" render (MB2 substrate, MB8 pipeline). '
  'READ-ONLY to sessions: members SELECT their event''s rows, and every write '
  'goes through a SECURITY DEFINER function (moodboard_begin_render / '
  'finish_render / fail_render / set_render_featured). Sessions hold no '
  'INSERT/UPDATE/DELETE, because RLS is row-level and cannot stop a couple '
  'admitted to their own row from writing a value about someone else — '
  'image_key in particular addresses the PRIVATE bucket that also holds '
  'payment proofs.';
-- Members READ their own consent state; nobody writes it from a session,
-- because writing it also grants credits.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON TABLE public.event_render_share_consent FROM authenticated;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   -- the weld, in both directions:
--   SELECT public.moodboard_begin_render('<broke-event>','room:ceiling','p',
--            '{}'::jsonb,'v1:abc',1);              -- NULL, and NO row created
--   SELECT count(*) FROM public.event_renders WHERE event_id='<broke-event>';  -- 0
--   INSERT INTO public.event_render_credit_grants (event_id, credits, source)
--        VALUES ('<event>', 50, 'admin');
--   SELECT public.moodboard_begin_render('<event>','room:ceiling','p',
--            '{}'::jsonb,'v1:abc',1);              -- a render_id; used = 1
--   SELECT public.moodboard_fail_render('<that-id>','provider timeout'); -- t
--   SELECT credits_used FROM public.event_render_credit_usage
--    WHERE event_id='<event>';                     -- back to 0
--   SELECT public.moodboard_fail_render('<that-id>','again');            -- f
--   -- consent: +1 once, never twice
--   SELECT public.moodboard_set_share_consent('<event>', TRUE);          -- t
--   SELECT public.moodboard_set_share_consent('<event>', TRUE);          -- t
--   SELECT count(*) FROM public.event_render_credit_grants
--    WHERE event_id='<event>' AND source='consent_bonus';                -- 1
-- ============================================================================
