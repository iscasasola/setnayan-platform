/**
 * an-added-rsvp-line-is-brought-into-view.test.ts — ＋ ON THE RSVP STAGE: THE NEW LINE IS SCROLLED INTO THE BAND.
 *
 * The Maker walk, 2026-10-12 (F3, `controller-2026-10-12/walk-maker/shots/p-667-2-added.png`): at 375 × 667 a
 * picture added above the Question sat mostly BELOW the 270-px band of page left above the toolbar — framed, picked,
 * its Edit open, and out of sight. ＋ keeps the same part (the card) picked, so the toolbar's own centring
 * (`centrePart`, run when the pick changes) never ran for it — and it centres the card's section, never a line.
 *
 * NOW (`rsvp-list-stage.tsx` `bringAddedIntoView`): the panel's answer to an add brings the new line into view once
 * it is drawn (a picture once its file shows), by the rule every pick uses (`partPickScroll`), in the band measured
 * the way `centrePart` measures it. Pinned + the band sums run:
 *   (1) an add that landed starts it, for the line picked — and stops the one before;
 *   (2) it waits for the line to be on the page with a height, and for a picture's file — at most a few seconds;
 *   (3) the band is the frame down to the guest bar / the lower third; the FRAME's window is scrolled (never
 *       `scrollIntoView`, which would scroll the Maker too); a line already in the middle is left alone;
 *   (4) the sums: in the 270-px band of a 667-px phone, a Wide (112) or Tall (176) picture lands whole in the band,
 *       wherever it was.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { partPickScroll } from './maker-stage-room';

const STAGE = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/rsvp-list-stage.tsx'), 'utf8'));
const fn = STAGE.slice(STAGE.indexOf('function bringAddedIntoView('), STAGE.indexOf('export function useRsvpListStage('));

test('(1) an add that landed brings ITS line into view, and stops the one before', () => {
  assert.match(
    STAGE,
    /if \(done\.ok && done\.edit\.do === 'add' && done\.pick\) \{\s*stopInView\.current\(\);\s*stopInView\.current = bringAddedIntoView\(frameSel, done\.edit\.part, done\.pick\);\s*\}/,
    'an added line is no longer brought into view',
  );
  assert.match(STAGE, /const stopInView = useRef<\(\) => void>\(\(\) => \{\}\);/);
  /* Stopped when the listener goes (the stage closed, another screen). */
  assert.match(STAGE, /window\.removeEventListener\(RSVP_GROUP_PICK_EVENT, onGroup\);\s*stopInView\.current\(\);\s*\};\s*\}, \[on, onPick, onSay, frameSel\]\);/);
});

test('(2) it waits for the line to be drawn with a height, and for a picture’s file — a few seconds at most', () => {
  assert.ok(fn.length > 400, 'anti-vacuity: bringAddedIntoView was not found');
  assert.match(fn, /const node = doc \? nodeOf\(doc, part, name\) : null;/);
  assert.match(fn, /const ready = node !== null && \(!img \|\| img\.complete\) && node\.getBoundingClientRect\(\)\.height > 0;/);
  assert.match(fn, /if \(performance\.now\(\) - t0 < ADDED_IN_VIEW_WAIT_MS\) raf = requestAnimationFrame\(step\);/);
  assert.match(STAGE, /const ADDED_IN_VIEW_WAIT_MS = 4000;/);
  assert.match(fn, /return \(\) => cancelAnimationFrame\(raf\);/);
});

test('(3) the band is centrePart’s; the frame’s own window scrolls; a line in the middle stays', () => {
  assert.match(fn, /const bottom = Math\.min\(fr\.bottom, bar && bar\.height > 0 \? bar\.top : Infinity, lt \? lt\.top : Infinity\);/);
  assert.match(fn, /document\.querySelector\('\[data-stage-guest-bar\]'\)/);
  assert.match(fn, /document\.querySelector\('\[data-maker-lower-third\]'\)/);
  assert.match(fn, /const dy = partPickScroll\(\{ top: r\.top, height: r\.height \}, band\);/);
  assert.match(fn, /if \(Math\.abs\(dy\) > 2\) win\.scrollTo\(\{ top: Math\.max\(0, win\.scrollY \+ dy\), behavior: 'smooth' \}\);/);
  assert.doesNotMatch(fn, /scrollIntoView/, 'scrollIntoView scrolls the Maker too');
  /* The toolbar's own measure is the one copied — if it changes, this must be looked at again. */
  const TOOLS = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/stage-tools.tsx'), 'utf8'));
  assert.match(TOOLS, /const bottom = Math\.min\(fr\.bottom, bar && bar\.height > 0 \? bar\.top : Infinity, lt \? lt\.top : Infinity\);/, 'centrePart measures its band another way now');
});

test('(4) the sums: a Wide or Tall picture lands whole in a 270-px band, from below or above it', () => {
  const band = 270;
  for (const height of [112, 176]) {
    for (const top of [230, 260, 520, -150]) {
      const dy = partPickScroll({ top, height }, band);
      const landed = top - dy;
      assert.ok(landed >= 0 && landed + height <= band, `a ${height}-px line at ${top} lands at ${landed}…${landed + height}, outside 0…${band}`);
    }
  }
});
