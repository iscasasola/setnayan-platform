## 2026-09-18 · chore(db): drop nine retired ends nobody calls or writes (S37)

**SPEC IMPACT:** None — every object is the leftover of a feature already retired or replaced in the
decision log; no product behaviour changes.

S26's both-ends guard (#5625) ranked each as an orphan. Each was re-measured against `origin/main`
**and production** (row counts, function bodies, policies, views, FKs), and each is **(b) delete the
end nobody needs**. Migration `20271234083820_retired_ends_nobody_calls.sql`, not CASCADE:

| object | why it is dead | prod rows |
|---|---|---|
| `couple_briefs`, `vendor_bid_submissions`, `derive_brief_token_cost()` | the bid/RFP marketplace, retired with the token economy | 0 · 0 |
| `papic_photo_challenge_sponsorships` | the ₱400 per-event Challenge; replaced by the 28-day subscription, read removed and marked RETIRED in `20271182071895` | 0 |
| `vendor_release_history` | soft-hold release audit whose writers never shipped; the inquiry lifecycle lives on `chat_threads.inquiry_status` | 0 |
| `release_event_lead_holds()`, `sweep_ghosted_lead_holds()` | lead-token hold housekeeping; callers deleted with the hold retirement (`43996627c`); `lead_token_holds` = 0 | — |
| `user_holds_founder_seat()` | anon-callable, no caller; founder logic runs on `event_host_holds_founder_seat()` | — |
| `register_guest_claim_otp_attempt()` | the email-OTP guest claim, replaced by Invite/Join v2; had drifted to anon-executable | — |
| `report_guest_capture()` | never called since written; took the reporter's identity from an anon caller's argument | — |

**Guards — none weakened:**
- `anon-table-grants-closed`: the three dropped tables STAY in their batch lists (no floor is trimmed)
  and move to a new `DROPPED_AFTER_CLOSING` set that must be **absent** from the schema.
- `delete-lane-and-orphans`: the bid-table half now pins that both bid tables stay gone (a revival
  must restate the SET-NULL rule).
- `the-challenge-is-a-subscription`: "a legacy row entitles nothing" → "the legacy table does not
  exist, and the entitlement gate never names it".
- erasure + export guardrails: `vendor_release_history`'s two purge rules removed from `coverage.ts`
  (a rule on a dropped table records an erasure FAILURE on every request) and the table listed as
  DROPPED, the repo's pattern for the parser that cannot read `DROP TABLE`.
- `anon-rpc-surface.baseline.txt`: three lines deleted (the test requires it); the exposure baseline
  regenerated — a pure narrowing, 58 lines removed, none added.
- Ugat J20 loses its two sponsorship claims.

⏭ Not done here: `finalize_guest_claim` and `guest_claims` (same retired OTP flow, not flagged by the
guard because TS comments name them), and `platform_settings.lead_hold_sweep_last_run_at`.
