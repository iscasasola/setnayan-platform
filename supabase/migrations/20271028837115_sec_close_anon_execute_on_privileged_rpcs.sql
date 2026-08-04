-- 20271028837115_sec_close_anon_execute_on_privileged_rpcs.sql
--
-- SEC · Seven SECURITY DEFINER functions were callable by ANY holder of the
-- publishable key — no account, no session. Two of them destroy or mint value.
--
-- ── HOW THIS WAS FOUND, AND WHY NOTHING CAUGHT IT ──────────────────────────
-- The platform's security work has been auditing ROW-LEVEL SECURITY policies.
-- It then emerged that the guest-facing surface largely does NOT go through
-- RLS: guests read their seat through SECURITY DEFINER functions while the
-- underlying tables grant anon nothing. A policy audit therefore cannot see
-- this class at all — it concludes "anon cannot read this" and is right about
-- the table and wrong about the product.
--
-- 297 functions in `public` are SECURITY DEFINER; 211 are anon-EXECUTE-able.
-- The 33 that touch sensitive data with no identity check in the body were read
-- in full; 8 findings survived an adversarial pass. These are the seven whose
-- fix is a grant.
--
-- ── WHY REVOKING IS SAFE — VERIFIED PER FUNCTION, NOT ASSUMED ──────────────
-- Every real caller was located by its actual `.rpc(...)` call site, not by a
-- name grep. Six of seven are invoked ONLY with the service-role client, which
-- bypasses grants entirely, so revoking changes nothing for them:
--
--   purge_expired_chat                      lib/retention-sweep.ts:19      admin
--   claim_unlock_vendor_event               lib/vendor-invite-actions.ts:445 admin
--   subscriptions_due_for_renewal_reminder  lib/daily-email-jobs.ts:303    admin
--   papic_event_pool_status                 lib/papic-event-pool.ts:246    admin
--   papic_event_owns_service                (no .rpc caller at all)
--   redeem_vendor_token_voucher             (no .rpc caller at all)
--   detect_self_review_signal               lib/self-review-gate.ts:89     SESSION
--
-- The last one runs on the user's own client, so it keeps `authenticated` and
-- loses only `anon` — a signed-out visitor has no review to gate.
--
-- ⚠ WHAT IS DELIBERATELY NOT TOUCHED. The audit also flagged the
-- `vendor_completed_events` view as an anonymous bulk-read. Revoking it would
-- BREAK A REAL PUBLIC FEATURE: `fetchVendorCompletedEvents` (lib/reviews.ts:580)
-- always filters `.eq('vendor_profile_id', …)` and renders a single vendor's
-- dated track record on their public `/v/[slug]` page. That data is public by
-- design — it is the vendor's social proof. The genuine issue there is that the
-- view exposes `event_id`, and three functions treat an event id as if it were
-- a credential. Event ids are NOT secret; they sit in guest-facing URLs. So the
-- fix belongs at the functions that trust them — which is what §1 does — not at
-- the view. Left alone on purpose.
--
-- ⚠ ALSO NOT FIXED HERE: `papic_grant_camera_points` lets a signed-in buyer
-- write the grant row the admin approval hook would have written, before paying,
-- because the Papic ownership check counts `draft` / `submitted` /
-- `awaiting_payment` orders as owned. That is a paywall logic change under
-- apply-then-pay, not a grant change, and it needs its own PR and its own tests.
--
-- ── WHY THE ORIGINAL LOCKS DIDN'T HOLD ─────────────────────────────────────
-- Several of these functions HAVE a REVOKE in their defining migration. The
-- revoke did nothing that lasted, because a later `CREATE OR REPLACE` in
-- another migration re-applied Supabase's default privileges. A REVOKE is a
-- point-in-time act; nothing re-asserts it. That is why this migration ships
-- alongside a CI guard (tests/db/anon-rpc-surface.db.test.ts) that fails when a
-- new anon-callable SECURITY DEFINER function appears without a written reason —
-- the same shape as the Ugat concept baseline. A one-off revoke would be back
-- open the next time somebody replaces one of these bodies.
--
-- IDEMPOTENT — REVOKE is naturally so.

-- ── 1 · Off anon and off authenticated: service-role callers only ──────────
-- Signatures verified against pg_get_function_identity_arguments — a REVOKE on
-- a signature that does not exist ERRORS and takes the whole migration with it.
REVOKE ALL ON FUNCTION public.purge_expired_chat(p_years integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_unlock_vendor_event(p_vendor_profile_id uuid, p_event_id uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscriptions_due_for_renewal_reminder(p_days integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.papic_event_pool_status(p_event_id uuid)
  FROM PUBLIC, anon, authenticated;

-- ── 2 · No .rpc caller anywhere — closed completely ────────────────────────
REVOKE ALL ON FUNCTION public.papic_event_owns_service(p_event_id uuid, p_service_key text)
  FROM PUBLIC, anon, authenticated;
-- The voucher minter. One live code (50 tokens, unlimited uses) is expired but
-- still is_active; the uniqueness key is per-VENDOR not per-code, so one code
-- credits again for every vendor id supplied. No caller exists — it was reachable
-- and useful to nobody but an attacker.
REVOKE ALL ON FUNCTION public.redeem_vendor_token_voucher(p_vendor_id uuid, p_vendor_user_id uuid, p_code text)
  FROM PUBLIC, anon, authenticated;

-- ── 3 · Keeps `authenticated`; a signed-out visitor has no review to gate ──
REVOKE ALL ON FUNCTION public.detect_self_review_signal(p_vendor_profile_id uuid, p_reviewer_user_id uuid)
  FROM PUBLIC, anon;
