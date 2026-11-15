/**
 * app-colours-in-globals.test.ts — 🎨 DECISION IS ITS OWN JOB, SPLIT FROM TOGGLE (Admin › Colours, owner 12 Nov 2026).
 *
 * Before this split the forward-step button (`.ab-brand`, `.button-primary`) read `--sn-accent`, the same token as a
 * switch that is on — so recolouring the toggle recoloured every Next/Add/Publish. This holds the split:
 *
 *   (1) `--sn-decision*` are NEVER declared in globals.css. A `:root` alias is resolved once at the root, so a Pro hub
 *       theme that re-points `--color-mulberry` on its own scope would paint its buttons in the house terracotta.
 *   (2) Every decision consumer reads `--sn-decision…` WITH a fallback to exactly what it read before — so with nothing
 *       saved no pixel moves.
 *   (3) No decision consumer still reads `--sn-accent` bare (that would be the toggle dragging it again).
 *   (4) The page behind everything has its own token, and the body reads it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const BRAND = /:is\(button, a\)\.ab\.ab-brand \{([^}]*)\}/.exec(CSS)?.[1] ?? '';

test('(1) the decision tokens are never declared in the stylesheet', () => {
  assert.doesNotMatch(CSS, /^\s*--sn-(?:on-)?decision(?:-600|-word)?\s*:/m);
});

test('(2) every decision consumer falls back to what it read before', () => {
  assert.match(BRAND, /--ab-tone: var\(--sn-decision, var\(--sn-accent\)\);/);
  assert.match(BRAND, /--ab-word: var\(--sn-decision-word, var\(--color-mulberry-700\)\);/);
  assert.match(CSS, /\.button-primary \{\n\s*background-color: rgb\(var\(--sn-decision, var\(--color-mulberry\)\)\);/);
  assert.match(CSS, /\.button-primary:hover \{\n\s*background-color: rgb\(var\(--sn-decision-600, var\(--color-mulberry-600\)\)\);/);
  assert.match(
    CSS,
    /\.app-surface \.button-primary \{\n\s*background: rgb\(var\(--sn-decision, var\(--sn-accent\)\)\);\n\s*color: rgb\(var\(--sn-on-decision, var\(--sn-on-accent\)\)\);/,
  );
  for (const sel of ['ab-main', 'ab-fill']) {
    assert.match(
      CSS,
      new RegExp(`html\\.dark :is\\(button, a\\)\\.ab\\.ab-brand\\.${sel} \\{ color: rgb\\(var\\(--sn-on-decision, var\\(--sn-on-accent\\)\\)\\); \\}`),
      sel,
    );
  }
});

test('(3) no decision consumer reads the toggle bare', () => {
  assert.ok(BRAND, 'the .ab-brand rule was not found');
  assert.doesNotMatch(BRAND.replace(/var\(--sn-decision, var\(--sn-accent\)\)/g, ''), /--sn-accent/);
  const surface = /\.app-surface \.button-primary \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.ok(surface, 'the .app-surface .button-primary rule was not found');
  assert.doesNotMatch(surface.replace(/var\(--sn-(?:on-)?decision, var\(--sn-(?:on-)?accent\)\)/g, ''), /--sn-(?:on-)?accent/);
});

test('(4) the page behind everything is its own token', () => {
  assert.match(CSS, /\n\s*body \{\n\s*background-color: rgb\(var\(--sn-page-bg\)\);/);
  const root = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('html.dark {'));
  assert.match(root, /--sn-page-bg: 255 255 255;/, 'the light page is not white');
});
