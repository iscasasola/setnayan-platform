import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { isRailFocused } from './rail-focus';
import { ACCOUNT_FOCUS_PATHS } from '../../dashboard/(account)/_components/account-focus-paths';

/**
 * THE RAIL FOCUSES ON THE SECTION YOU ARE IN.
 *
 * Owner 2026-09-21: *"When we enter an Event sidebar will collapse focusing on
 * just everything needed for that event and an icon to return to Events"* —
 * *"same concept when on memories, people, shop, and admin."*
 *
 * Half executed (the rule), half read (the five layouts that must use it and
 * the shell that must obey it).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

function code(rel: string): string {
  const src = readFileSync(join(WEB, rel), 'utf8');
  assert.ok(src.length > 500, `${rel} is missing or a stub.`);
  return stripComments(src);
}

const IN = { inApp: true, signedIn: true };
const F = { href: '/dashboard', label: 'My Home', caption: 'Home' };

test('the rule: focus applies in the app, signed in, on its paths only', () => {
  assert.equal(isRailFocused(F, '/admin/users', IN), true, 'no paths ⇒ every URL');
  assert.equal(isRailFocused(undefined, '/admin', IN), false);
  assert.equal(isRailFocused(F, '/', { inApp: false, signedIn: true }), false, '/ never focuses');
  assert.equal(isRailFocused(F, '/admin', { inApp: true, signedIn: false }), false);

  const acct = { ...F, paths: ACCOUNT_FOCUS_PATHS };
  for (const p of ['/dashboard/library', '/dashboard/people', '/dashboard/people/abc', '/dashboard/samahan/new']) {
    assert.equal(isRailFocused(acct, p, IN), true, `${p} should focus`);
  }
  for (const p of ['/dashboard/profile', '/dashboard/notifications', '/dashboard/peoplex', '/dashboard']) {
    assert.equal(isRailFocused(acct, p, IN), false, `${p} must keep the full rail`);
  }
});

test('all five sections pass focus back to /dashboard', () => {
  const layouts: Array<[string, RegExp]> = [
    ['app/dashboard/[eventId]/layout.tsx', /focus=\{\{\s*href: '\/dashboard',\s*label: 'Back to events'/],
    ['app/vendor-dashboard/layout.tsx', /focus=\{\{\s*href: '\/dashboard',\s*label: 'My Home'/],
    ['app/admin/layout.tsx', /focus=\{\{\s*href: '\/dashboard',\s*label: 'My Home'/],
    ['app/dashboard/(account)/layout.tsx', /focus=\{\{\s*href: '\/dashboard',\s*label: 'My Home',[\s\S]{0,60}paths: ACCOUNT_FOCUS_PATHS/],
  ];
  for (const [rel, re] of layouts) {
    assert.match(code(rel), re, `${rel} does not focus the rail.`);
  }
  // The (launcher) layout is My Home itself — it must NOT focus.
  assert.doesNotMatch(code('app/dashboard/(launcher)/layout.tsx'), /focus=\{/);
});

test('the shell draws the way back INSTEAD of Discover and My Home when focused', () => {
  const s = code('app/_components/frontdoor/front-door-shell.tsx');
  const back = s.indexOf('{focused && focus ? (');
  const discover = s.indexOf(`<Link href="/" {...rowProps('home')}>`);
  const myHome = s.indexOf('>My Home<');
  const ctx = s.indexOf('{railContext ? (');
  assert.ok(back >= 0, 'no focused branch in the rail');
  assert.ok(back < discover && discover < myHome && myHome < ctx,
    `Discover and My Home must sit in the focused branch's ELSE, before the context group ` +
    `(back ${back}, discover ${discover}, my home ${myHome}, context ${ctx}).`);
  // The lists are emptied ONCE, not gated at render (see
  // the-rail-renders-what-it-is-handed.test.ts for why that shape is required).
  for (const g of ['plannerTools', 'builderTools', 'togetherTools']) {
    assert.match(s, new RegExp(`const ${g} = focused \\? \\[\\] : ${g}In;`), `${g} still draws in focus.`);
  }
  assert.match(s, /const tools = focused && !insideEvent \? \[\] : toolsIn;/,
    'Studio must stay inside an event and nowhere else in focus.');
  assert.match(s, /\{tools\.length > 0 \? \(\s*<div className="fd-rgroup">\s*<div className="fd-rdiv" \/>\s*<div className="fd-rlabel">\s*Studio/,
    'the Studio group no longer renders from its (focus-emptied) list.');
  // Hidden rows must not compete for the highlight.
  assert.match(s, /\.\.\.\(focused\s*\?\s*\[\]\s*:\s*railMatchRows\(/,
    'in focus the hidden account rows still compete for the lit row.');
});

test('the account menu switches on exactly the focus paths', () => {
  const s = code('app/dashboard/(account)/_components/account-rail-context.tsx');
  const prefixes = [...s.matchAll(/under\(pathname, '([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(prefixes)].sort(),
    [...ACCOUNT_FOCUS_PATHS].sort(),
    'AccountRailContext and ACCOUNT_FOCUS_PATHS disagree: a focused page with no ' +
      'menu is an empty rail; a menu on an unfocused page draws twice.',
  );
  // Memories reads the page's own rule, not a copy of it.
  assert.match(s, /resolveLibraryView\(/);
  assert.match(s, /LENSES\.map/);
  assert.match(s, /KEPT\.map/);
});
