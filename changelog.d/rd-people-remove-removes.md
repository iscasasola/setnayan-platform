## 2026-10-23 · fix(people): ✕ → Remove on People removes — from either side — and never reports success for nothing

Owner, on account › People: *"why can't i delete anyone"*. A connected row ("Marco Testing · No label yet") pressed ✕ → Remove closed the sheet, showed nothing, and stayed.

- **Cause.** `withdrawConnection` filtered on `from_person_id = me` — the declarer's side only. On a connection the OTHER person asked for (and I accepted) I am `to_person_id`, so the UPDATE matched zero rows; PostgREST returned no error and the action returned `{ ok: true }`. RLS (`person_connections_update`) and the transition guard always allowed the recipient to end a non-draft row — only the action's filter was wrong, contradicting its own docblock ("a confirmed connection … comes down the same way, from whichever side asks").
- **Server.** The removal now reaches every row I declared and a CONFIRMED row I was asked into (`removableConnectionFilter`), returns its rows, and treats zero as a failure (`removalWriteResult`). A request still waiting on me keeps Decline as its answer — never a quiet soft-delete.
- **Screen.** The confirm goes through `removeFromPeople`: an empty or partial id list is refused before any call, a partial bulk removal says "Removed 2 of 3 …", and success says so ("Marco left your people.").
- **Loved ones.** `deleteDependent` / `deleteGodparent` (the existing alaga removes) landed on `removed=1` whatever the delete did; a refused or zero-row delete now comes back with an error.
- **Not touched.** The other person's account and `people` node, and every event's guest list — a guest row is its own record (`guests.person_id`), and no ruling ties leaving People to leaving an event.
- Guards: `lib/people-remove.test.ts` (empty / missing-id / partial / zero-row), `app/dashboard/(account)/people/remove-is-counted.test.ts` (every People removal write returns its rows and is judged), `tests/db/people-remove-removes.db.test.ts` (each row kind, using the action's own filter).

SPEC IMPACT: None — behaviour now matches the existing rule (the action's docblock and RLS); no new ruling.
