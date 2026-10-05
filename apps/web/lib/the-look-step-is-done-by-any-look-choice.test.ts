/**
 * the-look-step-is-done-by-any-look-choice.test.ts — the guided Look step is
 * DONE once the couple makes ANY Look choice, saved live or in the draft.
 *
 * 2026-10-05 (DECISION_LOG "THEMES ARE REPLACED BY THREE DIRECT GLOBAL
 * SETTINGS"): a couple no longer picks a theme. The step's ✓ used to be "a
 * theme is saved" (`invite_theme`), which a couple who never had one could now
 * never reach — a step that can never finish. It reads the Look's own choices:
 * a Background (the hero row's `main`), a font, a page colour, a button colour
 * or a button shape/fill — or a theme saved before, which still counts.
 *
 * Held here: (1) the pure rule, case by case; (2) the ONE derivation
 * (`guidedFactsFrom`) asks it with every Look column, drafted over live; (3) both
 * callers — the Maker and Home — hand it the Background, read the same way.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { guidedItemDone, lookChosen } from './details-guided-flow';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const NONE = { theme: null, bg: null, font: null, buttonColour: null, buttonStyle: null, background: false };

test('(1) any single Look choice finishes the step; nothing chosen leaves it open', () => {
  assert.equal(lookChosen(NONE), false, 'nothing chosen reads as done');
  assert.equal(lookChosen({ ...NONE, bg: '' }), false, 'an empty (cleared) value counts as a choice');
  for (const [what, f] of [
    ['a Background', { ...NONE, background: true }],
    ['a font', { ...NONE, font: 'cinzel' }],
    ['a page colour', { ...NONE, bg: '#112233' }],
    ['a button colour', { ...NONE, buttonColour: '#aa0000' }],
    ['a button shape / fill', { ...NONE, buttonStyle: 'pill-solid' }],
    ['a theme saved before', { ...NONE, theme: 'velvet' }],
  ] as const) {
    assert.equal(lookChosen(f), true, `${what} does not finish the Look step`);
  }
  // …and the step reads exactly that fact.
  const facts = { yourEvent: null, kind: null, palette: false, logo: false, hero: false, words: {} as never };
  assert.equal(guidedItemDone('theme', { ...facts, themeChosen: true }), true);
  assert.equal(guidedItemDone('theme', { ...facts, themeChosen: false }), false);
});

test('(2) the one derivation asks it with every Look column, drafted over live', () => {
  const src = read('app/dashboard/[eventId]/launch/_components/details-guided-progress.ts');
  const call = /themeChosen: lookChosen\(\{([\s\S]*?)\}\),/.exec(src)?.[1] ?? '';
  assert.ok(call.length > 0, 'the Look step\'s done is not `lookChosen` — a saved theme alone would decide it again');
  for (const part of ["theme: themeSaved", "bg: col('site_bg_color')", "font: col('site_font_key')", "buttonColour: col('site_button_color')", "buttonStyle: col('site_button_style')", 'background: input.backgroundChosen === true']) {
    assert.ok(call.includes(part), `the Look step ignores ${part}`);
  }
  // The row the derivation reads carries those columns (`col` reads the draft, else this row).
  const row = read('lib/print-set.server.ts');
  const cols = /const EVENT_COLUMNS =\s*'([^']+)'/.exec(row)?.[1] ?? '';
  for (const c of ['site_bg_color', 'site_button_color', 'site_button_style', 'site_font_key']) {
    assert.ok(cols.split(', ').includes(c), `readPrintEvent does not select ${c} — the Look step would never see it`);
  }
});

test('(3) the Maker and Home both hand it the Background, read one way (draft, else live)', () => {
  const progress = read('app/dashboard/[eventId]/launch/_components/details-guided-progress.ts');
  assert.match(progress, /backgroundChosen: await readBackgroundChosen\(admin, eventId, draftedMain\),/, 'Home does not read the Background');
  assert.match(progress, /if \(draftedMain !== undefined\) return draftedMain !== null;/, 'a drafted Background does not win over live');
  assert.match(progress, /return hubMainGround\(\(data as \{ config_json\?: unknown \} \| null\)\?\.config_json\) !== null;/, 'the live Background is not read off the hero row');
  const maker = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(maker, /backgroundChosen: await readBackgroundChosen\(printAdmin, eventId, draftedMain\),/, 'the Maker does not read the Background');
  assert.match(maker, /if \(d && d\.widgets\.hero && 'main' in d\.widgets\.hero\) draftedMain = d\.widgets\.hero\.main \?\? null;/, 'the Maker ignores a drafted Background');
});
