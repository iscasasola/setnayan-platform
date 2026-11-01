import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

/**
 * 🪪 THE AVATAR SHEET LAB DRAWS THE SHIPPED PANEL BOX (walk 2026-11-01).
 *
 * The walk reported the account switcher "stretched to full width at 1280". The shipped panel (`renderPanel()` in
 * `account-switcher.tsx`) is a 320-px card under the pill from `lg`; the lab had copied only the panel's PHONE classes
 * into its own dialog, so the lab — and only the lab — drew a phone sheet across a desktop. A lab that draws a partial
 * copy of a shipped box reports defects the product does not have, and hides ones it does.
 *
 * Property: every class the shipped panel wears, the lab's dialog wears too (the lab may add, never drop).
 */

const here = dirname(fileURLToPath(import.meta.url));
const code = (rel: string) =>
  stripComments(readFileSync(join(here, rel), 'utf8'));

/** The string literals of the first `className={[ … ].join(' ')}` after `anchor`. */
function classList(src: string, anchor: string, what: string): Set<string> {
  const at = src.indexOf(anchor);
  assert.ok(at >= 0, `${what}: anchor "${anchor}" moved`);
  const m = src.slice(at).match(/className=\{\[([\s\S]*?)\]\.join\(' '\)\}/);
  assert.ok(m, `${what}: no className={[…].join(' ')} after "${anchor}"`);
  const literals = [...m[1]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!);
  return new Set(literals.join(' ').split(/\s+/).filter(Boolean));
}

const shipped = classList(code('../../_components/account-switcher/account-switcher.tsx'), 'function renderPanel()', 'the shipped panel');
const lab = classList(code('sheet-lab.tsx'), 'role="dialog"', 'the lab dialog');

test('the shipped panel narrows from lg (or this guard is aimed at nothing)', () => {
  assert.ok(shipped.has('lg:inset-x-auto'), 'the shipped panel should stop pinning both edges from lg');
  assert.ok([...shipped].some((c) => /^lg:w-/.test(c)), 'the shipped panel should have its own width from lg');
});

test('the lab dialog wears every class of the shipped panel', () => {
  const missing = [...shipped].filter((c) => !lab.has(c));
  assert.deepEqual(missing, [], `the lab's switcher dialog is missing the shipped panel's classes: ${missing.join(' ')}`);
});
