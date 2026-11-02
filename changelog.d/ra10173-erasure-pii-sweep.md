## 2026-07-22 · fix(admin): RA 10173 erasure — extend the anonymize sweep to the user's other owner-scoped PII

Follow-up to the erasure unblock (PR #3542). A full schema audit found that
because `eraseUserAccount` issues no `auth.users` DELETE, NO FK `ON DELETE`
behaviour fires — so a lot of the erased user's personal data persisted beyond
the identity row + owned-event birth data + authored chat. This scrubs the
clearly owner-scoped set (harms no other data subject):

- **`users` row (extended):** + `religion`/`civil_status`/`sex` (§3(l) sensitive
  PI) + their consent stamps, `address_normalized`, `venue_address`/`venue_name`,
  `social_post_url`, `last_login_at`, `last_ghost_check_at`.
- **owned `events`:** + `owner_email`, `owner_display_name`,
  `photo_delivery_account_email`, and the **live encrypted photo-delivery OAuth
  token**.
- **new `purgeUserOwnedRecords`:** `people` node (anonymize), `user_face_profiles`
  (delete — biometric), `push_subscriptions` (delete), `dependents` + `godparents`
  (delete — private family records), `guest_claims` (anonymize), `help_messages`
  (anonymize, keep shell), `vendor_profiles` (scrub contact PII, blank name,
  unpublish).

Every step keeps the existing best-effort / never-throw / idempotent posture
(NOT NULL columns tombstoned/blanked, unique slugs freed). Verified column names
+ nullability against the schema.

⚠ **Deliberately NOT scrubbed — escalated to DPO/counsel** (see
`RA10173_Erasure_PII_Completeness_2026-07-22.md`): per-event guest-side
biometrics + the R2 objects behind verification docs / face selfies / chat
attachments (a DB scrub orphans the file); shared-event fields; financial + BIR
records (statutory retention); consent-audit tables; the fraud identity graph;
third-party PII the user entered; and direction-dependent `guests` rows.

SPEC IMPACT: extends erasure PII coverage + records the DPO judgment-call queue;
DECISION_LOG row + new corpus doc.
