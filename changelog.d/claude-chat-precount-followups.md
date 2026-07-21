## 2026-07-21 · chore(chat): kill the last stale pre-accept invariant comment + guard the thread_id scope

Fix-forward follow-ups on PR #3465 (`countCoupleMessages`), which merged sound but
left three non-blocking items open.

1. **Last surviving copy of the false invariant, removed.**
   `apps/web/app/dashboard/[eventId]/messages/[threadId]/page.tsx` still asserted
   verbatim that "while pending, only the couple can post … so the couple-authored
   count == total messages here". That claim is FALSE — the Vendor Auto-Reply
   Assistant posts into a still-`pending` thread as `sender_role='vendor'`,
   `is_bot=true`, and `'system'` notes exist in the enum too. The code below the
   comment was already couple-filtered, so this is comment-only, but it was the
   last copy of the model that caused the bug and the next reader would have
   re-derived it. Rewritten to state why the filter is required.

2. **`thread_id` scoping is now tested.** `apps/web/lib/chat.test.ts` recorded the
   `.eq()` filters but asserted only on `sender_role`. Mutating
   `countCoupleMessages` to drop `.eq('thread_id', threadId)` — which counts
   couple-authored messages across EVERY thread in the table — left the suite
   green. The stub now honours a recorded `thread_id` filter and a new test
   fixtures rows from two threads, so the mutation fails (expected 1, actual 3).
   Verified red-before/green-after in both directions: dropping `thread_id` fails
   1 test, dropping `sender_role` fails 3.

3. **RA 10173 erasure interaction — investigated, documented, not defended.**
   `app/admin/users/actions.ts` hard-deletes a leaving user's authored
   `chat_messages`, which can in principle drop the couple-authored count back to
   0 on a still-`pending` thread and re-open the pre-accept allowance (re-firing
   `vendor_inquiry`). It needs a second surviving `event_members` row with
   `member_type='couple'` on the same event, and no shipped APPLICATION path
   creates one — every couple row is written by the event's own creator
   (create-event / onboarding), co-hosts accepted via `/host/accept` get
   `'coordinator'`, and all join / claim paths (including the
   `finalize_guest_claim` RPC) write `'guest'`. Improbable, **not** impossible:
   `UNIQUE(event_id, user_id)` only stops one USER holding two rows, RLS
   (`member_can_self_join` / `couple_can_update_member`) still lets an existing
   couple member or an admin insert or promote a second couple row through
   PostgREST, and the iteration-0048 backfill explicitly handles pre-existing
   "additional rows (rare)". Recorded in `countCoupleMessages`' docstring as a
   known, accepted consequence (blast radius: one re-fired `vendor_inquiry` plus
   one restored pre-accept message) with the one-time data check and a revisit
   trigger if multi-couple hosts are ever wired up. `purgeUserAuthoredChat` now
   carries a back-pointer to that analysis so the erasure path is not edited
   blind.

Also confirmed and deliberately left alone: the unfiltered-by-role
`chat_messages` count in `apps/web/app/v/[slug]/inquiry-actions.ts` is thread-
scoped and answers a genuinely different question ("does this thread have any
message yet"). Couple-scoping it would change its meaning.

No behaviour change. Comments, a docstring, and one new test.

SPEC IMPACT: None.
