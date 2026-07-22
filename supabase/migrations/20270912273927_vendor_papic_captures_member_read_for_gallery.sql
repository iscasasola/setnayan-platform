-- Vendor documentation → event gallery (owner 2026-07-22 "compiles on the event
-- gallery"). The couple's gallery (fetchPapicGallery) runs under the couple's RLS,
-- but vendor_papic_captures had ONLY a vendor-own read policy + admin — the couple
-- could not read a vendor's captures of their own event. This adds a
-- couple/coordinator read policy so their event's vendor documentation compiles in.
--
-- ⚠ WHERE THE DPO GATE ACTUALLY IS (do not overstate for the NPC packet): the
-- DPO gate for this whole lane is the admin Data Privacy control
-- 'vendor_papic_capture' (default INACTIVE) — no capture is even created until the
-- DPO flips it live. It is NOT a per-capture human clearance: the capture route
-- (/api/vendor/papic-capture) stamps every row consent_basis='event_consent' (the
-- capture rides the event's consent basis), and the NSFW screen flips nsfw_checked
-- shortly after upload. So once the lane is DPO-approved, a vendor capture surfaces
-- to the couple/coordinator once nsfw_checked=true AND hidden_at IS NULL.
--
-- The consent_basis <> 'pending_dpo_ruling' clause below is a DEFENSIVE BACKSTOP
-- (it excludes any row ever left in the pending default by some other path), NOT
-- the primary gate — today nothing is pending on the live path.
--
-- SELECT policies are OR-combined, so this is additive to the existing
-- vendor_papic_captures_vendor_read (the vendor still reads their own, any state).

BEGIN;

DROP POLICY IF EXISTS vendor_papic_captures_member_read ON public.vendor_papic_captures;
CREATE POLICY vendor_papic_captures_member_read
  ON public.vendor_papic_captures
  FOR SELECT TO authenticated
  USING (
    nsfw_checked = true
    AND consent_basis <> 'pending_dpo_ruling'
    AND hidden_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = vendor_papic_captures.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
  );

COMMIT;
