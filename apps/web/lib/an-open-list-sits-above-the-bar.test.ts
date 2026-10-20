/**
 * an-open-list-sits-above-the-bar.test.ts — 📱 AN OPEN LIST NEVER HIDES UNDER THE BOTTOM BAR, AND NEVER COVERS IT.
 *
 * Found 2026-10-20 in the controller's 375 px shot of the guest card: the app's bottom bar (Guests · Suppliers · Hub ·
 * More) drew over the open Group list, and "＋ New group…"'s Create / × sat under it. Measured in the lab before the fix
 * (Chromium + WebKit, 375 × 812, the card page `/guests/[guestId]` under the real dock): the New group strip 63 px under
 * the bar (Create 43 px), a ✎ rename strip 139 px; a PickMenu (Title) opened DOWN 56 px over the bar, the Add card's
 * Role 56 px. After: 0 everywhere. The guest card's phone SHEET over the List (z-75) was never affected — it covers the
 * bar — and the rule below is written so it stays that way (a bar under the layer we show in covers nothing).
 *
 * ── What is proven ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE RULES (executed):
 *   1 · `revealDelta` brings a box's bottom above the bottom bar, keeps its top below the top bar when it cannot all fit,
 *       brings a box under a top bar down, and leaves a box already in the band alone;
 *   2 · `topChromeDrop` counts only bars stuck to the top edge — the mirror of `bottomChromeLift` (the cookie banner's);
 *   3 · `placePickList` with a `floor`: over a grid of button positions and list heights, a list never reaches below the
 *       floor, and opens up when there is more room above.
 * THE WIRING (source, comments stripped):
 *   4 · every PickMenu places its list from `pickViewport` (the floor at the bar); the one Group picker reveals the list
 *       on open and its editor when one opens, again on a keyboard move, and focuses its name box without the browser's
 *       own scroll; the band skips bars under the layer the thing sits in (the dock under the card's sheet).
 *
 * ── Caveats ───────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · No browser runs here: the before/after numbers above are the lab walk's (`list-above-bar/work/measure.jsonl`),
 *     Playwright WebKit being the Safari engine, not a real iPhone. The keyboard case (visualViewport) is not walked.
 *   · § 4 reads source; a rewrite keeping the shape could pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { REVEAL_MARGIN, revealDelta, topChromeDrop } from './bottom-chrome';
import { PICK_LIST_GAP, PICK_LIST_MARGIN, placePickList } from '../app/dashboard/[eventId]/website/editor/_components/pick-menu-place';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const VH = 812;
const DOCK_TOP = 714; // bar + home inset, as the lab measured

test('1 · a box under the bottom bar is brought above it; a tall one keeps its top; one under a top bar comes down', () => {
  const band = { top: 61, bottom: DOCK_TOP };
  // The New group strip: 120 px, its bottom 63 px under the bar.
  const strip = { top: DOCK_TOP - 57, bottom: DOCK_TOP + 63 };
  const d = revealDelta(strip, band);
  assert.equal(strip.bottom - d, DOCK_TOP - REVEAL_MARGIN, 'the strip’s bottom does not land just above the bar');
  // A list taller than the room shows its top (the pill), not its bottom.
  const tall = { top: 400, bottom: 1300 };
  assert.equal(tall.top - revealDelta(tall, band), band.top + REVEAL_MARGIN, 'a tall list was scrolled past its top');
  // Under the stuck top bar → scrolled back down (negative = up the page).
  const under = { top: 20, bottom: 200 };
  assert.equal(under.top - revealDelta(under, band), band.top + REVEAL_MARGIN);
  // Already clear → no scroll.
  assert.equal(revealDelta({ top: 200, bottom: 600 }, band), 0, 'a box already in view was scrolled');
  // Property over a sweep: after the move the box is inside the band whenever it fits.
  for (let top = -300; top < 1200; top += 37) {
    for (const h of [44, 120, 300, 600]) {
      const box = { top, bottom: top + h };
      const by = revealDelta(box, band);
      const after = { top: box.top - by, bottom: box.bottom - by };
      if (h <= band.bottom - band.top - 2 * REVEAL_MARGIN) {
        assert.ok(after.bottom <= band.bottom - REVEAL_MARGIN && after.top >= band.top + REVEAL_MARGIN, `box ${top}+${h} not in the band after ${by}`);
      } else {
        assert.equal(after.top, band.top + REVEAL_MARGIN, `tall box ${top}+${h} does not show its top`);
      }
    }
  }
});

test('2 · only bars stuck to the top edge count as the top cover', () => {
  const w = 375;
  assert.equal(topChromeDrop([{ top: 0, bottom: 61, width: w, height: 61 }], VH), 61, 'the stuck shell bar is not counted');
  assert.equal(topChromeDrop([{ top: 300, bottom: 361, width: w, height: 61 }], VH), 0, 'a sticky bar mid-page counted');
  assert.equal(topChromeDrop([{ top: 0, bottom: VH, width: w, height: VH }], VH), 0, 'a full-screen layer counted as a bar');
  assert.equal(topChromeDrop([{ top: -61, bottom: 0, width: w, height: 61 }], VH), 0, 'a bar scrolled away counted');
});

test('3 · a PickMenu list never reaches below the floor (the bar) — it is capped, or opens up', () => {
  let cases = 0;
  for (let btnTop = 80; btnTop < DOCK_TOP - 44; btnTop += 23) {
    for (const listHeight of [88, 176, 264, 452, 700]) {
      const button = { top: btnTop, bottom: btnTop + 44, left: 140, width: 220 };
      const p = placePickList({ button, listHeight, viewport: { width: 375, height: VH, floor: DOCK_TOP } });
      const drawn = Math.min(listHeight, p.maxHeight);
      if (p.side === 'below') {
        assert.ok(p.top + drawn <= DOCK_TOP - PICK_LIST_MARGIN + 0.5, `button ${btnTop}, list ${listHeight}: drawn to ${p.top + drawn}, over the bar at ${DOCK_TOP}`);
      } else {
        assert.ok(p.top >= PICK_LIST_MARGIN - 0.5 && p.top + drawn <= button.top - PICK_LIST_GAP + 0.5, `button ${btnTop}, list ${listHeight}: above, off the screen`);
      }
      cases++;
    }
  }
  assert.ok(cases > 100, 'anti-vacuity');
  // The Title pill near the bottom, a 4-row list (the lab's case): before, it opened down 56 px over the bar.
  const title = placePickList({ button: { top: 560, bottom: 604, left: 140, width: 220 }, listHeight: 176, viewport: { width: 375, height: VH, floor: DOCK_TOP } });
  assert.equal(title.side, 'above', 'the Title list still opens down over the bar');
  // No floor = the screen's edge, exactly as before.
  const noFloor = placePickList({ button: { top: 560, bottom: 604, left: 140, width: 220 }, listHeight: 176, viewport: { width: 375, height: VH } });
  assert.equal(noFloor.side, 'below');
});

test('4 · the wiring: PickMenu floors at the bar, the Group picker reveals its list and editors, the sheet keeps its dock', () => {
  const pick = read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx');
  assert.match(pick, /viewport: pickViewport\(b, listRef\.current\),/, 'PickMenu places its list against the bare screen');
  assert.doesNotMatch(pick, /viewport: \{ width: window\.innerWidth, height: window\.innerHeight \}/, 'PickMenu still reads the bare screen');
  const place = read('app/dashboard/[eventId]/website/editor/_components/pick-menu-place.ts');
  assert.match(place, /viewport\.floor \?\? viewport\.height/, 'placePickList ignores the floor');

  const picker = read('app/dashboard/[eventId]/guests/_components/guest-group-picker.tsx');
  const fx = picker.slice(picker.indexOf('revealAboveChrome(ed ?? box'), picker.indexOf('revealAboveChrome(ed ?? box') + 600);
  assert.ok(fx.length > 0 && picker.includes('revealAboveChrome(ed ?? box, ed ? null : btnRef.current)'), 'the Group list is not revealed from its pill');
  assert.match(picker, /\}, \[open, mode, err, clash\]\);/, 'the reveal does not follow the editor opening (or its sentence)');
  assert.match(picker, /const frame = requestAnimationFrame\(show\);/, 'the reveal is never run when the list opens');
  assert.match(picker, /querySelector\('\[data-group-rename\],\[data-group-delete\]'\) \?\? box\?\.querySelector\('\[data-group-new\]'\)\?\.closest\('li'\)/, 'the open editor is not the thing revealed');
  assert.match(picker, /vv\?\.addEventListener\('resize', onKeyboard\)/, 'a keyboard move does not re-reveal the editor');
  assert.match(picker, /el\?\.focus\(\{ preventScroll: true \}\)/, 'the name box’s focus scrolls on its own, fighting the reveal');

  const dom = read('lib/reveal-above-chrome.ts');
  assert.match(dom, /if \(layer && !layer\.contains\(el\) && zOf\(el\) < zOf\(layer\)\) continue;/, 'a bar under the card’s sheet is counted as covering it');
  assert.match(dom, /import \{ bottomChromeLift, revealDelta, topChromeDrop, type ChromeBox \} from '@\/lib\/bottom-chrome';/, 'not the cookie banner’s bar rule');
  assert.match(dom, /vv\.offsetTop \+ vv\.height/, 'the keyboard’s edge is not the floor');
});
