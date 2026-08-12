-- ============================================================================
-- A SUPPLIER CANNOT MARK THEIR OWN PAYOUT DESTINATION "CHECKED BY SETNAYAN".
-- ============================================================================
--
-- Fifth instance of the shape fixed four times already (20271132839561 chat
-- sender · 20271132843141 broadcast sender · 20271132891176 self-promotion to
-- admin · 20271134103060 self-awarded experience mark). `vendor_payment_methods`
-- has two PERMISSIVE `FOR ALL` policies keyed on owning the vendor profile, ZERO
-- triggers, and nothing anywhere constraining `moderation_status`.
--
-- ── WHAT IT DECIDES ───────────────────────────────────────────────────────
-- `lib/vendor-payment-methods.server.ts:64` and `:128` both filter
-- `.eq('moderation_status','approved')` — it gates whether a couple SEES the
-- destination they are about to send money to. `lib/admin/queue-counts.ts:117`
-- counts `pending_review|held` — so it also decides whether the row ever
-- appears in the admin review queue. Forging it does both at once: shown to
-- couples, invisible to the reviewer.
--
-- ── 🚨 THE TRAP THAT MAKES THE OBVIOUS FIX WORSE THAN THE BUG ─────────────
-- The column DEFAULT is **'approved'** (20260820000000). So "revoke the column
-- from the browser" — the shape the two sender migrations used — would have
-- shipped SILENT UNIVERSAL AUTO-APPROVAL: every payment destination anyone adds,
-- instantly visible to couples as Setnayan-checked and never queued for review.
-- No error, nothing in a log. This is the coordinator_broadcasts DEFAULT trap
-- inverted and considerably worse, because here the default IS the privileged
-- value.
--
-- The DEFAULT flip below is therefore not tidying. It is load-bearing, and the
-- db test asserts it separately from everything else.
--
-- ── WHAT IS *NOT* A BUG, AND MUST KEEP WORKING ────────────────────────────
-- Instant approval for the safe lanes is a deliberate product decision, not an
-- oversight. `addPaymentMethod` routes:
--   bank                       → auto-approve (today: by omitting the column)
--   QR whose image DECODES     → auto-approve (same)
--   QR whose image does NOT    → 'pending_review'
--   link on the allowlist      → auto-approve
--   link off the allowlist     → 'pending_review'
-- A vendor adding their BDO details still sees them on the client payment
-- screen immediately. What changes is WHO performs the approving write.
--
-- ── THE FIX ───────────────────────────────────────────────────────────────
-- 1. DEFAULT → 'pending_review'. A row nobody deliberately approved is now
--    unapproved, which is the safe direction and makes a direct PostgREST
--    insert land in the review queue instead of in front of couples.
-- 2. A BEFORE INSERT OR UPDATE trigger pins moderation_status/moderation_note
--    for end-user sessions: forced to the default on INSERT, frozen to OLD on
--    UPDATE. The UPDATE half is what survives somebody re-granting the column
--    later — the lesson from 20271132891176, where a guard covered one verb.
-- 3. The table-level INSERT/UPDATE grant is dropped and re-issued per column
--    minus the two moderation columns. (A column-level REVOKE against a
--    table-level grant is a Postgres no-op.) The allow-list is COMPUTED from
--    the catalog rather than typed, following 20271005100000 — this table has
--    18 columns and hand-enumeration is how a legitimate field silently stops
--    saving.
-- 4. `addPaymentMethod` stops naming the column and, for the auto-approve
--    lanes, performs the flip through the service-role client after the insert.
--    Same UX, same rules, but the trust decision is no longer something the
--    browser can assert for itself. If that follow-up write fails the row stays
--    'pending_review' — shown to nobody, visible to the reviewer. Fail-safe.
--
-- Prod rows: 0. Nothing to backfill, and the DEFAULT change cannot disturb
-- existing data because there is none.
--
-- The admin path is untouched: app/admin/payment-options/actions.ts moderates
-- through createAdminClient(), and the trigger exempts every non-end-user
-- session.
-- ============================================================================

-- ── 1 · THE SAFE DEFAULT ───────────────────────────────────────────────────
ALTER TABLE public.vendor_payment_methods
  ALTER COLUMN moderation_status SET DEFAULT 'pending_review';

-- ── 2 · PIN IT FOR END-USER SESSIONS ───────────────────────────────────────
-- SECURITY INVOKER so `current_user` reports the PostgREST request role. A
-- DEFINER function would report the owner and this branch would be dead code.
CREATE OR REPLACE FUNCTION public.tg_vendor_payment_methods_pin_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- service_role / owner / migrations: the admin console and the server
  -- action's own approve write. They are the server; nothing to protect.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Not "if null" — a supplied value is exactly what this discards. Written
    -- as the literal rather than DEFAULT so that a future DEFAULT change
    -- cannot quietly re-open the lane this migration exists to close.
    NEW.moderation_status := 'pending_review';
    NEW.moderation_note   := NULL;
  ELSE
    NEW.moderation_status := OLD.moderation_status;
    NEW.moderation_note   := OLD.moderation_note;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_vendor_payment_methods_pin_moderation() IS
  'BEFORE INSERT OR UPDATE on vendor_payment_methods: end-user sessions cannot '
  'set or change moderation_status/moderation_note. Approval is a service-role '
  'write (admin console, or addPaymentMethod''s auto-approve lanes). '
  'Migration 20271134376999.';

DROP TRIGGER IF EXISTS vendor_payment_methods_pin_moderation ON public.vendor_payment_methods;
CREATE TRIGGER vendor_payment_methods_pin_moderation
  BEFORE INSERT OR UPDATE ON public.vendor_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_vendor_payment_methods_pin_moderation();

-- ── 3 · TAKE THE PEN AWAY ──────────────────────────────────────────────────
-- Computed all-columns-minus-deny-set (precedent: 20271005100000). Typing the
-- keep-list by hand on an 18-column table is how a legitimate field silently
-- stops saving — and the failure would surface as a vendor unable to add their
-- bank details, blamed on anything but this migration.
DO $$
DECLARE
  cols text;
BEGIN
  REVOKE INSERT, UPDATE ON public.vendor_payment_methods FROM authenticated;
  REVOKE INSERT, UPDATE ON public.vendor_payment_methods FROM anon;

  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
    INTO cols
    FROM pg_attribute a
   WHERE a.attrelid = 'public.vendor_payment_methods'::regclass
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.attname NOT IN ('moderation_status', 'moderation_note');

  -- anon is granted nothing back: both policies are TO authenticated, so anon
  -- could never insert a row regardless; this stops the ACL claiming otherwise.
  EXECUTE format('GRANT INSERT (%s) ON public.vendor_payment_methods TO authenticated', cols);
  EXECUTE format('GRANT UPDATE (%s) ON public.vendor_payment_methods TO authenticated', cols);
END $$;

COMMENT ON COLUMN public.vendor_payment_methods.moderation_status IS
  'Whether Setnayan has cleared this payout destination. Gates couple-facing '
  'visibility (lib/vendor-payment-methods.server.ts) AND admin-queue membership '
  '(lib/admin/queue-counts.ts). Not writable by authenticated/anon — pinned by '
  'tg_vendor_payment_methods_pin_moderation. DEFAULT is ''pending_review'' and '
  'must stay that way: it was ''approved'', which would make any un-pinned '
  'insert silently self-approving.';
