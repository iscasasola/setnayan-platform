## 2026-07-19 · fix(privacy): include coordinator + marketing-share consent receipts in RA 10173 data export

- `GET /api/profile/export` now bundles two previously-omitted consent tables:
  - `coordinator_access_consents` — the subject's own coordinator data-sharing
    consent receipts (scoped to `consented_by_user_id`; internal id + moderator
    FK excluded; grant + revocation stamps included).
  - `marketing_share_consents` — the subject's per-artifact social-sharing
    grants (scoped to `customer_id`; incl. credit mode, revocation, post
    evidence + take-down stamps).
- Both follow the established self-scoped query + empty-array section pattern
  already used for orders / payments / face-enrollment consent metadata.

SPEC IMPACT: Privacy — RA 10173 data export now includes coordinator_access_consents + marketing_share_consents (completeness gap #4 in WHATS_NEXT_INDEX §7).
