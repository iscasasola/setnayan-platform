import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { railMatchRows, activeRailKey, railRowLit } from './rail-active';

/**
 * PEOPLE IS A DOOR, NOT A NOTICE.
 *
 * The rail carried "People · coming soon — waiting on a legal review". Both
 * halves were wrong: `/dashboard/people` ships, and its Samahan section WORKS
 * TODAY. A coming-soon label is a claim about a WHOLE SURFACE, and this one
 * covered a shipped feature standing beside an unfinished one.
 *
 * The page's own copy had already been corrected once for exactly this — the
 * wider sentence ("nothing to do on this page yet") was false for anyone
 * holding a samahan, and the fix was to SCOPE the claim to connections. The
 * rail never got the same correction.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = join(HERE, 'front-door-shell.tsx');

function shell(): string {
  const src = readFileSync(SHELL, 'utf8');
  assert.ok(src.length > 1000, 'front-door-shell.tsx is missing or a stub.');
  // Strip block comments so the guard judges the RENDERED rail, never the
  // prose explaining it — the comment naming the retired notice must not
  // keep this test green or red on its own.
  return src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');
}

test('the rail offers a real door into People', () => {
  // 🏠 People is a section of Home since 11 Nov 2026 ("HOME IS THE PROFILE"): its door is Home's People door.
  assert.match(
    shell(),
    /<Link href=\{homeSegHref\('people'\)\} className="fd-row fd-hsub" data-home-door="people">/,
    'The rail has no door into Home › People. It was a dead notice once; a ' +
      'row that cannot be pressed is the same defect wearing a link-shaped hole.',
  );
});

test('no coming-soon claim survives anywhere in the rail', () => {
  const src = shell();
  assert.doesNotMatch(
    src,
    /coming soon/i,
    'A "coming soon" label reappeared in the rail. Scope such a claim to the ' +
      'unfinished PART on the page itself — never to a surface whose other ' +
      'half a person can already use.',
  );
  assert.doesNotMatch(
    src,
    /legal review/i,
    'The "waiting on a legal review" wording is back. What is genuinely ' +
      'pending is the connections half, and the page says so itself.',
  );
});

test('the pages under People light Home, the place they belong to — and /dashboard is Home', () => {
  // 🏠 11 Nov 2026: the rail's 'events' slot is the Home row. People's own door is a section door (`?seg=people`),
  // which this rail cannot tell apart without the query, so it lights nothing; the pages still under People — an
  // alaga's page, a group's room — light Home.
  const rows = railMatchRows({ signedIn: true, hasShop: false, isAdmin: false });
  assert.equal(activeRailKey(rows, '/dashboard'), 'events');
  assert.ok(railRowLit(activeRailKey(rows, '/dashboard/people/S89D-ABCDEFGHJK'), 'events'), "an alaga's page does not light Home");
  assert.ok(railRowLit(activeRailKey(rows, '/dashboard/samahan/abc'), 'events'), "a group's room does not light Home");
  assert.equal(activeRailKey(rows, '/dashboard/profile'), null, 'Settings lit Home');
});

test('a signed-out visitor is offered no Home rows', () => {
  const rows = railMatchRows({ signedIn: false, hasShop: false, isAdmin: false });
  assert.ok(!rows.some((r) => r.key === 'people' || r.key.startsWith('events')));
});
