/**
 * 🛑 NO "ALL PAID" WITHOUT A BOOKING (THE ONE BUILD, 8 Nov 2026 · spec §4 + §9 #22 · slice plan 3 D3).
 *
 * The prototype's Details drew "Paid ₱0 · Balance ₱0 · all paid" for a client who had not booked — a false green: they
 * owe nothing because nothing is booked. Not booked shows Quote · Schedules "—" · Event day ("they asked"). And a
 * booking with no amount set, an unread ledger, or money on a frozen plan never says "all paid" either.
 *
 * SABOTAGE (done once, 8 Nov): returning the booked cells for an unbooked client → test 1 RED; dropping the
 * `expectedPhp <= 0` branch → test 3 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';
import { detailsNumbers, type DetailsNumbersInput } from './_components/details-numbers';

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
const base: DetailsNumbersInput = {
  isBooked: false,
  todayIso: '2026-11-07',
  eventDate: '2026-11-08',
  ledger: { receivedPhp: 0, expectedPhp: 0 },
  onPlan: false,
  sentQuotePhp: undefined,
  peso,
};
const words = (i: DetailsNumbersInput) => detailsNumbers(i).map((c) => `${c.label}|${c.value}|${c.sub}`);
const said = (i: DetailsNumbersInput) => words(i).join(' ');

test('1 · a client with NO booking: Quote · Schedules "—" · Event day — never Paid, Balance or "all paid"', () => {
  assert.deepEqual(words(base), ['Quote|—|not sent', 'Schedules|—|none yet', 'Event day|8 Nov|they asked']);
  assert.deepEqual(words({ ...base, sentQuotePhp: 40000 }), ['Quote|₱40,000|sent', 'Schedules|—|none yet', 'Event day|8 Nov|they asked']);
  assert.equal(words({ ...base, sentQuotePhp: null })[0], 'Quote|—|couldn’t load');
  // Whatever the ledger says, an unbooked client is never "all paid".
  for (const ledger of [null, { receivedPhp: 0, expectedPhp: 0 }, { receivedPhp: 5000, expectedPhp: 5000 }]) {
    assert.doesNotMatch(said({ ...base, ledger }), /all paid|Paid|Balance/);
  }
});

test('2 · a booked client: Paid · Balance · Event day', () => {
  const booked = { ...base, isBooked: true, ledger: { receivedPhp: 0, expectedPhp: 38000 } };
  assert.deepEqual(words(booked), ['Paid|₱0|received', 'Balance|₱38,000|to collect', 'Event day|8 Nov|tomorrow']);
  assert.deepEqual(words({ ...booked, ledger: { receivedPhp: 38000, expectedPhp: 38000 } }).slice(0, 2), [
    'Paid|₱38,000|received',
    'Balance|₱0|all paid',
  ]);
  assert.equal(words({ ...booked, todayIso: '2026-11-08' })[2], 'Event day|8 Nov|today');
  assert.equal(words({ ...booked, todayIso: '2026-11-10' })[2], 'Event day|8 Nov|done');
});

test('3 · "all paid" only when an amount was set AND it is all received', () => {
  const booked = { ...base, isBooked: true };
  assert.equal(words({ ...booked, ledger: { receivedPhp: 0, expectedPhp: 0 } })[1], 'Balance|—|no amount set');
  assert.deepEqual(words({ ...booked, ledger: null }).slice(0, 2), ['Paid|—|couldn’t load', 'Balance|—|couldn’t load']);
  assert.deepEqual(words({ ...booked, onPlan: true }).slice(0, 2), ['Paid|—|on Payment', 'Balance|—|on Payment']);
});

test('4 · the client page feeds Details these numbers from facts it already read', () => {
  const page = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8'));
  assert.match(page, /const numbersCells = detailsNumbers\(\{\s*isBooked,/);
  assert.match(page, /ledger: ledgerUnreadable \? null :/, 'an unread ledger must reach the numbers as unread');
  assert.match(page, /sentQuotePhp: proposalRowsError \? null :/, 'an unread quote list must reach the numbers as unread');
  assert.match(page, /\{pipelineBlock\}\s*<DetailsNumbersRow cells=\{numbersCells\} \/>/, 'the numbers sit under the stage strip');
});
