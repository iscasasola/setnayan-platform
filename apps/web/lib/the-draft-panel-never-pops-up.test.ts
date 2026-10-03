/**
 * the-draft-panel-never-pops-up.test.ts — the owner's live iPhone test,
 * 2026-10-02 (build 5666406), items 5–9. Each item's rule, asserted on the
 * component that holds it.
 *
 *  5 · The "Reset Save the Date… / Reset Invitation…" box opened by itself after
 *      Apply, would not close, and came back. → It opens ONLY from ⋯ › Reset
 *      this stage…; it closes on ×, Cancel, Esc, a tap outside — and a tap on
 *      the canvas (a frame: the tap blurs this window, it never reaches it).
 *  6 · After Apply the box was clipped off the phone's left edge. → It is
 *      fixed to the SCREEN, placed by `placePanelAt`, always inside 8 px gutters.
 *  7 · A "Use it" button sat greyed while the words had already saved. → No
 *      button: the Maker's word boxes save as you type.
 *  8 · The part sheet covered the part being edited. → The canvas scrolls the
 *      part into the band above the sheet (`scrollToClearSheet`).
 *  9 · Apply "jumped to the RSVP page" while Page ▾ said "Invitation ›
 *      Welcome". → A reload keeps the section in view (`makerSectionInView` in
 *      `carryScroll`), Page ▾ follows the canvas as it scrolls, and a Maker page
 *      covering the stage is the page Page ▾ names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { placePanelAt } from './maker-panel-place';
import { scrollToClearSheet } from './part-above-sheet';
import { makerSectionInView } from '../app/[slug]/_components/maker-section-find';
import { makerPageMenu } from '../app/dashboard/[eventId]/launch/_components/maker-bar';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BAR = code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');

test('5 · the draft panel opens ONLY from ⋯ › Reset this stage…, and always closes', () => {
  const opens = BAR.match(/setOpen\(true\)/g) ?? [];
  assert.equal(opens.length, 1, `the panel can be opened from ${opens.length} places — only ⋯ › Reset this stage… may open it`);
  const listener = BAR.slice(BAR.indexOf('const open = () => {'), BAR.indexOf('MAKER_OPEN_RESET_EVENT, open)'));
  assert.match(listener, /setOpen\(true\)/, 'the one opener is not the ⋯ › Reset this stage… listener');
  assert.doesNotMatch(BAR, /hubDraftPanelStaysOpen/, 'the answer-opens-the-panel rule is back');
  // Every way out: ×, Esc, a tap outside, and a tap on the canvas (window blur).
  assert.match(BAR, /data-maker-draft-close=""[\s\S]{0,80}onClick=\{\(\) => setOpen\(false\)\}/, 'the panel has no × to close it');
  assert.match(BAR, /window\.addEventListener\('blur', shut\)/, 'a tap on the canvas (a frame) does not close the panel');
  assert.match(BAR, /window\.addEventListener\('keydown', onKey\)/);
});

test('6 · the panel is fixed to the screen and never leaves it — at 390 px, whatever its anchor', () => {
  for (const right of [40, 120, 200, 300, 390]) {
    const p = placePanelAt({ bottom: 96, right }, 390);
    assert.ok(p.left >= 8, `anchor at ${right}: the panel starts at ${p.left}px — off the left edge`);
    assert.ok(p.left + p.width <= 390 - 8, `anchor at ${right}: the panel ends at ${p.left + p.width}px — off the right edge`);
  }
  assert.match(BAR, /createPortal\(\s*<div\s+ref=\{boxRef\}/, 'the panel is drawn inside the glass bar again — a fixed box hugs the bar there');
  assert.match(BAR, /position: 'fixed', top: at\.top, left: at\.left, width: at\.width/);
});

test('7 · the Maker’s word boxes save as you type — no "Use it" button', () => {
  const inspector = code('app/dashboard/[eventId]/website/editor/_components/part-inspector.tsx');
  assert.doesNotMatch(inspector, />\s*Use it\s*</, 'a "Use it" button is back beside a box that already saves');
  for (const row of ['function JoinerRow', 'function PartWordsRow']) {
    const at = inspector.indexOf(row);
    assert.ok(at >= 0, `${row} is gone — re-read this guard`);
    const body = inspector.slice(at, inspector.indexOf('\nfunction ', at + 10) > 0 ? inspector.indexOf('\nfunction ', at + 10) : undefined);
    assert.match(body, /useSavesAsYouType</, `${row} no longer saves as the couple types`);
    assert.match(body, /onBlur=\{box\.onBlur\}/, `${row} does not save when the box is left`);
  }
});

test('8 · the part being edited ends up above the sheet, never under it', () => {
  // A phone: the canvas shows 300 px above the sheet.
  assert.equal(scrollToClearSheet({ partTop: 100, partHeight: 40, band: 300 }), 0, 'a part already in sight moved');
  const under = scrollToClearSheet({ partTop: 520, partHeight: 40, band: 300 });
  const after = 520 - under;
  assert.ok(after >= 12 && after + 40 <= 300 - 12, `a part under the sheet lands at ${after}px — still hidden`);
  const tall = scrollToClearSheet({ partTop: 600, partHeight: 900, band: 300 });
  assert.equal(600 - tall, 12, 'a part taller than the band is shown from its top');
  const sheet = code('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx');
  assert.match(sheet, /keepPartAboveSheet\(sheet, target\.key, target\.el\)/, 'the part sheet no longer brings its part into view on a phone');
});

/** A fake canvas document: markers, each followed by its section at a given rect. */
function fakeDoc(sections: Array<{ key: string; top: number; height: number }>): Document {
  const markers = sections.map((s) => {
    const section = {
      hasAttribute: () => false,
      getBoundingClientRect: () => ({ top: s.top, bottom: s.top + s.height, height: s.height }),
    };
    return { nextElementSibling: section, getAttribute: () => s.key };
  });
  return { querySelectorAll: () => markers } as unknown as Document;
}

test('9 · the section in view is found, so a reload keeps it and Page ▾ follows it', () => {
  const doc = fakeDoc([
    { key: 'f:hero', top: -900, height: 700 },
    { key: 'w:welcome', top: -200, height: 400 },
    { key: 'w:rsvp', top: 200, height: 600 },
  ]);
  assert.equal(makerSectionInView(doc), 'w:welcome', 'the section at the top of the canvas is not the one in view');
  assert.equal(makerSectionInView(doc, 260), 'w:rsvp', 'the line a third down picks the wrong section');
  const frame = code('app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame.tsx');
  assert.match(frame, /const key = anchor \?\? makerSectionInView\(a\.document\);/, 'a reload (Apply) no longer keeps the section in view — it lands by raw offset');
  const shell = code('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /makerSectionInView\(win\.document, win\.innerHeight \/ 3\)[\s\S]{0,200}setTabKey/, 'Page ▾ no longer follows the canvas as it scrolls');
});

test('9 · a Maker page covering the stage is the page Page ▾ names', () => {
  const base = {
    stage: 'rsvp' as const,
    rsvpOpen: false,
    liveStage: null,
    pagesOf: () => [{ key: 'welcome', label: 'Welcome' }],
    shownPage: 'welcome',
    hasWork: true,
  };
  assert.equal(makerPageMenu({ ...base, openPage: 'Event Details' }).buttonText, 'Event Details', 'Page ▾ names the stage hidden under Event Details');
  assert.equal(makerPageMenu({ ...base, openPage: 'Event Details' }).value, '', 'a stage page is ticked while Event Details is on screen');
  assert.notEqual(makerPageMenu(base).buttonText, 'Event Details');
  const shell = code('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
  assert.match(shell, /openPage: openDoor === 'look' \? MAKER_LOOK_LABEL/, 'the shell does not tell Page ▾ which page covers the stage');
});
