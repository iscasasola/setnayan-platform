-- vendor_claim_locked_qr — the (d0) date finalize must advance the PRECISION too
-- ============================================================================
-- THE DEFECT
--   The (d0) block added in 20270426215000 writes the vendor's contracted date
--   into `events.event_date` and clears the candidate set / window / mode:
--
--       UPDATE public.events
--          SET event_date = t.event_date, date_candidates = NULL, ...
--
--   It never touches `events.event_date_precision`. New events default that
--   column to 'year' (create-event/actions.ts), so this writer lands a real
--   calendar day while the precision still says "sometime that year" — and
--   countdown maths only runs at 'day' (`apps/web/lib/progress-stages.ts`:
--   "events.event_date_precision — countdown math only applies at 'day'").
--   An event dated by a vendor's Locked QR was therefore skipped by everything
--   that counts down, and `progress-stages` filed it under "Lock your exact
--   date — narrowed, not final" for a date the couple had just signed a
--   contract on.
--
--   SAME SIGNATURE, SECOND WRITER. This is the bug fixed on 2026-07-30 for
--   `studio/save-the-date/actions.ts` (see the long comment at its
--   `event_date: filmDate` backfill). That fix's own note claimed it was "the
--   only `events.event_date` writer that didn't set precision alongside it".
--   It was not — it was the only TYPESCRIPT one. This is the plpgsql sibling,
--   and it is exactly the class of miss 20271031571953 named: fixing the
--   instance in front of you and not asking whether it had siblings.
--
-- ---------------------------------------------------------------------------
-- IS 'day' ALWAYS THE HONEST PRECISION HERE?  — asked, and answered YES
-- ---------------------------------------------------------------------------
--   This is the question that matters, because writing 'day' for a date nobody
--   committed to would be a LIE IN THE OTHER DIRECTION: it would switch ON
--   countdown maths and (via sync_event_date_status_trg) promote date_status to
--   'locked' for a guess. `events.event_date` genuinely does carry placeholders
--   — in year/month modes `updateEventDate` stores a first-of-range value — so
--   "it's a DATE column, therefore it's a day" is NOT sufficient. Four
--   independent checks say the token's date is never such a placeholder:
--
--   1. TYPE + PROVENANCE. `t` is `vendor_locked_qr_tokens%ROWTYPE`;
--      `event_date DATE` was added by 20270426214000 and is written from
--      exactly ONE place — `vendor-dashboard/invite/actions.ts`, which parses
--      it with /^\d{4}-\d{2}-\d{2}$/ + Date.parse. No other writer exists (the
--      table has no other UPDATE path in `apps/web`), and the column has no
--      companion precision/mode column to be vague WITH.
--
--   2. THE UI CANNOT EXPRESS VAGUENESS. `locked-qr-generator.tsx` renders a
--      single `<input type="date" required min={today}>`. There is no year /
--      month / "not sure yet" mode anywhere in the generator — unlike the
--      couple's own date-selection surface, which is where placeholders come
--      from.
--
--   3. IT IS VALIDATED AS A SINGLE CALENDAR DAY, SERVER-SIDE. The issue action
--      resolves the vendor's calendar for that ONE day
--      (`getVendorAvailableDays(supabase, vendorProfileId, bookDate, bookDate)`)
--      and refuses to issue if the vendor is not free on it (`date_unavailable`).
--      A vague "sometime in 2027" cannot pass a single-day availability check.
--      Every installment due-date is likewise range-checked `today <= d <=
--      eventDate`.
--
--   4. THE PRODUCT MEANING IS A COMMITMENT, STATED IN THREE PLACES. The
--      generator's own helper text: "A Locked QR means you've agreed on a
--      date." The column comment on `vendor_locked_qr_tokens.event_date`: "a
--      Locked QR implies a settled date". The claim page shows the couple the
--      formatted day and takes consent BEFORE the RPC runs ("Locking in
--      finalizes your date to <day>" / "changes your date to <day>"). A
--      downpayment has already changed hands off-platform against that day.
--
--   So 'day' is the honest value, not a convenient one. It is also the SAFE
--   direction with respect to the refine-only ratchet in
--   `dashboard/[eventId]/actions.ts` (precision may narrow year -> month -> day
--   but never widen): 'day' is the narrowest rung, so this write can only ever
--   narrow, never widen, whatever the row held before.
--
-- ---------------------------------------------------------------------------
-- DOWNSTREAM: date_status FIXES ITSELF (verified, not assumed)
-- ---------------------------------------------------------------------------
--   20271033121603 installed `sync_event_date_status_trg` BEFORE INSERT OR
--   UPDATE on public.events. Its promotion arm reads:
--
--       IF NEW.event_date_precision = 'day' AND NEW.date_status = 'undecided'
--          AND (TG_OP='INSERT' OR event_date/precision actually moved) ...
--
--   so before this migration the (d0) UPDATE moved `event_date` with precision
--   still 'year' and the row stayed 'undecided'; after it, the same UPDATE
--   satisfies the precision arm and the row promotes to 'locked' in the same
--   statement. No second UPDATE, and no explicit date_status write here — the
--   trigger's "explicit intent always wins" rule means writing it ourselves
--   would suppress the very invariant that is supposed to own this column.
--   That trigger is confirmed present in prod.
--
-- ---------------------------------------------------------------------------
-- BACKFILL: NONE NEEDED — MEASURED, NOT ASSUMED
-- ---------------------------------------------------------------------------
--   Checked in prod (njrupjnvkjkitfctetvi) before writing:
--       vendor_locked_qr_tokens                       0 rows  (0 claimed)
--       event_vendors WHERE source='vendor_locked_qr' 0 rows
--       event_vendor_payments WHERE method='qr_lock'  0 rows
--   No event has EVER been dated by this path, so there is nothing to repair
--   and no bounded backfill is included. Deliberately NOT included: a blanket
--   "any dated event at non-'day' precision" UPDATE. Prod has exactly one such
--   row (0ccc7aa3, event_date 2026-08-01, precision 'year') and it is the Song
--   Desk test fixture, hand-dated by the SQL in the corpus CLAUDE.md — not a
--   Locked-QR row. Promoting it would fabricate a commitment this migration has
--   no evidence for, which is the same class of error this file exists to avoid.
--
-- ---------------------------------------------------------------------------
-- GRANTS / ACL — PRESERVED, NOT REISSUED
-- ---------------------------------------------------------------------------
--   `vendor_claim_locked_qr` is SECURITY DEFINER. Its live ACL is
--       {postgres=X, anon=X, authenticated=X, service_role=X}
--   — `anon` holds an EXPLICIT grant (Supabase's default ACL), which the
--   original `REVOKE ALL ... FROM PUBLIC` in 20270414692373 does not remove and
--   which 20271031571953 deliberately KEPT after refutation: the function is
--   gated on a 128-bit token, and revoking anon "would have broken the guest
--   surface to fix nothing".
--
--   CREATE OR REPLACE FUNCTION preserves proacl (only DROP + CREATE resets it),
--   which is why the two prior replacements — 20270426215000 and 20270427212060
--   — issue no grant statements either. This migration follows that precedent
--   exactly: no REVOKE, no GRANT, no signature change, so the ACL cannot move in
--   EITHER direction. The post-condition below asserts all three roles still
--   hold EXECUTE and that PUBLIC still does not — a narrowing would fail it just
--   as loudly as a widening. No policy, USING or WITH CHECK clause is touched,
--   so the committed exposure baseline is unchanged.
--
-- ---------------------------------------------------------------------------
-- THE DELTA: one added SET clause. The body is otherwise byte-for-byte the
-- shipped 20270427212060 function — same signature, same SECURITY DEFINER, same
-- search_path, same verdicts, same money. Nothing about WHO may call it, WHAT it
-- charges, or any entitlement changes.
--
-- Idempotent CREATE OR REPLACE — re-runnable.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_claim_locked_qr(
  p_token    TEXT,
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  t            public.vendor_locked_qr_tokens%ROWTYPE;
  v_vendor     public.vendor_profiles%ROWTYPE;
  v_event_date DATE;
  v_ev_id      UUID;
  v_instances  JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT * INTO t FROM public.vendor_locked_qr_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF t.status = 'void' THEN
    RETURN jsonb_build_object('status', 'void');
  END IF;

  -- Idempotent re-scan by the same claimer -> report the existing lock, don't
  -- double-apply. A different user hitting a consumed token -> 'taken'.
  IF t.status = 'claimed' THEN
    IF t.claimed_by_user_id = v_uid THEN
      RETURN jsonb_build_object(
        'status', 'already_claimed',
        'event_id', t.claimed_event_id,
        'event_vendor_id', t.claimed_event_vendor_id
      );
    END IF;
    RETURN jsonb_build_object('status', 'taken');
  END IF;

  -- Ownership: the target event must be one the claimer hosts.
  IF p_event_id NOT IN (SELECT public.current_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_your_event');
  END IF;

  -- Race-safe single-use bind: only one caller can flip pending->claimed.
  UPDATE public.vendor_locked_qr_tokens
     SET status             = 'claimed',
         claimed_by_user_id = v_uid,
         claimed_event_id   = p_event_id,
         claimed_at         = NOW()
   WHERE token = p_token AND status = 'pending'
  RETURNING * INTO t;
  IF NOT FOUND THEN
    -- Someone else won the race between our read and this update.
    RETURN jsonb_build_object('status', 'taken');
  END IF;

  SELECT * INTO v_vendor
    FROM public.vendor_profiles WHERE vendor_profile_id = t.vendor_profile_id;

  -- (d0) Finalize the agreed wedding date (owner 2026-07). A Locked QR implies a
  --      settled date; the scan page already got the couple's consent to
  --      finalize/change. Clear the candidate set + window so the date is now
  --      resolved. No-op for legacy tokens (event_date NULL).
  --
  --      /!\ THE PRECISION MOVES WITH THE DATE (fixed 2026-08-02). The token's
  --      date is a single contracted calendar day — the generator offers only
  --      `<input type="date">`, the issue action validates it against the
  --      vendor's calendar for that ONE day, and a downpayment has already been
  --      taken against it — so 'day' is the honest precision, and leaving the
  --      column at its 'year' creation default made every countdown skip a date
  --      the couple had signed a contract on. 'day' is also the narrowest rung,
  --      so this can only narrow precision, never widen it. date_status is
  --      deliberately NOT written here: sync_event_date_status_trg promotes it
  --      to 'locked' off this very UPDATE, and an explicit write would suppress
  --      that invariant.
  IF t.event_date IS NOT NULL THEN
    UPDATE public.events
       SET event_date           = t.event_date,
           event_date_precision = 'day',
           date_candidates      = NULL,
           date_window_start    = NULL,
           date_window_end      = NULL,
           date_mode            = NULL,
           updated_at           = NOW()
     WHERE event_id = p_event_id;
  END IF;

  -- (a) Lock the vendor onto the event. Upsert on (event_id, marketplace
  --     vendor): a considering/shortlisted row is promoted to deposit_paid;
  --     otherwise a fresh locked row is inserted. `notes` carries the frozen
  --     "what the couple availed" scope of work.
  SELECT vendor_id INTO v_ev_id
    FROM public.event_vendors
   WHERE event_id = p_event_id AND marketplace_vendor_id = t.vendor_profile_id
   LIMIT 1;

  IF v_ev_id IS NULL THEN
    INSERT INTO public.event_vendors (
      event_id, marketplace_vendor_id, category, vendor_name,
      status, source, total_cost_php, notes
    ) VALUES (
      p_event_id, t.vendor_profile_id, t.category::public.vendor_category, v_vendor.business_name,
      'deposit_paid', 'vendor_locked_qr', t.total_php, t.service_description
    )
    RETURNING vendor_id INTO v_ev_id;
  ELSE
    UPDATE public.event_vendors
       SET status         = 'deposit_paid',
           source         = 'vendor_locked_qr',
           total_cost_php = COALESCE(t.total_php, total_cost_php),
           category       = t.category::public.vendor_category,
           notes          = COALESCE(t.service_description, notes)
     WHERE vendor_id = v_ev_id;
  END IF;

  -- (b) Freeze the payment plan from the schedule template. amount_php resolves
  --     percent-of-total (legacy) or fixed; due_date prefers the row's ABSOLUTE
  --     `due_date`, else falls back to on_lock (today) / before_event
  --     (event date - offset), NULL when unanchored. v_event_date reflects the
  --     just-finalized agreed date.
  SELECT event_date INTO v_event_date FROM public.events WHERE event_id = p_event_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'seq',         (item->>'seq')::INT,
             'label',       item->>'label',
             'amount_kind', COALESCE(item->>'amount_kind', 'fixed'),
             'amount_php',  CASE
               WHEN item->>'amount_kind' = 'percent'
                 THEN ROUND(COALESCE(t.total_php, 0) * (item->>'amount_value')::NUMERIC / 100.0, 2)
               ELSE ROUND((item->>'amount_value')::NUMERIC, 2)
             END,
             'due_date',    CASE
               WHEN NULLIF(item->>'due_date', '') IS NOT NULL
                 THEN item->>'due_date'
               WHEN item->>'due_anchor' = 'on_lock'
                 THEN to_char(CURRENT_DATE + COALESCE((item->>'due_offset_days')::INT, 0), 'YYYY-MM-DD')
               WHEN item->>'due_anchor' = 'before_event' AND v_event_date IS NOT NULL
                 THEN to_char(v_event_date - COALESCE((item->>'due_offset_days')::INT, 0), 'YYYY-MM-DD')
               ELSE NULL
             END
           )
           ORDER BY (item->>'seq')::INT
         ), '[]'::jsonb)
    INTO v_instances
    FROM jsonb_array_elements(t.schedule_json) AS item;

  INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json)
  VALUES (p_event_id, v_ev_id, v_instances)
  ON CONFLICT (event_id, event_vendor_id)
  DO UPDATE SET instances_json = EXCLUDED.instances_json, updated_at = NOW();

  -- (c) Record the downpayment already received off-platform (proof on the
  --     token). Attributed to installment seq 1 (the downpayment row) and
  --     stamped vendor-confirmed so the couple's stepper shows it PAID rather
  --     than double-counting a separate unattributed payment. Skipped when zero.
  IF COALESCE(t.initial_paid_php, 0) > 0 THEN
    INSERT INTO public.event_vendor_payments (
      event_id, vendor_id, amount_php, method, reference, notes,
      schedule_instance_seq, vendor_confirmed_at, vendor_confirmed_by
    ) VALUES (
      p_event_id, v_ev_id, t.initial_paid_php, 'qr_lock', t.public_id,
      'Downpayment recorded from Locked QR',
      1, NOW(), t.created_by_user_id
    );
  END IF;

  -- (d) Backfill the resolved booking onto the token for the audit trail.
  UPDATE public.vendor_locked_qr_tokens
     SET claimed_event_vendor_id = v_ev_id
   WHERE id = t.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'event_id', p_event_id,
    'event_vendor_id', v_ev_id
  );
END;
$$;

COMMENT ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) IS
  'Single-use Locked-QR claim. SECURITY DEFINER, race-safe. Finalizes the agreed event_date AND its precision (''day'' — the token carries one contracted calendar day, so countdown maths and date_status promotion both apply), freezes event_vendors (scope in notes) + event_vendor_payment_plan from the schedule template (absolute due_date preferred, legacy on_lock/before_event anchor fallback), records the initial_paid_php downpayment into event_vendor_payments attributed to installment seq 1 + vendor-confirmed. Idempotent re-scan by same claimer returns already_claimed. Verdicts: unauthenticated|invalid|void|taken|already_claimed|not_your_event|ok.';

-- ----------------------------------------------------------------------------
-- Post-conditions — RAISE if the end state is not actually true.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_oid OID;
BEGIN
  -- to_regprocedure, not pg_get_function_identity_arguments = 'text, uuid':
  -- PG 18 includes parameter NAMES in that function's output ('p_token text,
  -- p_event_id uuid'), so an equality test on it silently stops matching and
  -- the post-condition fires on a perfectly healthy function. to_regprocedure
  -- resolves the signature the same way every version, and yields NULL rather
  -- than erroring when it is genuinely absent.
  v_oid := to_regprocedure('public.vendor_claim_locked_qr(text, uuid)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION
      'post-condition failed: public.vendor_claim_locked_qr(text, uuid) is missing';
  END IF;

  -- 1. The fix is actually in the body.
  IF position('event_date_precision' IN pg_get_functiondef(v_oid)) = 0 THEN
    RAISE EXCEPTION
      'post-condition failed: vendor_claim_locked_qr does not write events.event_date_precision';
  END IF;

  -- 2. Still SECURITY DEFINER — the (d0) UPDATE bypasses the caller's RLS by
  --    design, and losing that would silently turn the finalize into a no-op.
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION
      'post-condition failed: vendor_claim_locked_qr is no longer SECURITY DEFINER';
  END IF;

  -- 3. THE ACL DID NOT MOVE — in either direction. Widening is the obvious
  --    danger; narrowing would break the guest claim surface that
  --    20271031571953 deliberately preserved.
  IF NOT has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION
      'post-condition failed: anon lost EXECUTE on vendor_claim_locked_qr (20271031571953 kept it on purpose)';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION
      'post-condition failed: authenticated lost EXECUTE on vendor_claim_locked_qr';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION
      'post-condition failed: service_role lost EXECUTE on vendor_claim_locked_qr';
  END IF;
  IF EXISTS (
    SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = v_oid)) a
     WHERE a.grantee = 0  -- 0 = PUBLIC
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: vendor_claim_locked_qr is granted to PUBLIC — 20270414692373 revoked that';
  END IF;

  -- 4. The invariant that makes date_status fix itself off this write.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'events'
       AND t.tgname = 'sync_event_date_status_trg' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: sync_event_date_status_trg is missing — a day-precise locked-QR date would not promote date_status';
  END IF;

  -- 5. No event dated by this path is left at a placeholder precision. Zero
  --    such rows in prod today (no token has ever been issued); this assertion
  --    is what keeps it true if the migration is ever replayed against a
  --    database that DOES have claimed tokens.
  IF EXISTS (
    SELECT 1
      FROM public.vendor_locked_qr_tokens tok
      JOIN public.events e ON e.event_id = tok.claimed_event_id
     WHERE tok.status = 'claimed'
       AND tok.event_date IS NOT NULL
       AND e.event_date = tok.event_date
       AND e.event_date_precision IS DISTINCT FROM 'day'
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: an event dated by a claimed Locked QR still carries a non-day event_date_precision';
  END IF;
END;
$$;

COMMIT;
