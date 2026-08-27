-- the_couple_may_build_their_own_board
--
-- 🚨 THE COUPLE'S CHALLENGE BOARD HAS BEEN REFUSED ON EVERY RENDER SINCE
--    2026-08-23, AND NOTHING ANYWHERE SAID SO.
--
-- `ensure_papic_board` is the ONE thing that writes `papic_missions.board_slot`
-- — which challenges reach a guest, and in what order. The couple's challenge
-- screen calls it through the couple's OWN session on every render
-- (`couple-challenges-manager.tsx`), and the guest route calls it through the
-- service role.
--
-- The pabati retirement (20271159146115) re-created this function with ONE
-- argument instead of two — correct, the boolean it dropped was the retired SKU
-- gate — and then wrote:
--
--     REVOKE ALL ON FUNCTION public.ensure_papic_board(uuid)
--       FROM PUBLIC, anon, authenticated;
--
-- ...with no matching GRANT. The migration it was carrying forward
-- (20271126272662) had a PAIR — `REVOKE ... FROM PUBLIC, anon;` followed by
-- `GRANT EXECUTE ... TO authenticated;`. The rewrite folded `authenticated`
-- into the revoke list and dropped the grant, so the new signature was born
-- with no caller privilege at all.
--
-- 🔑 A REVOKE THAT SWALLOWS ITS OWN GRANT IS INVISIBLE FROM THE APP SIDE.
-- Supabase does not throw — `.rpc()` resolves with `{ error }` — and the
-- wrapper is deliberately fail-soft (`if (error) return 0`), so for the whole
-- planning period every couple's board silently never materialized. Nothing
-- logged, nothing raised, CI green: the db tests call this function as
-- superuser in the PGlite replay, where a missing grant cannot be felt.
--
-- Measured in production before writing this file (not read off a migration):
--   has_function_privilege('authenticated', 'ensure_papic_board(uuid)', 'EXECUTE') = FALSE
--   ...while both of its siblings answer TRUE:
--   ensure_papic_auto_missions = TRUE · papic_challenge_pick_counts = TRUE
--
-- ⚖ THE FUNCTION ITSELF ALWAYS EXPECTED AN AUTHENTICATED CALLER. Its own body
-- still opens with "Auth: the event's couple or coordinator, an admin, or
-- service_role (server). NOT anon." and RAISEs for a signed-in non-member.
-- That guard has been unreachable dead code since the revoke — which is the
-- strongest evidence available that the revoke was a slip and not a decision.
--
-- ⛔ `anon` IS NOT GRANTED AND MUST NEVER BE. The function reads a NULL
-- `auth.uid()` as "the trusted server", so an anon grant would hand a stranger
-- the whole board builder on any event. `papic-story-challenges.db.test.ts`
-- pins that ("the board builder is not reachable by anon") and this migration
-- deliberately does not disturb it.
--
-- Idempotent: GRANT is a no-op when the privilege is already held.
--
-- ── WHY THE EXPOSURE BASELINE ADMITS THIS, recorded here because
--    `supabase/security/exposure-surface.baseline.txt` is a GENERATED file with
--    no room for a reason on the line itself. The line it gains is exactly:
--
--      func  public.ensure_papic_board(p_event_id uuid)
--            secdef=yes exec=authenticated search_path=public
--
--    ONE capability, and the regeneration absorbed nothing else — counted, not
--    assumed: 6216 → 6217 facts, one line added, zero removed.
--
--    It is admitted rather than narrowed because all three of these hold:
--      1. The grant names `authenticated` ONLY. Not PUBLIC (which would sweep in
--         `anon`), not `anon`. The generated fact agrees — it reads
--         `exec=authenticated`, with no `anon` on it.
--      2. THE FUNCTION AUTHORIZES ITS OWN CALLER. A signed-in stranger is
--         refused by the RAISE above; being `authenticated` is not enough, you
--         must be the event's couple/coordinator or an admin. That is precisely
--         what the freeze asks of a SECURITY DEFINER function it publishes.
--      3. It RESTORES a privilege lost to an unpaired REVOKE, so this is the
--         baseline catching up with an accident being undone — not new reach.
--         Its sibling `ensure_papic_auto_missions(uuid)` has carried the
--         identical fact all along.
--
--    ⚠ THE LOAD-BEARING CAVEAT FOR WHOEVER TOUCHES THIS NEXT: the authorization
--    block is SKIPPED when `auth.uid()` IS NULL, deliberately — that is how
--    `service_role` calls it. So the safety of this grant rests ENTIRELY on
--    `anon` never holding EXECUTE. Granting anon later would not merely widen
--    this line; it would hand the board builder to strangers on every event,
--    with the in-function guard silently skipped. Verified against production
--    before granting: the live ACL was `{postgres=X/postgres,service_role=X/postgres}`
--    — neither `anon` nor `authenticated` held EXECUTE.

GRANT EXECUTE ON FUNCTION public.ensure_papic_board(uuid) TO authenticated;

-- The comment a reader actually queries. Applied migrations are never edited,
-- so the two above will keep describing a revoke that no longer stands; this is
-- the correction that travels with the object.
COMMENT ON FUNCTION public.ensure_papic_board(uuid) IS
  'Materializes + ranks an event''s Papic challenge board (writes board_slot). '
  'Callable by the event''s couple/coordinator or an admin through their OWN '
  'session, and by the server (service_role, NULL auth.uid()). NOT anon — a '
  'NULL uid is read as the trusted server, so an anon grant would open the '
  'builder to strangers. The authenticated grant was lost by an unpaired REVOKE '
  'in 20271159146115 and restored in 20271173829027; between those two the '
  'couple''s own screen was refused on every render and failed soft to a board '
  'that never materialized.';
