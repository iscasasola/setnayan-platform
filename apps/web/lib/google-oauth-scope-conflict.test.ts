/**
 * REGRESSION — Google refuses to issue one consent covering both a YouTube
 * scope and Drive's `drive.file`. Requesting them together returns:
 *
 *   Access blocked: Authorization Error
 *   This request contains scopes that cannot be requested together:
 *   [.../auth/youtube, .../auth/drive.file]      (Error 400: invalid_request)
 *
 * We never request both in one `scope` param — but `include_granted_scopes=true`
 * (incremental authorization) asks Google to fold in every scope the user has
 * ALREADY granted, which reintroduces the conflict for any account that
 * connected both Live Studio (YouTube) and Papic's Drive. Observed live
 * 2026-07-25; it blocked the Google OAuth verification demo recording.
 *
 * The failure is ORDER-DEPENDENT and therefore very easy to reintroduce:
 * whichever integration is connected SECOND is the one that breaks, so a fresh
 * account tests perfectly clean. That's why this is asserted rather than left
 * to manual QA.
 *
 * Neither builder ever needed the flag: Drive and YouTube keep independent
 * grants (separate `oauth_grants` rows, refresh tokens, and OAuth clients), so
 * each token only has to carry its own scope. Dropping it also matches the
 * minimum-scope posture Google reviews.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Imports the PURE builder, not the two `server-only` wrappers — those can't be
// loaded by the tsx test runner ("Cannot find module 'server-only'"), which is
// the same reason lib/review-fraud-screener.ts keeps its scoring core in a
// separate module. Both wrappers now delegate here, so asserting on this one
// builder covers the YouTube and Drive consent URLs alike.
import { buildGoogleAuthorizeUrl } from './google-oauth-authorize';

// Mirrors YOUTUBE_OAUTH_SCOPES / DRIVE_OAUTH_SCOPES. Duplicated deliberately:
// importing them would pull in `server-only` again, and hard-coding the literal
// scope strings is what makes the conflicting PAIR explicit in the assertion.
const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube'] as const;
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

const YT = () =>
  new URL(
    buildGoogleAuthorizeUrl({
      clientId: 'cid.apps.googleusercontent.com',
      redirectUri: 'https://www.setnayan.com/api/oauth/youtube/callback',
      scopes: YOUTUBE_SCOPES,
      state: 'state-token',
    }),
  );

const DRIVE = (forceAccountChooser = false) =>
  new URL(
    buildGoogleAuthorizeUrl({
      clientId: 'cid.apps.googleusercontent.com',
      redirectUri: 'https://www.setnayan.com/api/oauth/drive/callback',
      scopes: DRIVE_SCOPES,
      state: 'state-token',
      prompt: forceAccountChooser ? 'select_account consent' : 'consent',
    }),
  );

test('YouTube authorize URL never sets include_granted_scopes', () => {
  assert.equal(YT().searchParams.get('include_granted_scopes'), null);
});

test('Drive authorize URL never sets include_granted_scopes', () => {
  // Both prompt variants — the account-chooser branch builds its own params.
  assert.equal(DRIVE(false).searchParams.get('include_granted_scopes'), null);
  assert.equal(DRIVE(true).searchParams.get('include_granted_scopes'), null);
});

test('neither authorize URL requests a YouTube scope together with drive.file', () => {
  for (const url of [YT(), DRIVE(false), DRIVE(true)]) {
    const scopes = (url.searchParams.get('scope') ?? '').split(' ').filter(Boolean);
    const hasYoutube = scopes.some((s) => s.includes('/auth/youtube'));
    const hasDriveFile = scopes.some((s) => s.includes('/auth/drive'));
    assert.ok(
      !(hasYoutube && hasDriveFile),
      `conflicting scope pair in one consent request: ${scopes.join(' ')}`,
    );
  }
});

test('each builder still requests its own scope, offline access, and forced consent', () => {
  const yt = YT();
  assert.equal(yt.searchParams.get('scope'), YOUTUBE_SCOPES.join(' '));
  assert.equal(yt.searchParams.get('access_type'), 'offline');
  // prompt=consent is what guarantees a fresh refresh_token on every reconnect.
  assert.equal(yt.searchParams.get('prompt'), 'consent');

  const drive = DRIVE(false);
  assert.equal(drive.searchParams.get('scope'), DRIVE_SCOPES.join(' '));
  assert.equal(drive.searchParams.get('access_type'), 'offline');
  assert.equal(drive.searchParams.get('prompt'), 'consent');
  assert.equal(DRIVE(true).searchParams.get('prompt'), 'select_account consent');
});
