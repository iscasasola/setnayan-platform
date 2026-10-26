/**
 * reset-makes-the-invitation-fresh.test.ts — 🔄 RESET beside Delete on the guest card (owner 2026-10-26, verbatim: *"So at
 * the bottom, have (RESET) (DELETE)"*), after a dry run on his own guest list: the guest's invitation must feel as if it
 * was never used — and Undo must put back exactly what was there.
 *
 * Held here, executed on a guest shaped like the owner's dry run (an answer the GUEST gave, a name they typed for
 * themselves, a +1 they named, a waiting song) beside a host-named +1 and an account-held one:
 *   1. Reset clears EXACTLY the reply's columns on the guest's row, and keeps every other column (name, side, role,
 *      table, the couple's notes, the mobile, `invitation_sent_at`, the QR key, the "+N").
 *   2. Only the seats the REPLY named go back to "+N · TBA" — a host-named seat and an account-held one are untouched —
 *      and they are un-named, never deleted (a guest's "+N" is their rows).
 *   3. Undo writes back exactly the snapshot: the row and the seats equal what they were, column for column.
 *   4. A crafted Undo payload is refused whole (another guest, a made-up answer, a meal that is not one, a long text).
 *   5. The writes: one host reply write (`setGuestRsvp(…, { fresh: true })`, +0 server actions) behind the limited-helper
 *      gate; the row through the couple's RLS client with a zero-row check; songs only `pending` + `origin = 'guest'`,
 *      restored as pending; no `invitation_sent_at`, `notes`, `mobile` or `qr_token` in any write; the Undo through
 *      `restoreGuestRsvpAndSeat` after the same gate.
 *   6. The card: Reset first, Delete second, side by side, only on a guest's own card (never the couple, never a +1).
 *
 * SABOTAGE (each seen RED, then restored): `display_name` dropped from `freshGuestWrite` → tests 1, 3, 4 red · Reset
 * called before the limited-helper gate in `setGuestRsvp` → test 5 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  FRESH_GUEST_COLUMNS,
  FRESH_SEAT_COLUMNS,
  freshBeforeIsValid,
  freshGuestRestore,
  freshGuestWrite,
  freshResetHasWork,
  freshSeatRestore,
  freshSeatWrite,
  seatsTheGuestNamed,
  type FreshBefore,
  type FreshSeatBefore,
} from '@/lib/guest-fresh-reset';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const G = '9632d9d0-79ac-4e14-a00e-2f15cef07b18';
const SEAT_GUEST = '31d4a5e2-27e5-46b6-900d-dc8c3aa75bf2';
const SEAT_HOST = '33c5e790-e2f0-4bab-81c9-d8c9d445a371';
const SEAT_LINKED = '47d5cbbf-c72d-4437-9b33-8b72559196ae';

/** The guest's row after their reply (the dry run): what the reply wrote, and what the host's info is. */
const guestRow = () => ({
  guest_id: G,
  first_name: 'Juanita',
  last_name: 'Sacdalan',
  side: 'bride',
  role: 'guest',
  notes: 'the couple’s own note',
  mobile: '09171234567',
  invitation_sent_at: '2026-10-25T12:00:00.000Z',
  qr_token: 'tok-unchanged',
  plus_one_count: 1,
  rsvp_status: 'attending' as const,
  rsvp_responded_at: '2026-10-26T01:50:54.905Z',
  rsvp_set_by: 'guest' as const,
  meal_preference: 'fish' as const,
  dietary_restrictions: 'no nuts',
  guest_note: 'see you there',
  display_name: 'Jhgf',
  face_tagging_wanted: true,
  plus_one_name: 'Ggvv Vfh',
  plus_one_name_confirmed_at: null,
});

const seat = (id: string, over: Partial<FreshSeatBefore>, i: number) => ({
  guest_id: id,
  first_name: 'Ggvv',
  last_name: 'Vfh',
  name_prefix: null,
  middle_name: null,
  name_suffix: null,
  display_name: null,
  plus_one_name_confirmed_at: '2026-10-26T01:50:54.905Z',
  rsvp_status: 'attending' as const,
  rsvp_responded_at: '2026-10-26T01:50:54.905Z',
  rsvp_set_by: 'guest' as const,
  meal_preference: null,
  dietary_restrictions: null,
  seat_index: i,
  plus_one_of_guest_id: G,
  side: 'bride',
  ...over,
});

const apply = <T extends Record<string, unknown>>(row: T, write: Record<string, unknown>): T => ({ ...row, ...write });

test('1 · Reset clears exactly the reply’s columns on the guest’s row and keeps every other column', () => {
  const before = guestRow();
  const after = apply(before, freshGuestWrite());
  assert.deepEqual(Object.keys(freshGuestWrite()).sort(), [...FRESH_GUEST_COLUMNS].sort(), 'Reset writes exactly the listed columns');
  assert.equal(after.rsvp_status, 'pending');
  for (const c of FRESH_GUEST_COLUMNS.filter((c) => c !== 'rsvp_status')) assert.equal(after[c], null, `${c} is cleared`);
  for (const kept of ['first_name', 'last_name', 'side', 'role', 'notes', 'mobile', 'invitation_sent_at', 'qr_token', 'plus_one_count', 'guest_id'] as const) {
    assert.equal(after[kept], before[kept], `${kept} is kept`);
  }
});

test('2 · only the seats the REPLY named go back to "+N · TBA" — never deleted, never a host’s or an account’s', () => {
  const seats = [
    seat(SEAT_GUEST, {}, 0),
    seat(SEAT_HOST, { rsvp_set_by: null, first_name: 'Named', last_name: 'ByHost' }, 1),
    seat(SEAT_LINKED, {}, 2),
  ];
  const named = seatsTheGuestNamed(seats, new Set([SEAT_LINKED]));
  assert.deepEqual(named.map((s) => s.guest_id), [SEAT_GUEST], 'only the guest-named, unlinked seat');
  const after = apply(named[0]!, freshSeatWrite(named[0]!.seat_index));
  assert.deepEqual(Object.keys(freshSeatWrite(0)).sort(), [...FRESH_SEAT_COLUMNS].sort());
  assert.equal(after.first_name, 'TBA');
  assert.equal(after.last_name, '+1');
  assert.equal(after.display_name, '+1 · TBA');
  assert.equal(after.plus_one_name_confirmed_at, null);
  assert.equal(after.rsvp_status, 'pending');
  assert.equal(after.rsvp_set_by, null);
  assert.equal(after.plus_one_of_guest_id, G, 'the seat is still theirs');
  assert.equal(after.side, 'bride', 'the seat keeps the side');
  assert.equal(freshSeatWrite(2).display_name, '+3 · TBA', 'numbered by seat');
  assert.ok(!('deleted_at' in freshSeatWrite(0)), 'a seat is un-named, never deleted');
});

test('3 · Undo writes back exactly what was there — the row and the seats, column for column', () => {
  const before = guestRow();
  const s0 = seat(SEAT_GUEST, { meal_preference: 'beef', dietary_restrictions: 'vegan-ish' }, 0);
  const snap: FreshBefore = {
    guest: Object.fromEntries([['guest_id', G], ...FRESH_GUEST_COLUMNS.map((c) => [c, before[c]])]) as FreshBefore['guest'],
    seats: [Object.fromEntries(Object.entries(s0).filter(([k]) => k !== 'plus_one_of_guest_id' && k !== 'side')) as FreshSeatBefore],
    songs: [{ request_id: '0b5df9ee-0000-4000-8000-000000000001', song_id: 42, requester_name: null, created_at: '2026-10-26T01:51:00.000Z' }],
  };
  assert.ok(freshResetHasWork(snap));
  assert.ok(freshBeforeIsValid(snap, G), 'a true snapshot is accepted');
  const reset = apply(before, freshGuestWrite());
  assert.deepEqual(apply(reset, freshGuestRestore(snap.guest)), before, 'the row is exactly as it was');
  const seatReset = apply(s0, freshSeatWrite(0));
  assert.deepEqual(apply(seatReset, freshSeatRestore(snap.seats[0]!)), s0, 'the seat is exactly as it was');
  // Nothing to reset → no work (the card says so instead of writing).
  const fresh: FreshBefore = { guest: { ...snap.guest, ...freshGuestWrite() }, seats: [], songs: [] };
  assert.equal(freshResetHasWork(fresh), false);
});

test('4 · a crafted Undo payload is refused whole', () => {
  const ok: FreshBefore = { guest: { guest_id: G, ...freshGuestWrite() }, seats: [], songs: [] };
  assert.ok(freshBeforeIsValid(ok, G));
  assert.equal(freshBeforeIsValid({ ...ok, guest: { ...ok.guest, guest_id: SEAT_HOST } }, G), false, 'another guest');
  assert.equal(freshBeforeIsValid({ ...ok, guest: { ...ok.guest, rsvp_status: 'yes' as never } }, G), false, 'a made-up answer');
  assert.equal(freshBeforeIsValid({ ...ok, guest: { ...ok.guest, meal_preference: 'pizza' as never } }, G), false, 'not a meal');
  assert.equal(freshBeforeIsValid({ ...ok, guest: { ...ok.guest, guest_note: 'x'.repeat(5000) } }, G), false, 'a long text');
  assert.equal(freshBeforeIsValid({ ...ok, guest: { ...ok.guest, rsvp_set_by: 'admin' as never } }, G), false, 'a made-up setter');
  assert.equal(freshBeforeIsValid({ ...ok, seats: [{ ...seat(G, {}, 0) }] as never }, G), false, 'the guest as their own seat');
  assert.equal(freshBeforeIsValid({ ...ok, songs: [{ request_id: 'nope', song_id: 1, requester_name: null, created_at: 'x' }] }, G), false, 'a bad song');
  // An extra column in the payload is never written: the restore writes only the listed columns.
  const sneaky = { ...ok.guest, notes: 'overwritten', invitation_sent_at: null } as unknown as FreshBefore['guest'];
  assert.deepEqual(Object.keys(freshGuestRestore(sneaky)).sort(), [...FRESH_GUEST_COLUMNS].sort());
});

test('5 · the writes: one gated host reply write, the row through RLS, songs only waiting ones, nothing the host owns', () => {
  const src = read('../inline-actions.ts');
  const set = src.slice(src.indexOf('export async function setGuestRsvp('), src.indexOf('export async function restoreGuestRsvpAndSeat('));
  const gate = set.indexOf("limitedHelperRefusal(eventId, 'guest_list')");
  const fresh = set.indexOf('resetGuestToFresh(');
  assert.ok(gate > 0 && fresh > gate, 'Reset runs only after the limited-helper gate (its FIRST call, not just one)');
  assert.equal(set.split('resetGuestToFresh(').length - 1, 1, 'one way into Reset');
  const restore = src.slice(src.indexOf('export async function restoreGuestRsvpAndSeat('));
  const rGate = restore.indexOf("limitedHelperRefusal(eventId, 'guest_list')");
  const rFresh = restore.indexOf('restoreGuestFresh(');
  assert.ok(rGate > 0 && rFresh > rGate, 'the Undo runs only after the same gate');
  const reset = src.slice(src.indexOf('async function resetGuestToFresh('), src.indexOf('async function restoreGuestFresh('));
  assert.match(reset, /\.update\(\{ \.\.\.freshGuestWrite\(\), updated_at: now \}\)[\s\S]*?\.select\('guest_id'\)/, 'the row is written through the couple client and read back');
  assert.match(reset, /if \(!wrote \|\| wrote\.length === 0\) return \{ ok: false/, 'a zero-row write is a refusal, never "saved"');
  assert.ok(reset.indexOf('freshGuestWrite()') < reset.indexOf(".from('event_song_requests')\n      .delete()"), 'songs are touched only after the RLS write landed');
  assert.match(reset, /\.eq\('origin', 'guest'\)\s*\.eq\('status', 'pending'\)/, 'only the guest’s own waiting songs');
  assert.match(reset, /\.eq\('plus_one_of_guest_id', guestId\)/, 'a seat write is confined to their seats');
  const restoreFresh = src.slice(src.indexOf('async function restoreGuestFresh('));
  assert.match(restoreFresh, /freshBeforeIsValid\(fresh, guestId\)/, 'the Undo payload is re-checked');
  assert.match(restoreFresh, /status: 'pending'/, 'a song comes back waiting, never decided');
  for (const owned of ['invitation_sent_at', 'notes:', 'mobile', 'qr_token']) {
    assert.ok(!reset.includes(owned) && !restoreFresh.slice(0, restoreFresh.indexOf('\n}\n')).includes(owned), `Reset never writes ${owned}`);
  }
  assert.doesNotMatch(src, /export async function resetGuest/, '+0 server actions — Reset rides the host reply write');
});

test('6 · the card: Reset first, Delete second, side by side, on a guest’s own card only', () => {
  const parts = read('guest-ticket-parts.tsx');
  const control = parts.slice(parts.indexOf('export function GuestDeleteControl('));
  const r = control.indexOf('data-guest-reset=""');
  const d = control.indexOf('data-guest-delete=""');
  assert.ok(r > 0 && d > r, 'Reset is drawn before Delete');
  assert.match(control, /className=\{resettable && !seatWithNoName \? 'grid grid-cols-2 gap-2' : undefined\}/, 'two equal buttons side by side');
  assert.match(control, /<GuestResetFlow eventId=\{eventId\} guestId=\{guestId\}/);
  const body = read('guest-card-body.tsx');
  assert.match(body, /const canReset = !isCouple && !guest\.plus_one_of_guest_id;/, 'never the couple, never a +1 seat');
  assert.match(body, /resettable=\{canReset\}/);
  const flow = read('guest-reset.tsx');
  assert.match(flow, /setGuestRsvp\(eventId, \[guestId\], 'pending', \{ fresh: true \}\)/);
  assert.match(flow, /pushUndo\(\{[\s\S]*restoreGuestRsvpAndSeat\(eventId, \[\], null, fresh\)/, 'Undo right after, in the same toast');
  assert.match(flow, /const \{ setGuestRsvp, restoreGuestRsvpAndSeat \} = useGuestActions\(\);/, 'through the context — the lab’s stand-ins answer there');
});
