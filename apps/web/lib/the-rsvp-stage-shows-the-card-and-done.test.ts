/**
 * 🃏 ⌨ THREE RSVP STAGE FAULTS A TESTER HIT (2026-10-11), AND WHAT HOLDS THEM SHUT:
 *
 *   · "RSVP opens with the card cut" and "the CARD label covers the guest's name" — ONE cause, measured 2026-10-12
 *     (lab, 375 × 812 and 375 × 667): the stage opens with the card picked, and a second later the page was at
 *     122 px. The card's frame is drawn round the WHOLE card (masthead, guest, form) while the stage's centring
 *     brings up the form's own section (`f:rsvp`, under the guest's name) — so the card's top (the couple's names, the
 *     date) was scrolled off and its name tag, clamped to the visible top, sat on "Teresita Aquino". A picked card is
 *     now shown from its top: the hold a screen opened by its tab already gets (`RSVP_TOP_MESSAGE`).
 *   · "Question has no Done" — a line's words box is the RSVP PANEL's, which lies over the toolbar, outside
 *     `[data-stage-tools]`, so the toolbar's own typing bar never came; the open row had only ✕. The panel has the
 *     stage's own typing bar for it now (`RsvpPanelTypingBar`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { createRsvpCanvasTop } from '../app/[slug]/_components/rsvp-canvas-parts';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · a picked CARD is shown from its top: a beat after the pick, and to a frame that comes up while it is picked', () => {
  const STAGE = src(`${L}/maker-rsvp-stage.tsx`);
  /* A card is a reply screen's part with no line picked — a LINE is brought into view as before. */
  assert.match(STAGE, /cardPicked\.current = pickedLine === null && rsvpLookCard\(pickedPart\) !== null;/);
  /* After the pick's own message (which ends the hold) — a beat later, to the screen on show. */
  assert.match(
    STAGE,
    /if \(!cardPicked\.current\) return;\s*const t = window\.setTimeout\(\(\) => \{\s*frames\.current\[sceneNow\.current\]\?\.contentWindow\?\.postMessage\(\{ source: RSVP_BRIDGE_SOURCE, t: RSVP_TOP_MESSAGE \}, window\.location\.origin\);\s*\}, 0\);\s*return \(\) => window\.clearTimeout\(t\);\s*\}, \[pickedPart, pickedLine\]\);/,
    'a picked card is no longer shown from its top',
  );
  assert.match(STAGE, /if \(d\.t === 'rsvpReady'\) \{\s*post\(from\);\s*if \(cardPicked\.current\) from\.contentWindow\?\.postMessage\(\{ source: RSVP_BRIDGE_SOURCE, t: RSVP_TOP_MESSAGE \}, window\.location\.origin\);/);
  /* The page answers that message by going to its top and holding there (the bridge's own, unchanged). */
  assert.match(src('app/[slug]/_components/rsvp-canvas-bridge.tsx'), /if \(d\.t === RSVP_TOP_MESSAGE\) \{\s*stopTyping\(\);\s*pageTop\.open\(\);/);
});

test('2 · the hold that answers it: to the top at once, a scroll that is not the couple’s put back, their touch frees it', () => {
  let y = 122;
  let t = 0;
  const win = { get scrollY() { return y; }, scrollTo: ({ top }: { top: number }) => void (y = top) };
  const top = createRsvpCanvasTop(win, () => t);
  top.open();
  assert.equal(y, 0, 'the card is not shown from its top');
  /* The stage's centring (a scroll that is not the couple's) a second later: put back. */
  t = 1100;
  y = 122;
  top.onScroll();
  assert.equal(y, 0, 'the centring took the card’s top away again');
  /* Their own touch: the page is theirs. */
  top.onTouch();
  y = 300;
  top.onScroll();
  assert.equal(y, 300);
});

test('3 · Done for a line’s words typed in the panel: the stage’s own typing bar, shown only while a box is open', () => {
  const LIST = src(`${L}/rsvp-line-list.tsx`);
  /* Shown by rule while a typed row of the panel's rows is open — no state to fall out of step with the field. */
  assert.match(LIST, /'\[data-rsvp-panel-keys\]\{display:none!important\}' \+\s*'body:has\(\[data-rsvp-stage-rows\] \[data-form-row-editing\]\) \[data-rsvp-panel-keys\]\{display:flex!important\}'/);
  /* The stage's own bar: its classes, "Typing · <line>", the brand Done — which only leaves the box (the row keeps). */
  assert.match(LIST, /data-rsvp-panel-keys="" style=\{\{ bottom \}\} className=\{`fixed inset-x-0 z-\[85\] \$\{SP_KEY_BAR\}`\}>/);
  assert.match(LIST, /<span className="min-w-0 truncate">Typing · \{name\}<\/span>/);
  assert.match(LIST, /<span data-type-done="" className=\{SP_KEY_DONE\}>\s*<ActionButton tone="brand" main icon=\{Check\} label="Done" onClick=\{\(\) => \(document\.activeElement as HTMLElement \| null\)\?\.blur\?\.\(\)\} \/>/);
  /* Both of the panel's word boxes for a line have it — one of the page's own lines, and one the couple added — and
     the rows it watches are the ones they stand in. */
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(PANEL, /<RsvpPanelTypingBar name=\{\(picked\.line && RSVP_LINE_NAME\[picked\.line\]\) \|\| 'Words'\} \/>/);
  assert.match(PANEL, /<RsvpPanelTypingBar name=\{addedLine\.k === 'h' \? 'Heading' : 'Message'\} \/>/);
  /* (Three Edit views of a line; the third is a PICTURE's, which has no words box and so no bar.) */
  assert.equal((PANEL.match(/data-rsvp-stage-rows="" data-rsvp-stage-line-edit=/g) ?? []).length, 3);
  assert.equal((PANEL.match(/<RsvpPanelTypingBar /g) ?? []).length, 2);
});
