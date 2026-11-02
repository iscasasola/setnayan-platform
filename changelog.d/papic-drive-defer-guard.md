## 2026-07-20 · fix(papic): Drive-aware defer guard on the full-res drop sweep

**Defensive fix — this change can only PREVENT a deletion, never cause one.**

The weekly full-res drop sweep (`lib/papic-fullres-drop.ts`, fired cron-free via
`claimPeriodicJob('papic-fullres-drop', WEEKLY_GAP_MS)`) is enabled by default
(`PAPIC_FULLRES_DROP_ENABLED !== 'false'`) and `r2Delete`s the couple's full-res
ORIGINAL at day 90. Its only per-event opt-out was the `HIGH_RES_ARCHIVE` SKU —
it had **no Drive awareness at all**. The whole retention model rests on "the
couple's Google Drive holds the full-res", yet the sweep never checked whether
that copy actually landed. A couple whose Drive copy was queued, retrying,
failed, or retry-capped had their only full-res original deleted at day 90.
Unrecoverable.

Added a Drive-aware defer guard:

- `lib/papic-fullres-drop-core.ts` (pure/testable): `DriveCopyState`
  (`not_connected` | `connected` | `unknown`), `isDriveCopyConfirmed()`,
  `confirmedDriveKeys()`, `isDriveDeferred()`. A copy counts as CONFIRMED only
  when `drive_file_id` is present **and** `copied_high_res !== false`.
- `lib/papic-fullres-drop.ts`: `loadEventDriveCopyState()` reads Drive intent
  from `oauth_grants` (`drive` / `drive_overflow` / `drive_photo_delivery`,
  revoked-or-not) plus the legacy `events.photo_delivery_folder_id` /
  `photo_delivery_status`, then batch-resolves confirmed keys from BOTH
  `drive_copy_artifacts` and `photo_delivery_artifacts`.
- **Fails SAFE**: every error/ambiguity path returns `unknown`, which defers every
  photo for that event. A read failure must never authorize a deletion.
- Drive never connected → behaviour is unchanged.
- The `HIGH_RES_ARCHIVE` skip, `DEFAULT_FULL_RES_RETENTION_DAYS` (90), and the
  sweep's enabled-by-default state are all untouched.
- Deferrals are **logged**, not silently skipped (`console.warn` with per-event
  counts + the unreadable-state reason), so a stuck Drive sync is observable.
- Summary gains `deferredDriveCopy` + `driveStateUnknownEvents` (surfaced by
  `/api/cron/papic-fullres-drop`).
- 9 new unit tests in `lib/papic-fullres-drop-core.test.ts` cover confirmed →
  eligible, queued/failed/missing → deferred, not-connected → unchanged, and
  read-error → deferred.

No migration (`copied_high_res` already exists per
`20260726000000_drive_copy_layer_foundation.sql`).

SPEC IMPACT: None — implements the guard already ruled MANDATORY by
`0012_papic/Papic_Build_Brief_2026-07-17.md` ruling #4; no corpus text changes.
