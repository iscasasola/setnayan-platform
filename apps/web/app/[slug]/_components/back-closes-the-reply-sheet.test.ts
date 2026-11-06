/**
 * BACK CLOSES THE REPLY SHEET, AND LEAVES THE GUEST WHERE THEY WERE.
 *
 * A guest's walk, 2026-10-11 (fault N14): opening the reply sheet from Me, then pressing Back — the address went
 * back and the sheet stayed up, covering the page and the bar. A door to the sheet is a plain link to
 * `#your-details`, so it adds a history entry; the sheet's listener asked "does this address open it?" on every
 * change and never "has the address that opened it gone?".
 *
 * WHAT IS HELD:
 *   (1) THE WALK, STEP BY STEP, through the one rule the listener asks (`sheetAfterAddressChange`): a tap on a door
 *       opens it; Back closes it; Forward opens it again; a second Back closes it again.
 *   (2) A sheet reopened by a REFUSED SAVE (no fragment in the address) is not closed by an unrelated history event —
 *       it holds the sentence that explains what went wrong.
 *   (3) An address that still asks for the sheet never closes it; an unrelated fragment never opens it.
 *   (4) THE WIRING: the sheet asks that rule on BOTH `hashchange` and `popstate`, with its own open state, and acts
 *       on both verdicts — and closing by Back runs the same close as the "Close" button, which is what hands the
 *       guest's reading position back (`returnTo`).
 *
 * NOT PROVEN HERE: a real browser's Back button and its own scroll restoration (needs a phone). The effect that
 * restores the position is the shipped one, unchanged.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the rule made to answer "stay" whenever
 * the address does not ask for the sheet → (1) red; the listener's `else if (verdict === 'close') closeSheet()`
 * removed → (4) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { RSVP_SHEET_ANCHORS, hashOpensSheet, sheetAfterAddressChange, type SheetAddressVerdict } from './rsvp-sheet-state';

const DOOR = `#${RSVP_SHEET_ANCHORS[0]}`;

/** The sheet's own two facts, moved by the verdicts exactly as `rsvp-sheet.tsx` moves them. */
function sheet() {
  const s = { open: false, openedByAddress: false };
  return {
    s,
    /** The address changed (a tap, Back, Forward) — what the listener does. */
    address(hash: string): SheetAddressVerdict {
      const verdict = sheetAfterAddressChange({ hash, open: s.open, openedByAddress: s.openedByAddress });
      if (hashOpensSheet(hash)) s.openedByAddress = true;
      if (verdict === 'open') s.open = true;
      if (verdict === 'close') { s.open = false; s.openedByAddress = false; }
      return verdict;
    },
    /** A refused save reopens it with no fragment (`sheetOpensOnLoad`). */
    flash() { s.open = true; },
  };
}

test('(1) a tap opens the sheet, Back closes it, Forward opens it, Back closes it again', () => {
  const g = sheet();
  assert.equal(g.address(''), 'stay');
  assert.equal(g.address(DOOR), 'open', 'the door no longer opens the sheet');
  assert.equal(g.s.open, true);
  assert.equal(g.address(''), 'close', 'Back took the address away and the sheet stayed up');
  assert.equal(g.s.open, false);
  assert.equal(g.address(DOOR), 'open', 'Forward does not bring it back');
  assert.equal(g.address('?tab=me'), 'close', 'Back to a tab’s address left the sheet up');
  assert.equal(g.s.open, false);
});

test('(2) a sheet reopened by a refused save is not closed by an unrelated history event', () => {
  const g = sheet();
  g.flash();
  assert.equal(g.address(''), 'stay', 'the sentence explaining the refused save was taken away');
  assert.equal(g.address('#site-details'), 'stay');
  assert.equal(g.s.open, true);
  // …but once the address carries the door, taking it away closes it like any other.
  assert.equal(g.address(DOOR), 'stay');
  assert.equal(g.address(''), 'close');
});

test('(3) an address that still asks for the sheet never closes it; an unrelated fragment never opens it', () => {
  for (const open of [true, false]) for (const openedByAddress of [true, false]) {
    assert.notEqual(sheetAfterAddressChange({ hash: DOOR, open, openedByAddress }), 'close');
    assert.notEqual(sheetAfterAddressChange({ hash: '#site-me', open, openedByAddress }), 'open');
    assert.notEqual(sheetAfterAddressChange({ hash: `${DOOR}-map`, open, openedByAddress }), 'open');
    assert.notEqual(sheetAfterAddressChange({ hash: null, open, openedByAddress }), 'open');
  }
  assert.equal(sheetAfterAddressChange({ hash: '', open: false, openedByAddress: true }), 'stay', 'a closed sheet is closed again');
});

test('(4) the sheet asks the rule on hashchange AND popstate, and acts on both verdicts with its own close', () => {
  const code = stripComments(readFileSync(join(__dirname, 'rsvp-sheet.tsx'), 'utf8'));
  const at = code.indexOf('const check = () => {');
  assert.ok(at > 0, 'the sheet’s address listener was not found — this guard is pointing at nothing');
  const listener = code.slice(at, code.indexOf('}, [', at));
  assert.match(listener, /sheetAfterAddressChange\(\{ hash, open: openRef\.current, openedByAddress: openedByAddress\.current \}\)/);
  assert.match(listener, /if \(verdict === 'open'\) openSheet\(\);/);
  assert.match(listener, /else if \(verdict === 'close'\) closeSheet\(\);/, 'Back is heard and nothing is done about it');
  for (const ev of ['hashchange', 'popstate']) {
    assert.match(listener, new RegExp(`window\\.addEventListener\\('${ev}', check\\)`), `the sheet does not hear ${ev}`);
    assert.match(listener, new RegExp(`window\\.removeEventListener\\('${ev}', check\\)`), `the ${ev} listener is never taken off`);
  }
  // The one close: it lowers the sheet and forgets how it was opened; the reading position is handed back by the
  // effect that watches `open` (unchanged).
  const close = code.slice(code.indexOf('const closeSheet = useCallback('), code.indexOf('const closeSheet = useCallback(') + 400);
  assert.match(close, /openRef\.current = false;\s*openedByAddress\.current = false;\s*setOpen\(false\);/);
  assert.match(code, /if \(open \|\| !hadOpened\.current\) return;[\s\S]{0,200}window\.scrollTo\(0, y\)/, 'closing no longer hands the reading position back');
});
