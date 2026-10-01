/**
 * 🗑 "NO THANKS" AFTER A SELFIE DELETES IT — WITH ONE CONFIRM (owner 2026-09-29,
 * DECISION_LOG "OWNER ANSWERS — TEN OPEN QUESTIONS" (3): *"Selfie: yes"* — a guest
 * who picks "No thanks" after giving a selfie → one confirm, then their selfie +
 * automatic face tags are deleted (same path as the existing delete button).
 *
 * Pins:
 *   1. ONE erasure body — `eraseGuestFaceData` — used by BOTH "Delete my face
 *      data" (`withdrawFaceConsent`) and the reply; never a second copy;
 *   2. the reply erases only for a "No" WITH a live enrollment AND the confirm;
 *      an unconfirmed "No" changes nothing (not even the stored wish);
 *   3. the confirm is drawn only for a guest who has a selfie, and it posts the
 *      field the server reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SELFIE_DELETE_FIELD } from '@/lib/face-tagging-wish';

const SLUG = join(__dirname, '..');
const ACTIONS = stripComments(readFileSync(join(SLUG, 'actions.ts'), 'utf8'));

test('1 · one erasure, two doors', () => {
  assert.equal((ACTIONS.match(/async function eraseGuestFaceData\(/g) ?? []).length, 1);
  const withdraw = ACTIONS.slice(ACTIONS.indexOf('export async function withdrawFaceConsent('));
  assert.match(withdraw.slice(0, 900), /await eraseGuestFaceData\(admin, eventId, guestId\)/, 'Delete my face data no longer uses the one erasure');
  const erase = ACTIONS.slice(ACTIONS.indexOf('async function eraseGuestFaceData('), ACTIONS.indexOf('export async function withdrawFaceConsent('));
  for (const step of [/face_vector: null/, /executeCleanupDelete\(decision\.target\)/, /from\('photo_tags'\)[\s\S]{0,200}\.eq\('source', 'auto_face'\)/, /\.eq\('photo_source', 'selfie'\)/]) {
    assert.match(erase, step, `the erasure lost a step: ${step}`);
  }
  // Only ONE copy of the tag tombstone in the file — the reply did not grow its own.
  assert.equal((ACTIONS.match(/removed_at: now, removed_by: 'guest'/g) ?? []).length, 1, 'a second, divergent erasure');
});

test('2 · the reply erases only for a confirmed "No" with a live selfie; unconfirmed changes nothing', () => {
  const submit = ACTIONS.slice(ACTIONS.indexOf('export async function submitRsvp'));
  const at = submit.indexOf('if (taggingWish === false) {');
  assert.ok(at > -1, 'the "No thanks" branch moved — re-point this guard');
  const block = submit.slice(at, submit.indexOf('if (taggingWish !== undefined) {', at));
  assert.match(block, /from\('guest_face_enrollments'\)[\s\S]*\.is\('revoked_at', null\)/, 'it erases without asking whether a selfie exists');
  assert.match(block, /if \(clean\(formData\.get\(SELFIE_DELETE_FIELD\)\) === '1'\) await eraseGuestFaceData\(admin, eventId, guestId\);\s*else taggingWish = undefined;/);
  assert.ok(block.indexOf('eraseGuestFaceData') < submit.indexOf('redirect('), 'the erasure runs after the redirect');
});

test('3 · the confirm shows only for a guest with a selfie, and posts the field the server reads', () => {
  const widget = stripComments(readFileSync(join(SLUG, '_components', 'rsvp-widget.tsx'), 'utf8'));
  assert.match(widget, /\{guest\.photo_source === 'selfie' \? <SelfieNoThanksConfirm \/> : null\}/);
  const confirm = readFileSync(join(SLUG, '_components', 'selfie-no-thanks-confirm.tsx'), 'utf8');
  assert.match(confirm, /name=\{SELFIE_DELETE_FIELD\} value=\{confirmed \? '1' : '0'\}/);
  assert.equal(SELFIE_DELETE_FIELD, 'delete_selfie');
});
