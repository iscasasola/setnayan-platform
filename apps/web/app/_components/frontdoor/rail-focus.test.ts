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
    /* 'Events', not 'Back to events' — owner 2026-09-23. The icon is pinned
       too: this row is the ONE of the four that is named after where it
       goes rather than what it does, so it carries the events drawing
       instead of the default arrow.

       🔴 IT IS THE NAME `'events'`, NOT `LayoutGrid`. This line used to pin
       the component, which is what the layout then passed across a
       server→client boundary — a 500 on every page inside an event. See
       `RailFocusIcon`. */
    ['app/dashboard/[eventId]/layout.tsx', /focus=\{\{\s*href: '\/dashboard',\s*label: 'Events',\s*caption: 'Events',\s*icon: 'events',?\s*\}\}/],
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

/**
 * 🔴 THE REGRESSION THIS FILE NOW OWNS — production, 2026-09-23.
 *
 * `RailFocus` is built in SERVER layouts and read by `front-door-shell.tsx`,
 * which is `'use client'`. The `icon` field was typed `LucideIcon`, so the
 * event layout passed `icon: LayoutGrid` — the component object — and React
 * refused to serialise it:
 *
 *   Functions cannot be passed directly to Client Components…
 *   {$$typeof: …, render: function, displayName: …}
 *
 * The throw was in `dashboard/[eventId]/layout.tsx`, so EVERY page inside an
 * event 500'd: Overview, Guests, Seat plan, all of them, for about an hour.
 *
 * 🔑 A TYPE IS NOT A GUARD. `icon?: LucideIcon` did not merely permit the
 * mistake, it INVITED it — the contract asked for exactly the thing that
 * cannot travel. So this pins the shape, not one spelling of it: the field
 * takes a NAME, the shell owns the map, and no focus call site hands over a
 * bare identifier.
 */
test('🔴 no rail focus hands a COMPONENT across the server→client boundary', () => {
  const contract = code('app/_components/frontdoor/rail-focus.ts');
  assert.doesNotMatch(
    contract,
    /icon\?:\s*LucideIcon/,
    'RailFocus.icon is typed as a component again — a server layout cannot send one to the client shell',
  );
  assert.match(
    contract,
    /icon\?:\s*RailFocusIcon/,
    'RailFocus.icon no longer takes a name',
  );

  // The shell — a client module — owns the name → drawing map.
  const shell = code('app/_components/frontdoor/front-door-shell.tsx');
  assert.match(shell, /const FOCUS_ICONS: Record<RailFocusIcon,/, 'the shell no longer maps the name to a drawing');
  assert.match(
    shell,
    /focus\.icon \? FOCUS_ICONS\[focus\.icon\] : ArrowLeft/,
    'the way-back row no longer resolves the name on the client side',
  );

  // And no caller reaches for a component, in any layout that focuses the rail.
  for (const rel of [
    'app/dashboard/[eventId]/layout.tsx',
    'app/dashboard/(account)/layout.tsx',
    'app/admin/layout.tsx',
    'app/vendor-dashboard/layout.tsx',
  ]) {
    const src = code(rel);
    const at = src.indexOf('focus={{');
    if (at === -1) continue;
    const call = src.slice(at, src.indexOf('}}', at) + 2);
    assert.doesNotMatch(
      call,
      /icon:\s*[A-Z][A-Za-z0-9_]*\s*[,}]/,
      `${rel} passes a bare component as focus.icon — that cannot cross to the client shell`,
    );
  }
});
