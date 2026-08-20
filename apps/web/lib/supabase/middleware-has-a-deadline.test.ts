/**
 * The sign-in check in front of every page must have a deadline, and must not
 * write cookies after it has given up.
 *
 * 🔴 THE OUTAGE THIS COMES FROM (2026-08-20). The database stopped answering
 * for ~50 minutes. Vercel was fine, the app was fine, and every page on the
 * site returned 504 `MIDDLEWARE_INVOCATION_TIMEOUT` — public pages included,
 * for visitors with no session. Measured in the edge logs for that hour:
 * `/auth/v1/token` 139× **522**, `/rest/v1/events` 244× **522**. The one URL
 * that stayed up was `/api/health`, and only because the matcher excludes it.
 *
 * Source-level, because the thing being asserted is the SHAPE of a function
 * that needs a NextRequest to run. The timing behaviour itself is tested for
 * real in session-budget.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(process.cwd(), 'lib', 'supabase');
const src = () => readFileSync(join(HERE, 'middleware.ts'), 'utf8');
/** Comments explain the trap; a guard must read the CODE, not the warning. */
const code = () =>
  src().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the session check runs under a budget', () => {
  const body = code();
  assert.match(
    body,
    /withBudget\(/,
    'The sign-in check is unbounded again. When the database stops answering, ' +
      'every page on the site — including public ones — returns a gateway timeout.',
  );
  assert.match(
    body,
    /SESSION_CHECK_BUDGET_MS/,
    'The budget constant is gone; a hardcoded number here drifts from the one the ' +
      'tests assert.',
  );
});

test('🔒 running out of time means NOBODY IS SIGNED IN — never the reverse', () => {
  assert.match(
    code(),
    /if \(!outcome\.ok\)[\s\S]{0,400}?return \{ response, user: null \}/,
    'A timeout must degrade to no-user. Any other value would let an unreachable ' +
      'database decide who is signed in.',
  );
});

test('🪤 a late cookie write is dropped after the check gives up', () => {
  const body = code();
  assert.match(body, /bailed = true/, 'nothing marks the request as given-up');
  assert.match(
    body,
    /setAll\(cookiesToSet: CookieToSet\[\]\) \{\s*if \(bailed\) return;/,
    'The losing side of the race keeps running: its cookie callback can fire ' +
      'seconds later and rewrite session cookies on a response already sent. The ' +
      'guard must be the FIRST thing in setAll.',
  );
});

test('the degrade is not silent', () => {
  assert.match(
    code(),
    /console\.warn\(/,
    'An outage that degrades quietly is one nobody measures — every page would ' +
      'render signed-out and look perfectly fine.',
  );
});

test('the health endpoint stays out of the middleware, so it can always answer', () => {
  const mw = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
  assert.match(
    mw,
    /matcher: \[[\s\S]*?health[\s\S]*?\]/,
    'During the outage /api/health was the only thing still answering, and that is ' +
      'how the fault was located. It must stay excluded.',
  );
});
