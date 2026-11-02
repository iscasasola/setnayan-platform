# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(drive): per-Drive folder namespace for the 2nd Google Drive per event

Schema foundation for "up to 2 Google Drives per event" (owner 2026-07-11) — the second slice after `20270720727938` added the `drive_overflow` provider value.

- **Migration `20270721479486`** — adds `drive_provider TEXT NOT NULL DEFAULT 'drive'` (CHECK in `'drive'`/`'drive_overflow'`) to `drive_copy_folders` and widens its unique from `(event_id, kind)` → `(event_id, kind, drive_provider)`. Google folder IDs are per-Drive, so the overflow Drive needs its own root + artifact subfolders; this gives each Drive its own folder rows.
- **Additive + backward-compatible**: existing rows default to `'drive'`, so the widened unique matches the old key for every existing row — the single-Drive copy path is byte-for-byte unchanged. Validated against the live prod schema in a rolled-back transaction (constraint name `drive_copy_folders_event_id_kind_key` confirmed; applies cleanly).

The functional wiring that USES this column — `ensureArtifactFolder`/`getEventDriveAccessToken` parametrized by `driveProvider`, the copy-runner quota-exceeded failover to the overflow Drive, the connect-2nd-Drive OAuth flow, and the UI — is the next slice, held for an end-to-end smoke-test with two real Drives (Drive I/O + quota-full can't be exercised in CI). The couple's Drive full-res is NEVER compressed/dropped by us — only our R2 web copy is (core invariant).

SPEC IMPACT: None new — `Pricing.md § 2.1` core-invariant block + DECISION_LOG 2026-07-11 already carry the 2-Drive rule + safety guardrails.
