/**
 * the-blue-look-is-tokens-only.test.ts — 🔵 THE SUPPLIER BLUE LOOK RE-POINTS TOKENS, AND TYPES NO COLOUR ANYWHERE ELSE.
 *
 * Owner rule (17 Nov, via the controller — "nothing hard-coded"): the blue look re-points the colour tokens only. Every
 * literal colour in `supplier-look.css` must sit on a custom-property line (`--name: …`); a rule body (the glow, the
 * button shadow) reads `var(--…)`.
 *
 * SABOTAGE (run once, went red): put `rgba(34, 114, 230, 0.75)` back in the button's box-shadow → 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/supplier-look.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('every literal colour is a token definition', () => {
  const typed = CSS.split('\n')
    .map((l, i) => ({ l: l.trim(), n: i + 1 }))
    .filter(({ l }) => /#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i.test(l) && !l.startsWith('--'));
  assert.deepEqual(typed, [], 'a colour is typed outside a token');
});
