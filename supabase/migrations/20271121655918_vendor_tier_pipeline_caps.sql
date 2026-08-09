-- vendor_tier_pipeline_caps
-- ============================================================================
-- OWNER 2026-08-09 — per-tier limits on the two vendor pipeline lists:
--
--            WHITELIST (per date)   WAITLIST (per date)
--   FREE            1                     0
--   SOLO            3                     1
--   PRO             5                     3
--   ENTERPRISE     10                     5
--
-- VOCABULARY — the two words look alike and mean different things. Owner-
-- confirmed 2026-08-09, matching Service_Schedule_and_Quotation_Flow_2026-06-02
-- § T1.1:
--   • WHITELIST = the vendor's ACCEPTED-BUT-NOT-YET-LOCKED customers for a date.
--     Pending demand — live candidates they are still pursuing. Informational;
--     it does NOT block the date. In code: a `chat_threads` row at
--     inquiry_status='accepted' whose event has no live booking with them.
--   • WAITLIST = couples QUEUED on a date that is already taken
--     (`vendor_date_waitlist`), of whom the vendor may pick N.
--   ⚠ NOT the `vendor_calendar_day_states.day_state='whitelist'` approve-first
--     DAY STATE, which shares the word and is a different feature entirely.
--     That day state is NOT capped here.
--
-- 🔑 ONE SOURCE FOR THE NUMBERS, NOT TWO HAND-TYPED COPIES. The grid also lives
-- in `apps/web/lib/vendor-tier-caps.ts` (TIER_CAPS, the code SSOT). Rather than
-- trust two hand-maintained lists to agree — a guard comparing two hand-typed
-- things is not a guard — `tests/db/vendor-tier-pipeline-caps.db.test.ts`
-- DERIVES its expectations from the TypeScript matrix and interrogates
-- `vendor_tier_limit()` for every tier × key. Editing one side alone fails CI.
--
-- SHIP-DARK, exactly as the two existing tier gates do
-- (`platform_settings.free_tier_booking_cap_enabled` · `VENDOR_TIER_FEATURE_GATE`):
-- gated on `platform_settings.vendor_tier_pipeline_caps_enabled`, DEFAULT FALSE.
-- ⚠ WHY THIS MATTERS HERE MORE THAN USUAL: every vendor in prod today is
-- `tier_state='free'` (2 shops, both hidden), so switching this on now would cap
-- the owner's own test vendors at ONE live candidate per date. It also brushes
-- against the 2026-07-24 lock *"your inbox is never locked — every vendor can
-- receive AND answer inquiries with no tier wall"*: this cap is per-DATE pipeline
-- depth, not inbox access (a capped vendor still answers every other date, and
-- frees a slot by declining someone — the § T1.4 decline-the-others-first rule),
-- but at FREE=1 the second couple asking about the SAME date cannot be accepted
-- until one is dropped. Flagged for the owner rather than silently shipped hot.
--
-- Enforced in the DATABASE, not app code: the accept path is reachable from the
-- vendor inbox, the admin demo-vendor console and any future surface, and a
-- per-date count is racy client-side.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE · DROP TRIGGER IF
-- EXISTS then CREATE. Additive; no RLS change (functions are SECURITY DEFINER).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. The ship-dark switch. Mirrors free_tier_booking_cap_enabled exactly.
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS vendor_tier_pipeline_caps_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.platform_settings.vendor_tier_pipeline_caps_enabled IS
  'Owner 2026-08-09. Master switch for the per-tier whitelist (accepted-not-locked customers per date) + waitlist (queued couples per date) caps. DEFAULT FALSE because every prod vendor is tier_state=free today and FREE=1 would cap the founder''s own test vendors. Flip with: UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = TRUE WHERE id = 1;';

-- ----------------------------------------------------------------------------
-- 1. vendor_tier_limit — the grid, as data rather than an if-ladder so the
--    parity test can enumerate it.
--
--    `verified` is the legacy free tier: it takes the FREE numbers so the
--    ladder stays monotonic (free <= verified <= solo), which the existing
--    tier tests require. `custom` runs as Enterprise by owner rule, so it
--    clones Enterprise — keep the two in lockstep on any Enterprise edit.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 1
        WHEN 'verified'   THEN 1
        WHEN 'solo'       THEN 3
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 10
        WHEN 'custom'     THEN 10
        ELSE 1                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 0
        WHEN 'solo'       THEN 1
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 5
        WHEN 'custom'     THEN 5
        ELSE 0
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
  END;
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Owner-set per-tier pipeline limits (2026-08-09). Keys: whitelist_per_date (accepted-but-not-yet-locked customers a vendor may hold for ONE date) · waitlist_acceptances (couples they may accept off the waitlist for one date). Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; the two are held in step by tests/db/vendor-tier-pipeline-caps.db.test.ts, which derives from the TS side. An unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap.';

-- No `authenticated` grant: the UI reads the grid from the TypeScript matrix,
-- and both triggers are SECURITY DEFINER (they run as the owner). Nothing a
-- signed-in role does needs to call this, so it stays off the exposed surface —
-- the exposure-freeze guard caught the reflexive `TO authenticated` here, as it
-- did on the sibling PR the same day.
REVOKE ALL ON FUNCTION public.vendor_tier_limit(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_tier_limit(text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. WHITELIST CAP — how many accepted-not-locked customers on one date.
--
--    Fires as the thread reaches 'accepted' (the vendor's answer). A thread
--    LEAVING accepted, or its event getting booked, frees the slot by itself —
--    the count is derived every time, never stored, so it cannot go stale.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_vendor_whitelist_per_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_tier    TEXT;
  v_cap     INT;
  v_date    DATE;
  v_count   INT;
BEGIN
  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  IF NEW.inquiry_status IS DISTINCT FROM 'accepted'::public.chat_inquiry_status THEN
    RETURN NEW;
  END IF;
  -- Only the transition INTO accepted; re-saving an accepted thread is not a
  -- new candidate and must never be refused.
  IF TG_OP = 'UPDATE'
     AND OLD.inquiry_status = 'accepted'::public.chat_inquiry_status THEN
    RETURN NEW;
  END IF;
  IF NEW.vendor_profile_id IS NULL OR NEW.event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.event_date INTO v_date FROM public.events e WHERE e.event_id = NEW.event_id;
  -- No date chosen yet ⇒ nothing to scope a per-date cap to. Accept freely; the
  -- cap re-applies to any later accept once the couple picks their day.
  IF v_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  v_cap := public.vendor_tier_limit(v_tier, 'whitelist_per_date');
  IF v_cap IS NULL THEN
    RETURN NEW;  -- unknown key can never silently block a vendor's inbox
  END IF;

  -- Live whitelist for this vendor on this DATE: accepted threads whose event
  -- is not yet locked in with them. Same predicate the vendor's own "Inquiring"
  -- list uses (clients/surface.tsx: accepted && not booked).
  SELECT COUNT(*) INTO v_count
    FROM public.chat_threads t
    JOIN public.events e ON e.event_id = t.event_id
   WHERE t.vendor_profile_id = NEW.vendor_profile_id
     AND t.thread_id <> NEW.thread_id
     AND t.inquiry_status = 'accepted'::public.chat_inquiry_status
     AND e.event_date = v_date
     AND NOT EXISTS (
       SELECT 1 FROM public.event_vendors ev
        WHERE ev.marketplace_vendor_id = NEW.vendor_profile_id
          AND ev.event_id = t.event_id
          AND ev.status IN (
                'deposit_paid'::public.vendor_status,
                'delivered'::public.vendor_status,
                'complete'::public.vendor_status
              )
     );

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      'WHITELIST_DATE_LIMIT: this plan lets you pursue % client(s) at a time for % (currently %)',
      v_cap, to_char(v_date, 'DD Mon YYYY'), v_count
      USING ERRCODE = 'check_violation',
            HINT = 'Lock one of them in, or decline someone, to free a slot — or upgrade for more.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_threads_whitelist_per_date ON public.chat_threads;
CREATE TRIGGER chat_threads_whitelist_per_date
  BEFORE INSERT OR UPDATE OF inquiry_status ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_whitelist_per_date();

-- ----------------------------------------------------------------------------
-- 3. WAITLIST CAP — how many queued couples a vendor may accept for one date.
--
--    The existing per-vendor setting was CHECK 1..3; the owner's grid needs
--    0 (Free: no waitlist at all) through 5 (Enterprise). Widen the CHECK to
--    0..10 so the TIER is the ceiling, not a column constraint that would have
--    to be re-typed every time the grid moves.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_max_waitlist_1_3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_max_waitlist_0_10'
  ) THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_max_waitlist_0_10
      CHECK (max_waitlist_acceptances BETWEEN 0 AND 10);
  END IF;
END $$;

-- CLAMP rather than RAISE: a vendor who downgrades should quietly land on their
-- new plan's number, not be locked out of saving their own settings page.
CREATE OR REPLACE FUNCTION public.clamp_vendor_waitlist_to_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_cap     INT;
BEGIN
  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  v_cap := public.vendor_tier_limit(NEW.tier_state::text, 'waitlist_acceptances');
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_cap = 0 THEN
    -- No waitlist on this plan at all: the switch cannot be left on, and the
    -- number goes to 0 so nothing downstream reads a stale 1..3 and offers a
    -- CTA the vendor's plan does not include.
    NEW.waitlist_enabled := FALSE;
    NEW.max_waitlist_acceptances := 0;
  ELSIF NEW.max_waitlist_acceptances > v_cap THEN
    NEW.max_waitlist_acceptances := v_cap;
  ELSIF NEW.max_waitlist_acceptances < 1 THEN
    -- A plan that HAS a waitlist always accepts at least one.
    NEW.max_waitlist_acceptances := 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_profiles_clamp_waitlist_to_tier ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_clamp_waitlist_to_tier
  BEFORE INSERT OR UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.clamp_vendor_waitlist_to_tier();

COMMENT ON FUNCTION public.clamp_vendor_waitlist_to_tier() IS
  'Holds vendor_profiles.waitlist_enabled + max_waitlist_acceptances inside the tier ceiling from vendor_tier_limit(). CLAMPS rather than raises so a downgraded vendor can still save their settings page. Inert until platform_settings.vendor_tier_pipeline_caps_enabled.';

-- ----------------------------------------------------------------------------
-- 4. 🚨 SOLO AND CUSTOM WERE MISSING FROM THE SQL TIER LADDER — found while
--    testing the above, fixed here because per-tier caps are meaningless if a
--    vendor cannot be put on the tier.
--
--    `vendor_tier_rank` enumerated only free · verified · pro · enterprise and
--    sent everything else to `ELSE 0`. The enum has SIX values. So:
--      • solo ranked 0, BELOW free's 1 ⇒ guard_vendor_tier_no_silent_downgrade
--        read free → solo as a DOWNGRADE and RAISED. **A free vendor could not
--        be moved onto Solo at all** — the first paid step on the ladder, and
--        the one every new subscriber takes.
--      • custom ranked 0 too ⇒ enterprise → custom blocked as a "downgrade",
--        while custom → free was never blocked at all (0 >= 0).
--
--    Latent, not live: the guard fires only on a tier CHANGE and prod has sold
--    no subscriptions (every vendor is `free`). It would have bitten on the
--    first Solo purchase — nothing thrown until then, nothing logged, CI green.
--
--    🔑 The ELSE-0 default was written to be safe ("a NEW tier can never be
--    silently outranked by pro") and did the exact opposite for the two tiers
--    that already existed: it silently ranked REAL tiers below free. A default
--    that swallows known values is not a safety net, it is a hiding place.
--    The ladder now matches TIER_RANK in lib/vendor-tier-caps.ts one-for-one,
--    and the db test asserts that pairing rather than trusting two lists.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_tier_rank(p_tier public.vendor_tier_state)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  -- Mirrors TIER_RANK in apps/web/lib/vendor-tier-caps.ts (free 0 … custom 5),
  -- shifted by one so 0 stays reserved for "unrecognised". Every value of the
  -- vendor_tier_state enum is named explicitly; ELSE is for a value added to
  -- the enum WITHOUT being added here, which then ranks lowest and therefore
  -- fails CLOSED (moving to it reads as a downgrade and is refused).
  SELECT CASE p_tier
           WHEN 'free'       THEN 1
           WHEN 'verified'   THEN 2
           WHEN 'solo'       THEN 3
           WHEN 'pro'        THEN 4
           WHEN 'enterprise' THEN 5
           WHEN 'custom'     THEN 6
           ELSE 0
         END;
$$;

COMMENT ON FUNCTION public.vendor_tier_rank(public.vendor_tier_state) IS
  'Vendor value ladder, mirroring TIER_RANK in apps/web/lib/vendor-tier-caps.ts. Fixed 2026-08-09: solo and custom were absent and fell to ELSE 0, ranking them BELOW free — which made guard_vendor_tier_no_silent_downgrade refuse the free→solo upgrade outright. Held in step with the TypeScript ladder by tests/db/vendor-tier-pipeline-caps.db.test.ts.';

COMMIT;
