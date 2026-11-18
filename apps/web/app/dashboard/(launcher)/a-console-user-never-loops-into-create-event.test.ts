import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

/**
 * W1-B25 (FAIL on live, walkthrough 2, 16 Nov 2026). A supplier who had just opened a shop landed on
 * /dashboard/create-event and the page crashed — the fault log's line, build afcef1e:
 *   "SecurityError: Attempt to use history.replaceState() more than 100 times per 10 seconds"
 * The board (`(launcher)/page.tsx`) redirected a console user with no events to /dashboard/create-event. On a
 * CLIENT navigation that address is intercepted by `@modal/(.)create-event`, which renders over THIS page — and this
 * page redirected again. Every loop wrote the history once.
 * Sabotage: point the empty-console redirect back at '/dashboard/create-event' → red.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the board never redirects into an address its own @modal intercepts', () => {
  assert.ok(existsSync(join(HERE, '@modal/(.)create-event/page.tsx')), 'the intercept moved — re-read this guard');
  assert.doesNotMatch(LAUNCHER, /redirect\(\s*['`]\/dashboard\/create-event/, 'the board redirects into its own intercept again — the loop is back');
});

test('a console user with nothing lands on their own console — a supplier on the shop', () => {
  assert.match(
    LAUNCHER,
    /if \(active\.length === 0 && hasConsole && !wantsHub && boardEvents\.length === 0\) \{\s*redirect\(roles\.hasVendorAccess \? '\/vendor-dashboard' : '\/admin'\);/,
  );
});
