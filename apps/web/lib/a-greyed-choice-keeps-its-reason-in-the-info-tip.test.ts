/**
 * 🔘 A GREYED CHOICE KEEPS ITS REASON IN THE ⓘ (owner 2026-10-31, *"Yes, tidy it"*, answering "Tidy the ⇅ menu's
 * greyed rows into the ⓘ? Greyed rows show one short word, and the reason goes in the ⓘ" — the house rule "title + one
 * short line visible, the rest in the ⓘ", owner 2026-10-23).
 *
 * The property, for EVERY PickMenu (the row is drawn by the shared `PickMenu`, so every caller with a `disabledNote`
 * gets it):
 *   G1  no disabled row renders its reason inline — the only visible text of the row is its label;
 *   G2  the reason is reachable through the shared ⓘ (`InfoTip`): it is the tooltip's text, and the ⓘ button names it
 *       with `aria-describedby`;
 *   G3  the row cannot be picked — it is not a button and not an option, and nothing in it calls `onPick`; `PickMenu`
 *       hands every disabled option to that row before it draws a pickable one.
 *
 * Executed: the row is rendered to markup (`renderToStaticMarkup`) and read. The routing in `pick-menu.tsx` is read
 * from source, comments stripped.
 *
 * SABOTAGE, seen red before this shipped: put `{o.disabledNote}` back beside the label in the row → G1 fails;
 * route a disabled option to the pickable button again → G3 fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments as strip } from '@/lib/strip-comments';
import { PickOffRow } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-off-row';

// The row is JSX; this runner compiles it to `React.createElement` without importing React.
(globalThis as unknown as { React: unknown }).React = React;

const DIR = join(import.meta.dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components');
const PICK = strip(readFileSync(join(DIR, 'pick-menu.tsx'), 'utf8'));
const ROW = strip(readFileSync(join(DIR, 'pick-menu-off-row.tsx'), 'utf8'));

const ROWS = [
  { key: 'near', label: 'Nearest to your venue', disabledNote: 'Add your venue to sort by distance.' },
  { key: 'budget', label: 'Fits your budget', disabledNote: 'Set a budget for this category to sort by budget fit.' },
  { key: 'table', label: 'New table…', disabledNote: 'Tap Edit first' },
];

const html = (o: (typeof ROWS)[number]) => renderToStaticMarkup(React.createElement(PickOffRow, { o, oo: 'menu' }));
const tooltipOf = (h: string) => /<span id="([^"]+)" role="tooltip"[^>]*>([\s\S]*?)<\/span><\/span>/.exec(h);
const visibleText = (h: string) =>
  h
    .replace(/<span id="[^"]+" role="tooltip"[\s\S]*?<\/span><\/span>/, '')
    .replace(/<span aria-hidden="true">i<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .trim();

test('G1 — a disabled row shows its label and nothing else', () => {
  for (const o of ROWS) {
    const h = html(o);
    assert.equal(visibleText(h), o.label, `"${o.label}" shows only its label`);
    assert.ok(!visibleText(h).includes(o.disabledNote), `"${o.label}" does not print its reason inline`);
  }
});

test('G2 — the reason is reachable through the shared ⓘ', () => {
  for (const o of ROWS) {
    const h = html(o);
    const tip = tooltipOf(h);
    assert.ok(tip, `"${o.label}" has an ⓘ tooltip`);
    assert.equal(tip[2]!.replace(/<[^>]+>/g, '').trim(), o.disabledNote, 'the ⓘ holds the reason');
    assert.match(h, new RegExp(`<button[^>]*aria-describedby="${tip[1]}"`), 'the ⓘ button points at the reason');
    assert.match(h, new RegExp(`aria-label="About ${o.label}"`), 'the ⓘ is named for its row');
  }
  assert.match(ROW, /from '@\/app\/_components\/info-tip'/, 'the ⓘ is the shared InfoTip');
  assert.doesNotMatch(ROW, /lucide-react/, 'never a lucide Info glyph');
});

test('G3 — a disabled row cannot be picked; PickMenu routes every disabled option to it', () => {
  for (const o of ROWS) {
    const h = html(o);
    assert.doesNotMatch(h, /role="option"/, 'the greyed row is not an option');
    assert.equal((h.match(/<button/g) ?? []).length, 1, 'its one button is the ⓘ');
  }
  assert.doesNotMatch(ROW, /onPick|onClick/, 'nothing in the row picks');
  const render = PICK.slice(PICK.indexOf('function renderOption('));
  const route = render.indexOf('if (o.disabledNote) return <PickOffRow');
  assert.ok(route > 0, 'PickMenu hands a disabled option to the greyed row');
  assert.ok(route < render.indexOf('role="option"'), '…before it draws any pickable option');
  assert.equal(PICK.split('disabledNote').length - 1, 1, 'pick-menu.tsx reads the reason nowhere else (no inline note)');
});
