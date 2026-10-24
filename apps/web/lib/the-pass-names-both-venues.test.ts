/**
 * 🎟 THE PASS NAMES BOTH VENUES (owner 2026-10-25: *"there are 2 venues. why did I only see 1 venue on the event card?"*).
 *
 * The card's date / time / venue lines read `ceremonyVenue` only, so an event with a Ceremony and a Reception printed one place.
 * Now (`passMetaLines`): two different venues → "Ceremony · …" and "Reception · …", each on its own line; one venue stays as it was.
 * Executed on the SHIPPED layout (`layoutPasses`, the route's own call) — both places reach the card's ink, no word cut.
 *
 * SABOTAGE (seen RED, then restored): the meta lines back to `[date, Ceremony <time>, ceremonyVenue]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { printLookFor } from './print-pieces';
import { layoutPasses, passMetaLines, type PrintOp } from './print-layout';
import { STRESS_ROWS, stressEvent } from './printed-pass-stress.fixture';

const CEREMONY = 'Santuario de San Vicente de Paul Parish';
const RECEPTION = 'Seda Hotel Vertis North';

test('two venues: both on the event pass, labelled; one venue: as before', () => {
  const two = { dateLabel: 'Saturday · December 12, 2026', ceremonyTime: '3:00 PM', ceremonyVenue: CEREMONY, receptionTime: '6:00 PM', receptionVenue: RECEPTION };
  assert.deepEqual(passMetaLines(two), ['Saturday · December 12, 2026', `Ceremony · 3:00 PM · ${CEREMONY}`, `Reception · 6:00 PM · ${RECEPTION}`]);
  assert.deepEqual(passMetaLines(two, true), ['Saturday · December 12, 2026', `Ceremony · ${CEREMONY}`, `Reception · ${RECEPTION}`]);
  const one = { ...two, receptionVenue: null };
  assert.deepEqual(passMetaLines(one), ['Saturday · December 12, 2026', 'Ceremony 3:00 PM', CEREMONY], 'one venue no longer prints as before');

  /* On the drawn calling card: every word of both places is in the ink. */
  const data = { ...stressEvent({ long: false, logo: false, still: false, nfc: false, round: false, mark: false }), ...two };
  const doc = layoutPasses({ look: printLookFor('house'), data, mode: 'print', foil: false, format: 'calling-card' }, [STRESS_ROWS.find((r) => r.key === 'no-table')!.pass])[0]!;
  const lines = doc.ops.map((o: PrintOp) => (o.t === 'path' && o.text ? o.text.s : '')).filter(Boolean);
  const ink = lines.join(' ');
  for (const word of [...CEREMONY.split(' '), ...RECEPTION.split(' '), 'Ceremony', 'Reception']) assert.ok(ink.includes(word), `"${word}" is not on the pass: ${ink}`);
  assert.ok(!lines.some((l) => /Ceremony|Reception|Santuario|Seda|Parish|North/.test(l) && l.includes('…')), 'a venue was cut on the pass');
});
