-- ════════════════════════════════════════════════════════════════════════════
-- THE OWNER SETS WHICH BAND EACH KIND OF CELEBRATION PAYS
--
-- ⚖ OWNER RULING 2026-08-28: *"we want to be able to set all events accordingly.
-- a price and a checkbox. If a checkbox is checked, it should not show to the
-- other prices. For start set the checkbox accordingly to the price they are
-- assigned to."*
--
-- Setnayan AI is ONE product with FIVE prices, and which price a couple pays is
-- decided by the kind of celebration they are planning. That assignment was
-- product config living in code, in TWO places:
--   • AI_TIER_BY_EVENT_TYPE in apps/web/lib/setnayan-ai-type-pricing.ts
--   • public.setnayan_ai_price_tier() below
-- so moving one celebration to a different band was a deploy. It is now a
-- column the admin screen writes.
--
-- 🔑 THE ASSIGNMENT IS NOT A PRICE. The AMOUNTS stay in
-- platform_retail_catalog_v2 (owner rule: prices are catalog-authoritative).
-- This migration moves only "which band is this kind in".
--
-- ⚠ `wake` IS SEEDED NULL ON PURPOSE — THIS IS THE POINT OF THE WHOLE SCREEN.
-- Sixteen kinds were given a band deliberately. The seventeenth, a wake, was
-- added to the product in August and NEVER given one: the TS map lists it as
-- 'C' with a comment saying so, and the SQL function below never mentioned it
-- at all, so it lands on the ELSE branch. Both arrive at ₱899 and NOBODY CHOSE
-- ₱899. Seeding it NULL records the truth — "no band has been chosen" — and the
-- admin screen renders it in a tray that asks the question out loud, instead of
-- a silent default that looks like a decision.
--
-- 🔑 NOTHING IS RE-PRICED BY THIS. A NULL assignment still resolves to 'C'
-- through the same COALESCE fallback the code has always used, so a wake is
-- charged exactly what it was charged yesterday. What changes is that the
-- screen can now tell a CHOICE from a LEFTOVER — and so can the next event type
-- somebody adds, which would otherwise start being sold at the middle price
-- with nothing anywhere saying so.
--
-- ⚠ VOLATILITY: public.setnayan_ai_price_tier() changes IMMUTABLE → STABLE. It
-- reads a table now, and an IMMUTABLE marker would let Postgres fold a stale
-- band into an already-planned statement.
-- MEASURED IN PRODUCTION BEFORE CHANGING IT (njrupjnvkjkitfctetvi, 2026-08-28):
--   • no index expression mentions it        (0 rows)
--   • no column default / generated column   (0 rows)
--   • no CHECK constraint                    (0 rows)
--   • no materialized view                   (0 rows)
-- Its one caller is guard_events_ai_price_tier(), a plpgsql trigger body, which
-- STABLE serves exactly as well.
--
-- 🔒 THE SEC-5 GUARD IS UNTOUCHED AND STAYS EXACTLY AS STRONG. That trigger
-- refuses a host re-pricing their own event by editing `event_type` after money
-- is committed. It calls this function, so it keeps working — and because an
-- unassigned type still resolves to 'C' rather than to NULL, a couple still
-- cannot dodge the guard by moving to a type nobody has banded yet. That
-- property is asserted below.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS · seed is WHERE ai_price_tier IS NULL
-- and named-type-scoped, so a re-run cannot overwrite an owner's later choice).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Where a kind's band lives now ────────────────────────────────────────
-- NULL is a real, meaningful state: "no band chosen". It is not the same as C.
ALTER TABLE public.event_type_vocab
  ADD COLUMN IF NOT EXISTS ai_price_tier TEXT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_type_vocab_ai_price_tier_check'
      AND conrelid = 'public.event_type_vocab'::regclass
  ) THEN
    ALTER TABLE public.event_type_vocab
      ADD CONSTRAINT event_type_vocab_ai_price_tier_check
      CHECK (ai_price_tier IS NULL OR ai_price_tier IN ('A','B','C','D','E'));
  END IF;
END $$;

-- ⚠ A NEW COLUMN INHERITS THE TABLE'S GRANTS, AND THIS TABLE'S ARE WIDE.
-- Measured in production before writing this: `event_type_vocab` grants BOTH
-- anon AND authenticated the full set — SELECT, INSERT, UPDATE, DELETE,
-- TRUNCATE — at TABLE level. Writes are refused today only by the RLS policy
-- `event_type_vocab_admin_write`; the GRANT has never been the thing holding
-- that door. So this column was born carrying anon INSERT + UPDATE, and the
-- exposure-freeze guard caught it.
--
-- 🔑 THAT MATTERS MORE FOR THIS COLUMN THAN FOR ITS NEIGHBOURS. The rest of this
-- table is vocabulary — a label, an emoji, a sort order. `ai_price_tier` decides
-- WHAT A CUSTOMER IS QUOTED: flipping one row re-prices Setnayan AI for every
-- celebration of that kind. A pricing control should not sit behind RLS alone
-- when the grant costs nothing to remove.
--
-- COST OF REMOVING IT: zero. The only writer is the admin action
-- `setEventTypeBand`, which goes through `createAdminClient()` (service_role),
-- and service_role bypasses column grants entirely.
--
-- SELECT is deliberately KEPT: the table is public vocabulary, read with
-- `select('*')` in places, and revoking SELECT would make those reads fail
-- rather than merely hide a value. The band is not a secret — it resolves to a
-- price that is published anyway.
--
-- 🪤 AND THE OBVIOUS FORM OF THIS REVOKE IS INERT. Writing
--     REVOKE INSERT (ai_price_tier), UPDATE (ai_price_tier) FROM anon, ...
-- changes NOTHING while a TABLE-level INSERT/UPDATE grant stands: the table
-- grant confers the privilege on every column, and a column-level revoke cannot
-- subtract from it. That exact mistake is already written down in this repo's
-- own notes, and it was made here first — the exposure guard reported the
-- column still carrying anon=SIU after the column-level revoke had "succeeded".
-- ⇒ IT MUST BE REVOKED AT TABLE LEVEL. Verified safe before doing so: every
-- writer of this table — /admin/taxonomy, /admin/event-types,
-- lib/event-types-mutations.ts and the new band action — goes through
-- `createAdminClient()` (service_role), which is untouched below. RLS already
-- refused these writes via `event_type_vocab_admin_write`; the grant was never
-- what held the door. TRUNCATE is the one that matters most: RLS is NEVER
-- consulted for TRUNCATE, so "there are no write policies for them" was never
-- sufficient reasoning for leaving it granted.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.event_type_vocab FROM anon, authenticated;

COMMENT ON COLUMN public.event_type_vocab.ai_price_tier IS
  'Which Setnayan AI price band this kind of celebration pays (A-E), set by the owner at /admin/pricing -> Setnayan AI prices. NULL means NO BAND HAS BEEN CHOSEN - it is deliberately NOT the same as C: an unassigned kind still resolves to C through setnayan_ai_price_tier()''s fallback, but the admin screen shows it as unanswered so a silent default can never pass for a decision. The AMOUNTS live in platform_retail_catalog_v2; this column is classification only.';

-- ── 2) Seed from what is live today — the sixteen deliberate assignments ────
-- Read out of apps/web/lib/setnayan-ai-type-pricing.ts (AI_TIER_BY_EVENT_TYPE)
-- and public.setnayan_ai_price_tier(), which agree on all sixteen.
--
-- ⚠ `wake` IS ABSENT FROM THIS LIST ON PURPOSE. See the header.
-- ⚠ `WHERE ai_price_tier IS NULL` so a re-run never overwrites a later choice.
UPDATE public.event_type_vocab v
   SET ai_price_tier = s.tier, updated_at = NOW()
  FROM (VALUES
    ('wedding','A'),
    ('debut','B'), ('corporate','B'), ('gala_night','B'),
    ('christening','C'), ('birthday','C'), ('celebration','C'), ('travel','C'),
    ('anniversary','C'), ('graduation','C'), ('reunion','C'),
    ('tournament','D'), ('gender_reveal','D'), ('date','D'), ('hangout','D'),
    ('simple_event','E')
  ) AS s(event_type, tier)
 WHERE v.event_type = s.event_type
   AND v.ai_price_tier IS NULL;

-- ── 3) The classifier, now reading the column ───────────────────────────────
-- Same contract as before: type → band, never a price. The ELSE 'C' fallback is
-- PRESERVED EXACTLY, and it is now reached in two ways — an unknown type, or a
-- known type with no band chosen. Both must stay safe: a brand-new type is
-- neither over- nor under-charged, and neither can be used to dodge the SEC-5
-- guard.
CREATE OR REPLACE FUNCTION public.setnayan_ai_price_tier(p_event_type TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE                              -- ← was IMMUTABLE; it reads a table now.
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT v.ai_price_tier
       FROM public.event_type_vocab v
      WHERE v.event_type = p_event_type
        AND v.ai_price_tier IS NOT NULL),
    'C'                             -- the safe middle — AI_TIER_DEFAULT.
  );
$$;

COMMENT ON FUNCTION public.setnayan_ai_price_tier(TEXT) IS
  'Setnayan AI price band (A-E) for an event type. Reads '
  'event_type_vocab.ai_price_tier, the owner-set assignment; falls back to C '
  '(AI_TIER_DEFAULT) for an unknown type OR a type with no band chosen, so an '
  'unbanded kind can never be used to dodge the SEC-5 tier-crossing guard. '
  'Mirror of AI_TIER_BY_EVENT_TYPE in apps/web/lib/setnayan-ai-type-pricing.ts; '
  'parity asserted by tests/db/setnayan-ai-tier-lock.db.test.ts. Classification '
  'only - the amounts live in platform_retail_catalog_v2. STABLE, not '
  'IMMUTABLE, because it reads a table.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- POST-CONDITIONS — nothing may be re-priced by this migration.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  bad      TEXT[] := ARRAY[]::TEXT[];
  v_seeded INT;
  v_null   INT;
  r        RECORD;
BEGIN
  -- Every band the code assigns must survive the move, kind by kind. This is
  -- the assertion that makes "nothing is re-priced" a measurement rather than a
  -- claim.
  FOR r IN
    SELECT * FROM (VALUES
      ('wedding','A'),
      ('debut','B'), ('corporate','B'), ('gala_night','B'),
      ('christening','C'), ('birthday','C'), ('celebration','C'), ('travel','C'),
      ('anniversary','C'), ('graduation','C'), ('reunion','C'),
      ('tournament','D'), ('gender_reveal','D'), ('date','D'), ('hangout','D'),
      ('simple_event','E')
    ) AS s(event_type, tier)
  LOOP
    IF public.setnayan_ai_price_tier(r.event_type) <> r.tier THEN
      bad := array_append(bad, format('%s resolves to %s, want %s',
        r.event_type, public.setnayan_ai_price_tier(r.event_type), r.tier));
    END IF;
  END LOOP;

  SELECT count(*) INTO v_seeded FROM public.event_type_vocab WHERE ai_price_tier IS NOT NULL;
  IF v_seeded <> 16 THEN
    bad := array_append(bad, format('%s kinds carry a band, want exactly 16', v_seeded));
  END IF;

  -- The wake must be the ONE unassigned kind, and must still price at C so the
  -- family is charged exactly what they were charged yesterday.
  SELECT count(*) INTO v_null FROM public.event_type_vocab WHERE ai_price_tier IS NULL;
  IF v_null <> 1 THEN
    bad := array_append(bad, format('%s kinds are unassigned, want exactly 1 (the wake)', v_null));
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_type_vocab
              WHERE event_type = 'wake' AND ai_price_tier IS NOT NULL) THEN
    bad := array_append(bad, 'the wake was given a band — that is the owner''s call, not this migration''s');
  END IF;
  IF public.setnayan_ai_price_tier('wake') <> 'C' THEN
    bad := array_append(bad, 'the wake no longer prices at C — this migration re-priced a live kind');
  END IF;

  -- An unknown type still falls to the safe middle, so SEC-5 cannot be dodged.
  IF public.setnayan_ai_price_tier('a_type_nobody_has_added_yet') <> 'C' THEN
    bad := array_append(bad, 'an unknown type no longer falls back to C');
  END IF;
  IF public.setnayan_ai_price_tier(NULL) <> 'C' THEN
    bad := array_append(bad, 'a NULL type no longer falls back to C');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ai band assignment post-condition failed: %',
      array_to_string(bad, ' | ');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION:
--   SELECT event_type, ai_price_tier FROM public.event_type_vocab ORDER BY sort_order;
--     -- → 16 rows with a band · `wake` NULL
--   SELECT public.setnayan_ai_price_tier('wake');      -- → C  (unchanged)
--   SELECT public.setnayan_ai_price_tier('wedding');   -- → A  (unchanged)
--   SELECT provolatile FROM pg_proc WHERE proname = 'setnayan_ai_price_tier';  -- → s
-- ════════════════════════════════════════════════════════════════════════════
