## 2026-09-30 · fix(guests): only the host finalizes the guest list; no sides on a sideless event; adding from your people asks nothing

Owner report, live: a birthday created for TODAY ("Birthday Salubong ni Ate") showed "0 of 0", said "Guest list
finalized", and "Add from your people" added nobody.

- **Root cause, measured on prod.** `guest_count_locked_at` was stamped 7 minutes after the event was created. With
  no reply-by date set, the old lazy rule closed the list at `event_date − 14 days`, and for a same-day event that
  was already two weeks gone. The first Guest list visit stamped it, and after that `guard_guest_edits_when_locked`
  refused every add, including the people picker's. All 4 stamps in prod came from that date rule
  (`guest_list_edit_deadline` NULL on each, no supplier booked on any).
- **Only the host finalizes** (owner: "i must click a finalize to finalize it"). `guestListIsClosed` takes the stamp
  alone. `ensureFinalized` became `readFinalizeState`, a pure read. New `finalizeGuestList` / `reopenGuestList`
  (lib/pax.ts) sit behind a host fence. One server action, `setGuestListFinalized`, and a Finalize / Reopen control
  with a confirm on the Guest list. Migration `20271256824468` clears every existing date-derived stamp and makes
  the supplier brief's `pax.finalized` read the stamp only. The reply-by date is still printed on the invitation;
  it closes nothing.
- **No sides on a sideless event** (owner: "why is there groom and bride's side for a simple event"). `eventHasSides`
  (from the profile's role set) now gates the Side filter (desktop and phone), the Side column, the bulk
  "Assign side…", the phone Assign sheet's Side, side sort and grouping, the arrange menu, the people picker, and
  the mind map's side branches.
- **Add from your people asks nothing** (owner: "we should not ask if they are my connected people"). The Last name
  box is gone. It held Add shut, and it unmounted on the first keystroke, which saved "buanhogclaire B". A one-word
  name goes on with the missing-surname mark `—`. The side choice is one PickMenu. Migration `20271257194736`: a
  connected person whose node has no name is named from their account (first + last, then display name). The
  WHERE fence is byte-identical.
- **A guest never reads a passed or default reply-by date** (controller decision). New `guestReplyBy` in
  `lib/rsvp-ask.ts` returns a date only when the host SET one and it is today or later. The invitation, the reply
  page and the reminder email use it; `resolveReplyBy` (with its 30-day default) is left for the host's Maker only.
  Guard: `lib/a-guest-never-reads-a-passed-reply-by.test.ts`.
- **Only a person can be invited from your people** (owner: "business and pets and gadgets are not people. so not
  allowed to be invited"). A loved one is offered only when `dependent_kind = 'person'`; the roster now carries
  `dependentKind`. Guard: `lib/only-a-person-can-be-invited.test.ts`.
- Empty Guest list copy: "No guests yet. Start by adding your first guest."
- Deleted the unreferenced `setEstimatedBudget` action to keep the server-action budget at its ceiling.
- Guards (each sabotaged red, then restored): `lib/guest-list-closed.test.ts`,
  `guests/a-simple-event-has-no-sides.test.ts`, `the-whole-samahan-can-come.test.ts` (no-question add),
  `plan3d-control.test.ts`, `the-vendor-brief-survives-its-own-schema-drops.db.test.ts` (a passed deadline no longer
  finalizes), `connection-name-visibility.db.test.ts` (account-name fallback, fence unchanged).

SPEC IMPACT: `DECISION_LOG.md`, one row for the 2026-09-30 owner rulings (finalize is a host action only and can be
reopened; non-wedding events have no sides; the people picker never asks about a connected person). It supersedes
the auto-finalize at the guest-list deadline from Adaptive Pax Pricing decision ⑥ (2026-06-13).
