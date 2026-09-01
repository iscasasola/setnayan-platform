## 2026-09-01 · test(entitlements): pin that a paid LIVE_STUDIO order never expires

`checkOrderActive` — the fail-closed gate behind the couple's "Watch the Film"
Live Studio replay embed (`eventSkuActive(..., 'PANOOD_SYSTEM')` in
`app/[slug]/_components/editorial/data.ts`) — queries `status IN (paid,
fulfilled)` and reads no date column, so a one-time paid order confers the
entitlement indefinitely. Added a guard in `lib/entitlements.test.ts` pinning
that no date/time filter is ever applied, so a future change that adds an
expiry cutoff (and would silently make a couple's wedding film disappear years
later) turns this test red immediately. Mutation-tested: a simulated
`.gte('created_at', …)` regression breaks 27 tests including this one; 0 fail
after revert.

No code behavior changed — this session found the two other L5 scope guards
already shipped (`app/(shell)/privacy/google-access/google-access.test.ts`
already byte-pins the disclosed OAuth scope list to `YOUTUBE_OAUTH_SCOPES` +
`DRIVE_OAUTH_SCOPES`) and corrected the corpus runbook instead of rebuilding
them — see `DECISION_LOG.md` 2026-09-01 (L5) for the full writeup.

SPEC IMPACT: `09_Operations/Verified_App_Submission_Runbook.md` corrected in
place (Part 1/Drive does not require Google's OAuth verification review;
Part 2/YouTube's scope table was stale, `youtube.upload` was dropped
2026-07-25) and `DECISION_LOG.md` gained a 2026-09-01 row. Both applied
directly per the 2026-06-04 corpus-edit authorization.
