## 2026-06-25 · fix(guests): clean up the orphan guest a racing claim-approval could leave

High-stakes audit finding (LOW, decision-free). `approveClaimAction` guarded the claim only with a non-atomic read-check, then INSERTed a new `guests` row BEFORE the atomic `finalize_guest_claim` RPC. The claims UI shows two approve forms per row ("Confirm as matched" + "Add as new guest"), each disabling only its own submit — so a double-click fired two concurrent approves: the loser created a guest, then finalize short-circuited (`already_confirmed`) without using it, leaving an orphan pending guest on the couple's list (no `event_member` points at it; `guests` has no uniqueness backstop).

Fix (no migration, airtight beyond the UI trigger — also covers two tabs / programmatic races): track whether THIS call minted the guest; after `finalize_guest_claim`, if it didn't bind our fresh row (`already===true` or `linked!==true`), delete the orphan and return before the email so only the winning call notifies the claimer. The decision is a pure predicate, `newGuestIsOrphaned`, in a new dependency-free `lib/guest-claim-result.ts` (the existing `lib/guest-claim.ts` is `server-only`); a null/ambiguous RPC result deliberately keeps the row (never risk deleting a possibly-bound guest).

- `lib/guest-claim-result.ts` (+ 5-case test): the orphan predicate.
- `app/dashboard/[eventId]/guests/claims/actions.ts`: track `guestWasCreated`; orphan cleanup after finalize.

typecheck clean; lib unit tests green (+5). No migration; no behaviour change on the happy path.

SPEC IMPACT: None.
