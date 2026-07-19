import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDriveQuotaExceededError } from './drive-copy-core';

// The 2-Drive overflow (owner 2026-07-11) fails over to the couple's 2nd Drive
// ONLY on a genuine "Drive #1 is full" error. This classifier is the trigger, so
// a false negative silently strands files and a false positive burns the overflow
// on a transient error — both worth a guard.

test('detects Google storageQuotaExceeded from the uploadFileToDrive message', () => {
  const err = new Error(
    'drive_upload_403:{"error":{"errors":[{"reason":"storageQuotaExceeded","message":"The user has exceeded their Drive storage quota."}],"code":403}}',
  );
  assert.equal(isDriveQuotaExceededError(err), true);
});

test('case-insensitive (survives casing drift in the payload)', () => {
  assert.equal(
    isDriveQuotaExceededError(new Error('...STORAGEQUOTAEXCEEDED...')),
    true,
  );
});

test('accepts a non-Error value (string / unknown)', () => {
  assert.equal(isDriveQuotaExceededError('storageQuotaExceeded'), true);
  assert.equal(isDriveQuotaExceededError(null), false);
  assert.equal(isDriveQuotaExceededError(undefined), false);
});

test('does NOT fire on other Drive errors (no false failover)', () => {
  // A 403 that is NOT a quota error (e.g. permission), a rate-limit, a network
  // blip, or our own folder-missing sentinel must all stay on Drive #1.
  assert.equal(
    isDriveQuotaExceededError(
      new Error('drive_upload_403:{"reason":"insufficientFilePermissions"}'),
    ),
    false,
  );
  assert.equal(isDriveQuotaExceededError(new Error('drive_upload_429:rateLimitExceeded')), false);
  assert.equal(isDriveQuotaExceededError(new Error('drive_folder_unavailable')), false);
  assert.equal(isDriveQuotaExceededError(new Error('ETIMEDOUT')), false);
});
