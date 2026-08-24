-- ═══════════════════════════════════════════════════════════════════════════
-- THE SUPPLIER KEEPS THE CLOCK. THE COUPLE KEEPS THE WORDS.
--
-- Owner, 2026-08-24: keep the clock, throw away the words.
--
-- "Usually responds in 2h" is a PUBLIC badge on every marketplace card, and the
-- vendor's own response rate and median reply time sit behind it. All three are
-- computed from `chat_threads`, which is NOT NULL on `event_id` and CASCADEs —
-- so a couple deleting their celebration silently erased part of a supplier's
-- reputation. Measured 2026-08-24 in a rolled-back transaction against prod:
-- threads 1 → 0, replied 1 → 0.
--
-- ⚖ AND THE OBVIOUS FIX IS THE ONE THE CLASSIFICATION CALLS "THE ONE MOST LIKELY
-- TO BE GOT WRONG IN BOTH DIRECTIONS AT ONCE." Sparing `chat_threads` to save a
-- statistic would hand the supplier the couple's private negotiation forever:
-- their budget, their guest count, what they said about other suppliers, and
-- `agreed_price_centavos`. That is not the supplier's record; it is a two-party
-- conversation the couple is entitled to take with them.
--
-- 🔑 SO THE NUMBER IS PRESERVED WITHOUT THE CONVERSATION. Three timing facts per
-- thread — when the couple asked, when the supplier answered, and whether it was
-- accepted — are copied to a VENDOR-KEYED row with NO foreign key to events, at
-- the only moment they can still be read. The messages go with the celebration.
--
-- ⛔ WHAT IS DELIBERATELY *NOT* COPIED, and none of it is an oversight: message
-- text · the couple's identity · the event id · `pax_at_inquiry` ·
-- `agreed_price_centavos` · `decline_reason` · `compat_reasons`. A row here can
-- answer "how fast does this supplier reply" and nothing else. If a later change
-- needs one of those, that is a new owner decision, not a column to add quietly.
--
-- 🔑 THE PRECEDENT IS `vendor_spotlight_awards`, which the classification names
-- as "the PRECEDENT the other twelve should copy": the criteria are computed
-- from cascading tables, but the VERDICT is snapshotted onto a row keyed only on
-- the vendor, so the award outlives its inputs.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vendor_reply_times (
  reply_time_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id       UUID NOT NULL
                          REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- When the couple opened the conversation (the thread's created_at).
  opened_at               TIMESTAMPTZ NOT NULL,
  -- When the supplier first answered. NULL = they never did, which is a fact the
  -- response RATE needs and the median must exclude.
  first_replied_at        TIMESTAMPTZ,
  -- Did the inquiry reach 'accepted'. The response-rate numerator.
  was_accepted            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Bookkeeping: these rows exist only because a celebration was removed.
  source_event_removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_reply_times_reply_after_open
    CHECK (first_replied_at IS NULL OR first_replied_at >= opened_at)
);

CREATE INDEX IF NOT EXISTS vendor_reply_times_vendor_idx
  ON public.vendor_reply_times (vendor_profile_id);

COMMENT ON TABLE public.vendor_reply_times IS
  'Reply TIMING for conversations whose celebration was deleted — kept so a '
  'supplier''s response rate and median reply time survive, while the messages '
  'go with the event (owner 2026-08-24: "keep the clock, throw away the words"). '
  'Carries no message text, no couple identity and no event id, by design.';

-- ── WHO MAY READ IT ────────────────────────────────────────────────────────
-- 🚨 REVOKE FIRST. Prod carries `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT
-- ALL ON TABLES TO anon, authenticated`, so a NEW table is born fully readable
-- AND writable by the public internet. Only the stats recompute reads this, and
-- it runs as service_role.
-- 🔑 RLS ON WITH NO POLICY READS EMPTY, SILENTLY — that is the intended state
-- here (22 prod tables are already in it), and the REVOKE is what actually
-- closes the door: RLS is row-level and a grant is what PostgREST checks first.
ALTER TABLE public.vendor_reply_times ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_reply_times FROM PUBLIC;
REVOKE ALL ON public.vendor_reply_times FROM anon;
REVOKE ALL ON public.vendor_reply_times FROM authenticated;
GRANT ALL ON public.vendor_reply_times TO service_role;

-- ── THE COPY, AT THE ONLY MOMENT IT CAN BE MADE ────────────────────────────
CREATE OR REPLACE FUNCTION public.keep_reply_clock_on_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  /*
    BEFORE DELETE: `chat_threads` still exists here and will not a moment later.

    One row per thread, timing only. `was_accepted` mirrors what the recompute
    counts today (`inquiry_status = 'accepted'`), so the preserved rows and the
    live ones answer the same question the same way — if they disagreed, a
    supplier's rate would move at deletion time for a reason nobody could see.
  */
  INSERT INTO public.vendor_reply_times
    (vendor_profile_id, opened_at, first_replied_at, was_accepted)
  SELECT t.vendor_profile_id,
         t.created_at,
         t.vendor_first_reply_at,
         (t.inquiry_status = 'accepted')
    FROM public.chat_threads t
   WHERE t.event_id = OLD.event_id;

  RETURN OLD;
END;
$function$;

-- 🔑 A SECURITY DEFINER FUNCTION IS EXECUTABLE BY PUBLIC BY DEFAULT, and a
-- trigger function needs no EXECUTE grant at all.
REVOKE ALL ON FUNCTION public.keep_reply_clock_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.keep_reply_clock_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.keep_reply_clock_on_event_delete() FROM authenticated;

DROP TRIGGER IF EXISTS events_keep_reply_clock_on_delete ON public.events;
CREATE TRIGGER events_keep_reply_clock_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.keep_reply_clock_on_event_delete();
