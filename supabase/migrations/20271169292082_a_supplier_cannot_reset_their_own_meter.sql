-- a_supplier_cannot_reset_their_own_meter
--
-- 🚨 TWO HOLES IN ONE POLICY, AND THE FIRST IS UNLIMITED FREE SHOTS.
--
-- `vendor_papic_captures_vendor_update` is `FOR UPDATE` with USING and WITH
-- CHECK that both ask ONE question — *is this row on a profile you own?* —
-- and constrain NO COLUMN. Verified in production: `authenticated` holds
-- UPDATE on ALL 23 columns of this table, `hidden_at` and `nsfw_checked`
-- included. Postgres checks the grant first, and the grant is there.
--
-- ── 1 · A SUPPLIER CAN RESET THEIR OWN METER ────────────────────────────────
-- `fetchVendorPapicPointsSpent` (lib/vendor-papic-grants.ts) tallies spend as
-- the captures on this event `WHERE hidden_at IS NULL`. So a supplier who
-- PATCHes `hidden_at` onto their own rows through PostgREST watches their spent
-- count return to ZERO — and shoots their whole allowance again. Repeatably.
-- No error anywhere; the meter simply reads a smaller number.
--
-- ── 2 · AND A SUPPLIER CAN MARK THEIR OWN FILE SCREENED ─────────────────────
-- `vendor_papic_captures_member_read` shows a capture to the couple only when
-- `nsfw_checked = true`. That same unconstrained UPDATE lets the supplier set
-- it. An unscreened image reaches the couple by the supplier saying it was
-- checked. **The safety screen is not the control if the uploader owns its
-- verdict.**
--
-- 🔑 THE ROW IS YOURS, THE FIELD IS NOT — the eighth time this exact shape has
-- been found in this schema (see DECISION_LOG 2026-08-12, eight PRs, including
-- #4366 where an uploader could pre-mark a photo `clean` so the screen never
-- ran on it). A PERMISSIVE policy that says "this row is yours" has no opinion
-- about a field that records somebody ELSE's decision.
--
-- ⚖ LATENT TODAY, NOT TOMORROW. Production holds ZERO vendor captures and the
-- whole lane sits behind the DPO control (`isVendorPapicCaptureEnabled`, the
-- route 403s). It stops being latent the moment this lane turns from a 5-shot
-- documentation aid into a 500-photo gallery upload — which is exactly what the
-- owner asked for on 2026-08-26.
--
-- ── ⛔ WHY A TRIGGER AND NOT A REVOKE, WHICH IS THE TEMPTING FIX ────────────
-- The vendor capture route NAMES `nsfw_checked` in its own INSERT (it writes
-- `false` deliberately, app/api/vendor/papic-capture/route.ts). **Postgres
-- checks privileges against the columns NAMED, not the values written** — so
-- dropping `nsfw_checked` from the INSERT grant would break every legitimate
-- capture with a 42501. This is the distinction recorded on 2026-08-12: revoke
-- when no RLS client writes the column; TRIGGER when the app must name it to
-- write a specific SAFE value. This is the trigger case.
-- ⛔ And `REVOKE UPDATE (column)` against a table-level grant is a NO-OP — that
-- was the inert "fix" already paid for once (DECISION_LOG 2026-08-20/21).
--
-- ✅ VERIFIED IT BREAKS NOTHING. Both legitimate writes of these two columns run
-- on the SERVICE ROLE: the post-screen verdict update
-- (`await admin ... .update({ nsfw_checked: true, hidden_at: ... })`) and every
-- admin/moderation path. The only unprivileged write is the route's own INSERT
-- of `nsfw_checked: false`, which this trigger forces to false anyway. Grep
-- `vendor_papic_captures` for `.update(`/`.insert(` — there are exactly two.

BEGIN;

CREATE OR REPLACE FUNCTION public.tg_pin_vendor_capture_verdict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- The screen, the healer and the admin console are all service-role. They are
  -- the deciders; there is nothing to protect them from.
  --
  -- ⚠ current_user, NOT auth.role(). The PGlite replay's shim returns 'anon'
  -- where production returns NULL, so every `auth.role() IS NULL` privileged
  -- branch is DEAD CODE in every db test in this repo (DECISION_LOG 2026-08-12).
  -- `current_user` is true in both.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The literals, not DEFAULT: a future DEFAULT change must not quietly
    -- re-open the lane this exists to close. An unscreened capture is what
    -- makes the screen run at all, and a row cannot arrive pre-hidden.
    NEW.nsfw_checked := false;
    NEW.hidden_at := NULL;
  ELSE
    -- Both fields record somebody ELSE's decision: the screen's verdict, and
    -- the take-down. Owning the row is not owning either.
    NEW.nsfw_checked := OLD.nsfw_checked;
    NEW.hidden_at := OLD.hidden_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pin_vendor_capture_verdict ON public.vendor_papic_captures;
CREATE TRIGGER pin_vendor_capture_verdict
  BEFORE INSERT OR UPDATE ON public.vendor_papic_captures
  FOR EACH ROW EXECUTE FUNCTION public.tg_pin_vendor_capture_verdict();

COMMENT ON FUNCTION public.tg_pin_vendor_capture_verdict() IS
  'A supplier owns the ROW, never the VERDICT. vendor_papic_captures_vendor_update '
  'constrains no column, and authenticated holds UPDATE on all 23 — so without '
  'this a supplier could PATCH hidden_at to reset their spent-points meter '
  '(fetchVendorPapicPointsSpent counts hidden_at IS NULL) and shoot their whole '
  'allowance again, and could set nsfw_checked=true to push an unscreened file '
  'to the couple (vendor_papic_captures_member_read trusts that flag). Trigger, '
  'not revoke: the capture route NAMES nsfw_checked in its own INSERT, and '
  'Postgres checks privileges against columns NAMED, not values written.';

COMMIT;
