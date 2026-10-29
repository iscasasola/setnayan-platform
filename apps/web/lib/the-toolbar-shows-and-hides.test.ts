/**
 * 🫥 THE EDITING TOOLBAR SHOWS AND HIDES — owner, 30 Oct, verbatim: *"i was thinking having the bottom nav still and
 * the bottom toolbar to show and hide when not needed?"*, then *"yes"* (DECISION_LOG 2026-10-30 "EVENT HUB PRO (look
 * redesign) — THE APP'S NAV STAYS; THE EDITING TOOLBAR SHOWS AND HIDES; THREE OPEN CALLS SETTLED"; prototype
 * `prototypes/build-contracts-2026-10-30/event-hub-pro/` "Hide the toolbar").
 *
 *   1 · it HIDES on a tap on the empty page, a scroll of the page (a finger or a wheel — the canvas says so, never for
 *       the Maker's own scrolling) and a swipe down on it; never while a scene is held, never in the guest preview,
 *       never on a desktop (its tools column is docked and never hides);
 *   2 · it SHOWS on arrival (call 2: something is always picked), and comes back for any part picked — the one already
 *       picked too — any tool picked, and a tap on its head;
 *   3 · stowed, what is left IS the toolbar's own head — the handle and the "You're editing · … ▴" line, one button —
 *       and the part stays picked (its frame stays on the page);
 *   4 · it glides with the app's ONE pin motion (`pin-glide.css`), the page's room and the guests' bar riding it, the
 *       work area's tool leaving with the four rows; no glide under Reduce Motion.
 *
 * Read from SOURCE (the toolbar needs a live canvas to render); each assertion names what it holds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { STAGE_BAR_HANDLE_PX, STAGE_BAR_LINE_PX, STAGE_BAR_STOW_GLIDE, STAGE_BAR_STOW_PX, STAGE_BAR_SWIPE_PX } from './maker-stage-room';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const TOOLS = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
const BRIDGE = read('app/[slug]/_components/editor-bridge.tsx');

test('1 · it hides on a tap on the empty page, a scroll of the page, a swipe down — never held, previewing or on a desktop', () => {
  assert.match(TOOLS, /d\.t === 'tapOutside' && !previewingRef\.current\) stowRef\.current\(\);/, 'a tap on the page’s ground does not put it away');
  assert.match(TOOLS, /d\.t === 'pageScroll' && !previewingRef\.current\) stowRef\.current\(\);/, 'a scroll of the page does not put it away');
  assert.match(TOOLS, /d\.t === RSVP_GROUND_MESSAGE\) stowRef\.current\(\);/, 'the RSVP stage’s ground does not put it away');
  assert.match(TOOLS, /stowRef\.current = \(\) => \{\s*if \(!desk && !held\) setStowed\(true\);\s*\};/, 'it may stow on a desktop, or while a scene is held');
  assert.match(TOOLS, /if \(desk\) setStowed\(false\);/, 'a desktop’s column can be left stowed');
  // The swipe: down by more than its distance, never from a field, a slider or a card strip.
  assert.equal(STAGE_BAR_SWIPE_PX, 40);
  assert.match(TOOLS, /y - swipe\.current > STAGE_BAR_SWIPE_PX/, 'a swipe down does not put it away');
  assert.match(TOOLS, /closest\('input,textarea,select,\[contenteditable="true"\],\[data-look-cards\],\[role="slider"\]'\)/, 'a swipe from a field or a card strip stows the toolbar');
  assert.match(TOOLS, /onTouchStart=\{\(e\) => swipeFrom\(/);
  assert.match(TOOLS, /onTouchMove=\{\(e\) => swipeTo\(/);
  // The canvas says a scroll only for the couple's own gestures, at most once a moment, never in the preview.
  assert.match(BRIDGE, /const theirScroll = \(\) => \{\s*if \(guest\.on\) return;[\s\S]*?t: 'pageScroll'/, 'the canvas does not say the couple scrolled');
  assert.match(BRIDGE, /window\.addEventListener\('touchmove', theirScroll, \{ passive: true \}\);\s*window\.addEventListener\('wheel', theirScroll, \{ passive: true \}\);/, 'a scroll is said for something other than a finger or a wheel');
  assert.doesNotMatch(BRIDGE, /addEventListener\('scroll', theirScroll/, 'the Maker’s own scrolling (a pick brought into view) would put the toolbar away');
});

test('2 · it shows on arrival and comes back for a part, a tool, or its head', () => {
  assert.match(TOOLS, /const \[stowed, setStowed\] = useState\(false\);/, 'it does not show on arrival');
  assert.match(TOOLS, /\(k: MakerPartKey\) => \{\s*setPicked\(k\);\s*setStowed\(false\);/, 'a part picked leaves it stowed');
  assert.match(TOOLS, /if \(d\.t === 'edit' && typeof d\.key === 'string'\) \{\s*setStowed\(false\);/, 'a part tapped on the page (the picked one too) leaves it stowed');
  assert.match(TOOLS, /setTool\(t\);\s*setStowed\(false\);/, 'a tool picked leaves it stowed');
  assert.match(TOOLS, /data-stage-show=""[\s\S]{0,200}onClick=\{\(\) => setStowed\(false\)\}/, 'its head does not bring it back');
});

test('3 · stowed, its head is left — the handle and the line, one named button — and the part stays picked', () => {
  assert.equal(STAGE_BAR_STOW_PX, STAGE_BAR_HANDLE_PX + STAGE_BAR_LINE_PX + 10, 'the head is not the handle and the line');
  assert.equal(STAGE_BAR_STOW_PX, 44, 'the head is not one whole tap target');
  assert.match(TOOLS, /if \(stowed && !desk\) \{\s*onPx\(STAGE_BAR_STOW_PX\);\s*return;\s*\}/, 'stowed, the lower third keeps more than its head');
  assert.match(TOOLS, /aria-label=\{`Show the editing tools — \$\{linePieces\.join\(' › '\)\}`\}/, 'the head’s button is not named for what it brings back');
  assert.match(TOOLS, /\[data-stage-tools\]\[data-stage-stow="away"\] \[data-stage-caption\]>span\[aria-hidden\]::after\{content:"\\\\25B4";/, 'the line does not say ▴');
  assert.match(TOOLS, /\[data-stage-tools\]\[data-stage-stow="away"\]>:not\(\[data-stage-handle\],\[data-stage-caption\],\[data-stage-show\]\)\{visibility:hidden;/, 'what the head does not show stays reachable');
  // The part is not let go: stowing never calls deselect.
  const stowBody = /stowRef\.current = \(\) => \{([\s\S]*?)\};/.exec(TOOLS)?.[1] ?? '';
  assert.ok(stowBody.length > 10, 'precondition: the stow was found');
  assert.doesNotMatch(stowBody, /deselect|setPicked/, 'putting the toolbar away lets the part go');
});

test('4 · the app’s one pin glide carries it; the guests’ bar and the work area’s tool ride it; none under Reduce Motion', () => {
  assert.equal(STAGE_BAR_STOW_GLIDE, 'var(--sn-pin-glide-ms,300ms) var(--sn-pin-glide-ease,cubic-bezier(0.2,0.8,0.2,1))');
  const glide = readFileSync(join(WEB, 'app/_components/pinned-row/pin-glide.css'), 'utf8');
  assert.match(glide, /--sn-pin-glide-ms: 300ms;/, 'the pin glide the toolbar rides is gone');
  assert.match(TOOLS, /\[data-maker-lower-third\]:has\(>\[data-stage-tools\]\[data-stage-stow\]\)\{transition:height \$\{STAGE_BAR_STOW_GLIDE\}!important\}/, 'the page’s room jumps');
  assert.match(TOOLS, /\[data-stage-guest-bar\]\{transition:bottom \$\{STAGE_BAR_STOW_GLIDE\}!important\}/, 'the guests’ bar does not ride it');
  assert.match(TOOLS, /\[data-stage-stow="away"\]\) \[data-phone-chrome="panel"\]\{transform:translateY\(var\(--scene-bar-px,100%\)\)!important;opacity:0;pointer-events:none\}/, 'the work area’s tool stays on the page');
  assert.match(TOOLS, /@media \(prefers-reduced-motion:reduce\)\{\[data-maker-lower-third\]:has\(>\[data-stage-tools\]\[data-stage-stow\]\)/, 'it glides under Reduce Motion');
  // A desktop never wears it.
  assert.match(TOOLS, /data-stage-stow=\{desk \? undefined :/, 'a desktop’s column wears the stow');
});
