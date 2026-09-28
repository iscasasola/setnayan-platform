/**
 * THE MENU EDITOR'S ROWS ARE ONE FULL-WIDTH FIELD + ONE "⋯" — ON A PHONE.
 *
 * At 375 px a dish row that carried Up · Down · Remove beside its input left the
 * input a sliver. The shipped shape (`Row` in print-menu-editor.tsx, verified in
 * a 375 px browser: input 263 px wide, every target 44 × 44) is: the field takes
 * the width, ONE "Move or remove <dish>" button sits beside it, and the labelled
 * strip (Up · Down · Remove / Earlier · Later · Remove moment) appears only for
 * the one row that is open.
 *
 * Held as a property of the rendered HTML, not as a phrasing: per moment, the
 * closed editor renders exactly (dishes + 1) "Move or remove" buttons and NO
 * arrow icon and NO action strip; every input keeps its "Dish N of <moment>"
 * label; every interactive control is a 44 px target.
 *
 * ⚠ Classic-runtime global + dynamic import, as in
 * `app/pay/[reference]/_components/one-stage-at-a-time.test.ts` (tsconfig
 * `"jsx": "preserve"`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

const MOMENTS = [
  { title: 'Cocktail hour', dishes: ['Lechon with liver sauce', 'Kinilaw na tanigue', ''] },
  { title: 'Reception & dinner', dishes: ['Beef caldereta', 'Garlic rice'] },
];

async function renderEditor(): Promise<string> {
  const { PrintMenuEditor } = await import('./print-menu-editor');
  return renderToStaticMarkup(
    React.createElement(PrintMenuEditor, {
      eventId: 'S89E-TEST000000',
      initial: MOMENTS,
      fromCaterer: false,
      suggestions: ['Dessert'],
      flash: null,
    }),
  );
}

test('closed, each moment renders one full-width input per line and exactly one "⋯" per line — no arrow buttons crowd the field', async () => {
  const html = await renderEditor();
  const moments = html.split('data-print-menu-moment=').slice(1);
  assert.equal(moments.length, MOMENTS.length, 'one block per moment');

  moments.forEach((block, i) => {
    const m = MOMENTS[i]!;
    const more = (block.match(/aria-label="Move or remove /g) ?? []).length;
    assert.equal(more, m.dishes.length + 1, `${m.title}: one "⋯" for the title and one per dish, nothing more`);
    assert.doesNotMatch(block, /lucide-arrow-(up|down)/, `${m.title}: no arrow buttons beside the inputs while closed`);
    assert.doesNotMatch(block, /data-print-menu-row-actions/, `${m.title}: no action strip is open by default`);
    m.dishes.forEach((_, j) => {
      assert.ok(block.includes(`aria-label="Dish ${j + 1} of ${m.title.replace(/&/g, '&amp;')}"`), `${m.title}: dish ${j + 1} keeps its label`);
    });
  });

  // Every field and every control is a phone-sized target.
  const inputs = html.match(/<input(?![^>]*type="hidden")[^>]*>/g) ?? [];
  assert.ok(inputs.length >= 5, 'the visible inputs rendered');
  for (const tag of inputs) assert.match(tag, /min-h-11/, `input is a 44 px target: ${tag.slice(0, 80)}`);
  for (const tag of inputs) assert.match(tag, /\bw-full\b/, `input takes the row's width: ${tag.slice(0, 80)}`);
  // The rows' own controls (the shared "Saves immediately" info dot above them
  // is `InfoTip`'s, not this editor's).
  const buttons = moments.join('').match(/<button[^>]*>/g) ?? [];
  assert.ok(buttons.length >= 7, 'the rows rendered their controls');
  for (const tag of buttons) assert.match(tag, /min-h-11/, `button is a 44 px target: ${tag.slice(0, 80)}`);
  const more = buttons.filter((t) => t.includes('aria-label="Move or remove '));
  for (const tag of more) assert.match(tag, /min-w-11/, `the "⋯" is 44 px wide too: ${tag.slice(0, 80)}`);
  for (const tag of more) assert.match(tag, /aria-expanded="false"/, 'the "⋯" tells a screen reader it opens something');
});
