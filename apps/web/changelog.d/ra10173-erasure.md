## 2026-07-22 · fix(admin): RA 10173 erasure — replace throwing hard-delete with soft-delete + anonymize

The admin "Delete user" button and the RA 10173 self-serve erasure queue both
funnelled through `deleteUser`/`blacklistUser`, which ended in a hard
`auth.admin.deleteUser`. That **threw for any user with activity** — ~46 FKs to
auth.users/public.users are `ON DELETE NO ACTION`/`RESTRICT`, and
`vendor_team_guard_trg` aborts deleting a vendor's sole admin — so erasure was
**unfulfillable** on real accounts (a 500). Worse: the two PII purges ran and
COMMITTED *before* the throwing delete, so a failed delete left the account LIVE
with its birth data + chat already erased (inconsistent, unrecoverable).

Fix — new shared `eraseUserAccount` helper (soft-delete + anonymize; no
`auth.users` DELETE is ever issued, so all the RESTRICT FKs + the trigger are
sidestepped, and the ordering bug is gone):

1. anonymize the `public.users` PII (`email`→per-user tombstone, `display_name`/
   `phone`/`profile_photo_url`/`birth_date`/`slug`→null) + stamp `deleted_at`
   (the middleware + dashboard layouts reject any session with it set → immediate
   lockout);
2. revoke every live session;
3. scrub the `auth.users` email to the same tombstone (frees the original address
   for re-signup — the blacklist gate still blocks blacklisted ones — and removes
   the email PII from auth);
4. run the existing domain PII purges (owned-event birth data · authored chat).

Best-effort per step (audit-logged, never thrown), so erasure can't trap an
account undeletable. `deleteUser`, `blacklistUser`, and the self-serve queue
(which delegates to them) all now work; the queue can no longer be left
approved-but-not-deleted.

⚠ **SCOPE — this is the foundation, not a complete erasure.** It scrubs the
identity-row PII + owned-event birth data + authored chat. It does **not** yet
scrub a VENDOR account's `vendor_profiles` PII (contact email/phone/owner name),
`face_enrollments` (biometric vectors), or uploaded verification IDs. Completing
the per-account-type PII sweep is a DPO / counsel retention-review follow-up.

SPEC IMPACT: Erasure semantics change (hard-delete → soft-delete + anonymize) +
a flagged completeness follow-up; DECISION_LOG row appended, ties to the Data
Retention Schedule + NPC filing retention item.
