## 2026-09-27 · feat(rsvp): "Who can RSVP?" and "one question at a time" are one stored value each

Guest pathway brief, item 4. Both ride inside the existing
`events.rsvp_ask_config` jsonb — no new column, no migration:

- `whoCanRsvp` — `'guest_list'` (Only my Guest List, the default and what an
  absent key means) or `'anyone'` (Anyone, I approve — a person without a key
  may ASK to join and waits in Requests).
- `oneAtATime` — boolean, default off.

`lib/rsvp-ask.ts` now exports the typed readers every surface uses —
`readWhoCanRsvp`, `anyoneMayAskToJoin`, `readOneAtATime` — plus
`resolveReplyBy`, which returns the couple's own `guest_list_edit_deadline`
when set and otherwise 30 days before the event, marked as the default (it
never overwrites a set deadline). The sanitizer the Maker's draft path runs
keeps both new keys, so saving one of the six question switches can no longer
reset "Who can RSVP?". Held by `apps/web/lib/who-can-rsvp-is-one-value.test.ts`
(sabotage-checked: dropping the key in the sanitizer fails 3 tests; dropping
the set-deadline branch fails 1).

SPEC IMPACT: None — implements DECISION_LOG 2026-09-26 "NOBODY WITHOUT A KEY" /
2026-09-27 guest pathway prototype rows as written.
