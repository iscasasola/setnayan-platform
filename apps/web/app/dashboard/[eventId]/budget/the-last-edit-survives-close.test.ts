/**
 * the-last-edit-survives-close.test.ts — 💾 THE EXPENSE SHEET NEVER DROPS THE LAST EDIT (audit 2026-11-02 #7). Its
 * unmount effect cleared the 600 ms debounce with no flush, so an amount typed and closed within 600 ms was lost while
 * the sheet said "Edits save as you type". Held as properties of `ExpenseSheet`:
 *   1. closing (the sheet's ✕, a tap outside) and unmounting both FLUSH a waiting edit — they send it, never clear it;
 *   2. a fired debounce forgets its timer, so a flush never sends one edit twice;
 *   3. a save that lands after the sheet closed still says a refusal (a toast), never nothing.
 * Sabotage (2026-11-02, each reverted, each red): the unmount back to `clearTimeout` only (1) · `onClose={onClose}`
 * on the Sheet (1) · the timer not nulled when it fires (2) · the closed-sheet branch returning silently (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const F = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'budget', '_components', 'budget-sheets.tsx');
const src = stripComments(readFileSync(F, 'utf8'));
const sheet = src.slice(src.indexOf('function ExpenseSheet('), src.indexOf('function AddExpenseSheet('));

test('1 · closing and unmounting flush a waiting edit', () => {
  assert.ok(sheet.length > 0, 'ExpenseSheet not found — this guard is pointed at nothing');
  const flush = sheet.slice(sheet.indexOf('const flush = () => {'), sheet.indexOf('useEffect(', sheet.indexOf('const flush = () => {')));
  assert.match(flush, /clearTimeout\(timer\.current\);\s*timer\.current = null;\s*void save\(\);/, 'flush does not SEND the waiting edit');
  assert.match(sheet, /return \(\) => \{\s*mounted\.current = false;\s*flush\(\);\s*\};/, 'unmounting clears the edit instead of sending it');
  assert.match(sheet, /const close = \(\) => \{\s*flush\(\);\s*onClose\(\);\s*\};/, 'closing does not send the waiting edit first');
  assert.match(sheet, /<Sheet open onClose=\{close\}/, 'the sheet closes without flushing');
});

test('2 · a fired debounce forgets its timer', () => {
  assert.match(sheet, /setTimeout\(\(\) => \{\s*timer\.current = null;\s*void save\(\);\s*\}, EDIT_DEBOUNCE_MS\)/, 'a fired save keeps its timer — a close would send it twice');
});

test('3 · a save that lands after close still says a refusal', () => {
  assert.match(sheet, /if \(!mounted\.current\) \{\s*if \(error\) toast\.error\(/, 'a refused save after close says nothing');
});
