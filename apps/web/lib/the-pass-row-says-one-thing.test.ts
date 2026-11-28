/**
 * the-pass-row-says-one-thing.test.ts — ☑ THE CHECKLIST'S PASS ROW AND ITS COUNT AGREE.
 *
 * Owner walk 2026-11-27 (MASTER-PLAN B9), the private Event Hub: "0 of 1 ready" stood beside a row titled "Your QR pass
 * saved" — two claims about one fact. Done-or-not is the tick's alone (`checklistProgress`, the one reader); the row's
 * words say what to do, and the save that lands ticks it (`savingTicks`, wired in `guest-checklist.tsx`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKLIST_PASS_TITLE, buildChecklist, checklistProgress, savingTicks } from './guest-checklist';

const PASS_ONLY = buildChecklist({
  wear: null,
  wearNote: null,
  arriveBy: null,
  venueName: null,
  mapsHref: null,
  tableLabel: null,
  passHref: '/api/guest/pass-card',
});

test('the pass row is a to-do: its words never claim it is saved', () => {
  assert.equal(PASS_ONLY.length, 1, 'anti-vacuity: no pass row');
  const row = PASS_ONLY[0]!;
  assert.equal(row.title, CHECKLIST_PASS_TITLE);
  assert.doesNotMatch(row.title, /\bsaved\b|✓|\bready\b|\bdone\b/i, `the row states its own status ("${row.title}") — the count beside it may disagree`);
});

test('one reader: unticked → "0 of 1", ticked → all set — and nothing else says otherwise', () => {
  assert.deepEqual(checklistProgress(PASS_ONLY, []), { ready: 0, total: 1, allSet: false });
  assert.deepEqual(checklistProgress(PASS_ONLY, ['pass']), { ready: 1, total: 1, allSet: true });
});

test('saving the pass ticks its row; no other row ticks itself', () => {
  assert.equal(savingTicks(PASS_ONLY[0]!), true);
  assert.equal(savingTicks({ key: 'arrive', link: { label: 'Open in Maps', href: 'https://maps.test' } }), false);
  assert.equal(savingTicks({ key: 'pass', link: null }), false);
  // The press that saves is wired to the tick, on the real component.
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'guest-checklist.tsx'), 'utf8');
  assert.match(src, /onSaved=\{savingTicks\(item\) \? \(\) => toggle\(item\.key, true\) : undefined\}/, 'Save to Photos no longer ticks the pass row');
});
