## 2026-10-04 · fix(security): who decided a song request is set by the server, never by the caller

`authenticated` held table-level UPDATE on `event_song_requests`, and the only
UPDATE policy (`event_song_requests_decide`) admitted `current_event_ids()` —
every member of the event, invited guests included, since that helper has no
member_type filter. Any member could PATCH `status`,
`decided_by_vendor_profile_id` and `decided_at` straight through PostgREST and
claim a supplier decided a request it never saw. #6316 closed the same forge on
the guest-delete Undo; this closes the direct-API door.

Migration `20271263384666_song_request_decisions_are_server_decided`:

- revokes UPDATE (table and every column) from PUBLIC / anon / authenticated,
  and drops the `_decide` policy, so a reflexive re-GRANT updates zero rows
  instead of reopening the hole. No session-client path ever wrote this table,
  so nothing legitimate loses access (call-site audit in the migration header).
- adds `decide_song_request(event, request, decision, vendor_profile)`:
  SECURITY DEFINER, pinned search_path, EXECUTE for service_role only. It is the
  only writer of the decision columns. `decided_at` is `now()` (there is no
  parameter for it), the decision vocabulary is checked fail-closed, the
  credited shop must have a booking on the event, `event_id` is re-checked next
  to the primary key, and touching zero rows raises an error.

`decideActSongRequest` (on-the-day actions) now calls that function. It still
takes no profile from the browser: it credits the profile the song_desk gate
resolved from the caller's own session. It stays service-role because the paid
half of the right to decide lives in TypeScript (PR #3876).

Guarded by `apps/web/tests/db/a-song-decision-is-server-decided.db.test.ts`.
Each guard was sabotaged (re-grant plus re-policy, drop the coalesce, make the
booking check always pass, add a browser-supplied profile): each went red, and
went green again once restored. `exposure-surface.baseline.txt` was regenerated.
The diff only narrows access: `authenticated` goes from SU to S on the table and
its columns, and the policy is removed.

SPEC IMPACT: None. This enforces the existing rule that the act decides through
the paid song desk. The host-override leg in the 2026-07-27 policy was never
built into any surface.
