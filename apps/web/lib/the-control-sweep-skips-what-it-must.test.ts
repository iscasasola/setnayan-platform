import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ERROR_SCREEN_TEXT,
  SKIP_CONTROLS,
  SKIP_OPTIONS,
  consoleNoise,
  failureKey,
  fillRoute,
  planRoutes,
  responseNoise,
  routePattern,
  skipReason,
  type ScreenRow,
} from '../tests/rehearsal/sweep-rules';

/**
 * THE CONTROL SWEEP (tests/rehearsal/sweep.spec.ts) PRESSES EVERY CONTROL ON
 * EVERY DASHBOARD SCREEN — so what it must NEVER press, what it counts as a
 * failure, and where its route list comes from are held here, by behaviour.
 *
 * Owner 2026-11-23: a guest card's reply dropdown threw the page to the global
 * error screen in production; the e2e specs measured sizes and never pressed it.
 */

test('destructive, money, outward-facing and sign-out controls are never pressed', () => {
  for (const name of [
    'Delete guest', 'Remove from list', '(icon: trash-2)', 'Discard draft', 'Archive', 'Revoke link',
    'Pay now', 'Checkout', 'Upgrade to Event Pro', 'Get Event Plus', 'Mark as paid', 'Buy credits',
    'Send to 12', 'Resend invitation', 'Email guests', 'Share', 'Publish', '✓ Apply', 'Request a quote',
    'Book this supplier', 'Accept quote', 'Sign the contract', 'Lock booking', '(icon: send)',
    'Sign out', 'Log out', 'Switch account',
    'Cancel booking', 'Cancel order',
    'Finalize the seat plan', 'Close RSVPs', 'Release 3 seats',
  ]) {
    assert.ok(skipReason(name, SKIP_CONTROLS), `"${name}" must be on the skip list`);
  }
});

test('ordinary controls — including the ones that close a sheet — are pressed', () => {
  for (const name of [
    'Cancel', 'Close', 'Done', 'Back', 'Edit', 'Add guest', 'Filter', 'Sort', 'Seats', 'Guests', 'Open menu',
    'Show more', 'Copy invitation link', '(icon: x)', 'Reply', 'Payday', 'Poster', 'Design', 'Bookings',
    'Invite Andres Bonifacio', 'Attending',
  ]) {
    assert.equal(skipReason(name, SKIP_CONTROLS), null, `"${name}" must be pressed`);
  }
});

test('a reply dropdown\'s every answer is picked, even the ones that read like a refusal', () => {
  for (const option of ['Attending', 'Declines', 'Declined', 'Maybe', 'Pending', 'Joyfully accepts', 'Not yet', 'Confirm later']) {
    assert.equal(skipReason(option, SKIP_OPTIONS), null, `option "${option}" must be picked`);
  }
  for (const option of ['Delete guest', 'Send reminder', 'Pay deposit']) {
    assert.ok(skipReason(option, SKIP_OPTIONS), `option "${option}" must not be picked`);
  }
});

test('every error boundary heading in the app is recognised as the error screen', () => {
  for (const file of ['app/error.tsx', 'app/global-error.tsx', 'app/vendor-dashboard/error.tsx', 'app/dashboard/[eventId]/seating/error.tsx']) {
    const src = readFileSync(join(process.cwd(), file), 'utf8').replace(/&rsquo;/g, '’');
    const heading = /<h1[^>]*>\s*([^<{]+?)\s*<\/h1>/.exec(src)?.[1]?.replace(/\s+/g, ' ');
    assert.ok(heading, `${file} has an <h1>`);
    assert.match(heading!, ERROR_SCREEN_TEXT, `${file}: "${heading}" is not recognised as an error screen`);
  }
});

test('the rehearsal stubs are noise; everything else is a failure', () => {
  assert.ok(consoleNoise('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT', 'https://fonts.example/x.woff2'));
  assert.ok(consoleNoise('Failed to load resource: net::ERR_CONNECTION_REFUSED', 'http://127.0.0.1:54330/media/a.webp'));
  assert.ok(responseNoise('http://localhost:3000/_next/image?url=http%3A%2F%2F127.0.0.1%3A54330%2Fa.webp&w=640&q=75'));
  assert.equal(consoleNoise('TypeError: Cannot read properties of undefined (reading \'map\')', ''), null);
  assert.equal(consoleNoise('Failed to load resource: the server responded with a status of 404 ()', 'http://localhost:3000/x'), null);
  assert.equal(responseNoise('http://localhost:3000/dashboard/e0e0e0e0-0000-4000-8000-000000000001/guests'), null);
  assert.equal(responseNoise('http://localhost:3000/_next/image?url=%2Fimages%2Flocal.png&w=640&q=75'), null);
});

test('the same bug on many screens is one line of the failure list', () => {
  assert.equal(
    failureKey('page-error', 'TypeError at guest 61616161-0000-4000-8000-000000000003 row 12'),
    failureKey('page-error', 'TypeError at guest 61616161-0000-4000-8000-000000000007 row 44'),
  );
});

test('the route list is the app\'s own map: every dashboard screen, redirects named, [param] screens last', () => {
  const screens = (JSON.parse(readFileSync(join(process.cwd(), 'lib/ugat/screens.generated.json'), 'utf8')) as { screens: ScreenRow[] }).screens;
  const couple = planRoutes(screens, 'couple');
  const supplier = planRoutes(screens, 'supplier');
  for (const [plan, root] of [[couple, '/dashboard/[eventId]'], [supplier, '/vendor-dashboard']] as const) {
    const all = screens.filter((s) => s.route === root || s.route.startsWith(`${root}/`));
    assert.ok(plan.sweep.length > 20, `${root}: too few screens to sweep (${plan.sweep.length})`);
    assert.equal(plan.sweep.length + plan.left.length, all.length, `${root}: every screen is swept or named as left out`);
    for (const l of plan.left) assert.match(l.reason, /redirects/);
    const firstParam = plan.sweep.findIndex((s) => /\[(?!eventId\])/.test(s.route.slice(root.length)));
    if (firstParam >= 0) {
      assert.ok(plan.sweep.slice(firstParam).every((s) => /\[(?!eventId\])/.test(s.route.slice(root.length))), `${root}: [param] screens come last`);
    }
  }
  assert.ok(couple.sweep.some((s) => s.route === '/dashboard/[eventId]/guests/[guestId]'), 'the guest card screen is swept');
  assert.ok(supplier.sweep.some((s) => s.route === '/vendor-dashboard/services'), 'the supplier services screen is swept');
});

test('a [param] route fills from the fixture and matches the address it names', () => {
  const r = '/dashboard/[eventId]/guests/[guestId]';
  const url = fillRoute(r, { eventId: 'e1', guestId: 'g1' });
  assert.equal(url, '/dashboard/e1/guests/g1');
  assert.equal(fillRoute(r, { eventId: 'e1' }), null);
  assert.ok(routePattern(r).test('/dashboard/e1/guests/g1'));
  assert.ok(!routePattern(r).test('/dashboard/e1/guests/g1/edit'));
});
