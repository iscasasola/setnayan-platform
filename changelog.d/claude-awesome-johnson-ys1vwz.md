## 2026-11-28 · docs(audit): data + mapping

Read-only audit of stored value maps, shared-number readers, outside-service call paths and data shape (orphans, indexes, N+1, polling, prod test data). Report: `docs/audits/2026-11-28/data-mapping.md`, ordered by severity, with 10 non-overlapping fix groups and read-only SELECTs for the controller to run on prod. No app code or migrations changed.

SPEC IMPACT: None — an audit report; the fix groups need the controller's scoping before any build.
