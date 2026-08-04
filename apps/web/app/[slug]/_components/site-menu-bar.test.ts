/**
 * The camera slot in the live menu bar, and the veil's retirement.
 *
 * Both are owner rulings that a later tidy-up could silently reverse, and both
 * were caught by the owner looking at his phone rather than by any check —
 * twice in two days. These are the assertions that make the third time fail
 * loudly instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BAR = readFileSync(join(HERE, 'site-menu-bar.tsx'), 'utf8');
const SITE = readFileSync(join(HERE, 'site-body.tsx'), 'utf8');
const VEIL = readFileSync(join(HERE, 'reveal', 'reveal-overlay.tsx'), 'utf8');
const HANDOFF = readFileSync(join(HERE, 'std-film-handoff.tsx'), 'utf8');

test('menu bar · a closed camera is DRAWN and locked, never absent', () => {
  // Owner 2026-08-03: the host holds the switch, but the camera is part of what
  // the invitation promises. An absent slot says the wedding has no camera; a
  // dead button says the app is broken. Locked says neither.
  assert.match(BAR, /\{ locked: true; reason: string \}/);
  assert.match(BAR, /aria-disabled="true"/);
  // The locked branch must not be a link — a link would navigate.
  const locked = BAR.slice(BAR.indexOf('aria-disabled'));
  assert.ok(!locked.slice(0, 400).includes('<a'), 'the locked camera is still a link');
  // And it must carry the reason.
  assert.match(BAR, /title=\{camera\.reason\}/);
});

test('menu bar · both trees offer the camera, and both lock it rather than hide it', () => {
  const uses = SITE.match(/camera=\{/g) ?? [];
  assert.equal(uses.length, 2, 'expected the camera slot in BOTH the anonymous and guest trees');
  const locks = SITE.match(/locked: true, reason: 'The host has not opened the camera'/g) ?? [];
  assert.equal(locks.length, 2, 'a tree hides the camera instead of locking it');
});

test('menu bar · Papic sits in the MIDDLE of the bar', () => {
  // The widest, easiest place for a thumb — on the day, shooting is what people
  // are actually doing.
  assert.match(BAR, /const mid = Math\.ceil\(tabs\.length \/ 2\);/);
  assert.ok(
    BAR.indexOf('{before.map') < BAR.indexOf('{camera ?'),
    'the camera is not between the two halves of the tab list',
  );
  assert.ok(BAR.indexOf('{camera ?') < BAR.indexOf('{after.map'));
});

test('veil · retires when the visitor steps out to the site, and returns with the film', () => {
  // The veil was built to persist by owner ruling (2026-06-18/19) — right when
  // the film WAS the page. Once the site moved underneath it, that ruling
  // silently became a decision about the whole website.
  assert.match(VEIL, /addEventListener\(STD_FILM_EXIT_EVENT, retire\)/);
  assert.match(VEIL, /addEventListener\(STD_FILM_RETURN_EVENT, restore\)/);
  assert.match(VEIL, /const restore = \(\) => setGone\(false\)/);
});

test('veil · the event names are imported, never re-typed', () => {
  // A hand-copied name drifts silently and the veil simply stops standing down,
  // with nothing failing.
  assert.match(VEIL, /import \{ STD_FILM_EXIT_EVENT \} from '\.\.\/save-the-date-film';/);
  assert.match(VEIL, /import \{ STD_FILM_RETURN_EVENT \} from '\.\.\/std-film-handoff';/);
  assert.ok(!/'std:film-(exit|return)'/.test(VEIL), 'the veil hard-codes an event name');
  assert.match(HANDOFF, /export const STD_FILM_RETURN_EVENT = 'std:film-return';/);
});
