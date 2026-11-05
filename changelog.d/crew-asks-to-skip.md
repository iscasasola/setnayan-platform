## 2026-11-05 · feat(hub): a crew Member asks to skip a part; the coordinator approves or declines it on the floor with one tap

Owner, 5 Nov, on whether a crew Member may ask to skip a part: *"yes they can request"* (follow-up to #7274).

- **Crew phone** (`/join/crew/[token]`, Change the schedule): **Ask to skip** sits next to the ± move. It files ONE open
  request (`event_schedule_suggestions`, new kind `skip`) through `crew_request_schedule_skip` — the crew door's gates,
  one open ask per part, never a part that has started. A part a **locked** supplier is on says the lock's line
  ("<shop> isn't taking changes.") and offers no ask; a part already asked says it waits.
- **Floor** (coordinator): "Your crew asks" lists their own crew's open skip asks — **Decline · Approve skip**, one tap each,
  through the one accept path (`decideSuggestion`) via `floorChangeSchedule({ op: 'answer' })` (no new server action).
- **An approved skip IS the floor's own Skip** — `decideSuggestion`'s new `skip` branch calls `changeTheSchedule(…, 'floor')`:
  the same write on the answerer's own session, the same change lock, ONE notice to the booked suppliers and (in-app) guests.
  The hosts can answer the same ask from their Schedule's Requests.
- **Told in the app only** — the coordinator gets a `schedule_ask` notice (not on the email allowlist). No new email.
- Migration `20271308669061_the_crew_asks_to_skip`: kind CHECK + `skip`, one-open-skip unique index, a RESTRICTIVE insert
  policy so only the crew door writes a skip ask, `crew_request_schedule_skip` (SECURITY DEFINER, authenticated only).

SPEC IMPACT: DECISION_LOG.md — new 2026-11-05 row "A CREW MEMBER MAY ASK TO SKIP A PART" (owner verbatim), pushed to Setnayan-specs main (0f07e7e5).
