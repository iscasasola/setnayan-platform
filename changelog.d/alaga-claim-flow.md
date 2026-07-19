## 2026-07-16 · feat(people): Alaga claim/hand-over flow — the ownership-transfer mechanism

The owner-locked ownership rule (guardian is rightful owner; a person's profile transfers only at 18; pets/other rehome guardian→guardian) existed only as helpers — nothing could actually hand a profile over. The live Alaga copy promises "a child's becomes their own at 18"; this builds the mechanism.

- **Migration `20270819114210_dependent_claim_handover.sql`** (applied to prod): `claim_token` / `claim_token_purpose` (`claim`|`rehome`) / `claim_token_expires_at` on `dependents`; splits the owner FOR ALL policy into per-command policies so a **handed-over row is read-only to its guardian** (the adult's RA 10173 rights attach — guardian keeps the history, loses the pen); adds `dependents_claimed_read` (the claimant reads their own claimed record). Spouse-read + admin override unchanged.
- **Guardian actions** (`dependent-actions.ts`): `createHandoverLink` (purpose derives from kind — person→claim gated by `isClaimEligible` age≥18 proof; pet/other→rehome; one active link, 7-day expiry, `randomBytes` token) + `revokeHandoverLink`.
- **Claim landing `/claim/[token]`**: service-role validated (invalid/expired/revoked → inert screen), own-link guard, signed-out visitors get `/login`+`/signup` with `?next=` return. Redemption is ONE conditional service-role UPDATE — atomic, so raced/expired/underage redeems match zero rows; the age proof (`birth_date <= today−18y`, Manila, leap-day-clamped `claimBirthdateCutoff`) is re-checked in the WHERE, not trusted from mint time. Rehome resets `shared_with_spouse` (old household consent doesn't travel).
- **Guardian UI** (`dependents-section.tsx`): per-row hand-over block ("X is of age — create their hand-over link" / "Transfer care to someone else", copy + expiry + revoke); handed-over rows show "Their own account since DATE" (claimant sees "Your own profile") and lose Remove/share/edit affordances to match the RLS freeze.
- **Lib + tests**: `isClaimEligible` (18+ incl. elders; no birthday = no proof) + `claimBirthdateCutoff` (leap-day clamped down — a Mar-1-born can't claim a day early on Feb 29); suite 9/9 green.

Verified: typecheck clean · unit suite 9/9 · `/claim/<bogus>` renders the inert screen live (flag on) · claim/replay/underage/rehome all exercised against the prod schema in a rolled-back transaction (hand-over ✓, token single-use ✓, 17-year-old blocked ✓, pet moved + sharing reset ✓).

Prod DB note: migration applied via psql + version recorded (`supabase db push` was blocked by an out-of-band remote version `20270818084314` not present on main — left untouched, pre-existing).

SPEC IMPACT: DECISION_LOG.md 2026-07-16 rows (dependent ownership model · Alaga name lock — this PR closes the "claim/transfer flow unbuilt" gap; elder claim-on-request ships here too, as elders are claim-eligible from day one)
