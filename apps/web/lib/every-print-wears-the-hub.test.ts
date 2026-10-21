/**
 * lib/every-print-wears-the-hub.test.ts — owner 2026-10-21, on Studio › Prints: *"shouldn't this mimic the event hub
 * design? and so does the other prints?"* (`lib/print-hub-look.ts`).
 *
 *   1 · the paper and inks are the guest page's own bag (`guestLookFrom`), read back by the page's own reader;
 *   2 · the couple's four faces reach the paper in the page's roles — and every Hub face prints real letters;
 *   3 · a picture background is print-safe: never less veil than the Hub's scrim or the floor, every ink ≥ 4.5 : 1
 *       on the picture's lightest and darkest measured colours;
 *   4 · nothing of the couple's on the page → the print's colours are exactly today's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { HUB_FONT_KEYS } from './hub-fonts';
import { printFont } from './print-layout';
import { hexRgb, legibleInk, MIN_CONTRAST, over, worstContrast } from './print-ground';
import { FRAME_INSET_PT, PANEL_FLOOR, printHubFonts, printLookFromHub } from './print-hub-look';
import { hubPrintFont, printLookFor } from './print-pieces';
import { boardColours, dressedTheme, themeColours } from './theme-colours';
import { buildCustomSiteColorVars } from './site-palette';

const BOARD = { reception: ['#6B7F5E', '#E9E4D4', '#B08D57', '#FBF8F1', '#C9A9A6'] };
const base = printLookFor('house', themeColours('house', BOARD));
const NO_FONTS = printHubFonts(null, null);

test('1 · the paper is the page’s own — a couple’s page colour reaches the card', () => {
  const vars = buildCustomSiteColorVars('#2E3B4E', null)!;
  const look = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars, fonts: NO_FONTS, picture: null, wearsThemeLoop: true });
  assert.equal(look.paper, boardColours(vars, dressedTheme('house', BOARD)).canvas);
  assert.equal(look.paper, '#2e3b4e');
  for (const ink of [look.ink, look.muted, look.accent, look.heading]) {
    assert.ok(worstContrast(hexRgb(ink), 1, [hexRgb(look.paper)]) >= MIN_CONTRAST, `${ink} does not read on ${look.paper}`);
  }
});

test('2 · Names · Headings · Text · Labels reach the paper in the page’s roles; Headings follow Names', () => {
  const look = printLookFromHub(base, {
    theme: 'house',
    rolePalette: BOARD,
    vars: null,
    fonts: printHubFonts('cinzel', { body: { font: 'lora' }, highlight: { font: 'marcellus' } }),
    picture: null,
    wearsThemeLoop: true,
  });
  assert.equal(look.headFont, 'hub-cinzel');
  assert.equal(look.headingFont, 'hub-cinzel');
  assert.equal(look.bodyFont, 'hub-lora');
  assert.equal(look.labelFont, 'hub-marcellus');
  const none = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars: null, fonts: NO_FONTS, picture: null, wearsThemeLoop: true });
  assert.equal(none.headFont, base.headFont);
  assert.equal(none.headingFont, undefined);
  assert.equal(none.labelFont, undefined);
});

test('2b · every Hub face prints real letters (a broken outline falls back, never reaches paper)', () => {
  assert.ok(HUB_FONT_KEYS.length >= 40);
  for (const k of HUB_FONT_KEYS) {
    const f = printFont(hubPrintFont(k));
    for (const ch of 'OAEg') {
      const b = f.getPath(ch, 0, 0, 100).getBoundingBox();
      assert.ok(b.y2 - b.y1 < 200, `${k} draws "${ch}" ${Math.round(b.y2 - b.y1)} units tall at 100`);
    }
  }
});

test('3 · a picture is print-safe: the Hub’s scrim at the edge, a panel that reads, every ink ≥ 4.5', () => {
  const samples = ['#595607', '#484707', '#383907', '#756b08', '#f8d8a1', '#282a0e'];
  const look = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars: null, fonts: NO_FONTS, picture: { samples, scrim: 0.45 }, wearsThemeLoop: true });
  assert.equal(look.still, 'full');
  assert.ok(look.frame, 'a picture with no panel');
  assert.equal(look.frame!.outer, 0.45, 'the edge does not wear the Hub’s own scrim');
  assert.equal(look.frame!.inset, FRAME_INSET_PT);
  assert.ok(look.frame!.inner >= Math.max(0.45, PANEL_FLOOR), `panel ${look.frame!.inner} below the floor`);
  const grounds = samples.map((s) => over(hexRgb(look.paper), hexRgb(s), look.frame!.inner));
  for (const ink of [look.ink, look.muted, look.accent, look.heading]) {
    assert.ok(worstContrast(hexRgb(ink), 1, grounds) >= MIN_CONTRAST, `${ink} does not read on the panel`);
  }
});

test('4 · nothing of the couple’s on the page: today’s paper and still; an ink moves only if it did not read', () => {
  const look = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars: null, fonts: NO_FONTS, picture: null, wearsThemeLoop: true });
  assert.equal(look.paper, base.paper);
  assert.equal(look.still, base.still);
  assert.equal(look.frame, null);
  const paper = [hexRgb(base.paper)];
  for (const k of ['ink', 'muted', 'accent', 'heading'] as const) {
    const was = worstContrast(hexRgb(base[k]), 1, paper);
    if (was >= MIN_CONTRAST + 0.05) assert.equal(look[k], base[k], `${k} read already and was still changed`);
    else assert.equal(look[k], legibleInk(base[k], paper), `${k} (${was.toFixed(2)} : 1) did not take the least change that reads`);
  }
});
