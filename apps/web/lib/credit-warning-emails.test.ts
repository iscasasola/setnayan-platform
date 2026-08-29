/**
 * THE CREDIT WARNING HAS TO LEAVE THE APP.
 *
 * 🚨 THE BUG THIS EXISTS TO PREVENT, WHICH ALREADY HAPPENED ONCE. All six
 * `lock_request_*` types were on the email allowlist AND in the marketing-gated
 * set, whose only effect is to SUPPRESS the send unless
 * `users.marketing_opt_in = TRUE` — a column that is NOT NULL DEFAULT FALSE
 * with zero users opted in. Both halves looked correct in isolation and the
 * suite stayed green because the existing test asserted membership of the FIRST
 * set and never looked at the second. Two lists, one checked.
 *
 * So this asserts BOTH DIRECTIONS: on the email list, and NOT in the gated set.
 *
 * ⚠ It reads the SOURCE rather than importing the sets, because both are module
 * -private `const`s. A test that could only see exported values could not see
 * this bug at all — which is exactly how it survived.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(process.cwd(), 'lib', 'notification-emit.ts'), 'utf8');

/** The body of one `const NAME: ... = new Set([ ... ]);` declaration. */
function setBody(name: string): string {
  const start = SOURCE.indexOf(`const ${name}`);
  assert.notEqual(start, -1, `${name} must exist — this guard is worthless if it silently finds nothing`);
  const open = SOURCE.indexOf('new Set([', start);
  assert.notEqual(open, -1, `${name} must be declared as a Set literal`);
  const close = SOURCE.indexOf(']);', open);
  assert.notEqual(close, -1, `${name} must be closed`);
  return SOURCE.slice(open, close);
}

/**
 * Comments are stripped before matching. Every entry in that file carries a
 * paragraph of prose, and several paragraphs NAME types they are explaining the
 * exclusion of — so a raw-source match reports membership for a type the set
 * deliberately does not contain.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

test('the credit warning is emailed', () => {
  const emails = stripComments(setBody('EMAIL_ENABLED_TYPES'));
  assert.match(
    emails,
    /'vendor_credit_expiring'/,
    'a shop drifting toward a lapse is by definition not opening the dashboard — ' +
      'an in-app-only notice reaches exactly the shops that do not need it',
  );
});

test('the credit warning is NOT marketing-gated', () => {
  const gated = stripComments(setBody('MARKETING_GATED_EMAIL_TYPES'));
  assert.doesNotMatch(
    gated,
    /'vendor_credit_expiring'/,
    "this set suppresses unless marketing_opt_in is TRUE, which defaults FALSE — " +
      'putting a transactional money notice in it silences it for everybody',
  );
});

test('the comment stripper is not itself the reason this passes', () => {
  // If stripComments ate the whole body, both assertions above would pass for
  // the wrong reason — the first would fail, but only because it matches
  // nothing. Pin that a known member survives stripping.
  const emails = stripComments(setBody('EMAIL_ENABLED_TYPES'));
  assert.match(emails, /'order_paid'/, 'a long-standing member must survive the stripper');
  assert.ok(emails.length > 100, 'the stripped body must not be empty');
});
