/**
 * 🚪 "THEIR EVENT" (owner 2026-11-21; drawing `prototypes/their_event_door_2026-11-21/their_event_door_fable.html`,
 * "Default links per trade") — the list a booked supplier sees, held to the owner's table and to the server's gates.
 *
 *   1 · every trade starts with exactly the owner's links (Schedule · Logo · Numbers for everybody, then its own);
 *   2 · THE CAP: a supplier never gets Payments or Memories, Budget at most View — in the list, in the TS resolver, and
 *       in the migration's SQL;
 *   3 · a part the server would refuse is never drawn as a door (Seats off the floor list; Guests with no group);
 *   4 · the hosts' extra grant adds a part; Edit reads "Propose" (a supplier never writes);
 *   5 · the Logo is a plain download; the last row is always "Ask for access to more";
 *   6 · the part page and the customer page / chat mount the SAME list, and Guests read only `supplier_booking_group`;
 *   7 · a supplier's edit to their OWN schedule item applies at once; anything else waits;
 *   8 · Ask for access left the chat ＋.
 *
 * SABOTAGE (each turns this file red): add 'payments' to a trade · drop the `proposesOnly && (payments|photos)` line in
 * `seatAreaLevel` · let `editsOwnItem` accept 'new' · put the ＋ access row back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASK_FOR_MORE,
  GROUP_NOT_YOURS,
  GROUP_NOT_YOURS_LINE,
  TRADE_PARTS,
  defaultParts,
  groupDriftWords,
  supplierAreaCap,
  theirEventRows,
  tradeOf,
  type TheirEventInput,
} from './their-event';
import { DELEGATE_AREA_LABEL, seatAreaLevel, type ModeratorPermissions } from './delegate-areas';
import { editsOwnItem } from './supplier-schedule';
import { supplierPlusRows } from './chat-plus';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '../..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const base = (over: Partial<TheirEventInput>): TheirEventInput => ({
  eventId: 'e1',
  category: null,
  grants: {},
  logoHref: 'data:image/svg+xml;utf8,%3Csvg%2F%3E',
  tables: 19,
  group: { label: 'Special meals', count: 14 },
  ...over,
});
const parts = (over: Partial<TheirEventInput>) => theirEventRows(base(over)).map((r) => r.part);

test('1 · each trade starts with the owner’s links — everybody: Schedule · Logo · Numbers', () => {
  assert.deepEqual(parts({ category: 'catering' }), ['schedule', 'logo', 'numbers', 'guests', 'seats']);
  assert.deepEqual(parts({ category: 'venue' }), ['schedule', 'logo', 'numbers', 'guests', 'seats', 'mood_board']);
  assert.deepEqual(parts({ category: 'reception_decor', services: ['stylist_decorator'] }), ['schedule', 'logo', 'numbers', 'guests', 'seats', 'mood_board']);
  assert.deepEqual(parts({ category: 'makeup_artist' }), ['schedule', 'logo', 'numbers', 'guests']);
  assert.deepEqual(parts({ category: 'florist' }), ['schedule', 'logo', 'numbers', 'seats', 'mood_board']);
  assert.deepEqual(parts({ category: 'lights_and_sound' }), ['schedule', 'logo', 'numbers', 'seats', 'mood_board']);
  assert.deepEqual(parts({ category: 'photographer' }), ['schedule', 'logo', 'numbers', 'guests', 'mood_board']);
  assert.deepEqual(parts({ category: 'band_dj' }), ['schedule', 'logo', 'numbers']);
  assert.deepEqual(parts({ category: 'invitations_stationery' }), ['schedule', 'logo', 'numbers', 'guests', 'hub']);
  assert.deepEqual(parts({ category: 'cake_maker' }), ['schedule', 'logo', 'numbers']);
  assert.deepEqual(parts({ category: 'transportation' }), ['schedule', 'logo', 'numbers']);
  assert.equal(tradeOf('photographer'), 'photo_video');
  assert.deepEqual(defaultParts('photo_video'), ['schedule', 'logo', 'numbers', 'guests', 'mood_board']);
});

test('2 · THE CAP — never Payments or Memories, Budget at most View, in TS and in the SQL resolver', () => {
  for (const t of Object.values(TRADE_PARTS)) {
    for (const p of t) assert.ok(!['payments', 'photos', 'budget', 'memories'].includes(p), `a trade opens ${p}`);
  }
  assert.equal(supplierAreaCap('payments', 'view'), null);
  assert.equal(supplierAreaCap('photos', 'edit'), null);
  assert.equal(supplierAreaCap('budget', 'edit'), 'view');
  assert.equal(supplierAreaCap('guest_list', 'view'), 'view');
  const seat: ModeratorPermissions = { edit_all: true, checkout: false, invite_hosts: false, remove_hosts: false, areas: { payments: 'view', photos: 'view', budget: 'view', guest_list: 'edit' } };
  assert.equal(seatAreaLevel(seat, 'payments', true), null, 'a supplier seat opens Payments');
  assert.equal(seatAreaLevel(seat, 'photos', true), null, 'a supplier seat opens Memories');
  assert.equal(seatAreaLevel(seat, 'guest_list', true), 'view', 'a supplier writes');
  assert.equal(seatAreaLevel(seat, 'payments', false), 'view', 'the cap hit a seat that is not a supplier’s');
  const sql = readFileSync(join(REPO, 'supabase/migrations/20271357741892_the_their_event_door.sql'), 'utf8');
  const both = sql.match(/AND p_area IN \('payments', 'photos'\)\s+AND public\.supplier_proposes_only_for\(p_event_id, s\.user_id\)\s+THEN NULL/g) ?? [];
  assert.equal(both.length, 2, 'moderator_area_level and moderator_area_level_of must both carry the cap');
  // The SQL this migration replaces must be the NEWEST definition — a later file would undo the cap.
  const dir = join(REPO, 'supabase/migrations');
  const newest = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => readFileSync(join(dir, f), 'utf8').includes('FUNCTION public.moderator_area_level(')).pop();
  assert.equal(newest, '20271357741892_the_their_event_door.sql');
});

test('3 · a part the server would refuse is never a door', () => {
  // A category OFF the seat-plan floor list never shows Seats, even granted (the RPC would refuse it); one ON it does.
  assert.ok(parts({ category: 'cake_maker', grants: { seat_plan: 'view' } }).includes('seats'));
  assert.ok(!parts({ category: 'transportation', grants: { seat_plan: 'view' } }).includes('seats'));
  const noGroup = theirEventRows(base({ category: 'catering', group: null })).find((r) => r.part === 'guests')!;
  assert.equal(noGroup.href, null, 'Guests with no group is drawn as a door');
  assert.equal(noGroup.line, 'One group · the hosts have not filled it yet');
  // 🔒 The group has three readers — the shop's owner, a Shop Manager, the person who handles this client (ship review,
  // 22 Nov 2026). Anybody else on the team is TOLD so: never "the hosts have not filled it yet", never a door.
  const notYours = theirEventRows(base({ category: 'catering', group: null, groupNotYours: true })).find((r) => r.part === 'guests')!;
  assert.equal(notYours.href, null, 'a group that is not theirs to read is drawn as a door');
  assert.equal(notYours.line, GROUP_NOT_YOURS_LINE);
  assert.doesNotMatch(notYours.line, /not filled/);
  const read = code('lib/their-event.server.ts');
  assert.match(read, /r\.status === 'not_your_client'/, 'the read drops the refusal — it would then be said as "couldn’t load"');
  assert.match(read, /groupNotYours: group\?\.status === 'not_your_client',/);
  const page = code('app/vendor-dashboard/clients/[eventId]/_components/their-event-parts.tsx');
  const refused = page.indexOf("group.status === 'not_your_client'");
  assert.ok(refused > 0 && refused < page.indexOf("group.status !== 'ok'"), 'the Guests page says "not filled yet" to somebody who may not read the group');
  assert.match(page.slice(refused, refused + 200), /\{GROUP_NOT_YOURS\}/);
  assert.match(GROUP_NOT_YOURS, /owner.*Shop Manager.*handles this client/);
  const noLogo = theirEventRows(base({ logoHref: null })).find((r) => r.part === 'logo')!;
  assert.equal(noLogo.href, null);
});

test('4 · the hosts add a part through the seat; Edit reads "Propose"', () => {
  assert.ok(parts({ category: 'cake_maker', grants: { mood_board: 'view' } }).includes('mood_board'));
  // A grant the cap refuses adds nothing.
  assert.deepEqual(parts({ category: 'cake_maker', grants: { photos: 'view', payments: 'view', budget: 'view' } }), ['schedule', 'logo', 'numbers']);
  const seats = theirEventRows(base({ category: 'catering', grants: { seat_plan: 'edit' } })).find((r) => r.part === 'seats')!;
  assert.equal(seats.trail, 'Propose');
});

test('5 · the Logo is a plain download; the Schedule edits only "yours"', () => {
  const rows = theirEventRows(base({ category: 'catering' }));
  const logo = rows.find((r) => r.part === 'logo')!;
  assert.equal(logo.download, true);
  assert.match(logo.href!, /^data:image\/svg\+xml/);
  assert.equal(rows.find((r) => r.part === 'schedule')!.trail, 'Yours: edit');
  assert.equal(ASK_FOR_MORE, 'Ask for access to more');
  assert.match(code('app/vendor-dashboard/clients/[eventId]/_components/their-event-list.tsx'), /\{ASK_FOR_MORE\}/);
  assert.equal(groupDriftWords(14, 14), 'Matches the 14 booked.');
  assert.match(groupDriftWords(17, 14)!, /^3 more than the 14 booked\. The price changes only through the quote\.$/);
});

test('6 · ONE list, mounted on the customer page and in the chat; Guests read only the booking group', () => {
  const page = code('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /isBooked && !theBookedCoordinator && feeGate\.stage === 'unlocked'\s*\?\s*await readTheirEvent\(/, 'the coordinator or a locked supplier gets the list');
  assert.match(page, /\{tab === 'overview' && feeUnlocked \? theirEventNode : null\}/);
  assert.match(page, /<div id="ask-access"/, 'Ask for access to more lands nowhere');
  assert.match(code('app/vendor-dashboard/clients/[eventId]/_pages/chat.tsx'), /<TheirEventList eventId=\{ctx\.eventId\} rows=\{ctx\.theirEventRows\} \/>/);
  const part = code('app/vendor-dashboard/clients/[eventId]/their-event/[part]/page.tsx');
  assert.match(part, /if \(brief\.stage !== 'booked'\) redirect\(clientHref\);/);
  assert.match(part, /if \(isBookedCoordinator\(\{ booked: true, services \}\)\) redirect\(`\/dashboard\/\$\{eventId\}`\);/);
  assert.ok(part.indexOf("if (!open)") > 0 && part.indexOf("if (!open)") < part.indexOf("part === 'guests'"), 'a shut part draws its content');
  assert.doesNotMatch(part, /\.from\('guests'\)/, 'the part page reads the guest list directly');
  assert.match(code('lib/their-event.server.ts'), /\.rpc\('supplier_booking_group'/);
  assert.match(code('app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx'), /fromTheirEvent \? \(\s*<TheirEventLine /, 'mood-board/page.tsx opens without the Their event line');
  // Seats is drawn by supplier pages set two (main, 21 Nov): EVERY visit opens under the line, door or not.
  assert.match(code('app/vendor-dashboard/clients/[eventId]/seat-plan/seat-plan-body.tsx'), /<TheirEventPart\b/, 'the seat plan opens without the Their event line');
});

test('7 · a supplier’s edit to their OWN item applies at once; anything else waits', () => {
  const mine = { blockId: 'b1', responsibleVendorIds: ['ev-mine'], myBookingIds: ['ev-mine'] };
  assert.equal(editsOwnItem({ ...mine, kind: 'adjust' }), true);
  for (const kind of ['new', 'remove', 'where', 'hours', 'skip']) assert.equal(editsOwnItem({ ...mine, kind }), false, `${kind} applied by itself`);
  assert.equal(editsOwnItem({ ...mine, kind: 'adjust', responsibleVendorIds: ['ev-other'] }), false, 'another supplier’s item applied');
  assert.equal(editsOwnItem({ ...mine, kind: 'adjust', blockId: null }), false);
  const settle = code('lib/schedule-suggestion-decide.server.ts');
  assert.match(settle, /if \(await requestEditsOwnItem\(admin, eventId, suggestionId\)\) return true;/);
});

test('8 · one set of names, and Ask for access left the chat ＋', () => {
  assert.deepEqual(
    [DELEGATE_AREA_LABEL.guest_list, DELEGATE_AREA_LABEL.seat_plan, DELEGATE_AREA_LABEL.schedule, DELEGATE_AREA_LABEL.invitations, DELEGATE_AREA_LABEL.photos],
    ['Guests', 'Seats', 'Schedule', 'Hub', 'Memories'],
  );
  const rows = supplierPlusRows({} as Parameters<typeof supplierPlusRows>[0]).map((r) => r.key);
  assert.ok(!rows.includes('access'), 'Ask for access is back under the chat ＋');
});
