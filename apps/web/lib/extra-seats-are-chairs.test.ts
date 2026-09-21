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
  // One box per seat (owner 2026-09-21): planSeatNames fills seats and caps
  // new ones at what the couple gave — the reply can never mint extra seats.
  assert.match(rsvp, /const ops = planSeatNames\(seatNames, seats, plusOneSeats\(primary\)\);/, 'the RSVP does not use the seat plan, or does not cap it');
  assert.match(rsvp, /\.eq\('plus_one_of_guest_id', guestId\);/, 'a named seat is not scoped to this guest');
});

test('🔒 a finalized guest list locks extra seats — checked before saving, on every path', () => {
  // ⚖ Owner 2026-09-21 ("1. yes"): once the count is finalized, seats stop moving.
  const sync = read('lib', 'extra-seats-sync.ts');
  const at = sync.indexOf('export async function checkExtraSeats(');
  const body = sync.slice(at, sync.indexOf('\nexport async function', at + 1));
  assert.match(body, /guestListIsClosed\(\{/, 'the seat check no longer asks whether the list is closed');
  assert.match(body, /return \{ ok: false, error: GUEST_LIST_FINALIZED \};/, 'a closed list does not refuse a seat change');
  assert.match(body, /if \(evErr \|\| !ev\) return \{ ok: false/, 'an unreadable event is treated as open');
  // Keep writes with the ADMIN client, which the DB lock exempts — so it must ask.
  const keep = read(...G, 'claims', 'actions.ts');
  const check = keep.indexOf('checkExtraSeats(admin, eventId, guestId, chosen.plusOnes)');
  const write = keep.indexOf('.update({ plus_one_count: chosen.plusOnes');
  assert.ok(check > -1 && write > check, 'Keep saves extra seats on a finalized list');
  // And the roster stops offering the picker.
  const chip = read(...G, '_components', 'chip-editors.tsx');
  assert.match(chip, /const finalized = useContext\(GuestListFinalizedContext\);[\s\S]{0,400}if \(finalized\) \{/, 'the + picker is offered on a finalized list');
  assert.match(read(...G, 'page.tsx'), /listFinalized=\{finalize\.locked\}/, 'the roster is never told the list is finalized');
});
