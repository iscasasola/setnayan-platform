/**
 * the-reply-pills-are-one-family.test.ts — 🔒 EVERY ROW'S REPLY PILL WEARS ITS ICON AND ITS OWN COLOUR.
 *
 * Owner 2026-10-27 (DECISION_LOG "THE ROW REPLY PILLS ARE ONE FAMILY", option A of
 * `prototypes/guests_reply_pills_2026-10-27/`): *"The attending. Not attending. No reply and no invite. Eeds to be
 * presented better."* → *"Okay let us do A"*.
 *
 *   · Five states, five icons (Attending ✓ · Not coming ✕ · Maybe ? · No reply clock · To invite send) — none bare.
 *   · Not coming is the danger colour, never the grey of No reply (they were identical).
 *   · To invite is an outline in the accent, never the avatars' gold fill (it melted into them).
 *   · An unnamed +1 seat says "On <guest>'s invitation" instead of a To invite of its own; the COUNT rule is untouched.
 *
 * Sabotage (2026-10-27, each reverted): Not coming back to `pillMute` → red · To invite back to the gold fill → red ·
 * the icon dropped from the pill → red · the +1 line removed → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8'));

function rule(sel: string): string {
  const at = CSS.indexOf(`${sel} {`);
  assert.ok(at > -1, `${sel} is gone`);
  return CSS.slice(at, CSS.indexOf('}', at));
}

test('five states, each with its own icon and class', () => {
  const map = SCREEN.slice(SCREEN.indexOf('const PILL:'), SCREEN.indexOf('};', SCREEN.indexOf('const PILL:')));
  const want: Record<string, [string, string]> = {
    attending: ['pillOk', 'Check'],
    declined: ['pillNo', 'X'],
    maybe: ['pillWine', 'CircleHelp'],
    pending: ['pillMute', 'Clock'],
    toinvite: ['pillGold', 'Send'],
  };
  for (const [k, [cls, icon]] of Object.entries(want)) {
    assert.match(map, new RegExp(`${k}: \\{ cls: '${cls}', word: [^}]*Icon: ${icon} \\}`), `${k} is not ${cls} + ${icon}`);
  }
  assert.match(SCREEN, /<pill\.Icon aria-hidden className=\{styles\.pillIco\}/, 'the pill no longer draws its icon');
});

test('Not coming is red, never the grey of No reply', () => {
  assert.match(rule('.pillNo'), /color: rgb\(var\(--color-danger\)\);/);
  assert.notEqual(rule('.pillNo').replace('.pillNo', ''), rule('.pillMute').replace('.pillMute', ''), 'Not coming and No reply look the same again');
});

test('To invite is an accent outline, never the avatars’ gold fill', () => {
  const inv = rule('.pillGold');
  assert.match(inv, /background: transparent;/);
  assert.match(inv, /box-shadow: inset 0 0 0 1\.25px rgb\(var\(--sn-accent\) \/ 0\.7\);/);
  assert.doesNotMatch(inv, /gild/, 'To invite wears the avatars’ gold again');
});

test('an unnamed +1 rides its guest’s invitation instead of a pill of its own', () => {
  assert.match(SCREEN, /const rides = plusWords\?\.name \? plusWords\.host : null;/);
  assert.match(SCREEN, /data-row-rides-on="">\s*On \{rides\}’s invitation/);
});
