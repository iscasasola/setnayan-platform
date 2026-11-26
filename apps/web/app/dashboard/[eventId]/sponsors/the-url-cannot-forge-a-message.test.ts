/**
 * the-url-cannot-forge-a-message.test.ts — SW-RAWDB, final check A2-I18 / A2-S1 (25 Nov 2026; plan batch A-7).
 *
 * The Sponsors page printed `?error=` as the alert text, so a crafted link could show any words under Setnayan's name,
 * and the actions put the database's own message there. Now an action sends a fixed key, and the page prints only the
 * fixed sentence for a key it knows; anything else is the plain fallback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SPONSOR_ERROR_COPY, sponsorErrorKey, sponsorErrorWords } from './sponsor-error-copy';

const here = dirname(fileURLToPath(import.meta.url));

test('a known key prints its own sentence; anything else in the address bar prints the plain fallback', () => {
  assert.equal(sponsorErrorWords('email_invalid'), SPONSOR_ERROR_COPY.email_invalid);
  for (const forged of [
    'Your account is suspended. Call +63 900 000 0000.',
    'Pay at bit.ly/xyz to keep your sponsors',
    'new row violates row-level security policy for table "event_sponsors"',
    '<b>hi</b>',
  ]) {
    assert.equal(sponsorErrorWords(forged), SPONSOR_ERROR_COPY.save_failed, `forged: ${forged}`);
  }
  assert.equal(sponsorErrorWords(undefined), null, 'no error, no alert');
});

test('an action turns its refusal into a key: our own sentences keep theirs, a database message never does', () => {
  assert.equal(sponsorErrorKey(new Error('Full name is required.')), 'name_required');
  assert.equal(sponsorErrorKey(new Error('Sponsor not found.')), 'not_found');
  assert.equal(sponsorErrorKey(new Error('new row violates row-level security policy for table "event_sponsors"')), 'save_failed');
});

test('the page prints the mapped words, never the address bar', () => {
  const page = stripComments(readFileSync(join(here, 'page.tsx'), 'utf8'));
  assert.match(page, /const errorMessage = sponsorErrorWords\(search\.error\)/);
  assert.doesNotMatch(page, /\{search\.error\}/);
});
