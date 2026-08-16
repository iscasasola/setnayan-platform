/**
 * vendor-nav-boundary.test.ts — the side of the wall the icons are resolved on.
 *
 * ─── WHAT WENT WRONG, AND WHY 21 GREEN TESTS SAID NOTHING ────────────────
 * One Shell slice 2 handed `<VendorRailContext>` a FINISHED list of rows,
 * built in `layout.tsx`. `NavItem.icon` is a React component, so building that
 * list means calling `navIconComponent` — which lives in a `'use client'`
 * module. `layout.tsx` is a server component. Calling a client module's
 * function from the server throws, and the nav registry always serves a slot
 * for `vendor.sidebar.overview`, so the icon branch ran on EVERY request.
 *
 * Result: from 2026-08-14 17:38Z every supplier opening any of their 63 shop
 * screens got the full-page "Something on our end didn't work" card. Not a
 * wrong pixel — the whole shop, gone, for everybody.
 *
 * `vendor-rail-context.test.ts` had 21 assertions over this exact code and all
 * 21 passed while it was down, because Node's test runner has no server/client
 * graph: `'use client'` is an inert string literal there, so the call that
 * throws in production returns an icon in a test. That is not a gap to patch
 * with more of the same — it is why the guards below are STRUCTURAL. They ask
 * which side of the wall each call sits on, which is a question source code
 * can answer.
 *
 * 🔑 THE SHAPE TO REMEMBER: a mechanism that works in every test and dies in
 * production is usually a mechanism whose ENVIRONMENT the tests do not model.
 * Guard the boundary, not the behaviour.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const HERE = import.meta.dirname;
const WEB_ROOT = join(HERE, '..', '..', '..');
const read = (p: string) => readFileSync(p, 'utf8');

/**
 * Source with comments stripped.
 *
 * 🔑 WITHOUT THIS EVERY GUARD BELOW IS DECORATION IN THE OTHER DIRECTION:
 * this file's own prose names `navIconComponent` and `destinations=` while
 * explaining why they must not appear, so a raw search flags the files that
 * document the rule and misses nothing else.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The first non-comment, non-blank line — where a directive has to be. */
function declaresUseClient(src: string): boolean {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/.*\n\s*)*['"]use client['"]/.test(src);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · NOBODY RESOLVES A NAV ICON FROM THE SERVER — anywhere in the app
   ══════════════════════════════════════════════════════════════════════════ */

test('every module that resolves a nav icon is itself a client module', () => {
  /*
    `navIconComponent` returns a React COMPONENT out of a `'use client'`
    module. A module that calls it is a client module whether or not it says
    so, and the day one of them forgets to say so is the day the surface it
    feeds goes to the error card for everyone. This is the guard that would
    have caught the outage at the file that caused it.
  */
  /*
    🪤 THE FIRST CUT OF THIS SEARCHED THE RAW SOURCE AND CRIED WOLF TWICE —
    on `app/download/page.tsx`, whose comment explains why it deliberately
    does NOT resolve icons, and on the vendor layout's own warning comment
    directly below the fix. A guard that flags a file for TALKING about the
    defect teaches you to skim past the one time it is right. Match the act:
    strip comments first, then look for the import or the call.
  */
  const offenders: string[] = [];
  for (const file of [...walk(join(WEB_ROOT, 'app')), ...walk(join(WEB_ROOT, 'lib'))]) {
    const src = read(file);
    // The definition itself is the client module every caller depends on.
    if (file.endsWith(join('nav', 'nav-icon-component.tsx'))) continue;
    if (!/\bnavIconComponent\b/.test(code(src))) continue;
    if (!declaresUseClient(src)) offenders.push(relative(WEB_ROOT, file));
  }
  assert.deepEqual(
    offenders,
    [],
    'These modules resolve a nav icon but do not declare `use client`. If any ' +
      'server component imports one, Next throws "Attempted to call ' +
      'navIconComponent() from the server" and the WHOLE route tree renders ' +
      `the error page. That is the 2026-08-14 vendor outage. Found: ${offenders.join(', ')}`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE VENDOR LAYOUT HANDS OVER DATA, NEVER BUILT ROWS
   ══════════════════════════════════════════════════════════════════════════ */

const LAYOUT = join(HERE, '..', 'layout.tsx');
const RAIL = join(HERE, 'vendor-rail-context.tsx');
const DESTINATIONS = join(HERE, 'vendor-nav-destinations.ts');

test('the vendor layout does not build the rail rows itself', () => {
  const src = code(read(LAYOUT));
  assert.doesNotMatch(
    src,
    /\bresolveVendorDestinations\b/,
    'layout.tsx is a SERVER component. Resolving the rows there calls ' +
      'navIconComponent on the server and takes every vendor screen down. ' +
      'Pass role + navSlots + the two counts; the rail resolves its own rows.',
  );
  assert.doesNotMatch(
    src,
    /\bnavIconComponent\b/,
    'layout.tsx is a SERVER component and must never resolve an icon.',
  );
});

test('the rail is handed serializable values, not a finished list', () => {
  const src = code(read(LAYOUT));
  const mount = src.slice(src.indexOf('<VendorRailContext'));
  assert.doesNotMatch(
    mount,
    /destinations=/,
    'A `destinations` prop carries React components across the server→client ' +
      'boundary, which is how the rows came to be built on the server at all.',
  );
  for (const prop of ['role=', 'navSlots=', 'bookingsBadge=', 'threadsBadge=']) {
    assert.ok(
      mount.includes(prop),
      `The rail lost \`${prop}\`. It needs the same four raw values the ` +
        'phone\'s bottom bar gets, or the laptop and the phone start ' +
        'disagreeing about a renamed row or a waiting count.',
    );
  }
});

test('the rail resolves the rows on its own side of the wall', () => {
  const src = read(RAIL);
  assert.ok(declaresUseClient(src), 'the rail context stopped being a client module');
  assert.match(
    code(src),
    /\bresolveVendorDestinations\(/,
    'the rail no longer resolves its rows — something upstream is doing it again',
  );
});

test('the destinations module declares the side it lives on', () => {
  assert.ok(
    declaresUseClient(read(DESTINATIONS)),
    'vendor-nav-destinations.ts calls navIconComponent, so it IS a client ' +
      'module. Leaving the directive off is what let a server component ' +
      'import it and call it — the 2026-08-14 outage exactly.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE PHONE AND THE LAPTOP STILL ASK ONE RESOLVER
   ══════════════════════════════════════════════════════════════════════════ */

test('both vendor nav surfaces read the registry slot map', () => {
  // Two surfaces deriving the same words from different inputs is the
  // "two answers to one question" shape; here it would show as an admin
  // rename applying on the phone and not on the laptop, with nothing to see.
  const bar = code(read(join(HERE, 'vendor-bottom-nav.tsx')));
  const rail = code(read(RAIL));
  for (const [name, src] of [['bottom nav', bar], ['rail', rail]] as const) {
    assert.match(
      src,
      /\bnavSlots\b/,
      `the ${name} stopped reading the nav registry, so an admin rename now ` +
        'reaches only one of the two vendor menus',
    );
  }
});
