## 2026-08-09 · fix(schedule): only the coordinator can advance the run of show

The day-of "Start next / End & advance" control moves the whole wedding
programme forward. The owner ruled that only the coordinator holds it. Until
now the only thing enforcing that was a screen — and on the vendor client
workspace not even that: every booked supplier is shown the button there.
Underneath, the `advance_schedule_block` RPC admits **any booked vendor**
(migration `20270321980372`, widened by `20270917100000`), so the caterer, the
florist and anyone else contracted on the wedding could advance the night's
programme by reaching the server action directly.

`advanceScheduleBlock` (`apps/web/app/_actions/run-of-show.ts`) now re-checks
the caller **before** it calls the RPC, admitting the same four classes with
the vendor arm narrowed:

| arm | how it is resolved |
|---|---|
| host / couple | an `event_members` row (mirrors `current_event_ids()`) |
| delegate coordinator | accepted, non-removed `event_moderators` row whose grid resolves `schedule:'edit'` (`resolveAreaLevel`) |
| **booked coordinator** | **`current_coordinator_booked_event_ids()`** — the existing SECURITY DEFINER helper (migration `20271013100000`, `'coordinator' = ANY(vp.services)`) |
| Setnayan admin | the shared `isAdminProfile` predicate |

Reused rather than re-implemented on purpose: a marketplace vendor **cannot
read their own `event_vendors` row under RLS**, so a hand-rolled booked check
would silently return "not booked" for everyone.

This is a NARROWING in application code — no migration, no widening. The DB
gate stays as it is; a follow-up migration could tighten it to match. A refused
caller gets `status: 'not_the_coordinator'` with a sentence, never a silent
success.

Guard: `apps/web/lib/run-of-show-coordinator-gate.test.ts` (6 tests). Every
assertion is scoped to the **stripped function body** it is about, so the
docblock explaining the bug cannot satisfy the test meant to catch it coming
back. Mutation-tested 5 ways — remove the gate call · move it after the RPC ·
swap the coordinator helper for `current_vendor_booked_event_ids` · drop the
delegate `'edit'` requirement · turn the refusal into a fall-through — each
went red, restore went green (6/6).

Known follow-ups, deliberately NOT touched (out of this change's file scope):
- `app/vendor-dashboard/clients/[eventId]/page.tsx` passes `canAdvance`
  unconditionally, so a non-coordinator supplier still SEES a button that now
  refuses. The refusal message is returned but `RunOfShowHeader` does not
  render it.
- `app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts`
  does not map the new `'not_the_coordinator'` status, so in the (narrow) case
  where its pool-booking check and the event-vendor-based helper disagree, it
  would report `ok: true` on a refusal.

SPEC IMPACT: None — this implements the existing owner ruling that only the
coordinator advances the run of show; no price, SKU or scope decision.
