## 2026-11-04 · fix(schedule): a locked supplier's part is said on the chapters' moment sheet, and on the admin event page

DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" (7) CHANGE LOCK — audit follow-up. The lock
(migration 20271303409352, audit D7) refused a host's change in the database and said so on the old rail and
inspector, but the Schedule page's CURRENT editor — the chapters' moment sheet (`moment-sheets.tsx`) — showed nothing
before a change and answered a refused save with "Try again."

- **Host:** the moment sheet now says "<shop> isn’t taking changes." and a
  **Send them a request** when a locked supplier is on the moment, which opens the sheet's own Ask with that supplier picked. A
  refused field save, delete, task line or Suppliers-and-crew tick says "<shop> isn’t taking changes. Send them a request instead." instead of "Try again."
  The lock reaches the sheet on `who.suppliers[].locked`, from the one marks resolver (`times === NOT_TAKING_CHANGES`).
- **Admin:** `/admin/events/<id>` gains a read-only **Suppliers’ schedule** section — each booked shop: Locked since
  <day> · or Open (Times confirmed / Seen / nothing pressed). A refused read says "Couldn't load", never "no suppliers".
- **Lab:** `/dev/chapters-lab?lock=1&moment=1`.
- Guards: `lib/a-locked-part-refuses-the-host.test.ts` (4 new tests; sabotage turned 3 red, restored green).

SPEC IMPACT: None — implements the existing ruling; no schema change.

**Follow-up (coordinator review):** a locked supplier's moment is now READ-ONLY — its values as plain text (no pencil,
chevron, clock or frame), its tasks as text, no Delete or Add a task; the one thing to press is **Send them a request**,
which opens the Ask with that supplier picked (the Ask hides its own open button). The WHOLE moment locks, not only the
locked supplier's crew line: the moment's when / where / what is the locked supplier's part, so the trigger refuses all
of it. Guard: "a locked moment renders no editable inputs" (sabotage: a TypedRow in the branch, a framed `<dl>` — both red).
The editable What pill's cut-off start was the owner's long-answer ride (`lib/form-row.ts`) caught mid-scroll — at rest
it shows its start, ellipsed; unchanged.
