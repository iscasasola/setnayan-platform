## 2026-10-04 · fix(privacy): a guest reads only their own song requests; nobody else's anon key

`event_song_requests_read` admitted `current_event_ids()`, which returns every
`event_members` row of the caller with no member_type filter, and
`authenticated` held table-level SELECT. So any invited guest with an account
could read every request on the event through PostgREST: other guests'
`guest_id` and `requester_name`, and every walk-in's `anon_key`.

`anon_key` authorises nothing (the scanned master QR token is the open lane's
authorisation; the key is only the per-device rate-limit bucket and the handle a
device mute would use). But it is a stable pseudonymous device id that links one
phone's requests across events, and its owner is a device with no account, so no
browser role has a reason to read it.

Migration `20271263627893_song_requests_read_only_what_is_yours`:

- the read policy now admits exactly: the hosts (`current_couple_event_ids()`,
  all rows); a delegate only where the host left The Day (`schedule`) at View or
  Edit (the same rule `event_song_picks_host_select` uses since #6315); a guest
  only their own rows (`guest_id IN current_user_guest_ids()`); admin.
- `authenticated` loses table-level SELECT and gets SELECT back on every column
  except `anon_key`. A column added later stays closed until granted on purpose.

Every shipped reader keeps working: the guest list's search (session client,
`guest_id, songs(...)`) is a host read; the paid act's inbox, the interconnect
probe and all submit/decide/release/restore RPCs run as service_role or SECURITY
DEFINER. A delegate with The Day Off loses song words in the guest-list search,
which already degrades gracefully on a refused read.

Proven by `apps/web/tests/db/a-guest-reads-only-their-own-song-requests.db.test.ts`
(guest own-only, anon_key refused to guest and hosts, hosts all, delegate per
level, non-member nothing, admin all), each sabotaged red then restored green.

SPEC IMPACT: None. Aligns the implementation with the existing People-with-access
area model (The Day covers songs) and the "a guest sees their own" rule; no
product decision changed.
