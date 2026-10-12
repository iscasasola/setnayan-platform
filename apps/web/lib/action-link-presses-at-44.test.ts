/**
 * An ActionButton rendered AS A LINK (`href` → `<a class="ab">`) presses at 44px,
 * like its button form, without changing its 40px look.
 *
 * Why: the button form paints 44 (globals' base `button { min-height: 44px }`
 * beats `.ab { height: 40px }`); the link form had no floor, so every
 * link-button app-wide was a 40px press (controller sweep, 2026-10-13). The
 * fix is an `a.ab::after` expander — measured here by arithmetic: the drawn
 * height plus twice the expander's inset must reach 44. It must NOT bleed
 * sideways: `useFitRow` reads a row's scrollWidth, and 2px of horizontal bleed
 * would read as overflow and strip words from a row that fits.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));

test('a link-button carries a press expander that reaches 44px each way', () => {
  const base = css.match(/(?:^|\n)\.ab \{([^}]*)\}/)?.[1] ?? '';
  const h = Number(base.match(/\bheight:\s*(\d+)px/)?.[1]);
  assert.ok(h > 0, 'the .ab base rule lost its height — did the drawing change?');
  const after = css.match(/a\.ab::after\s*\{([^}]*)\}/)?.[1];
  assert.ok(after, 'a.ab::after is gone — every ActionButton link presses at its 40px paint again');
  assert.match(after!, /content:\s*''/, 'the expander has no content, so it does not render');
  assert.match(after!, /position:\s*absolute/, 'the expander is not absolutely positioned');
  const inset = after!.match(/inset:\s*(-?\d+)px(?:\s+(-?\d+)(?:px)?)?/);
  assert.ok(inset, 'the expander has no inset');
  const v = -Number(inset![1]);
  const x = -Number(inset![2] ?? inset![1]);
  assert.ok(h + 2 * v >= 44, `link-button press height ${h + 2 * v}px < 44`);
  assert.ok(x === 0, 'the expander bleeds sideways — useFitRow will read it as overflow');
  assert.match(css, /:where\(a\.ab\)\s*\{\s*position:\s*relative/, 'the link-button is not a positioning box for its expander');
});

test('the producer still renders a link for href — the rule above has something to hold', () => {
  const src = stripComments(readFileSync(join(WEB, 'components/action-button.tsx'), 'utf8'));
  assert.ok(/props\.href !== undefined/.test(src) && /<Link\b/.test(src), 'ActionButton no longer renders <Link> for href');
});
