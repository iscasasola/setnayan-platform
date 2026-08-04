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




test('menu bar · the switch is read on EVERY day, not only the wedding day', () => {
  // If the loader only asks during the live window, the slot silently reverts to
  // "closed" on every other day and the fix above is undone from underneath.
  const L = readFileSync(join(HERE, '..', '_lib', 'loaders.ts'), 'utf8');
  assert.match(
    L,
    /const hostCameraOpen = await eventPapicGuestActive\(admin, event\.event_id\);/,
    'hostCameraOpen must be resolved unconditionally',
  );
  const line = L.slice(L.indexOf('const hostCameraOpen'));
  assert.ok(
    !line.slice(0, 200).includes("dayOfPhase === 'live'"),
    'the switch read is wrapped in a live-window check again',
  );
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

test('menu bar · the bar DECIDES NOTHING — every rule lives in the resolver', () => {
  // This is the separation that stops the bar and the rules disagreeing. They
  // did, twice in two days: a camera that vanished instead of locking, and tabs
  // that hid themselves after the page beneath them started rendering. A
  // component that cannot decide cannot contradict a decision.
  //
  // The rules themselves are pinned in _lib/site-nav.test.ts.
  assert.match(BAR, /export function SiteMenuBar\(\{ slots \}: \{ slots: NavSlot\[\] \}\)/);
  for (const decision of [
    'dayOfPhase',
    'isLive',
    'hostCameraOpen',
    'papicGuest',
    'anyChapterPublic',
    'siteMenuTabs',
  ]) {
    assert.ok(
      !BAR.includes(decision),
      `the bar consults "${decision}" — it must render what the resolver decided, not re-decide`,
    );
  }
});

test('menu bar · both trees feed it from the SAME resolver', () => {
  const calls = (SITE.match(/resolveSiteNav\(\{/g) ?? []).length;
  assert.equal(calls, 2, 'expected the anonymous and guest trees to both resolve their bar');
  assert.ok(!SITE.includes('sections={menuSections}'), 'a tree still uses the old props-based bar');
});
