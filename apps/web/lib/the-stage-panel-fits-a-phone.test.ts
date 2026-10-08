/**
 * 📏 THE STAGES PANEL FITS A PHONE (`lib/maker-stage-room.ts`, `stage-tools.tsx`).
 *
 *   1. The toolbar is ONE height and takes well under half the screen — 330 px of an
 *      iPhone's 812 — so the page keeps more than half. (🔁 Re-aimed 2026-10-09, owner
 *      "330 px it is": it used to rise to HALF the screen when a part was picked, 406 px.
 *      The exact sum is held by `the-toolbar-is-four-rows.test.ts`.)
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
import { SP_LOOK_CARD, SP_STYLE_CARD, STAGE_BAR_HANDLE, STAGE_TAP_TARGETS, stageBarGridPx, stageBarPx, stageBarRow } from './maker-stage-room';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';

test('the toolbar is under half of the phone at every height, and still has its four rows', () => {
  for (const h of [667, 740, 812, 844, 932]) {
    for (const safe of [0, 34]) {
      const px = stageBarPx(h, safe);
      assert.ok(px < h / 2, `${h}px tall: the toolbar takes ${px}px, half or more`);
      assert.ok(stageBarGridPx(h) >= 4 * 44, `${h}px tall: four 44-px rows do not fit (${stageBarGridPx(h)}px)`);
    }
  }
  assert.ok(stageBarPx(812, 34) <= 406);
});

test('every control in the panel is at least 44 px tall', () => {
  for (const [name, classes] of Object.entries(STAGE_TAP_TARGETS)) {
    const px = phoneHeightPx(classes, 812);
    assert.ok(px !== null, `${name}: declares a phone height`);
    assert.ok(px! >= 44, `${name}: ${px}px is under Apple's 44`);
  }
});

test('a look card is as tall as its phone-shaped frame — far over 44 px', () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const rule = /\n\.sn-phone-card \{([^}]*)\}/.exec(css)?.[1] ?? '';
  const w = Number(/inline-size:\s*var\(--phone-card-w,\s*(\d+)px\)/.exec(rule)?.[1]);
  assert.ok(Number.isFinite(w) && w > 0, 'the frame declares its default width');
  assert.match(rule, /aspect-ratio:\s*3 \/ 4/);
  assert.ok((w * 4) / 3 >= 44, `the frame is ${(w * 4) / 3}px tall`);
  assert.ok(SP_LOOK_CARD.split(' ').includes('min-h-11'), 'and the card keeps the 44 px floor whatever width a strip sets');
  /* The toolbar's Style card is as tall as its strip (`!h-full`), and a strip is never under two rows. */
  assert.ok(SP_STYLE_CARD.split(' ').includes('!h-full'));
  for (const h of [568, 667, 812]) assert.ok(2 * stageBarRow(h).row + stageBarRow(h).gap >= 88, `${h}px tall: a two-row card is under 88 px`);
});

test('the panel draws those same strings for every button', () => {
  for (const file of [
    'stage-tools.tsx',
    'stage-item-menu.tsx',
    /* 🎨 The redraw's own pieces (DECISION_LOG 2026-10-07): every button wears a measured STAGE_ / SP_ string. */
    'stage-panel/kit.tsx',
    /* (stage-arrange.tsx draws no button of its own since Order went — owner 2026-10-07; its rows are kit's Dd.) */
    'stage-panel/stage-background.tsx',
    /* (stage-animate.tsx and stage-text.tsx draw no button of their own since 2026-10-08: Move's direction is kit's
       Dd, Grow | Shrink is the app's `PillSelector`, the colour circles are kit's `Swatch` — all measured there.) */
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
        /* 📱 `SP_LOOK_CARD` (owner 2026-10-08, every style card is phone-shaped): its height is its FRAME's
           (`.sn-phone-card`, 3 : 4), not a height class — measured from the stylesheet in the test below. */
        /* 🎠 `SP_STYLE_CARD` (owner 2026-10-09, the toolbar's Style): the same frame AS TALL AS THE ROWS it has — two
           rows at the least (92 px on a short phone), measured below. */
        Object.keys(STAGE_TAP_TARGETS).some((n) => cls.includes(n)) || cls.includes('SP_LOOK_CARD') || cls.includes('SP_STYLE_CARD'),
        `${file}: a button wears its own classes (${cls.slice(0, 60)}…) — use a STAGE_* string from lib/maker-stage-room.ts`,
      );
    }
  }
});

test('the panel’s two files that draw no button of their own hand every tap to a measured piece', () => {
  for (const [file, pieces] of [
    ['stage-panel/stage-animate.tsx', ['<Dd', '<PanelSwitch', '<PillSelector', '<Phases']],
    ['stage-panel/stage-text.tsx', ['<Swatch', '<SwatchMore']],
  ] as const) {
    const src = readFileSync(join(WEB, L, file), 'utf8');
    assert.equal((src.match(/<(?:button|a)\s/g) ?? []).length, 0, `${file}: a button of its own is back — give it a STAGE_* string and list the file above`);
    for (const p of pieces) assert.ok(src.includes(p), `${file}: no longer draws ${p}`);
  }
});

test('the handle is the prototype’s 14 px strip — drawn, never a control', () => {
  /* 🔁 Re-aimed 2026-10-09: the grab was a button (drag or tap to resize, a 44 px tap reaching 15 px above and
     below its 14 px strip). The toolbar is ONE height now — "330 px it is" — so the handle is only drawn: the claim
     that is left is its size, and that nothing presses it (a control would owe the 44 px it no longer has). */
  assert.ok(STAGE_BAR_HANDLE.split(' ').includes('h-[14px]'), 'the strip is the prototype’s 14 px');
  const src = readFileSync(join(WEB, L, 'stage-tools.tsx'), 'utf8');
  const at = src.indexOf('data-stage-handle=""');
  assert.ok(at > 0, 'the handle is drawn');
  assert.match(src.slice(at - 40, at + 120), /<div aria-hidden data-stage-handle="" className=\{STAGE_BAR_HANDLE\}>/, 'the handle is a control again — give it a 44 px tap or keep it drawn');
});
