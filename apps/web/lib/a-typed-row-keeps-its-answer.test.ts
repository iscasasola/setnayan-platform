/**
 * A FORM ROW'S ✕ LEAVES ITS ANSWER AS IT WAS — so a screen must never feed the
 * TYPING back into the row's `value`.
 *
 * Walked in the Maker on 2026-10-12 (the venue's address row, shared with "Add
 * your own"): the address was typed, ✕ pressed, and the row KEPT the typing.
 * Cause: `onType={(t) => setAddress(t)}` with `value={address}` — every keystroke
 * became the row's answer, so ✕ "restored" the typed words. The rule: `value`
 * is what was KEPT (set in `onKeep`); `onType` may only move a LIVE copy.
 *
 * Scanned: every `<TypedRow` in the files this branch built on the template. A
 * row whose `onType` calls the setter of the very state it passes as `value`
 * fails, by name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'app/dashboard/[eventId]/_components/add-your-own-walk.tsx',
  'app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx',
  'app/dashboard/[eventId]/_components/address-pin-field.tsx',
];

function rows(src: string): string[] {
  const out: string[] = [];
  let i = src.indexOf('<TypedRow');
  while (i >= 0) {
    const end = src.indexOf('/>', src.indexOf('onKeep', i));
    out.push(src.slice(i, end));
    i = src.indexOf('<TypedRow', end);
  }
  return out;
}

test('no Form row is handed its own typing as its answer', () => {
  let seen = 0;
  const bad: string[] = [];
  for (const rel of FILES) {
    for (const row of rows(stripComments(readFileSync(join(ROOT, rel), 'utf8')))) {
      const value = /\bvalue=\{([A-Za-z_]\w*)\}/.exec(row)?.[1];
      const onType = /onType=\{([\s\S]*?)\}\s*\n\s*(onKeep|attrs|inputMode|maxLength|placeholder|note|\/>)/.exec(row)?.[1] ?? '';
      if (!onType) continue;
      seen += 1;
      if (!value) continue;
      const setter = `set${value[0]!.toUpperCase()}${value.slice(1)}(`;
      if (onType.includes(setter)) bad.push(`${rel}: value={${value}} is set by its own onType`);
    }
  }
  assert.ok(seen >= 6, `only ${seen} typed rows with onType were found — the scan lost them`);
  assert.deepEqual(bad, []);
});
