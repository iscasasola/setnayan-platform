/**
 * 📱 THE PART SHEET ON A PHONE — every transition (owner 2026-10-04: *"when i
 * tap here it, collapese the names/motion popup?"*; `element-sheet-state.ts`),
 * and the sheet's ONE segmented control: Text · Motion · Arrange (owner
 * 2026-10-04: "segmented control").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { ELEMENT_SHEET_CLOSED, elementSheetStep, type ElementSheetState } from './element-sheet-state';

(globalThis as unknown as { React: unknown }).React = React;

type T = { key: string; el: string; range?: string | null };
const NAMES: T = { key: 'f:hero', el: 'names' };
const DATE: T = { key: 'f:hero', el: 'date' };
const closed = ELEMENT_SHEET_CLOSED as ElementSheetState<T>;
const open = (target: T, more: Partial<ElementSheetState<T>> = {}): ElementSheetState<T> => ({ target, collapsed: false, section: 'text', ...more });

test('tap a part with no sheet → it opens on it', () => {
  assert.deepEqual(elementSheetStep(closed, { t: 'tapPart', target: NAMES }), open(NAMES));
});

test('tap empty canvas → the sheet folds to its bar; tap again once folded → it closes (the tap goes through)', () => {
  const s = open(NAMES, { section: 'animate' });
  const folded = elementSheetStep(s, { t: 'tapOutside' });
  assert.deepEqual(folded, { ...s, collapsed: true }, 'nothing but the fold changes — the part and section are kept');
  assert.deepEqual(elementSheetStep(folded, { t: 'tapOutside' }), closed);
  assert.equal(elementSheetStep(closed, { t: 'tapOutside' }), closed, 'no sheet, nothing to fold');
});

test('tap the bar → restored, exactly as it was', () => {
  const folded = open(NAMES, { collapsed: true, section: 'animate' });
  assert.deepEqual(elementSheetStep(folded, { t: 'restore' }), open(NAMES, { section: 'animate' }));
  const s = open(NAMES);
  assert.equal(elementSheetStep(s, { t: 'restore' }), s);
});

test('tap ANOTHER part → the sheet switches to it, open, on the SAME section', () => {
  const s = open(NAMES, { section: 'animate' });
  assert.deepEqual(elementSheetStep(s, { t: 'tapPart', target: DATE }), open(DATE, { section: 'animate' }));
  const folded = open(NAMES, { collapsed: true, section: 'arrange' });
  assert.deepEqual(elementSheetStep(folded, { t: 'tapPart', target: DATE }), open(DATE, { section: 'arrange' }));
});

test('tap the SAME part → no change (a folded sheet opens again)', () => {
  const s = open({ ...NAMES, range: 'kept' }, { section: 'animate' });
  assert.equal(elementSheetStep(s, { t: 'tapPart', target: { ...NAMES } }), s, 'the same part re-tapped changed the sheet');
  const folded = { ...s, collapsed: true };
  assert.deepEqual(elementSheetStep(folded, { t: 'tapPart', target: { ...NAMES } }), s);
});

test('drag the handle down → folds to the bar', () => {
  const s = open(NAMES, { section: 'animate' });
  assert.deepEqual(elementSheetStep(s, { t: 'dragDown' }), { ...s, collapsed: true });
  assert.equal(elementSheetStep(closed, { t: 'dragDown' }), closed);
});

test('× / Done → closed, nothing selected (the next sheet opens on Text)', () => {
  assert.deepEqual(elementSheetStep(open(NAMES, { section: 'animate', collapsed: true }), { t: 'close' }), closed);
  assert.equal(elementSheetStep(closed, { t: 'close' }), closed);
});

test('a section chosen is kept; the Maker opening a part keeps the fold only for the same part', () => {
  const s = open(NAMES);
  assert.deepEqual(elementSheetStep(s, { t: 'section', section: 'arrange' }), open(NAMES, { section: 'arrange' }));
  const folded = open(NAMES, { collapsed: true });
  // Its selected letters re-laid: still folded.
  assert.deepEqual(elementSheetStep(folded, { t: 'set', target: (p) => (p ? { ...p, range: null } : p) }), { ...folded, target: { ...NAMES, range: null } });
  // Another part opened from the navigator: open.
  assert.deepEqual(elementSheetStep(folded, { t: 'set', target: DATE }), open(DATE));
  assert.deepEqual(elementSheetStep(folded, { t: 'set', target: null }), closed);
});

/* ── WIRED, NOT ONLY WRITTEN ──────────────────────────────────────────────── */

const WEB = join(__dirname, '..');
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the Maker drives the sheet through the one reducer, and the canvas reports a stray tap', () => {
  const SHELL = read(`${E}/editor-shell.tsx`);
  assert.match(SHELL, /useReducer\([\s\S]{0,200}elementSheetStep\(st, ev\)/);
  assert.match(SHELL, /sheetDo\(\{ t: 'tapOutside' \}\)/);
  assert.match(SHELL, /sheetDo\(\{ t: 'tapPart', target:/);
  for (const ev of ['dragDown', 'restore', 'close', 'section']) assert.match(SHELL, new RegExp(`sheetDo\\(\\{ t: '${ev}'`), `${ev} is not wired`);
  assert.match(read('app/[slug]/_components/editor-bridge.tsx'), /t: 'tapOutside'/);
  const SHEET = read(`${E}/element-sheet.tsx`);
  assert.match(SHEET, /<SheetGrip onClose=\{onCollapse \?\? onClose\} \/>/, 'the handle does not fold the sheet');
  assert.doesNotMatch(SHEET, /<SheetScrim/, 'a scrim over the canvas would swallow the tap on another part');
});

const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
async function sheet(props: Record<string, unknown> = {}): Promise<string> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ElementSheet } = await import(`../${E}/element-sheet`);
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(ElementSheet, {
        eventId: 'e1',
        target: { key: 'f:hero', widgetType: 'hero', el: 'names' },
        canvas: {},
        palette: { ink: '#1b1a17', heading: '#1b1a17', accent: '#a0522d', muted: '#6b6b6b', surface: '#ffffff' },
        ownsPro: true,
        draftAction: async () => {
          throw new Error('opening the sheet wrote to the draft');
        },
        onClose: () => {},
        ...props,
      }),
    ),
  );
}

test('▣ the part sheet has exactly ONE segmented control — Text · Motion · Arrange — the chosen one in wine', async () => {
  const html = await sheet({ section: 'animate' });
  const groups = html.match(/<div role="group" aria-label="Edit this part"[^>]*>[\s\S]*?<\/div>/g) ?? [];
  assert.equal(groups.length, 1, `${groups.length} section controls`);
  const labels = [...groups[0]!.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Text', 'Motion', 'Arrange']);
  const chosen = /<button[^>]*aria-pressed="true"[^>]*>Motion<\/button>/.exec(groups[0]!);
  assert.ok(chosen, 'Motion is not the chosen section');
  assert.match(chosen[0], /\bbg-mulberry\b[^"]*\btext-white\b/, 'the chosen section is not filled in the wine token');
  assert.doesNotMatch(html, /role="tablist"|data-inspector-tabs-pick/, 'the old tabs are still drawn');
  assert.match(html, /data-part-tab="animate"/, 'the Motion section is not the one shown');
});

test('📱 folded: a slim bar "Names · Motion ▴" and the sheet kept (hidden on a phone), never unmounted', async () => {
  const html = await sheet({ section: 'animate', collapsed: true, onRestore: () => {} });
  assert.match(html, /data-element-sheet-bar=""[^>]*>[\s\S]*?Names · Motion[\s\S]*?▴/);
  assert.match(html, /<aside[^>]*class="max-lg:hidden /, 'the sheet is not kept, folded');
  const openHtml = await sheet({ section: 'animate' });
  assert.doesNotMatch(openHtml, /data-element-sheet-bar/);
});
