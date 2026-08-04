-- SEC · The last six anon-callable SECURITY DEFINER functions that survived
-- adversarial refutation. This completes the walk of all 211.
--
-- ── THE WALK, END TO END ───────────────────────────────────────────────────
--   pass 1   33 examined (regex-selected)        →  7 closed
--   pass 2  178 examined (the regex-excluded)    →  9 closed
--   pass 3   52 examined (neither pass had seen) →  6 closed  ← this migration
--
-- 51 functions were classified in pass 3; 8 were flagged; 2 died under
-- refutation and are recorded as safe with their corrected reason. The two that
-- died are worth naming, because they are the pattern that must NOT be revoked:
-- `vendor_claim_locked_qr` and `papic_record_guest_capture` are gated on
-- 128-bit and 122-bit random tokens respectively. A guest has no session; the
-- token IS the credential. Revoking those would have broken the guest surface
-- to fix nothing.
--
-- ── 1 · THE PAPIC SIBLINGS, AND WHY THIS ONE STINGS ────────────────────────
-- `papic_reserve_event_points` / `papic_release_event_points` were closed this
-- morning. Their per-CAMERA twins — same shape, same argument-as-credential
-- flaw, adjacent in the same file — were left open because the first sweep's
-- regex never selected them and nobody asked whether the fix had siblings.
--
-- That is the third time today one fix turned out to be one instance of a
-- class: the vendor_ig_oauth_state FK (21 of them), the default-ACL table grant
-- (203 functions), and now this. Fixing the instance in front of you and moving
-- on is the recurring defect, not any individual hole.
--
--   papic_release_camera_points  one anon call with a large p_cost floors
--                                points_used at 0 via GREATEST(0, …) — a guest
--                                refunds their own capture cost and shoots
--                                without limit.
--   papic_reserve_camera_points  the other direction, and it has NO caller at
--                                all in the codebase.
--
-- ── 2 · THE CO-BOOKING GRAPH ───────────────────────────────────────────────
-- `vendor_worked_with_ids` answers "which vendors has this vendor worked with";
-- `vendors_worked_together` is the one-bit oracle over the same relation. The
-- argument is a vendor_profile_id — a PUBLIC JOIN KEY, not a credential, and
-- anon-enumerable from the anon-readable `vendor_public_completed_events_stats`
-- matview. An anonymous scraper walks the ids and reconstructs the marketplace's
-- entire co-booking graph, which RLS on event_vendors otherwise protects.
--
-- Kept for `authenticated`: the hint is shown in-product to signed-in vendors in
-- the propose picker, and is deliberately NOT self-scoped. Only `anon` goes.
--
-- ── 3 · ACCEPTING YOUR OWN OFFER ───────────────────────────────────────────
-- `respond_creator_offer` is gated on auth.uid() matching the addressed
-- creator — which is correct, and useless to an anonymous caller who has no
-- uid. It holds no token-based credential, so anon has no legitimate way to
-- authenticate here at all; the grant serves nobody and removes the gate's
-- meaning for a NULL uid.
--
-- ── 4 · WATCHING A CEREMONY YOU WERE NOT INVITED TO ────────────────────────
-- `live_studio_guest_rtc_can_access` returns TRUE for three properly
-- caller-scoped classes AND a fourth that is not caller-scoped: any session at
-- all, including a native-anonymous one, while a roam zone is live and
-- guest-pick is on. Someone holding an event id — which sits in guest-facing
-- URLs — can watch the ceremony. It has NO caller in the codebase.
--
-- ── WHY REVOKING IS SAFE — VERIFIED PER FUNCTION ───────────────────────────
--   papic_reserve_camera_points      NO caller            → closed completely
--   vendors_worked_together          NO caller            → closed completely
--   live_studio_guest_rtc_can_access NO caller            → closed completely
--   papic_release_camera_points      admin client only    → closed to sessions
--   vendor_worked_with_ids           session (vendor dash)→ keeps authenticated
--   respond_creator_offer            session (creator)    → keeps authenticated
--
-- Signatures verified against pg_get_function_identity_arguments before writing.
-- IDEMPOTENT.

-- ── 1 · No caller at all ───────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.papic_reserve_camera_points(p_seat_id uuid, p_event_id uuid, p_cost integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vendors_worked_together(vendor_a uuid, vendor_b uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.live_studio_guest_rtc_can_access(p_topic text)
  FROM PUBLIC, anon, authenticated;

-- ── 2 · Service-role caller only ───────────────────────────────────────────
REVOKE ALL ON FUNCTION public.papic_release_camera_points(p_seat_id uuid, p_cost integer)
  FROM PUBLIC, anon, authenticated;

-- ── 3 · Keep `authenticated`; anon has no legitimate identity here ─────────
REVOKE ALL ON FUNCTION public.vendor_worked_with_ids(for_vendor uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_creator_offer(p_offer_id uuid, p_response text, p_deliverable_chapter_id uuid)
  FROM PUBLIC, anon;
