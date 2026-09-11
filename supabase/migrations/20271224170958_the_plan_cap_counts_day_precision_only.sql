/*
  THE PLAN CAP COUNTS DAY-PRECISION ONLY — a month-only couple never takes a
  real day. Register "FOLLOW-UPS A" item 2 (found by LOCK-PATH 2, 2026-09-11).

  ── THE BUG ────────────────────────────────────────────────────────────────
  A month-only event stores its placeholder in `events.event_date` — the 1st of
  the month — with `event_date_precision = 'month'`. The per-plan
  customers-per-date ceiling (enforce_vendor_whitelist_per_date, counted by
  vendor_whitelist_used_for_date) ignored the precision on BOTH sides:
    · a shop chasing a month-only March couple was counted as busy on 1 March,
      so a Free shop REFUSED a real 1 March couple (replayed by LOCK-PATH 2);
    · and the month-only couple's own accept was capped against that placeholder.
  The two counts beside it already say "a month-only event is never a booking on
  the 1st": service_card_bookings_on (#5441) and vendor_soft_holds_on (#5444).
  This makes the third one agree.

  ── WHAT CHANGES, AND NOTHING ELSE ─────────────────────────────────────────
  Each body below is the LIVE production definition — read 2026-09-11 with
  pg_get_functiondef; md5 of each saved copy equal to md5(pg_get_functiondef)
  on prod — changed in exactly these lines (line-hash diff in the PR):
    vendor_whitelist_used_for_date     + AND e.event_date_precision = 'day'
    enforce_vendor_whitelist_per_date  + v_precision; the event read takes the
                                         precision; a non-day event returns NEW
    vendor_whitelist_pressure          the same, so the screen never shows a
                                         cap the trigger would not apply
  Grants and comments persist through CREATE OR REPLACE; the count's comment is
  re-stated below only to say "day-precise".

  🔢 Prod 2026-09-11 (read-only): vendor_tier_pipeline_caps_enabled = TRUE, so the
  ceiling is live. Events carrying a date: 4 day-precise (1 with an accepted
  thread) and 1 at 'year' (none accepted). Nothing in flight changes. The switch
  itself is untouched.

  ⚠ `event_date_precision` DEFAULTS TO 'year'. An event with a date and no
  precision is not a day-precise event and is not capped — which is how the two
  sibling counts already treat it, and how the product stores a year-only plan.

  Guard: apps/web/tests/db/the-plan-cap-counts-day-precision-only.db.test.ts
*/

CREATE OR REPLACE FUNCTION public.vendor_whitelist_used_for_date(p_vendor_profile_id uuid, p_date date, p_exclude_thread_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Live whitelist for this vendor on this DATE: accepted threads whose event
  -- is not yet locked in with them. Same predicate the vendor's own "Inquiring"
  -- list uses (clients/surface.tsx: accepted && not booked).
  SELECT COUNT(*)::int
    FROM public.chat_threads t
    JOIN public.events e ON e.event_id = t.event_id
   WHERE t.vendor_profile_id = p_vendor_profile_id
     AND (p_exclude_thread_id IS NULL OR t.thread_id <> p_exclude_thread_id)
     AND t.inquiry_status = 'accepted'::public.chat_inquiry_status
     AND e.event_date = p_date
     AND e.event_date_precision = 'day'
     AND NOT EXISTS (
       SELECT 1 FROM public.event_vendors ev
        WHERE ev.marketplace_vendor_id = p_vendor_profile_id
          AND ev.event_id = t.event_id
          AND ev.status IN (
                'deposit_paid'::public.vendor_status,
                'delivered'::public.vendor_status,
                'complete'::public.vendor_status
              )
     );
$function$;

CREATE OR REPLACE FUNCTION public.enforce_vendor_whitelist_per_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled   BOOLEAN;
  v_tier      TEXT;
  v_cap       INT;
  v_date      DATE;
  v_precision TEXT;
  v_count     INT;
  v_unlimited BOOLEAN;
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
  -- new candidate and must never be refused. This is also why the whitelist
  -- half needs no grandfather clause: a customer already being chased is never
  -- re-counted, so switching the ceilings on cannot disturb work in flight.
  IF TG_OP = 'UPDATE'
     AND OLD.inquiry_status = 'accepted'::public.chat_inquiry_status THEN
    RETURN NEW;
  END IF;
  IF NEW.vendor_profile_id IS NULL OR NEW.event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.event_date, e.event_date_precision INTO v_date, v_precision FROM public.events e WHERE e.event_id = NEW.event_id;
  -- No date chosen yet => nothing to scope a per-date cap to. Accept freely; the
  -- cap re-applies to any later accept once the couple picks their day.
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  v_cap := public.vendor_tier_limit(v_tier, 'whitelist_per_date');
  IF v_cap IS NULL THEN
    RETURN NEW;  -- unknown key can never silently block a vendor inbox
  END IF;

  -- Bought the ceiling away (owner 2026-08-29, ₱2,500 flat). Asked AFTER the cap
  -- is resolved and BEFORE the count is taken: it is the only branch that can
  -- skip the count entirely, and an unlimited shop should not pay for the query.
  v_unlimited := public.vendor_pipeline_is_unlimited(NEW.vendor_profile_id);
  IF COALESCE(v_unlimited, FALSE) THEN
    RETURN NEW;
  END IF;

  v_count := public.vendor_whitelist_used_for_date(
    NEW.vendor_profile_id, v_date, NEW.thread_id
  );

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      'WHITELIST_DATE_LIMIT: this plan lets you pursue % client(s) at a time for % (currently %)',
      v_cap, to_char(v_date, 'DD Mon YYYY'), v_count
      USING ERRCODE = 'check_violation',
            HINT = 'Lock one of them in, or decline someone, to free a slot - or upgrade for more.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vendor_whitelist_pressure(p_thread_id uuid)
 RETURNS TABLE(used integer, cap integer, event_date date, enforced boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_ids UUID[];
  v_vendor      UUID;
  v_event       UUID;
  v_date        DATE;
  v_precision   TEXT;
  v_tier        TEXT;
  v_cap         INT;
  v_enabled     BOOLEAN;
BEGIN
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RETURN;  -- not a vendor -> no rows, and the caller draws nothing
  END IF;

  SELECT t.vendor_profile_id, t.event_id
    INTO v_vendor, v_event
    FROM public.chat_threads t
   WHERE t.thread_id = p_thread_id
     AND t.vendor_profile_id = ANY(v_profile_ids);
  IF v_vendor IS NULL OR v_event IS NULL THEN
    RETURN;  -- not this caller thread -> no rows
  END IF;

  -- Bought the ceiling away: there is nothing to count down to, so the screen
  -- draws nothing at all rather than a number that will never bind.
  IF public.vendor_pipeline_is_unlimited(v_vendor) THEN
    RETURN;
  END IF;

  SELECT e.event_date, e.event_date_precision INTO v_date, v_precision FROM public.events e WHERE e.event_id = v_event;
  IF v_date IS NULL OR v_precision IS DISTINCT FROM 'day' THEN
    RETURN;  -- no date chosen yet: the ceiling has nothing to scope to, and the
             -- trigger accepts freely, so the screen must promise nothing.
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_vendor;
  v_cap := public.vendor_tier_limit(v_tier, 'whitelist_per_date');
  IF v_cap IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;

  RETURN QUERY SELECT
    public.vendor_whitelist_used_for_date(v_vendor, v_date, p_thread_id),
    v_cap,
    v_date,
    COALESCE(v_enabled, FALSE);
END;
$function$;

COMMENT ON FUNCTION public.vendor_whitelist_used_for_date(UUID, DATE, UUID) IS
  'How many accepted-but-not-yet-locked customers a vendor currently holds for ONE '
  'DAY-PRECISE date — a month-only event is never counted on its placeholder 1st '
  '(20271224170958). The SINGLE definition of the whitelist count: called by '
  'enforce_vendor_whitelist_per_date() (which refuses on it) and by '
  'vendor_whitelist_pressure() (which shows it). Takes a vendor_profile_id and is '
  'therefore NOT granted to any user role — it would report another shop pipeline '
  'depth. Reach it through vendor_whitelist_pressure(), which scopes to the caller '
  'own shops.';
