/**
 * The couple's say over face tagging. Every test is about the direction: this
 * control can only ever say NO.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFaceMode } from './papic-face-mode';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const ACTION = read('..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'face-tagging-actions.ts');
const CARD = read('..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', '_components', 'face-tagging-choice.tsx');

test('a couple can switch face tagging OFF on their own event', () => {
  assert.equal(resolveFaceMode('mode_a', 'wedding'), 'mode_a');
  assert.equal(resolveFaceMode('mode_a', 'wedding', true), 'mode_b');
});

test('a couple CANNOT switch it on where an admin has not', () => {
  // The whole safety of this control. "Not declined" restores the admin's
  // setting; it never creates one.
  assert.equal(resolveFaceMode('mode_b', 'wedding', false), 'mode_b');
  assert.equal(resolveFaceMode(null, 'wedding', false), 'mode_b');
  assert.equal(resolveFaceMode(undefined, 'wedding', false), 'mode_b');
});

test('a couple can decline on ANY event type, including the minor-heavy ones', () => {
  // ⚠ CHANGED 2026-08-05: these types are no longer force-locked, so the
  // couple's decline is what protects them if an admin has enabled it — which
  // makes this test more load-bearing than the one it replaces, not less.
  for (const type of ['christening', 'debut', 'wedding', 'birthday']) {
    assert.equal(resolveFaceMode('mode_a', type, true), 'mode_b', `${type} must obey the couple`);
    assert.equal(resolveFaceMode('mode_a', type, false), 'mode_a', `${type} runs when they don't`);
  }
});

test('only an explicit true declines — a null is not a decision', () => {
  assert.equal(resolveFaceMode('mode_a', 'wedding', null), 'mode_a');
  assert.equal(resolveFaceMode('mode_a', 'wedding', undefined), 'mode_a');
});

test('the one resolver that answers "what runs" passes the couple’s choice', () => {
  // If this ever stops reading the column, every caller silently reverts to the
  // admin's answer and the couple's decision disappears with no error anywhere.
  const src = strip(read('papic-face-mode.ts'));
  assert.match(src, /face_tagging_declined_by_couple/, 'the server resolver must read it');
  assert.match(
    src,
    /resolveFaceMode\(\s*row\.papic_face_mode,\s*row\.event_type,\s*row\.face_tagging_declined_by_couple,?\s*\)/,
    'and pass it through',
  );
});

test('only a couple member may set it', () => {
  const code = strip(ACTION);
  assert.match(code, /member_type', 'couple'/, 'not a coordinator, not a supplier');
  // ⚠ Compare inside the FUNCTION, not the file — `createAdminClient` also
  // appears in the import line at the top, so a whole-file indexOf makes this
  // assertion pass no matter where the check actually sits. The first version
  // of this test did exactly that.
  const fn = code.slice(code.indexOf('export async function setCoupleFaceTaggingDeclined'));
  assert.ok(
    fn.indexOf("member_type', 'couple'") < fn.indexOf('createAdminClient('),
    'the membership check must happen BEFORE the service-role write',
  );
});

test('the service-role write is authorised by that check, not by itself', () => {
  const code = strip(ACTION);
  assert.match(code, /if \(!membership\) redirect\(back\)/);
});

test('the card renders nothing when there is nothing to decline', () => {
  const code = strip(CARD);
  assert.match(code, /eventTypeForcesModeB\(row\.event_type\)\) return null/);
  assert.match(code, /row\.papic_face_mode !== 'mode_a'\) return null/);
});

test('THE HANDLE: the column has a writer and a mounted control', () => {
  assert.match(strip(ACTION), /\.update\(\{ face_tagging_declined_by_couple/);
  assert.match(strip(CARD), /action=\{setCoupleFaceTaggingDeclined\}/);
  const page = strip(read('..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'page.tsx'));
  assert.match(page, /<FaceTaggingChoice/);
});
