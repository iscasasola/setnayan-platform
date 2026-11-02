## 2026-07-20 · fix(security): couple-membership gate on planNextYearEvent

Privilege escalation, live in production since PR #3194 (no flag gating it).

`planNextYearEvent` (`apps/web/app/dashboard/(account)/create-event/actions.ts`)
authorized on an RLS-gated `events` SELECT alone. The `event_member_can_read`
policy resolves through `current_event_ids()`, which returns every `event_id` the
caller has an `event_members` row for **regardless of `member_type`** — and the
join flow seeds real `member_type='guest'` rows. Because a server action is a
public POST, the `[eventId]` layout's couple gate never ran for it: any
authenticated user could harvest the action id from their own Home render and
replay it with a victim `event_id` they were merely a GUEST on. The action then
cloned that event on the SERVICE-ROLE client and inserted the caller as
`member_type='couple'` of the new event — a stranger's event details copied into
one the attacker owns.

- Added an explicit **couple-only** membership gate before the clone, mirroring
  the house pattern at `[eventId]/checklist-actions.ts` (read
  `event_members.member_type` for `(source event × caller)` on the *user* client,
  fail closed). Accepted `event_moderators` are deliberately **not** admitted:
  the layout admits them only to view the shell, and a delegate must not be
  handed couple-ownership of a fresh event.
- Decision extracted to `apps/web/lib/plan-next-year-authz.ts` so it sits inside
  the `lib/**` unit-test glob (same rationale as `lib/add-single-guest-core.ts`);
  fails closed on a missing row, a null/unknown `member_type`, or a throwing read.
- Kept the RLS source read as defence-in-depth and corrected the misleading
  "RLS-gated read = the membership gate" comment that invited the mistake.
- Regression suite `apps/web/lib/plan-next-year-authz.test.ts` — a guest member is
  rejected; couple-only allow-list pinned against silent widening.

SPEC IMPACT: None.
