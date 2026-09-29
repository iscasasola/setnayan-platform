/**
 * 🖨 "CHANGED SINCE YOU PRINTED" (owner 2026-09-29, DECISION_LOG "OWNER ANSWERS —
 * TEN OPEN QUESTIONS" (5): YES). What it reuses: `printInputsVersion` — the hash
 * the Maker's previews already carry — sent with every print PDF, kept by the
 * Save button, compared by the piece (lib/printed-stamp.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PRINT_VERSION_HEADER, changedSincePrinted, printedTarget } from './printed-stamp';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = '0e6a4f2c-1b2d-4c3e-8f9a-0b1c2d3e4f50';

test('the stamp names the piece and the event from the save’s own address', () => {
  assert.deepEqual(printedTarget(`/api/hub-print/set?event=${E}&mode=print&theme=classic`), { piece: 'set', eventId: E });
  assert.deepEqual(printedTarget(`/api/hub-print/passes?event=${E}&mode=print`), { piece: 'passes', eventId: E });
  assert.equal(printedTarget('/api/guest/pass-card'), null);
});

test('changed only when a save was seen AND the inputs moved on — never a false "changed"', () => {
  assert.equal(changedSincePrinted({ version: 'a', at: 'x' }, 'b'), true);
  assert.equal(changedSincePrinted({ version: 'a', at: 'x' }, 'a'), false);
  assert.equal(changedSincePrinted(null, 'b'), false, 'a browser that never saved it is told it changed');
  assert.equal(changedSincePrinted({ version: 'a', at: 'x' }, null), false, 'an unread version reads as changed');
});

test('every print PDF carries its version; the Save keeps it; the pieces show the notice', () => {
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /\.\.\.\(version \? \{ \[PRINT_VERSION_HEADER\]: version \} : \{\}\)/);
  assert.equal((route.match(/false, await printInputsVersion\(eventId\)\.catch\(\(\) => null\)\)/g) ?? []).length, 2, 'the ticket batch or the set/piece PDF lost its version');
  assert.equal(PRINT_VERSION_HEADER, 'x-print-version');
  const save = read('app/dashboard/[eventId]/launch/_components/print-save-button.tsx');
  assert.match(save, /if \(version && target\) writePrintedStamp\(target\.eventId, target\.piece, version\)/);
  const prints = read('app/dashboard/[eventId]/launch/_components/maker-prints.tsx');
  for (const piece of ['piece={k}', 'piece="set"', 'piece="passes"']) {
    assert.match(prints, new RegExp(`<ChangedSincePrinted eventId=\\{[^}]+\\} ${piece.replace(/[{}]/g, '\\$&')} version=\\{input\\.previewVersion\\} />`), `no notice on ${piece}`);
  }
  // Lazy, in the existing Maker details chunk (the Maker budget is at its ceiling).
  const lazy = readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/details-lazy.tsx'), 'utf8');
  assert.match(lazy, /export const ChangedSincePrinted = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/print-save-button'\)/);
});
