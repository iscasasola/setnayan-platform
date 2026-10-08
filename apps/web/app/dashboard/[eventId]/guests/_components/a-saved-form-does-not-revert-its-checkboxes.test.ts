/**
 * a-saved-form-does-not-revert-its-checkboxes.test.ts — REACT 19 RESETS A FORM AFTER ITS ACTION LANDS; A CONTROLLED CHECKBOX MUST SURVIVE IT.
 *
 * Found 2026-10-09 while moving the card onto the templates, measured in a real browser with the autosave's own `<form>`: change
 * the Role to a sponsor → "Invited to" snaps to all five blocks and the autosave posts them → the action lands → React calls
 * `form.reset()` → each CONTROLLED checkbox goes back to its `checked` ATTRIBUTE, its mount-time value (two blocks). The screen's
 * state still said five; the DOM said two; and the NEXT autosave — any other field — read the DOM and posted two, quietly
 * un-inviting the guest from the three blocks the host had just ticked. (`InvitedToChips`, in the card since 2026-05-23.)
 *
 * The cure is one line per control: keep the attribute (`defaultChecked`) equal to the box's current state, so the reset puts back
 * what is there. The same holds for the checkboxes the new `fieldName` props render (`SwitchRow`, `Chips`).
 *
 * SABOTAGE (each seen RED, then restored): the effect removed from `InvitedToChips` · from `SwitchRow` · from `Chips`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const APP = join('..', '..', '..', '..', '_components');

test('the card’s own Invited-to switches keep their attribute equal to their state', () => {
  const src = read('invited-to-chips.tsx');
  assert.match(src, /boxes\.current\?\.querySelectorAll<HTMLInputElement>\('input\[type="checkbox"\]'\)\.forEach\(\(el\) => \{\s*el\.defaultChecked = el\.checked;\s*\}\);\s*\}, \[blocks\]\);/);
  assert.equal((src.match(/ref=\{boxes\}/g) ?? []).length, 2, 'one of the two looks (switches · chips) is not watched');
});

test('SwitchRow and Chips do the same for the checkboxes they render under a fieldName', () => {
  assert.match(read(APP, 'form-row.tsx'), /if \(fieldName && post\.current\) post\.current\.defaultChecked = on;\s*\}, \[on, fieldName\]\);/);
  assert.match(read(APP, 'chips.tsx'), /for \(const \[key, box\] of boxes\.current\) box\.defaultChecked = value\.includes\(key\);/);
});

test('the templated Invited-to also takes a fresh set from the server (the old one never did)', () => {
  const rows = read('guest-card-rows.tsx');
  assert.match(rows, /const fromServer = \(initialBlocks \?\? \[\]\)\.join\(','\);\s*useEffect\(\(\) => \{\s*if \(initialBlocks\) setBlocks\(initialBlocks as InvitedToBlock\[\]\);/);
});
