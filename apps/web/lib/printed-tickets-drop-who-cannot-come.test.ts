/**
 * 🎟 PRINTED TICKET BATCHES DROP WHO CAN'T COME (owner 2026-09-29, DECISION_LOG
 * "OWNER ANSWERS — TEN OPEN QUESTIONS" (9): *"Yes"* — the calling card · ticket ·
 * boarding · phone card batches print only guests who have a ticket).
 *
 * The rule is the Digital ticket's own (`filterPassCardRows`, executed in
 * the-pass-card-is-a-card.test.ts); this pins that the Printed ticket batch asks
 * it, that the free QR sheet (not a ticket) still lists everyone, and that the
 * rule as the batch applies it drops a decline, a declining bringer's plus-one
 * and a "+ TBA" seat.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { filterPassCardRows, type PassCardRow } from './pass-card';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the Printed ticket batch asks for tickets only; the free QR sheet does not', () => {
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /if \(piece === 'passes'\) \{\s*const \{ passes, images, measured \} = await loadGuestPasses\(set, \{ width: 600, ticketsOnly: true \}\)/);
  assert.match(route, /await loadGuestPasses\(set, \{ width: thumb \? 160 : 420, limit: thumb \? 12 : undefined \}\)/, 'the free QR sheet started dropping guests');
  const loader = read('lib/print-set.server.ts');
  const body = loader.slice(loader.indexOf('export async function loadGuestPasses('));
  assert.match(body, /const all = opts\.ticketsOnly\s*\?\s*filterPassCardRows\(listed,/, 'the batch no longer asks the ticket rule');
  assert.ok(body.indexOf('filterPassCardRows') < body.indexOf('for (const g of guests)'), 'the rule is applied after the QRs are drawn');
  for (const col of ['rsvp_status', 'plus_one_of_guest_id', 'plus_one_name_confirmed_at']) {
    assert.match(body.slice(0, body.indexOf('.eq(')), new RegExp(col), `${col} is not read — the rule reads undefined and keeps everyone`);
  }
});

test('as the batch applies it: a decline, a declining bringer’s plus-one and a "+ TBA" seat drop; the rest print', () => {
  const r = (o: Partial<PassCardRow> & { guest_id: string }): PassCardRow => ({ event_id: 'e', qr_token: 't', entry_source: 'host_seeded', rsvp_status: 'attending', ...o });
  const rows = [
    r({ guest_id: 'a' }),
    r({ guest_id: 'b', rsvp_status: 'declined' }),
    r({ guest_id: 'c', rsvp_status: 'declined' }),
    r({ guest_id: 'c1', plus_one_of_guest_id: 'c', rsvp_status: 'pending' }),
    r({ guest_id: 'a1', plus_one_of_guest_id: 'a', rsvp_status: 'pending' }),
    r({ guest_id: 'a2', plus_one_of_guest_id: 'a', tba: true }),
    r({ guest_id: 'p', rsvp_status: 'pending' }),
  ];
  assert.deepEqual(filterPassCardRows(rows).map((x) => x.guest_id), ['a', 'a1', 'p']);
});
