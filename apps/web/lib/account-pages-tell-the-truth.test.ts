/**
 * FINAL CHECK · area 1 · sign-up, the You card, public profiles (batch a1-a4-account, 25 Nov 2026).
 * Each test names the finding it holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PASSWORD_RESET_WINDOW_MS, passwordResetWaitMessage } from './password-reset-limit';

const src = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('A1-061 · /signup makes no promise that guest photos move to the new account', () => {
  assert.doesNotMatch(src('app/signup/page.tsx'), /Your event photos will be saved to your new account/);
});

test('A1-064 · the /signup description makes no speed claim', () => {
  assert.doesNotMatch(src('app/signup/page.tsx'), /in seconds/i);
});

test('A1-065 · the reset refusal names the limiter’s real wait', () => {
  assert.match(passwordResetWaitMessage(), /wait 15 minutes/);
  assert.equal(PASSWORD_RESET_WINDOW_MS, 15 * 60_000);
  assert.match(src('app/forgot-password/page.tsx'), /rate_limited: passwordResetWaitMessage\(\)/);
  assert.match(src('app/forgot-password/actions.ts'), /PER_EMAIL_WINDOW_MS = PASSWORD_RESET_WINDOW_MS/);
});

test('A1-062 · a refused You-card read is said, and a save without the saved row is refused', () => {
  const page = src('app/signup/you/page.tsx');
  assert.match(page, /if \(profileError\) \{[\s\S]{0,400}Couldn’t read your details/);
  assert.match(src('app/signup/you/actions.ts'), /if \(mineError\) backWithError\(/);
});

test('A1-063 · the consent box names no retired feature', () => {
  const card = src('app/signup/you/_components/you-card.tsx');
  assert.doesNotMatch(card, /realstories|Stories showcase/i);
});
