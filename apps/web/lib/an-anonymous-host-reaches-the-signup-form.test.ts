/**
 * FINAL CHECK A1-056 (blocker, confirmed on the staging copy 25 Nov 2026): "Secure my plan" must reach the Create
 * account card for a host who started with no account. Seen: /signup?next=/dashboard bounced the anonymous host
 * straight back to the dashboard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signupShouldBypass } from './signup-bypass';
import { stripComments } from './strip-comments';

test('an anonymous session sees the form; a real account is sent on', () => {
  assert.equal(signupShouldBypass({ is_anonymous: true }), false);
  assert.equal(signupShouldBypass({ is_anonymous: false }), true);
  assert.equal(signupShouldBypass({}), true);
  assert.equal(signupShouldBypass(null), false);
});

test('🔒 /signup gates its signed-in redirect on the rule, not on any session', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/signup/page.tsx'), 'utf8'));
  assert.match(src, /if \(user && signupShouldBypass\(user\)\) \{/);
  assert.doesNotMatch(src, /if \(user\) \{\s*if \(next !== '\/'\)/, 'the bypass counts any session again');
});
