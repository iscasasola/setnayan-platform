/**
 * picture-cards-are-phone-shaped.test.ts — `.sn-phone-card`, THE ONE FRAME EVERY
 * PICTURE CARD IN THE MAKER WEARS.
 *
 * Owner 2026-10-08, on Look › Background's cards drawn as short, wide strips:
 * *"we are on mobile view, so show in mobile view, not like a header that is
 * short and wide or at least square or 4:3 or 3:4"* — and, a minute later,
 * *"on all style across the market hub"*.
 *
 * Held here: the frame's own promises, read off the stylesheet's DECLARATIONS
 * (never off a comment): 3 : 4 portrait · a fixed inline size from
 * `--phone-card-w` · never grows or shrinks · clips · the house radius · its
 * media covers — and that it is UNLAYERED, so no utility on a card can undo it.
 * Who wears it is each picker's own guard (`the-background-has-one-source.test.ts`
 * for Look › Background).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

/** The stylesheet with its comments blanked — a promise in a comment is not a declaration. */
const code = stripComments(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));

/** The declarations of the ONE rule whose selector is exactly `selector`. */
function ruleOf(selector: string): Record<string, string> {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = [...code.matchAll(new RegExp(`(^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))];
  assert.equal(hits.length, 1, `expected ONE \`${selector}\` rule, found ${hits.length}`);
  return Object.fromEntries(
    hits[0]![2]!
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
  );
}

const PHONE_CARD_CLASS = 'sn-phone-card';
const PHONE_CARD_WIDTH_VAR = '--phone-card-w';

test('the frame is 3 : 4 portrait, a fixed inline size, and can neither grow nor shrink', () => {
  const frame = ruleOf(`.${PHONE_CARD_CLASS}`);
  assert.equal(frame['aspect-ratio'], '3 / 4', 'the frame is not 3 : 4');
  const [w, h] = frame['aspect-ratio']!.split('/').map((n) => Number(n.trim()));
  assert.ok(h! > w!, 'the frame is not PORTRAIT (taller than it is wide)');
  // A fixed size, from the one custom property — never a percentage, never auto.
  const size = /^var\(--phone-card-w, (\d+)px\)$/.exec(frame['inline-size'] ?? '');
  assert.ok(size, `the frame's inline size is not a fixed size from ${PHONE_CARD_WIDTH_VAR}: ${frame['inline-size']}`);
  // About two and a half across a 375px phone: 16px of side padding, 8px between cards.
  const across = (375 - 16 + 8) / (Number(size![1]) + 8);
  assert.ok(across >= 2.3 && across <= 2.8, `${across.toFixed(2)} cards show across a 375px phone — the strip does not visibly scroll`);
  assert.equal(frame['flex'], 'none', 'a card may grow into a wide panel, or shrink');
  assert.equal(frame['overflow'], 'hidden');
  assert.equal(frame['border-radius'], 'var(--m-r-md)', 'the frame does not wear the house radius token');
  for (const banned of ['width', 'min-width', 'max-width', 'flex-grow', 'flex-basis', 'height']) assert.ok(!(banned in frame), `the frame sets ${banned} — a second, competing size`);
});

test('its picture or loop is cropped to the frame the way a phone crops the page', () => {
  const media = ruleOf(`.${PHONE_CARD_CLASS} :is(img, video)`);
  assert.deepEqual(media, { 'inline-size': '100%', 'block-size': '100%', 'object-fit': 'cover' });
});

test('it is UNLAYERED — no Tailwind utility on a card can turn it back into a strip', () => {
  const at = code.indexOf(`.${PHONE_CARD_CLASS} {`);
  assert.ok(at > 0);
  // Walk the braces before it: at the rule, we must be at depth 0 (inside no `@layer`, no `@media`).
  let depth = 0;
  for (let i = 0; i < at; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') depth--;
  }
  assert.equal(depth, 0, 'the frame sits inside an at-rule (a layered rule loses to every utility)');
  // …and nothing else in the stylesheet resizes it.
  const others = [...code.matchAll(/([^{}]*\.sn-phone-card[^{}]*)\{/g)].map((m) => m[1]!.trim());
  assert.deepEqual(others, ['.sn-phone-card', '.sn-phone-card :is(img, video)'], 'a second rule reaches the frame');
});
