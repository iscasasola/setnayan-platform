## 2026-07-27 · feat(day-of): the requests inbox + vendor status updates (build plan §10 #2 + #6)

One shared day-of stream behind one inbox, replacing a device-local log that could
never leave the coordinator's phone.

**The stream.** New table `public.event_day_requests` (migration
`20271013100000_day_of_requests_stream.sql`) with three enums — `day_request_origin`
(`couple` · `vendor` · `host` · `coordinator`), `day_request_kind`
(`issue` · `request` · `status_update`), `day_request_status`
(`open` · `acknowledged` · `resolved`). The origin enum is what lets ONE inbox carry
four lanes instead of four tables; new lanes extend the enum rather than adding a
column any reader must learn about. Every column is NOT NULL-with-default or
nullable, so an INSERT naming only `(event_id, origin, body)` keeps working.

**§10 #2 — vendor status updates.** Six one-tap presets ("On site", "Setup done",
"Ready to start", "Packed up", "Running late", "Need help") write into that same
stream — not a second channel. Body and kind are resolved server-side from the
preset key, so the endpoint cannot post arbitrary text, and only the two presets
that are genuinely work for the coordinator file as `issue`; the rest file as
`status_update` and never inflate the open count.

**§10 #6 — one inbox UI.** `_components/requests-inbox.tsx` renders both sides: the
booked coordinator sees every lane and triages open → seen → done; every other
supplier sees only what they filed, read-only.

**Not a fork.** `issues-log.tsx` keeps its identity and its localStorage log — it is
now the switch, and the local log is the offline fallback that ships when the
control is dark. Its own header called this migration a follow-up needing "a table +
booked-vendor RLS"; this is that follow-up.

**Boundary.** The coordinator on this surface is a *booked vendor* carrying the
`coordinator` tile, not an event member, so `current_event_ids()` never reached them
— new SECURITY DEFINER helper `current_coordinator_booked_event_ids()` admits them
to read and triage. Ordinary suppliers get own-rows-only SELECT and no UPDATE policy
at all, and `canTriage()` in `lib/day-requests.ts` mirrors that exactly so the UI
never offers a button RLS would refuse.

**Privileges.** `REVOKE ALL` from PUBLIC/anon/authenticated, then
`GRANT SELECT, INSERT, UPDATE TO authenticated` — anon holds nothing, and nobody
gets DELETE (a shared coordination record is resolved, never quietly erased). This
is load-bearing: every new relation in `public` ships open under this project's
default privileges.

**Flag-dark.** New activation control `coordinator_requests_inbox`, seeded
`inactive`. Nothing renders from the table until the owner flips it at
`/admin/data-privacy`. Fail-closed on a missing row.

**Verification.** `lib/day-requests.test.ts` — 23 unit tests over the pure decision
logic. `tests/db/day-requests-stream.db.test.ts` — 18 tests against replayed
migrations proving the REVOKE, the four-lane RLS boundary, forge attempts failing,
the CHECK constraints, the resolved_at trigger, and the gate proven by neutralising
it (flip to `active`, watch the answer change, confirm RLS is unaffected by the
flip).

SPEC IMPACT: None — implements `Design_Premium_Guest_Site_2026-07-25/BUILD_INSTRUCTIONS_FOR_OPUS_2026-07-25.md` §10 items 2 and 6 as written. The corpus already describes both; no decision changed. Worth noting for the record that §10 #6's phrase "extend the issues stream" described a stream that had no backing table — `issues-log.tsx` was localStorage-only — so this PR creates the stream's first table rather than altering an existing one.
