-- ═══════════════════════════════════════════════════════════════════════════
-- THE CONTRACT STAYS WITH WHO SIGNED IT — slice 3 of "vendors get to keep it"
--
-- Owner, 2026-08-21, naming this one explicitly: every row where both parties
-- have a claim — "signed contracts, records of a deposit paid, completed
-- bookings" — resolves to the VENDOR.
--
-- 🔑 SIMPLER THAN SLICE 2, AND FOR A REASON WORTH STATING. `event_vendors`
-- needed three conditions because it holds the couple's private shortlist in
-- the same rows. A contract has no such ambiguity: `vendor_profile_id` is NOT
-- NULL, the supplier AUTHORED the document, and there is no such thing as a
-- contract the supplier did not take part in. So every row survives, with no
-- status test. Do not copy slice 2's conditions here — they would be cargo.
--
-- Measured against prod before writing: of six FKs on this table, FIVE already
-- survive a deletion (`event_vendor_id`, `order_id`, `uploaded_by_user_id`,
-- `cancelled_by_user_id` are SET NULL; `vendor_profile_id` cascades to the
-- VENDOR, which is correct). `event_id` was the only one taking the contract
-- down with the couple's celebration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · The contract may outlive the celebration ────────────────────────────
ALTER TABLE public.vendor_contracts
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.vendor_contracts
  DROP CONSTRAINT IF EXISTS vendor_contracts_event_id_fkey;

ALTER TABLE public.vendor_contracts
  ADD CONSTRAINT vendor_contracts_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

-- ── 2 · …and must still say WHOSE contract it was ───────────────────────────
-- 🚨 SLICE 2'S LESSON, APPLIED BEFORE IT COULD BITE AGAIN. The supplier's
-- contract list resolves the client name by looking the event up separately and
-- falls back to the literal string 'Unknown event'
-- (app/vendor-dashboard/contracts/surface.tsx). So unlike slice 2 the row does
-- NOT vanish — it survives and becomes ANONYMOUS, which for a signed contract
-- is its own kind of useless. The name is stamped here so the supplier's own
-- paperwork still names the client they signed with.
--
-- ⚠ This is the ONE couple-derived value kept, and it is kept because it is on
-- the contract already: a signed agreement names its counterparty. Nothing else
-- about the celebration comes across.
ALTER TABLE public.vendor_contracts
  ADD COLUMN IF NOT EXISTS client_name_at_delete text;

COMMENT ON COLUMN public.vendor_contracts.client_name_at_delete IS
  'Who the supplier signed with, copied here ONLY when the couple deleted the '
  'celebration. NULL while the event exists — read `events.display_name` then. '
  'Exists because a surviving contract that cannot name its counterparty is not '
  'much of a record, and the supplier''s list would otherwise read '
  '"Unknown event" for a real client.';

-- ── 3 · Stamp it while the event is still there to read ─────────────────────
CREATE OR REPLACE FUNCTION public.keep_supplier_paperwork_on_event_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  /*
    The FK does the detaching (ON DELETE SET NULL). This trigger exists ONLY to
    capture the counterparty's name while the event row still exists — after the
    delete there is nothing left to read it from.

    Deliberately a SEPARATE trigger from slice 2's, not an extension of it: that
    one was still in review when this was written, and stacking would have made
    two independently-mergeable changes depend on each other. They touch
    different tables and cannot conflict. A later slice may consolidate the
    "what the supplier keeps" triggers; doing it now would buy elegance with
    a merge dependency.
  */
  UPDATE public.vendor_contracts vc
     SET client_name_at_delete = COALESCE(vc.client_name_at_delete, OLD.display_name)
   WHERE vc.event_id = OLD.event_id;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.keep_supplier_paperwork_on_event_delete() IS
  'BEFORE DELETE on events: stamps the client name onto every contract for that '
  'celebration so the supplier''s surviving paperwork still names who they '
  'signed with (owner 2026-08-21, "vendors get to keep it").';

-- 🚨 A SECURITY DEFINER FUNCTION IS EXECUTABLE BY **PUBLIC** BY DEFAULT, so it
-- joins the anon-callable surface simply by existing — `anon-rpc-surface.db.test.ts`
-- caught exactly this on slice 2's trigger. A trigger function needs no EXECUTE
-- grant; Postgres runs it as part of the DELETE regardless.
REVOKE ALL ON FUNCTION public.keep_supplier_paperwork_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.keep_supplier_paperwork_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.keep_supplier_paperwork_on_event_delete() FROM authenticated;

DROP TRIGGER IF EXISTS events_keep_supplier_paperwork_on_delete ON public.events;
CREATE TRIGGER events_keep_supplier_paperwork_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_supplier_paperwork_on_event_delete();

COMMENT ON COLUMN public.vendor_contracts.event_id IS
  'The celebration this contract was signed for, or NULL once the couple '
  'deleted it (owner 2026-08-21, "vendors get to keep it"). NULL is a real '
  'expected value. The supplier keeps full access either way — their policy '
  'keys on `vendor_profile_id` — while the couple''s read policy keys on '
  'event_id through event_members, so an orphaned contract correctly leaves '
  'the couple''s view and stays in the supplier''s.';
