## 2026-07-17 · fix(people): Alaga rights gap-fix — claim becomes a TRUE ownership transfer

Four gaps found auditing the live claim flow, all rooted in one design choice: ownership used to stay with the guardian post-claim (freeze policies). Fixed by making the claim transfer `owner_user_id` to the claimant — the owner's model applied literally.

- **Guardian deletion no longer destroys a claimed adult's record.** Pre-fix, `ON DELETE CASCADE` on `owner_user_id` erased the row with the *guardian's* account even after hand-over. Now the row belongs to the claimant (lives/dies with THEIR account); the guardian is stamped into new `handed_over_by_user_id` (SET NULL on their deletion) for read-only history via `dependents_former_guardian_read`. Unclaimed rows still correctly cascade with their guardian.
- **The claimant gets the RA 10173 erasure right structurally** — as owner they inherit update/delete; the `handed_over_at IS NULL` freeze on the owner policies is dropped (it existed only because ownership used to stay put). UI: claimed rows show an "Erase" confirm (warns the former guardian loses their copy).
- **Godparent edges follow the claim.** Found live in verification: `godparents.owner_user_id` CASCADE meant a claimed adult's ninong/ninang record still died with the guardian's account. The claim action now hands the edges to the subject; migration backfills already-claimed rows; `godparents_subject_read` added as belt-and-braces read for any edge that races the hand-off. UI shows the claimed adult their godparent chips read-only.
- **RA 10173 data export now covers Alaga**: `alaga_dependents` (guardian-stored + claimed-as-own + handed-over history, incl. consent stamps; spouse-shared rows another guardian owns excluded — that's their stored data) + `alaga_godparents`. Active `claim_token` values never export (live bearer secrets; listed in `not_included`).

Migration `20270819200000` applied to prod + version recorded. Verified in rolled-back prod transactions: claim transfers ownership ✓ · claimed row + godparent edge survive guardian `auth.users` deletion ✓ · unclaimed row still cascades ✓. Tests 9/9 · typecheck clean.

SPEC IMPACT: DECISION_LOG.md 2026-07-17 row (ownership-transfer semantics supersede the freeze model of `20270819114210`; guardian history = former-guardian read, not frozen ownership)
