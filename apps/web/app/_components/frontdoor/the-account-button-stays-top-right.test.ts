/**
 * 🔝 THE ACCOUNT BUTTON STAYS IN THE TOP-RIGHT CORNER — on every page, with or without the bar's search.
 *
 * Owner, 2026-10-23, over the Events board: "wrong position. that button should be at the upper right
 * corner". `.fd-topbar` is a three-column grid; a page that passes `search={false}` renders no middle
 * child, and auto-placement dropped `.fd-topright` into the search column. The property held here: the
 * account cluster names its column (the last one) instead of relying on how many siblings precede it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const css = stripComments(readFileSync(join(__dirname, 'front-door.css'), 'utf8'));

function rulesFor(selector: string): string {
  const re = new RegExp(`(^|[}\\s])${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(re)].map((m) => m[2]).join(';');
}

test('the account cluster is pinned to the last grid column', () => {
  assert.match(rulesFor('.fd-topright'), /grid-column:\s*-2\s*\/\s*-1/, '.fd-topright must name the last column');
});

test('the wordmark cluster is pinned to the first column', () => {
  assert.match(rulesFor('.fd-topleft'), /grid-column:\s*1\b/);
});
