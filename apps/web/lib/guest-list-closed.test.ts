/**
 * The guest list is closed ONLY when the host pressed Finalize.
 *
 * ⚖ Owner, 2026-09-30: *"i must click a finalize to finalize it."* Until that
 * date the list closed itself at the reply-by date, or at `event_date − 14 days`
 * when none was set, and a birthday created ON its own day was therefore closed
 * the moment it existed ("Birthday Salubong ni Ate": 0 guests, every add
 * refused, on the night of the party).
 *
 * These cases pin the rule and are also the sabotage for it: put any date leg
 * back into `guestListIsClosed` and the same-day and past-deadline cases fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guestListIsClosed } from './guest-list-closed';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

test('stamped (the host pressed Finalize) → closed', () => {
  assert.equal(guestListIsClosed({ lockedAt: '2026-09-30T10:00:00Z' }), true);
});

test('not stamped → open, whatever the calendar says', () => {
  assert.equal(guestListIsClosed({ lockedAt: null }), false);
  assert.equal(guestListIsClosed({ lockedAt: undefined }), false);
  assert.equal(guestListIsClosed({ lockedAt: '' }), false);
});

test('the input has no date in it — a date cannot close the list', () => {
  // A date field on the input is how the date rule would come back. Pinned by
  // the type's source, so re-adding `editDeadline` / `eventDate` fails here.
  const src = read('guest-list-closed.ts');
  const sig = src.slice(src.indexOf('export function guestListIsClosed'));
  assert.doesNotMatch(
    sig.slice(0, sig.indexOf('{\n')),
    /editDeadline|eventDate|nowMs|Date/,
    'guestListIsClosed takes a date again: only the Finalize stamp may close the list',
  );
  assert.doesNotMatch(src, /FINALIZE_LEAD_DAYS|guestListDeadlineEndMs/, 'the retired date helpers are back');
});

test('the finalize state is a READ — nothing on a page load may write the stamp', () => {
  const pax = read('pax.ts');
  const body = pax.slice(
    pax.indexOf('export async function readFinalizeState'),
    pax.indexOf('export type FinalizeResult'),
  );
  assert.ok(body.length > 0, 'readFinalizeState moved; re-anchor this guard');
  assert.doesNotMatch(body, /\.update\(|createAdminClient\(/, 'readFinalizeState writes again: a page load would finalize the list');
  assert.doesNotMatch(pax, /export async function ensureFinalized/, 'the lazy auto-finalize is back');
});

test('the stamp is written only behind the host fence', () => {
  const pax = read('pax.ts');
  for (const fn of ['finalizeGuestList', 'reopenGuestList']) {
    const at = pax.indexOf(`export async function ${fn}`);
    assert.ok(at >= 0, `${fn} is gone`);
    const body = pax.slice(at, pax.indexOf('\n}\n', at));
    const fence = body.indexOf('callerHostsEvent(');
    const write = body.indexOf('.update(');
    assert.ok(fence >= 0 && write > fence, `${fn} writes the stamp before (or without) checking the caller hosts the event`);
  }
});
