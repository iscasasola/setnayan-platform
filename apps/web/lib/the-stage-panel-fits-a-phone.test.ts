/**
 * 📏 THE STAGES PANEL FITS A PHONE (`lib/maker-stage-room.ts`, `stage-tools.tsx`).
 *
 *   1. Picked open, the panel takes at most HALF the screen — 406 px of an
 *      iPhone's 812 — and the page keeps the other half.
 *   2. Every control a thumb lands on is at least 44 px tall (`phoneHeightPx`,
 *      the phone-room guard's own reader). Sabotage: `h-11` → `h-9` on any → red. The redraw's
 *      body (`SP_*` — segments, dropdown rows, switches, swatches, layout cards) is in the same list.
 *   3. The panel draws those SAME strings — no control of its own outside them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { phoneHeightPx } from './maker-phone-room';
import { SP_GRAB, STAGE_TAP_TARGETS, stagePanelOpenPx } from './maker-stage-room';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';

test('picked open, the panel is at most half of an 812 px phone', () => {
  for (const h of [667, 740, 812, 844, 932]) {
    const px = stagePanelOpenPx(h);
    assert.ok(px <= h / 2, `${h}px tall: the panel takes ${px}px, more than half`);
    assert.ok(px >= 216, `${h}px tall: the panel still has room for its tools (${px}px)`);
  }
  assert.ok(stagePanelOpenPx(812) <= 406);
});

test('every control in the panel is at least 44 px tall', () => {
  for (const [name, classes] of Object.entries(STAGE_TAP_TARGETS)) {
    const px = phoneHeightPx(classes, 812);
    assert.ok(px !== null, `${name}: declares a phone height`);
    assert.ok(px! >= 44, `${name}: ${px}px is under Apple's 44`);
  }
});

test('the panel draws those same strings for every button', () => {
  for (const file of [
    'stage-tools.tsx',
    'stage-item-menu.tsx',
    /* 🎨 The redraw's own pieces (DECISION_LOG 2026-10-07): every button wears a measured STAGE_ / SP_ string. */
    'stage-panel/kit.tsx',
    /* (stage-arrange.tsx draws no button of its own since Order went — owner 2026-10-07; its rows are kit's Dd.) */
    'stage-panel/stage-background.tsx',
    'stage-panel/stage-animate.tsx',
    'stage-panel/stage-text.tsx',
    'stage-panel/style-carousel.tsx',
  ]) {
    const src = readFileSync(join(WEB, L, file), 'utf8');
    /* Each `<button` / `<a ` and the class list its own tag opens with (the next `className=`). */
    const buttons = [...src.matchAll(/<(?:button|a)\s/g)].map((m) => {
      const at = src.indexOf('className=', m.index!);
      return src.slice(at, at + 140);
    });
    assert.ok(buttons.length >= (file.startsWith('stage-panel/') ? 1 : 2), `${file}: its buttons were found (${buttons.length})`);
    for (const cls of buttons) {
      assert.ok(
        Object.keys(STAGE_TAP_TARGETS).some((n) => cls.includes(n)) || cls.includes('SP_GRAB'),
        `${file}: a button wears its own classes (${cls.slice(0, 60)}…) — use a STAGE_* string from lib/maker-stage-room.ts`,
      );
    }
  }
});

test('the grab looks like the prototype’s 14 px strip and still takes a 44 px tap', () => {
  /* Its face is the prototype's `.grab` (a 44 × 5 pill in 14 px); its tap reaches 15 px above and below. */
  const h = Number(/!h-\[(\d+)px\]/.exec(SP_GRAB)?.[1]);
  const up = Number(/before:-top-\[(\d+)px\]/.exec(SP_GRAB)?.[1]);
  const down = Number(/before:-bottom-\[(\d+)px\]/.exec(SP_GRAB)?.[1]);
  assert.equal(h, 14, 'the strip is the prototype’s 14 px');
  assert.ok(h + up + down >= 44, `the grab's tap is ${h + up + down}px, under Apple's 44`);
});
