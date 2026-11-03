## 2026-11-02 · feat(schedule): the host or coordinator asks a booked supplier to change their times; the supplier answers

Owner, 2026-11-02 (DECISION_LOG "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK", item 2): *"receive requests for schedules
from hosts of the event and coordinator?"* Supplier gate audit row D2 (was MISSING).

- **One table, both ways** (migration `20271303655108`): `event_schedule_suggestions` gains `direction`
  (`to_host` — every existing row — or `to_supplier`), `asked_as` (`host` | `coordinator`, checked against who the asker
  really is) and `answer_note` (the supplier's reason on a No). No new table (Rule 8: one fact, one home).
- **Who may ask** (`schedule_asks_host_insert` + `current_user_may_ask_supplier`): the couple as host, a seat with The
  Day = Edit as coordinator, only of a supplier booked on the event, on a moment of the event, with a new time. One open
  ask per moment per supplier. A RESTRICTIVE policy stops a supplier writing a `to_supplier` row to itself (it could then
  answer Yes and move the host's day). The host's resolve policy is now `to_host` only — a host never approves their own ask.
- **Who may answer** (`may_answer_schedule_ask`): only the asked supplier's org, while still booked, while open. A Yes
  runs the ONE accept path (`decideSuggestion`, now direction-aware: `sideMayDecide` refuses the wrong side as 'gone';
  `proposedPatch` is the one patch both directions write), so the moment changes in one place.
- **Host door**: the moment sheet's new "Asked of suppliers" section (`ask-supplier-section.tsx`) — each supplier's latest
  ask and its state (waiting · said yes · said no with the reason), and "Ask a supplier to change their times" opening
  Supplier ▾ · New time · Minutes · Note in place. Rides `updateScheduleBlock` (`moment_op: ask_supplier`) — no new
  exported action (the budget is at its ceiling).
- **Supplier door**: "Asked of you" at the top of their Schedule for the event — who asked (host or coordinator), the
  moment, the new time, the note; Accept, or Decline with an optional reason, answered in place. Rides
  `suggestScheduleChange` (`request: 'answer'`).
- **Notices, in the app only**: `schedule_ask` → the supplier; `schedule_ask_answered` → the asker (enum values in
  `20271302910538`). Neither is on the email allowlist.
- The host's Requests queue and Home's count read `direction = 'to_host'` only.
- Labs: `/dev/chapters-lab?moment=1&asks=1` (and `asks=fail`) · `/dev/supplier-lab?s=schedule&state=asked` (and `askedfail`).
- Guards: `tests/db/the-host-asks-a-supplier-to-change-their-times.db.test.ts` (a request is created; a coordinator
  cannot ask as host; a View seat, a stranger and the supplier itself cannot ask; only the asked supplier may answer; the
  host cannot flip their own ask; a stranger cannot read it) · `lib/the-supplier-answers-the-hosts-ask.test.ts`.

SPEC IMPACT: None — builds the owner's 2026-11-02 ruling (DECISION_LOG "A SUPPLIER'S SCHEDULE BASICS") along the audit's
D2 design note. Not built here: D7's change lock (its own PR), which will route a refused host edit into this ask.
