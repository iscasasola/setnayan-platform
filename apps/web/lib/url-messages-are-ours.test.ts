/**
 * FINAL CHECK A1-058 · A1-083 (25 Nov 2026): a link's own words never print inside our cards, and a stray "%"
 * never takes a page down.
 *
 * Seen live: `/login?ready=100%25`, `/reset-password?error=%25` and `/help?error=%25` answered HTTP 500 (a second
 * `decodeURIComponent` on a value Next had already decoded), and `/signup?error=Call%20us%20at%200917` printed
 * "Call us at 0917" inside the sign-up card. This holds the helpers AND every page that shows such a param.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeParamSafely, emailFromParam, ownMessageFromParam } from './human-auth-error';
import { HELP_MESSAGE_ERRORS, HELP_MESSAGE_ERROR_FALLBACK, helpReferenceFromParam } from './help-message-errors';
import { RESET_NOT_SAVED, RESET_PASSWORD_ERRORS } from './reset-password-errors';
import { INVITE_ERRORS, INVITE_JOIN_FAILED } from './supplier-invite-errors';
import { stripComments } from './strip-comments';

const PHISH = 'Your account is locked. Call 0917 000 0000 to restore it.';

test('a lone "%" never throws', () => {
  assert.equal(decodeParamSafely('%'), '%');
  assert.equal(decodeParamSafely('100%'), '100%');
  assert.equal(decodeParamSafely('a%20b'), 'a b');
  assert.equal(decodeParamSafely(undefined), null);
  assert.equal(decodeParamSafely('   '), null);
  assert.doesNotThrow(() => ownMessageFromParam('%', HELP_MESSAGE_ERRORS, HELP_MESSAGE_ERROR_FALLBACK));
  assert.doesNotThrow(() => emailFromParam('100%'));
});

test('the URL chooses among our sentences and never supplies one', () => {
  assert.equal(ownMessageFromParam(PHISH, HELP_MESSAGE_ERRORS, HELP_MESSAGE_ERROR_FALLBACK), HELP_MESSAGE_ERROR_FALLBACK);
  assert.equal(ownMessageFromParam('missing', HELP_MESSAGE_ERRORS, 'x'), HELP_MESSAGE_ERRORS.missing);
  assert.equal(ownMessageFromParam(PHISH, RESET_PASSWORD_ERRORS, RESET_NOT_SAVED), RESET_NOT_SAVED);
  assert.equal(ownMessageFromParam('Passwords do not match', RESET_PASSWORD_ERRORS, RESET_NOT_SAVED), 'Passwords do not match');
  assert.equal(ownMessageFromParam(INVITE_ERRORS.self, Object.values(INVITE_ERRORS), INVITE_JOIN_FAILED), INVITE_ERRORS.self);
  assert.equal(ownMessageFromParam('Call us at 0917', Object.values(INVITE_ERRORS), INVITE_JOIN_FAILED), INVITE_JOIN_FAILED);
  assert.equal(ownMessageFromParam(undefined, INVITE_ERRORS, INVITE_JOIN_FAILED), null);
});

test('an email banner shows only an email address', () => {
  assert.equal(emailFromParam('ana@example.com'), 'ana@example.com');
  assert.equal(emailFromParam('ana%40example.com'), 'ana@example.com');
  assert.equal(emailFromParam(PHISH), null);
  assert.equal(emailFromParam('<b>x</b>@a.co'), null);
});

test('a help reference prints only when it is shaped like ours', () => {
  assert.equal(helpReferenceFromParam('S89H-ABC123XYZ0'), 'S89H-ABC123XYZ0');
  assert.equal(helpReferenceFromParam(PHISH), null);
});

test('🔒 no page that shows a URL message decodes it by hand or prints it as given', () => {
  const pages = [
    'app/signup/page.tsx',
    'app/signup/you/page.tsx',
    'app/reset-password/page.tsx',
    'app/i/[slug]/page.tsx',
    'app/login/_components/login-data.ts',
    'app/(shell)/help/page.tsx',
  ];
  for (const rel of pages) {
    const src = stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
    assert.doesNotMatch(src, /decodeURIComponent\(/, `${rel} decodes a URL param by hand (a lone "%" throws)`);
    assert.doesNotMatch(src, /\?\?\s*rawError/, `${rel} falls back to the URL's own words`);
  }
  for (const rel of ['app/help/actions.ts', 'app/reset-password/actions.ts', 'app/signup/you/actions.ts']) {
    const src = stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
    assert.doesNotMatch(src, /encodeURIComponent\(\s*error\??\.message/, `${rel} sends the database's own text to the page`);
    assert.doesNotMatch(src, /backWithError\([^)]*error\.message/, `${rel} sends the database's own text to the page`);
  }
});
