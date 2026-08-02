-- ============================================================================
-- 20271033121603_sync_event_date_status_with_event_date.sql
--
-- events.date_status has NEVER held 'locked' in production. All 5 prod events
-- read 'undecided', including the 4 that carry a real event_date. This is the
-- THIRD attempt at this fix; the first two were one-shot UPDATEs that went
-- inert the moment they ran:
--
--   20260604020000_phase_0_date_selection.sql          — backfill inside the DDL
--   20260604140000_backfill_date_status_for_existing_events.sql — a "belt and
--       suspenders" repeat of the same UPDATE
--
-- Both promoted the rows that existed AT APPLY TIME and then stopped being a
-- rule. Every event in prod today was created AFTER both ran, so both are
-- no-ops now and the column drifted straight back. A third bare UPDATE would
-- drift back too. This migration therefore ships the INVARIANT first and the
-- backfill second.
--
-- WHY A TRIGGER AND NOT A TYPESCRIPT HELPER
--   `events.event_date` has eleven writers. Three maintain date_status
--   (date-selection/actions.ts lockEventDate · wizard-actions.ts · vendors/
--   actions.ts), and they are exactly the three nobody has exercised yet. The
--   writers that actually landed the 4 dated rows do not:
--     · app/onboarding/simple/actions.ts   — INSERTs event_date + precision
--       'day' and lets date_status take its DEFAULT 'undecided'.
--     · app/dashboard/[eventId]/actions.ts — updateEventDate writes event_date
--       + event_date_precision, never date_status.
--     · studio/save-the-date/actions.ts    — writes the film date, and its own
--       comment says it leaves the status alone deliberately.
--     · public.vendor_claim_locked_qr()    — a plpgsql RPC that writes
--       events.event_date from a vendor's locked-QR contract.
--   That last one is decisive: it is SQL, so no TypeScript helper — however
--   well factored — can ever cover it. Neither can a helper cover a Supabase
--   Studio edit or a fixture UPDATE, and the 20260604140000 header already
--   names both as observed causes. The rule has to live where every writer
--   passes: on the table.
--
-- WHAT THE RULE IS
--   Fill in date_status ONLY when the writer stated no intent of its own, and
--   promote to 'locked' only for a DAY-precise date.
--
--   (1) EXPLICIT INTENT ALWAYS WINS. If an UPDATE changes date_status itself,
--       the trigger returns untouched. So lockEventDate keeps writing 'locked'
--       (including its deliberate 'locked' + precision year/month case — see
--       below), and markDateUndecided keeps writing 'undecided' WITHOUT
--       clearing event_date, which is its documented "I'm not ready yet"
--       behaviour.
--
--   (2) ONLY A DAY IS A COMMITMENT. In year/month modes updateEventDate stores
--       a first-of-range PLACEHOLDER in event_date ('2027-01-01' for a year),
--       so `event_date IS NOT NULL` does NOT mean the host named a day.
--       Promoting on a placeholder would mark "Set your wedding date" done for
--       someone who only picked a year. Promotion therefore requires
--       event_date_precision = 'day'. This is the conservative direction: the
--       trigger never claims a commitment the host did not make.
--
--   (3) A CLEARED DATE CANNOT BE LOCKED. event_date → NULL demotes a 'locked'
--       row back to 'undecided'.
--
--   (4) NO SPONTANEOUS RESURRECTION. On UPDATE the trigger only promotes when
--       event_date or its precision actually moved. An unrelated edit (venue,
--       palette, wizard_state) to a row sitting at (date set, 'undecided')
--       leaves it alone — that state is reachable on purpose via
--       markDateUndecided and must not be undone by a mood-board save.
--
-- WHY NOT DERIVE IT (asked, and answered NO)
--   A generated/derived column is tempting for a flag that shadows the column
--   next to it, but two states are genuinely NOT derivable from (event_date,
--   event_date_precision):
--     · lockEventDate deliberately supports 'locked' WITH precision
--       'year'/'month' — its own comment: those submissions "still set
--       date_status='locked' but with the matching precision".
--     · markDateUndecided deliberately supports 'undecided' WITH a non-null
--       event_date.
--   Both carry host intent that no function of the date columns can recover.
--   date_status stays a stored lifecycle marker; this trigger only supplies a
--   default for the writers that express no intent at all.
--
-- BEHAVIOUR CHANGE (all 5 prod events checked individually)
--   044f7e64 wedding 2026-12-18 precision day  → 'locked'. HAS a pending
--            'set_date' checklist item, which auto-completes on the next
--            reconcile. That is the fix, not a side effect.
--   947e7bab wedding 2026-12-12 precision day  → 'locked'. Same, pending
--            'set_date' item auto-completes.
--   3fe4441e simple_event 2026-09-19 prec day  → 'locked'. No 'set_date'
--            checklist row exists → zero visible change.
--   0ccc7aa3 wedding 2026-08-01 precision YEAR → UNCHANGED ('undecided').
--            Placeholder-shaped precision; correctly not promoted.
--   9b41095a date, event_date NULL             → UNCHANGED ('undecided').
--   Net user-visible effect: two couples who HAVE set a day-precise wedding
--   date stop being told "Set your wedding date" is still outstanding. That is
--   the owner's 2026-05-22 Task #67 complaint, still live because both prior
--   fixes were one-shot backfills.
--
--   The ONLY code that branches on date_status is
--   app/dashboard/[eventId]/checklist-actions.ts → dateStatusLocked →
--   lib/checklist-autocomplete.ts → done.add('set_date').
--   date-selection/page.tsx SELECTs the column but never reads it.
--
-- GRANTS
--   Deliberately no REVOKE here. Trigger-returning functions are excluded from
--   the exposure surface by construction (apps/web/tests/db/
--   exposure-surface.ts: "Trigger-returning functions are excluded: they are
--   not directly callable"), PostgREST does not publish them at /rest/v1/rpc/,
--   and all 10 existing triggers on public.events carry the same default ACL.
--   No policy, USING or WITH CHECK clause is touched, so the committed
--   exposure baseline is unchanged by this migration.
--
-- Idempotent: CREATE OR REPLACE + DROP TRIGGER IF EXISTS + a guarded UPDATE
-- that matches nothing on a second run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_event_date_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- (1) The writer stated its own intent for date_status — never override it.
  IF TG_OP = 'UPDATE' AND NEW.date_status IS DISTINCT FROM OLD.date_status THEN
    RETURN NEW;
  END IF;

  -- (3) A cleared date cannot be a committed one.
  IF NEW.event_date IS NULL THEN
    IF NEW.date_status = 'locked' THEN
      NEW.date_status := 'undecided';
    END IF;
    RETURN NEW;
  END IF;

  -- (2) + (4) Promote only a DAY-precise date, and on UPDATE only when the
  -- date columns actually moved.
  IF NEW.event_date_precision = 'day' AND NEW.date_status = 'undecided' THEN
    IF TG_OP = 'INSERT'
       OR NEW.event_date IS DISTINCT FROM OLD.event_date
       OR NEW.event_date_precision IS DISTINCT FROM OLD.event_date_precision
    THEN
      NEW.date_status := 'locked';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_event_date_status() IS
  'Keeps events.date_status honest against events.event_date for the writers '
  'that express no intent of their own (onboarding INSERTs, updateEventDate, '
  'the save-the-date film date, vendor_claim_locked_qr, and any direct SQL or '
  'Studio edit). Explicit date_status writes always win; only a day-precise '
  'date promotes to ''locked'', because year/month modes store a placeholder.';

DROP TRIGGER IF EXISTS sync_event_date_status_trg ON public.events;
CREATE TRIGGER sync_event_date_status_trg
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_date_status();

-- ----------------------------------------------------------------------------
-- Backfill the rows that already drifted. Bounded to day-precise dates so a
-- year/month placeholder is never mistaken for a commitment.
-- ----------------------------------------------------------------------------

UPDATE public.events
   SET date_status = 'locked'
 WHERE event_date IS NOT NULL
   AND event_date_precision = 'day'
   AND date_status = 'undecided';

-- ----------------------------------------------------------------------------
-- Post-conditions — RAISE if the end state is not actually true.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  drifted INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'events'
       AND t.tgname  = 'sync_event_date_status_trg'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: trigger sync_event_date_status_trg is missing on public.events';
  END IF;

  SELECT count(*) INTO drifted
    FROM public.events
   WHERE event_date IS NOT NULL
     AND event_date_precision = 'day'
     AND date_status = 'undecided';
  IF drifted > 0 THEN
    RAISE EXCEPTION
      'post-condition failed: % event row(s) still carry a day-precise event_date with date_status = ''undecided''',
      drifted;
  END IF;
END;
$$;

COMMIT;
