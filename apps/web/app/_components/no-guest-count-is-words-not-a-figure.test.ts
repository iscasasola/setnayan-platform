/**
 * no-guest-count-is-words-not-a-figure.test.ts — re-walk on live 307925d, 24 Nov, fault 3 (controller GO).
 *
 * On live at 375 px the quote maker's "On their list" set "No guest count yet" in the FIGURE's size (serif, large),
 * so it broke over two lines beside its label, and "Billed" wrapped too. A count is a figure; "No guest count yet" is
 * words: body size, one line, in both rows. The figure itself is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAKER = readFileSync(join(__dirname, 'proposal-maker.tsx'), 'utf8');

function classOf(attr: string): string {
  const at = MAKER.indexOf(attr);
  assert.ok(at > 0, `anti-vacuity: ${attr} is gone`);
  const tag = MAKER.slice(MAKER.lastIndexOf('<strong', at), MAKER.indexOf('>', at) + 1);
  return /className="([^"]+)"/.exec(tag)?.[1] ?? '';
}

for (const attr of ['data-quote-live-pax="none"', 'data-quote-billed-pax="none"']) {
  test(`${attr}: "No guest count yet" at body size, on one line`, () => {
    const cls = classOf(attr);
    assert.match(cls, /\btext-sm\b/, 'not at body size');
    assert.match(cls, /\bwhitespace-nowrap\b/, 'it may break over two lines');
    assert.match(cls, /\bshrink-0\b/, 'the label can squeeze it');
    assert.doesNotMatch(cls, /\b(?:font-serif|text-lg)\b/, 'the words are set as a figure');
    const after = MAKER.slice(MAKER.indexOf(attr), MAKER.indexOf(attr) + 160);
    assert.match(after, />\s*No guest count yet\s*</);
  });
}

test('the figure stays a figure', () => {
  assert.match(classOf('data-quote-live-pax=""'), /font-serif text-lg tabular-nums/);
  assert.match(classOf('data-quote-billed-pax=""'), /font-serif text-lg tabular-nums/);
});
