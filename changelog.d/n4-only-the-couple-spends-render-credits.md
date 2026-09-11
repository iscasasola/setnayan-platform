## 2026-09-11 · security(mood-board): only the couple (and Setnayan admins) spend render credits or give share consent (N4 part 4)

Owner ruling 2026-09-11 (DECISION_LOG, "ONLY THE COUPLE MAY SPEND MOOD-BOARD RENDER CREDITS OR SHARE THE COUPLE'S RENDERS"): "Only the couple (Recommended)" — and admins. Found by N3 (#5415), which pinned the keys and left the gate as an owner question.

Measured in production (read-only): `moodboard_render_caller_may_act` admitted ANY `event_members` row (couple, guest, vendor, coordinator) and gated ten SECURITY DEFINER functions — seven that spend or act (begin, reserve, release, finish, fail/refund, attach gallery copy, set share consent) and two that read (balance, inspiration pool).

- Migration `20271221631865_only_the_couple_spends_render_credits`: `moodboard_render_caller_may_act` narrowed to `is_admin()` or `current_couple_event_ids()` (the same couple definition `colour_access_caller_is_couple` uses); the NULL-uid trusted-server arm kept. New `moodboard_render_caller_may_view` = the old member rule verbatim, used only by `moodboard_render_balance` and `moodboard_inspiration_pool`, and granted to no browser role (called only from inside those definer functions — no EXECUTE widening; exposure baseline unchanged). Post-conditions assert all of it.
- Every other member's READ access is kept: balance, the couple's renders (table RLS unchanged) and the pool.
- The mood-board page asks the same gate and passes `mayStartRenders` to Make it real: for a guest, supplier or coordinator the tiles say "Only the couple can make this real", the consent checkbox is disabled ("Only the couple can change this."), and the render-credit pack is not offered. `requestRender` asks the gate before `moodboard_begin_render`, so a refusal is never reported as "insufficient — buy a pack".
- Guards: `tests/db/only-the-couple-spends-render-credits.db.test.ts` (12, real `authenticated` role for every member type, with a rolled-back neutralisation) and `lib/only-the-couple-spends-render-credits.test.ts` (5). `a-render-key-is-its-own` updated: the guest case it pinned open "so a change to it is a visible decision" is now the decided refusal.

SPEC IMPACT: None — implements the owner's 2026-09-11 ruling already recorded in DECISION_LOG.md.
