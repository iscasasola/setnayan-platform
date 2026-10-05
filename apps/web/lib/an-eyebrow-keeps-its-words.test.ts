/**
 * AN EYEBROW KEEPS ITS WORDS — THE RULE GIVES WAY (owner, live at 375 px
 * 2026-10-06: "E- / GIFTS", "OUR / LOVE / STORY", "A NOTE / FROM US").
 *
 * MEASURED in the dev Maker lab at 375 px, in a 327 px column. Each eyebrow box
 * sized itself to its words alone, because a `flex-basis` adds nothing to the
 * box's own width. The 3.5rem rule could not shrink, so it took its room from
 * the words: one word per line, and "E-Gifts" broken at its hyphen. With the
 * fix, every eyebrow there sits on one line (height 15.8 px; it was 32).
 *
 * The rule is a WIDTH, so the box counts it. It is the only part that shrinks,
 * down to nothing. The words never shrink: they wrap only past the column's own
 * width, and then at a space.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const rule = (selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is gone`);
  return css.slice(at, css.indexOf('}', at));
};

test('the rule is a counted width that shrinks — first and down to nothing', () => {
  const after = rule('.sn-editorial .pahina-eyebrow::after');
  assert.match(after, /width: var\(--pahina-rule-len, 3\.5rem\);/, 'a flex-basis alone is not counted in the box’s width');
  assert.match(after, /min-width: 0;/, 'the rule must be able to drop away');
  assert.match(after, /flex: 0 1 auto;/);
  assert.doesNotMatch(after, /flex: 0 0 /, 'a rule that cannot shrink squeezes the words');
});

test('the words never shrink, and wrap only past the column', () => {
  const words = rule(".sn-editorial .pahina-eyebrow > span:not([aria-hidden='true'])");
  assert.match(words, /flex: 0 0 auto;/, 'words that can shrink wrap at every space (and at E-Gifts’ hyphen)');
  assert.match(words, /max-width: 100%;/, 'a long custom eyebrow must still wrap inside its column');
  assert.match(rule('.sn-editorial .pahina-eyebrow'), /max-width: 100%;/);
});
