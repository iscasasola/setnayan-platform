# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(drive): 2nd Google Drive per event — connect + automatic overflow (HELD for a 2-Drive smoke test)

Functional wiring for "up to 2 Google Drives per event" (owner 2026-07-11), on top of the two schema slices (`drive_overflow` provider value + per-Drive folder namespace). Same `drive.file` scope + OAuth client as Drive #1 — no new verification.

- **Connect a 2nd Drive** — `/api/oauth/drive/start?slot=overflow` writes an `oauth_state` with `provider='drive_overflow'` and forces the Google account chooser (it must be a *different* account). The shared `/callback` branches on the state provider: `'drive_overflow'` → upserts the `drive_overflow` grant and **skips** both the folder bootstrap and the `events.photo_delivery_folder_id` update (those belong to Drive #1 and must not be clobbered). A UI affordance ("Connect a second Drive **you own**") is added to the Papic studio's connected state.
- **Automatic overflow** — `runDriveCopyBatch` starts on Drive #1; on a Google `storageQuotaExceeded` (Drive #1 full) it fails over to the `drive_overflow` grant for that file and the rest of the batch. Folder ids are per-Drive, so each provider has its own folder cache; `getEventDriveAccessToken(eventId, provider)` + `ensureArtifactFolder`/`ensureFolderRow` are parametrized by `driveProvider` (backward-compatible default `'drive'` — the single-Drive path is byte-for-byte unchanged). The overflow Drive's folder tree is created lazily by the copy runner on first overflow upload (one tree, no redundant bootstrap).
- **Pure `isDriveQuotaExceededError`** extracted to a non-`server-only` `drive-copy-core.ts` (repo `-core` pattern) with 4 unit tests — true on Google's `storageQuotaExceeded`, false on permission/rate-limit/network/folder errors (no false failover).
- **Core invariant honored:** the couple's Drive full-res is NEVER compressed/dropped by us — this only routes full-res between the couple's own two Drives.

**⚠ HELD — do NOT auto-merge.** The Drive upload path + a real quota-full state cannot run in CI. Verified here: full typecheck, 1489/1489 unit tests (4 new), lint. **Smoke test to merge:** connect two real Google accounts as Drive #1 + #2 on one event → fill #1 (or force the quota path) → confirm new captures land in Drive #2, nothing lost, and Drive #1's full-res untouched.

Known edge (documented, not blocking): if Drive #1 is fully disconnected (not just full) while only Drive #2 is connected, `pushToDriveCopy`'s primary-token pre-check returns "not connected" and skips the batch — the failover triggers on a quota error *during* upload, not on a wholly-absent primary. Real weddings connect #1 first, so this is a non-issue in practice; a follow-up can broaden the pre-check if needed.

SPEC IMPACT: None new — `Pricing.md § 2.1` core-invariant block + DECISION_LOG 2026-07-11 already carry the 2-Drive rule + safety guardrails.
