/**
 * GUARD — FACE BLOCKING ON THE PAPIC CARD IS A COUNT, NEVER A SWITCH (owner ruling 2026-10-24: "no event switch …
 * each guest's wish is always honoured").
 *   1. The row draws no switch and posts no form — nothing on the card can override a guest's own choice.
 *   2. N counts ACTIVE guests only (`deleted_at is null`) who set `faceblock_enabled`.
 *   3. A failed read says so — never "0 guests blurred".
 *   4. The card draws the row, beside Face tagging.
 * Sabotage (2026-10-24): drop `.is('deleted_at', null)` → 2 red; return '0 guests blurred' for null → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { faceBlockingWords } from './face-blocking-words';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const ROW = read('app/dashboard/[eventId]/studio/papic/_components/face-blocking-count.tsx');

test('1 · the row has no switch and posts nothing', () => {
  assert.doesNotMatch(ROW, /role="switch"|<form\b|SwitchTrack|action=\{/, 'the Face blocking row can change something — it must only count');
});

test('2 · N excludes removed guests and counts only those who asked', () => {
  assert.match(ROW, /\.from\('guests'\)/);
  assert.match(ROW, /\.is\('deleted_at', null\)/, 'removed guests are counted');
  assert.match(ROW, /\.eq\('faceblock_enabled', true\)/, 'the count is not of the guests who asked to be blurred');
});

test('3 · a failed read is said, never 0', () => {
  assert.doesNotMatch(faceBlockingWords(null), /\b0\b/);
  assert.match(faceBlockingWords(null), /Couldn/);
  assert.equal(faceBlockingWords(0), '0 guests blurred');
  assert.equal(faceBlockingWords(1), '1 guest blurred');
  assert.match(ROW, /faceBlockingWords\(error \? null : \(count \?\? null\)\)/, 'a refused count reaches the words as a number');
});

test('4 · the open Papic card draws it, after Face tagging', () => {
  const cam = read('app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx');
  const tag = cam.indexOf('<FaceTaggingChoice');
  const block = cam.indexOf('<FaceBlockingCount eventId={eventId} />');
  assert.ok(tag > 0 && block > tag, 'Face blocking is not beside Face tagging in the card');
});
