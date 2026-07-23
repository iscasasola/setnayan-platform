## 2026-07-23 · fix(privacy): RA 10173 — erase guest-side biometrics/selfies + keep temp password out of the URL

Closes three verified right-to-erasure / credential-leak gaps in the account
lifecycle (one PR, adjacent files, same erasure theme).

- **Account deletion now erases the subject's per-event guest-side biometrics.**
  `eraseUserAccount` never touched `guest_face_enrollments` (no user FK), so a
  deleted user's `face_vector` + the full-res R2 selfie behind `asset_url`
  survived indefinitely. New `purgeUserGuestBiometrics` resolves the subject's
  guest identities via **BOTH** user→guest links — `event_members.guest_id`
  **and** the person spine (`guests.person_id` → `people.claimed_by_user_id`) —
  deletes the R2 selfie objects, hard-deletes the enrolment rows (vector
  included), and nulls the subject's own selfie display photos. Service-role,
  best-effort + audit-logged per step. The person-spine link is essential: a
  public-page selfie RSVP writes a `guest_face_enrollments` row with **no**
  `event_members` insert, so an `event_members`-only resolution would leave that
  face vector + selfie surviving deletion for a subject who never joined the
  event but later signed up + deleted their account under the same email.
- **Host consent-withdrawal now actually deletes the biometric, not just
  tombstones it — for every host actor.** Withdrawing photo consent on a guest
  used to only set `revoked_at`, leaving `face_vector` + the R2 selfie in
  storage. Photo-consent OFF now deletes the R2 selfie objects + hard-deletes
  the enrolment rows; face-recognition-exclusion (photo consent retained) nulls
  `face_vector` + `vector_model` + revokes but keeps the still-consented display
  image. **The biometric mutations run through the service-role admin client**,
  gated on the already-succeeded, edit-authorized `guests` update: a
  co-host/coordinator with `guest_list='edit'` (whose `guests` write is allowed
  by `guests_moderator_write`, FOR ALL) is **not** `member_type='couple'`, so
  under the user JWT the enrolment DELETE — governed only by the couple/admin
  `couple_writes_face_enrollment` policy — silently matched 0 rows, leaving the
  vector alive while `r2Delete` (not RLS-gated) had already removed the selfie:
  a dangling asset + a retained biometric. The admin client closes that gap.
- **Temp password no longer rides the URL.** `resetUserPassword` redirected to
  `/admin/users?temp_password=<plaintext>&for_email=<email>`, landing plaintext
  credentials + the account email in Vercel/edge request logs and browser
  history. It now delivers them via a short-TTL (120s) httpOnly cookie
  (`setnayan_admin_pw_flash`, path=/admin) that the Accounts surface reads
  server-side and renders once; the `?temp_password/for_email` passthrough is
  removed from the `/admin/users` redirect stub.
- Extracted pure helpers to `lib/account-erasure.ts` (`distinctGuestIds`,
  `distinctPersonIds`, `serializeTempPasswordFlash`, `parseTempPasswordFlash`)
  with red/green unit tests in `lib/account-erasure.test.ts`, including a test
  asserting the biometric-purge resolution unions event-member + person-linked
  guests (a guest reachable only through the person spine is still targeted).

**Adoption hardening (adversarial review before merge):** the consent-withdrawal
path routes the biometric purge through the service-role client — but the
RLS-scoped `guests` UPDATE that authorizes it returns NO error on a 0-row
(unauthorized) match, so `!error` was not proof of authorization and any caller
could have wiped an arbitrary guest's biometrics. Fixed by requiring the UPDATE
to return the row (`.select('guest_id')`) before any service-role mutation runs.
Plus CI fixes: escaped a JSX apostrophe, de-secreted a test fixture (gitleaks
false positive), and marked the two legitimate `guest_face_enrollments`
erasure lines with `chat-guard-allow` (they read only the R2 key, never a vector).

No schema/RLS change — resolves via existing FKs + existing couple/admin
policies. DPO sign-off items are enumerated in the PR body.

SPEC IMPACT: None. (Implements erasure obligations already asserted in the
Data Retention Schedule / DPIA face-vectors corpus; no locked decision changes.)
