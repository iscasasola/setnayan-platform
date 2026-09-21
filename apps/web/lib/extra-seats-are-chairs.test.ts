import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * ⚖ Owner 2026-09-21: "decision. yes. + will have seats beside the person
 * invited." The planner is pinned by lib/extra-seats.test.ts; this pins that
 * EVERY way a +N is set actually makes the seats, and that the guest's RSVP
 * fills one instead of adding another.
 */
const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));
const G = ['app', 'dashboard', '[eventId]', 'guests'];

test('every writer of a +N makes the seats', () => {
  for (const [what, src] of [
    ['the Seat-column picker + quick-add', read(...G, 'inline-actions.ts')],
    ['the guest-detail form', read(...G, '[guestId]', 'actions.ts')],
    ['the add-guest form', read(...G, 'new', 'actions.ts')],
    ['CSV import', read(...G, 'import', 'actions.ts')],
  ] as const) {
    assert.match(src, /syncExtraSeats\(supabase, eventId, /, `${what} sets a +N and makes no seats`);
  }
  // The picker and quick-add are two writers in one file.
  assert.equal((read(...G, 'inline-actions.ts').match(/syncExtraSeats\(supabase, eventId, guestId\)/g) ?? []).length, 2);
});

test('🔒 going below a NAMED plus-one is refused before anything is saved', () => {
  const inline = read(...G, 'inline-actions.ts');
  const at = inline.indexOf('export async function setGuestPlusOneCount(');
  const body = inline.slice(at, inline.indexOf('\nexport async function', at + 1));
  const check = body.indexOf('checkExtraSeats(');
  const write = body.indexOf(".update({ plus_one_count: count");
  assert.ok(check > -1 && write > check, 'the picker saves before asking whether a named plus-one would be cut');
});

test('the seats are seated BESIDE the guest', () => {
  const sync = read('lib', 'extra-seats-sync.ts');
  assert.match(sync, /plus_one_of_guest_id: primary\.guest_id/, 'a seat is not linked to the guest who brings it');
  assert.match(sync, /applyReconcileForEvent\(supabase, eventId, \{ reseatGuestIds: \[primary\.guest_id\] \}\)/, 'the seats are made but never placed beside the guest');
});

test('a guest naming their plus-one fills a seat — never adds one', () => {
  const rsvp = read('app', '[slug]', 'actions.ts');
  const at = rsvp.indexOf("from('guests')\n        .select('guest_id, first_name, plus_one_name_confirmed_at, created_at')");
  assert.ok(at > -1, 'the RSVP no longer reads every seat');
  const window = rsvp.slice(at, at + 600);
  assert.match(window, /\.is\('deleted_at', null\)/, 'removed seats are counted again');
  assert.ok(!/\.eq\('plus_one_of_guest_id', guestId\)\s*\.maybeSingle\(\)/.test(rsvp), 'maybeSingle on the seats is back — two seats read as none, and every RSVP adds another');
  assert.match(rsvp, /seatToName\(seats\)/, 'the RSVP does not fill the open seat');
});
