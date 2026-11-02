## 2026-07-21 · fix(privacy): include coordinator_access_consents.scopes in the RA 10173 data export

The RA 10173 data export (`app/api/profile/export/route.ts`) selected
`coordinator_access_consents` but omitted the `scopes` column — the
`{vendor_lock, checkout}` money authorities the subject granted a coordinator
(added 2026-07-19, migration `20270823668011`). The export shipped
`scope_version` (a version string) but not the actual scopes, so a data subject
couldn't see *which* powers they consented to. Added `scopes` to the select.

Gap-check finding (WHATS_NEXT_INDEX §7.4 pattern): a consent field added after
the export was written wasn't reflected in it — same class as the earlier
`marketing_share_consents` / `coordinator_access_consents` misses.

SPEC IMPACT: None (compliance completeness fix; RA 10173 export coverage).
Logged at the bottom of the corpus DECISION_LOG.md (2026-07-21).
