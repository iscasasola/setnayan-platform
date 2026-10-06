/**
 * 📏 THE STAGES PANEL FITS A PHONE (`lib/maker-stage-room.ts`, `stage-tools.tsx`).
 *
 *   1. Picked open, the panel takes at most HALF the screen — 406 px of an
 *      iPhone's 812 — and the page keeps the other half.
 *   2. Every control a thumb lands on is at least 44 px tall (`phoneHeightPx`,
 *      the phone-room guard's own reader). Sabotage: `h-11` → `h-9` on any → red.
 *   3. The panel draws those SAME strings — no control of its own outside them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { phoneHeightPx } from './maker-phone-room';
import { STAGE_TAP_TARGETS, stagePanelOpenPx } from './maker-stage-room';

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
  for (const file of ['stage-tools.tsx', 'stage-item-menu.tsx']) {
    const src = readFileSync(join(WEB, L, file), 'utf8');
    /* Each `<button` / `<a ` and the class list its own tag opens with (the next `className=`). */
    const buttons = [...src.matchAll(/<(?:button|a)\s/g)].map((m) => {
      const at = src.indexOf('className=', m.index!);
      return src.slice(at, at + 140);
    });
    assert.ok(buttons.length >= 2, `${file}: its buttons were found (${buttons.length})`);
    for (const cls of buttons) {
      assert.ok(
        Object.keys(STAGE_TAP_TARGETS).some((n) => cls.includes(n)),
        `${file}: a button wears its own classes (${cls.slice(0, 60)}…) — use a STAGE_* string from lib/maker-stage-room.ts`,
      );
    }
  }
});
