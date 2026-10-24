/**
 * the-held-pass-actions-follow-their-line.test.ts — THE HELD-PASS LINE'S ACTIONS LOOK PRESSABLE AND STAND WHERE THE
 * LINE STANDS (owner 2026-10-24, on cale-ice).
 *
 * ⚖ Under "Will you join us? · Reply" the Event Hub read "This browser also holds Indalecia's invitation. Viewing as
 * you." — centred — then "Open as Indalecia" and "Remove it from this browser" as two underlined words flush LEFT,
 * out of line with everything above them. The row was `flex flex-wrap gap-x-5`, and a flex row has its own
 * `justify-content`: it ignores the `text-align` it sits in. And underlined text is not what a pressable thing looks
 * like on this platform (a pill, icon + word).
 *
 * Held, on the REAL component's markup (react-dom/server), in all three of its modes:
 *   · every action is a POST form (a link would be run by a prefetch) whose button is a pill — rounded, a 44 px tap
 *     target, an icon AND a word, no underline;
 *   · the row is INLINE — no `flex` / `grid` of its own, the forms `inline-block` — so it follows the alignment of
 *     the place it is drawn in (centred under the cover, flush left beside the reply's name);
 *   · it paints with the Event Hub's theme token (`ink`) only — no fixed colour, no house-only brand colour — so it
 *     wears every couple's design and the dark Look.
 *
 * Sabotages seen red (each restored): the row back to `flex flex-wrap gap-x-5` · a button back to `underline` · the
 * icon dropped · `bg-mulberry` on the pill.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeldPassLine } from './held-pass-line';

const MODES = ['set_aside', 'set_aside_host', 'host_preview'] as const;

function render(mode: (typeof MODES)[number]): string {
  return renderToStaticMarkup(createElement(HeldPassLine, { slug: 'maria-and-jose', firstName: 'Eufemia', mode }));
}

test('every action is a POST form whose button is a pill with an icon and a word — never underlined text', () => {
  for (const mode of MODES) {
    const html = render(mode);
    const forms = html.match(/<form[^>]*>/g) ?? [];
    const buttons = [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
    assert.ok(forms.length > 0 && forms.length === buttons.length, `${mode}: one form per action`);
    for (const f of forms) assert.match(f, /method="post"/, `${mode}: an action is not a POST form`);
    for (const [, attrs, inner] of buttons) {
      assert.match(attrs!, /type="submit"/);
      assert.match(attrs!, /rounded-full/, `${mode}: a button is not a pill`);
      assert.match(attrs!, /min-h-\[44px\]/, `${mode}: a button's tap target is under 44 px`);
      assert.doesNotMatch(attrs!, /\bunderline\b/, `${mode}: a button is underlined text again`);
      assert.match(inner!, /<svg[^>]*aria-hidden="true"/, `${mode}: a button has no icon`);
      assert.match(inner!.replace(/<svg[\s\S]*?<\/svg>/g, ''), /<span>[^<]+<\/span>/, `${mode}: a button has no word`);
    }
  }
});

test('the row is inline, so it follows the alignment it is drawn in — never a flex row of its own', () => {
  for (const mode of MODES) {
    const html = render(mode);
    const row = /<div data-held-pass-actions="" class="([^"]*)"/.exec(html);
    assert.ok(row, `${mode}: the actions row lost its marker — point this guard at it`);
    assert.doesNotMatch(row![1]!, /(^|\s)(flex|inline-flex|grid)(\s|$)/, `${mode}: the row decides its own alignment again (flex/grid ignores text-align)`);
    for (const f of html.match(/<form[^>]*>/g) ?? []) assert.match(f, /inline-block/, `${mode}: an action is not inline`);
  }
});

test('it paints with the Event Hub’s theme token only', () => {
  for (const mode of MODES) {
    const html = render(mode);
    assert.doesNotMatch(html, /#[0-9a-f]{3,6}\b|\b(bg|text|border)-(mulberry|terracotta|white|black)\b/i, `${mode}: a fixed or house colour on a couple’s page`);
    assert.match(html, /border-ink\//, `${mode}: the pill's hairline is not the page's ink`);
  }
});
