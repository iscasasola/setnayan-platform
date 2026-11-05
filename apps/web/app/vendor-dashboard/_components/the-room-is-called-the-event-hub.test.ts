import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * THE RENAME IS LABELS ONLY — and a rename that misses a copy is a diff.
 *
 * The supplier's day-of room is called the **Event Hub**, because that is what a
 * supplier walks into on the day (owner, 2026-08-28, on the drawing). The word
 * is written in SIX places, not the five the plan listed — the sixth is the
 * 72px icon strip's caption, which is keyed by the stable key and would have
 * gone on saying "On the day" beside five renamed rows.
 *
 * 🔒 AND THE KEY AND THE ROUTE ARE FROZEN. `vendor-nav-destinations.ts` records
 * that `on-the-day` is load-bearing in four separate places — the staff role
 * filter, the admin nav registry slots (`vendor.sidebar.<key>`), the
 * localStorage open-state, and the badge map — and three of the four fail
 * SILENTLY. Renaming the key is not a bigger version of renaming the label; it
 * is a different, invisible change.
 *
 * This guard reads the SOURCE because these are literal strings in data
 * tables — there is no rendered surface to query without a browser, and a
 * hand-written list of "the places I remembered" is exactly what let the sixth
 * one drift. Every path below is asserted to exist first, so a moved file fails
 * loudly instead of quietly guarding nothing.
 */

const WEB = path.resolve(__dirname, '../../..');
const NAME = 'Event Hub';
/**
 * The TAB's word since 2026-10-21 (owner "Yes to all": the bar is Today ·
 * Customers · Shop · Hub — the couple's fourth word in the couple's slot). The
 * ROOM is still the Event Hub: its title, its headings, its back links.
 */
const TAB_WORD = 'Hub';
const OLD = /On the Day/;

/** Every file that renders the room's NAME to a supplier. */
const LABEL_SITES = [
  'lib/nav-registry-defaults.ts',
  'app/vendor-dashboard/_components/vendor-nav-destinations.ts',
  'app/vendor-dashboard/_components/vendor-bottom-nav.tsx',
  'app/vendor-dashboard/_components/vendor-rail-context.tsx',
  'app/vendor-dashboard/on-the-day/page.tsx',
  'app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx',
  'app/vendor-dashboard/on-the-day/live/[eventId]/papic/page.tsx',
];

function read(rel: string): string {
  const src = readFileSync(path.join(WEB, rel), 'utf8');
  assert.ok(src.length > 0, `${rel} is empty — the guard would pass on nothing`);
  return src;
}

/**
 * Strip comments before matching. Several of these files EXPLAIN the rename in
 * prose, and a raw-source scan would fail on the sentence describing the fix.
 * A line-prefix filter is not enough: the survivors of one are mostly
 * block-comment continuation lines.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | 'str' = 'code';
  let quote = '';
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (mode === 'code') {
      if (two === '//') { mode = 'line'; i += 2; continue; }
      if (two === '/*') { mode = 'block'; i += 2; continue; }
      if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
        mode = 'str'; quote = src[i]!; out += src[i]; i += 1; continue;
      }
      out += src[i]; i += 1; continue;
    }
    if (mode === 'str') {
      if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (src[i] === quote) mode = 'code';
      out += src[i]; i += 1; continue;
    }
    if (mode === 'line') {
      if (src[i] === '\n') { mode = 'code'; out += '\n'; }
      i += 1; continue;
    }
    if (two === '*/') { mode = 'code'; i += 2; continue; }
    i += 1;
  }
  return out;
}

test('the comment stripper actually strips — otherwise every check below is vacuous', () => {
  assert.equal(stripComments('const a = 1; // On the Day\n').includes('On the Day'), false);
  assert.equal(stripComments('/* On the Day */ const a = 1;').includes('On the Day'), false);
  assert.equal(stripComments("const a = 'On the Day';").includes('On the Day'), true);
});

test('NO RENDERED SITE STILL SAYS "On the Day"', () => {
  for (const rel of LABEL_SITES) {
    const code = stripComments(read(rel));
    assert.ok(
      !OLD.test(code),
      `${rel} still renders the old room name — a rename that misses a copy is a diff`,
    );
  }
});

test('the room says Event Hub; its tab — on the bar and the rail — says Hub', () => {
  const registry = read('lib/nav-registry-defaults.ts');
  // Both registry slots — the rail row AND the bar tab. The registry label wins
  // over the word in the code, so a slot still saying "Event Hub" would put the
  // old word back on a renamed tab with no error to notice.
  const slots = [...registry.matchAll(/route: "\/vendor-dashboard\/on-the-day",\s*\n\s*label: "([^"]+)"/g)];
  assert.equal(slots.length, 2, 'both registry slots must be found — a missed one is a stale label');
  for (const m of slots) assert.equal(m[1], TAB_WORD);
  // …and the code's own words agree with the registry's, on both menus.
  assert.match(
    stripComments(read('app/vendor-dashboard/_components/vendor-bottom-nav.tsx')),
    /key: 'onday',\s*\n\s*label: 'Hub',\s*\n\s*href: '\/vendor-dashboard\/on-the-day'/,
  );
  assert.match(
    stripComments(read('app/vendor-dashboard/_components/vendor-nav-destinations.ts')),
    /key: 'on-the-day',\s*\n\s*label: 'Hub',\s*\n\s*href: '\/vendor-dashboard\/on-the-day'/,
  );
  // The room itself keeps its name.
  assert.match(read('app/vendor-dashboard/on-the-day/page.tsx'), new RegExp(`title: '${NAME} · Supplier'`));
});

test('🔒 THE KEY AND THE ROUTE ARE UNCHANGED — four systems read them, three silently', () => {
  assert.match(read('app/vendor-dashboard/_components/vendor-nav-destinations.ts'), /key: 'on-the-day',/);
  assert.match(read('app/vendor-dashboard/_components/vendor-bottom-nav.tsx'), /key: 'onday',/);
  assert.match(read('lib/nav-registry-defaults.ts'), /key: "vendor\.sidebar\.on-the-day",/);
  assert.match(read('lib/nav-registry-defaults.ts'), /key: "vendor\.bottom-nav\.onday",/);
  for (const rel of [
    'app/vendor-dashboard/_components/vendor-nav-destinations.ts',
    'app/vendor-dashboard/_components/vendor-bottom-nav.tsx',
    'lib/nav-registry-defaults.ts',
  ]) {
    assert.ok(
      read(rel).includes('/vendor-dashboard/on-the-day'),
      `${rel} must still point at the shipped route — the rename never moves the address`,
    );
  }
});
