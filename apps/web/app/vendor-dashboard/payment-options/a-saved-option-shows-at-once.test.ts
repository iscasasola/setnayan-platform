/**
 * a-saved-option-shows-at-once.test.ts — walk W1-B9, 16 Nov 2026.
 *
 * On Your details › How clients pay you, after "Save payment option" the row still read "Not yet · No payment options
 * yet." until a reload. Held as properties:
 *   1 · the add form saves IN PLACE (`StayForm`, the app-wide "a save never resets the screen") and, once the save has
 *       landed, re-reads the screen in place (`router.refresh()`) — never a navigation, and never before the save;
 *   2 · the action still revalidates both screens that mount this editor (Your details and the Customers ⚙), so the
 *       re-read draws the new row;
 *   3 · the row and the list read the SAME methods (`d.pay`, handed to the surface as `preloaded`), so the badge, the
 *       fold's line and the cards can never disagree after the re-read.
 *
 * SABOTAGE (each seen red): `router.refresh()` removed → 1 · moved before `setOpen(false)` outside `onSaved` → 1 ·
 * a `revalidatePath(LANDING)` dropped from `addPaymentMethod` → 2 · the surface reading its own methods → 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

test('1 · the add form re-reads the screen in place once the save has landed', () => {
  const src = code('_components/add-payment-method.tsx');
  assert.match(src, /<StayForm\s+door="supPayments\.addPaymentMethod"/, 'the add form no longer saves in place');
  const saved = src.slice(src.indexOf('onSaved={() => {'), src.indexOf('className="space-y-5 border-t'));
  assert.ok(saved.length > 0, 'anti-vacuity: onSaved not found');
  assert.match(saved, /setOpen\(false\);\s*router\.refresh\(\);/, 'the saved option waits for a reload');
  assert.doesNotMatch(src, /router\.(push|replace)\(/, 'a save navigates — it resets the screen');
});

test('2 · the action revalidates both screens that mount the editor', () => {
  const src = code('actions.ts');
  const add = src.slice(src.indexOf('export async function addPaymentMethod'), src.indexOf('export async function deletePaymentMethod'));
  assert.match(add, /revalidatePath\(LANDING\);\s*revalidatePath\('\/vendor-dashboard\/customers'\);/);
});

test('3 · Your details’ row and the list read the same methods', () => {
  const page = code('../profile/page.tsx');
  assert.match(page, /<PaymentOptionsSurface searchParams=\{searchParams\} embedded preloaded=\{d\.pay\} \/>/);
  const screen = code('../profile/_components/details-screen.tsx');
  assert.match(screen, /d\.pay\.methods\.length/, 'the fold line reads its own methods');
});
