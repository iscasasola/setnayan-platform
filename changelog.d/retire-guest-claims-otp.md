## 2026-06-26 · chore(guests): retire the dormant guest_claims / OTP claim code

Invite/Join v2 (PRs #2186/#2192/#2194/#2199/#2205) replaced the privacy-first
email-OTP "claim your seat" flow with optimistic admit + name matching, leaving that
flow with zero callers. Deleting the dead code:

- Removed routes `app/join/[eventId]/verify/` + `app/join/[eventId]/pending/` (the OTP
  code-entry + review-pending screens — unreachable since #2186).
- Removed `app/join/[eventId]/claim-actions.ts` (verify/resend/request-review actions),
  `lib/guest-claim-flow.ts` (`processGuestClaim` + `sendClaimOtpEmail`), and
  `lib/guest-claim-result.ts` (+ its test) — all orphaned.
- Pruned `lib/guest-claim.ts` to JUST the name matcher (`classifyClaimMatch`,
  `nameSimilarity`, `normalizeName`, `MAX_NAME_LENGTH`, types) — the only thing the live
  join action still imports. Dropped the OTP constants/crypto (`generateOtpCode`,
  `hmacOtp`, `verifyOtp`, `maskEmail`, `OTP_*`/`CLAIM_*`) and the `node:crypto` import.
- Removed the dead `join.pending` / `join.verify` route helpers from `lib/routes.ts`;
  repointed the now-stale `guest_claim_pending` comment in `lib/notifications.ts` to its
  real v2 source (`notifyCoupleUnlisted`).

No migration. The `guest_claims` table + the `finalize_guest_claim` /
`register_guest_claim_otp_attempt` RPCs are left in the DB as tombstones (non-destructive
— dropping them is a separate decision; nothing references them in code anymore).
typecheck ✅ · lint ✅ · no tests referenced the removed symbols.

SPEC IMPACT: none (dead-code removal; the live v2 behavior is unchanged).
