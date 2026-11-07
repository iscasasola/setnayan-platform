/**
 * a-guest-sees-their-seat-the-hosts-way.test.ts — 🪑 SEATS S1d (owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH VIEW
 * DOES"): (2) a host "Guide me" test in the view-only 3D room; (3) a Seats ⚙ "How guests see their seat" — 2D map ·
 * 3D walk · Both (default Both, today's behaviour) — beside "Show guests their seats early"; (4) the host's guest card
 * shows that guest's seat exactly as the guest will see it, their table lit, tap for full screen; (5) the guest's 2D map
 * draws the booked suppliers' booths, a tap opens their card.
 *
 *   1 · ONE answer for what a seat view draws (`seatViewParts`) — and both the guest page and the card ask it.
 *   2 · the column is ALTER-only (prod refused ALTER-after-write, SQLSTATE 55006), default 'both', checked.
 *   3 · the ⚙ row sits right after the switch, writes through `guestSeatView` › set, and a refusal puts the choice back.
 *   4 · the guest page draws what the choice says (rendered): 2D → map, no walk · 3D → the walk, no map · Both → both.
 *   5 · booths: drawn and pressable on the guest's map, read only behind the seat gate, public identity only.
 *   6 · the card's preview is read when drawn (never with the card), a refused read says so.
 *   7 · Guide me walks the picked guest along `seatApproachPath` and saves nothing.
 *
 * SABOTAGE (each seen red, then restored): `seatViewParts` ignoring '3d' → 1 + 4 · the booths read moved above the seat
 * gate → 5 · the preview mounted for an unseated guest (`seatTableId ?` dropped) → 6 · `guideTo` not using
 * `seatApproachPath` → 7.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { GUEST_SEAT_VIEWS, parseGuestSeatView, seatViewParts } from './guest-seat-view';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));

test('1 · one answer for what a seat view draws — Both is today’s; 3D with no room still shows the map', () => {
  assert.deepEqual(GUEST_SEAT_VIEWS, ['both', '2d', '3d']);
  assert.equal(parseGuestSeatView(undefined), 'both');
  assert.equal(parseGuestSeatView('nope'), 'both');
  assert.deepEqual(seatViewParts('both', true), { map: true, walk: 'link' });
  assert.deepEqual(seatViewParts('2d', true), { map: true, walk: 'none' });
  assert.deepEqual(seatViewParts('3d', true), { map: false, walk: 'main' });
  assert.deepEqual(seatViewParts('3d', false), { map: true, walk: 'none' }, 'a 3D choice with no room left the guest with nothing');
  for (const f of ['app/[slug]/find-seat/_components/your-seat.tsx', 'app/dashboard/[eventId]/guests/_components/guest-seat-preview.tsx']) {
    assert.match(read(f), /seatViewParts\(/, `${f} decides the seat view on its own`);
  }
});

test('2 · the column: ALTER only, default both, checked', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const f = require('node:fs').readdirSync(dir).find((n: string) => n.endsWith('_guest_seat_view.sql'));
  assert.ok(f, 'the guest_seat_view migration is missing');
  const sql = stripComments(readFileSync(join(dir, f), 'utf8')).replace(/--[^\n]*/g, '');
  assert.match(sql, /ALTER TABLE public\.event_floor_plan\s+ADD COLUMN IF NOT EXISTS guest_seat_view TEXT NOT NULL DEFAULT 'both'\s+CHECK \(guest_seat_view IN \('2d', '3d', 'both'\)\)/);
  assert.doesNotMatch(sql, /\b(UPDATE|INSERT)\b/i, 'a write in the same file as the ALTER (prod refuses it: 55006)');
  assert.match(read('lib/seating.ts'), /guest_seat_view: parseGuestSeatView\(/, 'the plan read does not carry the choice');
});

test('3 · the ⚙ row sits beside "Show guests their seats early" and a refusal puts the choice back', () => {
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(ed, /name="Show guests their seats early"[\s\S]{0,1400}?attrs=\{\{ 'data-seat-plan-door-switch': '' \}\}\s*\/>\s*<ChosenRow\s+name="How guests see their seat"/, 'the row is not beside the switch');
  assert.match(ed, /\/>\s*<ChosenRow\s+name="How guests see their seat"[\s\S]{0,700}?onPick=\{pickSeatView\}/);
  const pick = ed.slice(ed.indexOf('const pickSeatView = '), ed.indexOf('const flipDoor = '));
  assert.match(pick, /await guestSeatView\(eventId, \{ kind: 'set', view: v \}\)/);
  assert.match(pick, /if \(!res\.ok\) \{\s*setSeatView\(was\);\s*setSeatViewNote\(res\.error\);/, 'a refused save keeps showing the new choice');
  const act = read('app/dashboard/[eventId]/guests/seat-view-actions.ts');
  const fn = act.slice(act.indexOf('async function writeGuestSeatView('), act.indexOf('export type GuestSeatViewSaved'));
  assert.match(fn, /\.select\('guest_seat_view'\)/);
  assert.match(fn, /if \(error \|\| !data \|\| data\.length === 0\)/, 'zero rows written reads as a save');
});

const g = (over = {}) => ({
  firstName: 'Ana',
  names: 'M & J',
  occasionLine: null,
  dayOf: false,
  doorsOpenLabel: null,
  published: true,
  tables: [{ table_id: 't1', public_id: 'x', event_id: 'e', table_label: 'Table 5', table_type: 'round_10', capacity: 10, sort_order: 0, x_pos: 40, y_pos: 40 }],
  entrance: { x: 50, y: 96 },
  table: { table_id: 't1', table_label: 'Table 5', capacity: 10 },
  mates: [],
  seatsOpen: 0,
  venueHref: '/s/venue',
  inviteHref: '/s',
  slug: 's',
  plural: true,
  pass: null,
  seatView: 'both',
  booths: [{ id: 'b1', kind: 'live_cooking', label: 'Lechon station', xPct: 6, yPct: 62, offerings: null, cardItems: null, vendor: { name: 'Lab Lechon House', category: 'catering', logoUrl: null, tier: 'pro', slug: null, bookable: false, boothAddonActive: false } }],
  ...over,
});

test('4 · the guest page draws what the choice says (rendered)', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { YourSeat } = await import('../app/[slug]/find-seat/_components/your-seat');
  const draw = (seatView: string, dayOf = false) => renderToStaticMarkup(React.createElement(YourSeat, g({ seatView, dayOf }) as never));
  for (const dayOf of [false, true]) {
    const both = draw('both', dayOf);
    assert.match(both, />Table 5</);
    assert.match(both, /data-way-booth="b1"/, `Both${dayOf ? ' (on the day)' : ''}: no map`);
    assert.match(both, /Walk the room in 3D/, `Both${dayOf ? ' (on the day)' : ''}: no walk link`);
    const two = draw('2d', dayOf);
    assert.match(two, /data-way-booth="b1"/);
    assert.doesNotMatch(two, /Walk the room in 3D|data-seat-walk-main/, '2D map still offers the walk');
    const three = draw('3d', dayOf);
    assert.match(three, /data-seat-walk-main=""[^>]*href="\/s\/venue"|href="\/s\/venue"[^>]*data-seat-walk-main=""/, '3D walk is not the way in');
    assert.doesNotMatch(three, /data-way-booth=/, '3D walk still draws the map');
  }
});

test('5 · booths: drawn and pressable on the guest map, read behind the seat gate, public identity only', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { WayfindingMap } = await import('../app/_components/wayfinding-map');
  const base = { tables: g().tables as never, entrance: { x: 50, y: 96 }, targetTableId: 't1' };
  const tap = renderToStaticMarkup(React.createElement(WayfindingMap, { ...base, booths: [{ id: 'b1', label: 'Lab Lechon House', x: 6, y: 62 }], onBooth: () => {} }));
  assert.match(tap, /<button[^>]*aria-label="Lab Lechon House — the supplier’s card"[^>]*data-way-booth="b1"/, 'a booth on the guest map is not a button');
  const none = renderToStaticMarkup(React.createElement(WayfindingMap, base));
  assert.doesNotMatch(none, /data-way-booth/, 'every older caller now draws booths');
  const page = read('app/[slug]/find-seat/page.tsx');
  const gate = page.indexOf('const published = await guestsMaySeeSeatsFor(');
  const boothRead = page.indexOf('readGuestBooths(admin, event.event_id)');
  assert.ok(gate > 0 && boothRead > gate, 'the booths are read before the seat gate');
  assert.match(page, /let booths: Lab3DBooth\[\] = \[\];\s*if \(published\) \{\s*const \[viewRow, boothRows\] = await Promise\.all\(\[[\s\S]{0,200}?readGuestBooths\(admin, event\.event_id\)/, 'the booths are read for a guest the gate kept out');
  const lib = read('lib/booth-card-from-row.ts');
  assert.match(lib, /return rows\.filter\(boothHasSupplier\)\.map\(boothCardFromRow\);/);
  assert.match(lib, /logoUrl: null,/, 'a raw stored logo ref reaches a guest');
  assert.match(read('app/_components/guest-seat-map.tsx'), /<BoothVendorCard booth=\{booth\} onClose=\{\(\) => setOpen\(null\)\} \/>/);
});

test('6 · the card’s preview: read when drawn, only for a seated guest, a refusal said', () => {
  const body = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.match(body, /\{seatTableId \? <GuestSeatPreview eventId=\{eventId\} guestId=\{guest\.guest_id\}/);
  const pv = read('app/dashboard/[eventId]/guests/_components/guest-seat-preview.tsx');
  assert.match(pv, /useEffect\(\(\) => \{\s*read\(\);\s*\}, \[read\]\);/);
  assert.match(pv, /Couldn’t read how they’ll see their seat just now\./);
  assert.match(pv, /dynamic\(\(\) => import\('@\/app\/_components\/guest-seat-map'\)/, 'the map rides the card’s first load');
  assert.match(pv, /<Sheet open=\{full\}[\s\S]{0,120}? full rise/, 'no full screen');
  assert.match(pv, /&guide=\$\{encodeURIComponent\(guestId\)\}/, 'the 3D way in is not the host’s Guide me');
  const act = read('app/dashboard/[eventId]/guests/seat-view-actions.ts');
  assert.match(act, /if \(failed\) \{[\s\S]*?return \{ ok: false \};/);
});

test('7 · Guide me: the picked guest walks along seatApproachPath; nothing is saved', () => {
  const room = read('app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx');
  const fn = room.slice(room.indexOf('const guideTo = useCallback('), room.indexOf('const guidedFromUrl = useRef('));
  assert.match(fn, /seatApproachPath\(entranceWorld, table, s\.seatNumber, room, walkAround, 0\.2\)/);
  assert.match(fn, /setWalker\(\{ gid, name: g\.name, path, tableId: s\.tableId, seatNumber: s\.seatNumber, seat: pose \}\)/);
  assert.doesNotMatch(fn, /await |action|fetch\(/, 'Guide me writes something');
  assert.match(room, /guide=\{\{ options: guideOptions, onPick: \(gid\) => void guideTo\(gid\), active: walker\?\.gid \?\? null \}\}/);
  const tools = read('app/dashboard/[eventId]/seating/lab/_components/room-view-tools.tsx');
  assert.match(tools, /<PickMenu\s+label="Guide me to a seat"/, 'Guide me is not the shared dropdown');
});
