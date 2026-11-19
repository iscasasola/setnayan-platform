## 2026-11-20 · fix(chat): a failed whisper read is not "nobody here"; a deactivated crew seat hears nothing

Follow-up to PR #8040 (a removed co-host reads no chat), closing what its review found. Owner, 20 Nov: "Yes, build it".

- **Whisper bar honest on a failed read.** `readThreadHostPeople` now returns `measured: false` when either of its reads
  is refused. The whisper box says "Couldn't load the co-hosts in this chat. Try again in a moment." and the send core
  refuses with "Couldn't check who is in this chat — your whisper was not sent. Try again." — never "No co-host is in
  this chat", which is the honest empty case only. `readWhisperCoHostIds` returns `{ ids, unread }`; one rule
  (`whisperBlockedLine`) picks the box's words. Guard: `lib/a-failed-whisper-read-is-not-nobody.test.ts` (behaviour
  against a stubbed client + the wiring).
- **Deactivated / removed shop crew lose host-made group seats.** Migration `20271353093349`: `chat_close_unheld_seats()`
  (the 20271352461498 closing step as one helper) + triggers on `vendor_team_members` (deactivated_at / user_id /
  vendor_profile_id change, and DELETE) + an idempotent backfill. Same rule (`chat_seat_is_held`) — no second source of
  truth. Before it, their seat stayed live, so they were still pinged (id-only) and addressable by a private line in a
  group they could no longer read. Prod measured 20 Nov: 0 deactivated members, 0 stale seats — latent, not live.
- **Soft-deleted guests needed nothing new** (measured): the soft delete already ends the `event_members` link
  (`20271261618741`), which fires #8040's trigger. Now pinned by a test.
- **Tests:** `tests/db/a-stale-guest-or-crew-seat-hears-nothing.db.test.ts` — crew tests fail without the migration
  ("not pinged about a new line"), pass with it; plus a co-host removed and added back regains the supplier chat
  (rejoins by themselves or is re-seated; neither trigger nor backfill re-closes a held seat).

SPEC IMPACT: None
