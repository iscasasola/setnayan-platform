import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import { DETAILS_FIRST_ITEM, DETAILS_FIRST_PRINT, PRINTS_ITEM_KEYS, isPrintsItem } from '@/lib/maker-details-items';
import type { DetailsItemKey } from '@/lib/maker-details-items';
import { MAKER_BAR, makerDetailsDoor, makerOpenTool, makerPlacePick, makerPressDoor, makerPrintsDoor } from './maker-bar';

(globalThis as unknown as { React: unknown }).React = React;

/**
 * THE MAKER'S TOP MENU OFFERS EXACTLY: THE STAGES · DETAILS · PRINTS.
 *
 * Owner 2026-09-30, "THE MAKER RE-PLAN IS CUT TO ITS CORE": kept = *the top
 * menu (Details | stages | Prints)*. The bar, the phone's one picker and the
 * highlight are held here, per component — the rendered full row AND the pure
 * picker model — so a sixth kind of thing cannot creep onto the top level
 * (Search, Quick setup and Opening strips are the owner's cuts) and Prints
 * cannot become a second page.
 *
 * "THE MAKER IN 4 IS A DIRECTION, NOT A COUNT" (2026-09-30): the guard is on
 * WHAT the top level is made of, not on a number to hit.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const STAGE_KEYS = [...PUBLIC_STAGE_ORDER.flatMap((p) => (p === 'save_the_date' ? [p, 'rsvp-stage'] : [p]))];

test('the top level is the stages, Details and Prints — nothing else (the list)', () => {
  assert.deepEqual(MAKER_BAR.map((i) => i.key), [...STAGE_KEYS, 'details', 'prints']);
  assert.deepEqual(MAKER_BAR.filter((i) => i.group === 'stages').length, STAGE_KEYS.length);
  assert.deepEqual(MAKER_BAR.filter((i) => i.group === 'made-once').map((i) => i.key), ['details', 'prints']);
});

test('the top level is the stages, Details and Prints — nothing else (the rendered row, counted)', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerBar } = await import('./maker-shell');
  const html = renderToStaticMarkup(
    React.createElement(MakerBar, { stage: 'rsvp', liveStage: null, selection: null, hasWork: true, onPress: () => {} }),
  );
  assert.equal((html.match(/data-maker-bar-item=/g) ?? []).length, STAGE_KEYS.length + 2, 'a control joined the top level');
  assert.match(html, /data-maker-bar-item="prints"/);
  assert.equal((html.match(/data-maker-divider/g) ?? []).length, 1, 'one divider: stages │ Details · Prints');
});

test('Prints is a door into Details, never a page of its own', () => {
  // On a print item Prints wears the highlight and Details does not — one highlight, one page.
  assert.equal(makerOpenTool('details', 'invitation'), 'prints');
  assert.equal(makerOpenTool('details', 'theme'), 'details');
  assert.equal(makerOpenTool('details', null), 'details');
  assert.equal(makerOpenTool(null, 'invitation'), null, 'a stage is open — neither door is');
  for (const k of PRINTS_ITEM_KEYS) assert.equal(makerOpenTool('details', k), 'prints', k);
  // …and it lands on the print the couple is on, else the first print (an old ?tool=prints address).
  assert.equal(makerPrintsDoor(null), DETAILS_FIRST_PRINT);
  assert.equal(makerPrintsDoor('theme'), DETAILS_FIRST_PRINT);
  assert.equal(makerPrintsDoor('menu'), 'menu');
  assert.ok(isPrintsItem(DETAILS_FIRST_PRINT));
  // Looks, words and facts are NOT prints (they stay Details).
  for (const k of ['theme', 'logo', 'names', 'love-story', 'address']) assert.equal(isPrintsItem(k), false, k);
});

test('the phone’s one picker names where you are — Prints on a print — and lists the same top level', () => {
  const on = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: 'details', detailsItem: 'invitation', hasWork: true });
  assert.equal(on.value, 'prints');
  const det = makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: 'details', detailsItem: 'theme', hasWork: true });
  assert.equal(det.value, 'details');
  assert.deepEqual(on.options.map((o) => o.key), MAKER_BAR.map((i) => i.key));
});

test('by source: the shell highlights one of the two, and pressing Prints opens Details on a print', () => {
  const shell = src('maker-shell.tsx');
  assert.match(shell, /const openTool = makerOpenTool\(selectedTool, detailsItem\)/);
  assert.match(shell, /: openTool === item\.key;/);
  assert.match(shell, /if \(item\.key === 'prints' \|\| item\.key === 'details'\) \{\s*if \(hasWork\) \{\s*setDetailsItem\(makerPressDoor\(\{ detailsItem \}, item\.key\)\.detailsItem\);\s*select\(\{ kind: 'tool', key: 'details' \}\);/);
  // No second Prints page: the selection union never grew a 'prints' tool.
  assert.doesNotMatch(src('maker-context.tsx'), /'prints'/);
});

test('pressing Prints, then Details, moves the highlight to Details and opens a non-print item', () => {
  // The shell's pressBar runs `makerPressDoor` for both doors; drive the same reducer through the sequence.
  let state: { detailsItem: DetailsItemKey | null; selectedTool: string | null } = { detailsItem: null, selectedTool: null };
  const press = (key: 'details' | 'prints') => {
    state = makerPressDoor(state, key);
  };
  press('prints');
  assert.equal(state.detailsItem, DETAILS_FIRST_PRINT);
  assert.equal(makerOpenTool(state.selectedTool, state.detailsItem), 'prints');
  press('details');
  assert.equal(makerOpenTool(state.selectedTool, state.detailsItem), 'details', 'Details looks dead after Prints');
  assert.equal(isPrintsItem(state.detailsItem), false);
  assert.equal(state.detailsItem, DETAILS_FIRST_ITEM, 'a fresh press of Details opens this item');
  // …and Prints again re-opens a print.
  press('prints');
  assert.equal(makerOpenTool(state.selectedTool, state.detailsItem), 'prints');
  // From any print, Details lands off the prints; a non-print item the couple is on is kept.
  for (const k of PRINTS_ITEM_KEYS) assert.equal(isPrintsItem(makerDetailsDoor(k)), false, k);
  assert.equal(makerDetailsDoor('hero'), 'hero');
  assert.equal(makerDetailsDoor(null), DETAILS_FIRST_ITEM);
  // The phone's picker names Details, not Prints, after that press.
  press('details');
  assert.equal(makerPlacePick({ stage: 'rsvp', liveStage: null, openTool: state.selectedTool, detailsItem: state.detailsItem, hasWork: true }).value, 'details');
});
