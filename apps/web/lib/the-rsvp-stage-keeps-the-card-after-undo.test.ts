/**
 * the-rsvp-stage-keeps-the-card-after-undo.test.ts — ↺ TAKES AWAY THE PICKED LINE; ITS CARD IS PICKED, NEVER NOTHING.
 *
 * The Maker walk, 2026-10-12 (F5, `controller-2026-10-12/walk-maker/shots/r-812-9-undo2.png`): ＋ a line on the RSVP
 * stage, ↺ until it is gone — the toolbar then showed "RSVP › FORM", Edit lit, and NOTHING under it. Cause: the
 * stage's list hook let go of a gone line with `onPick(null)`, which the toolbar reads as "deselect" — no part, so no
 * rows. The page the couple is looking at is still that screen's card; when the stage opens, that card is what is
 * picked ("RSVP › FORM › CARD" with the reply's settings).
 *
 * NOW: the gone line hands the pick to its screen's CARD through the toolbar's own "Open the card" event
 * (`RSVP_OPEN_CARD_EVENT` — the line goes, the card it sat on stays the picked part; the pass's line hands on to the
 * When-yes card). Pinned (no DOM here; the walk saw it — controller-2026-10-12/maker-polish):
 *   (1) on the truth, a gone added line or group asks for its card — and nothing on that path deselects;
 *   (2) the toolbar's answer to that event keeps a part picked (it clears the LINE only);
 *   (3) the form's card, picked with no line, draws its Edit rows (the reply's settings) — the rows the couple sees.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { RSVP_OPEN_CARD_EVENT } from './rsvp-stage-shared';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) a gone added line or group asks for its card — never a deselect', () => {
  const LIST = src(`${L}/rsvp-list-stage.tsx`);
  assert.match(LIST, /import \{ RSVP_OPEN_CARD_EVENT \} from '@\/lib\/rsvp-stage-shared';/);
  const at = LIST.indexOf('const onTruth = () => {');
  assert.ok(at > 0, 'anti-vacuity: the truth listener was not found');
  const body = LIST.slice(at, LIST.indexOf('};', at) + 2);
  assert.match(body, /if \(doc && !nodeOf\(doc, listPart, line\)\) window\.dispatchEvent\(new CustomEvent\(RSVP_OPEN_CARD_EVENT\)\);/, 'the gone line no longer asks for its card');
  assert.doesNotMatch(body, /onPick|letGo|\(null\)/, 'the gone line lets go of everything again (Edit lit, nothing under it)');
  assert.doesNotMatch(LIST, /letGo\.current\(null\)/, 'a let-go-of-everything path is back');
});

test('(2) the toolbar answers "Open the card" by keeping the card picked — it clears the line only', () => {
  assert.equal(RSVP_OPEN_CARD_EVENT, 'setnayan:rsvp-open-card');
  const TOOLS = src(`${L}/stage-tools.tsx`);
  const at = TOOLS.indexOf('window.addEventListener(RSVP_OPEN_CARD_EVENT, open);');
  assert.ok(at > 0, 'anti-vacuity: the toolbar no longer hears "Open the card"');
  const open = TOOLS.slice(TOOLS.lastIndexOf('const open = () => {', at), at);
  assert.match(open, /setLineAtPart\(null\);/);
  assert.doesNotMatch(open, /deselect|setPicked\(null\)|pickPartRef\.current\(null\)/, '"Open the card" lets go of the part');
});

test('(3) the form’s card, picked with no line, draws its Edit rows', () => {
  const ASK = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(ASK, /if \(picked\.tool === 'edit' && scene === 'form' && picked\.part === 'rsvp' && !picked\.line\) \{\s*return \(\s*<div className=\{RSVP_ROWS\} data-rsvp-stage-controls=\{scene\} data-rsvp-stage-rows="" data-rsvp-stage-card-edit="">/);
});
