/**
 * rsvp-push-grouping.test.ts — A GUEST REPLY BUZZES THE HOST'S PHONE AT MOST ONCE
 * PER 20 MINUTES PER EVENT, AND THE LATER NOTICE CARRIES EVERYBODY WHO WAITED.
 *
 * Owner, 2026-10-31: "Can we make the notification instead like facebook" →
 * "Yes. The notification on the phone not on the app." Facebook's shape: the first
 * one at once, then "Maria and 2 others".
 *
 * Runs the PURE decision (`lib/rsvp-push-grouping.ts`) the server half calls on
 * every reply and on the flush — properties, not phrasing:
 *   1 · the first reply after a quiet stretch goes at once, alone;
 *   2 · a reply inside the window is HELD, and says when it may go;
 *   3 · after the window, every held reply goes as ONE notice;
 *   4 · a reply the host already opened in the bell is not pushed;
 *   5 · nothing older than the horizon is ever pushed;
 *   6 · the words: one → its own title and card; several → "Maria + 2 others
 *       replied", counted by GUEST, opening the list; one tag per event;
 *   7 · the name comes out of BOTH title shapes the emit site writes — read from
 *       the emit site, so a reworded title fails here, not on a phone.
 *
 * SABOTAGE (each seen red, then restored): window check `<` → `>` (2 and 3 red) ·
 * dropped the read_at filter (4 red) · counted rows not guests (6 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RSVP_PUSH_HORIZON_MS,
  RSVP_PUSH_WINDOW_MS,
  decideGroupedPush,
  groupedPushText,
  guestNameFromRsvpTitle,
  type RsvpNoticeRow,
} from './rsvp-push-grouping';

const T0 = Date.parse('2026-10-31T10:00:00.000Z');
const MIN = 60 * 1000;
const EV = '11111111-2222-4333-8444-555555555555';
const iso = (ms: number) => new Date(ms).toISOString();

let n = 0;
function row(over: Partial<RsvpNoticeRow> & { at: number; guest?: string; name?: string }): RsvpNoticeRow {
  n += 1;
  const guest = over.guest ?? `g${n}`;
  return {
    notification_id: `n${n}`,
    title: `${over.name ?? 'Maria Santos'} RSVP'd: attending`,
    body: 'Meal preference: fish.',
    related_url: `/dashboard/${EV}/guests/${guest}`,
    created_at: iso(over.at),
    pushed_at: null,
    read_at: null,
    ...over,
  };
}

test('1 · the first reply after a quiet stretch goes at once, alone', () => {
  const first = row({ at: T0 });
  const d = decideGroupedPush([first], T0 + 1000);
  assert.deepEqual(d, { send: true, ids: [first.notification_id] });
  assert.equal(groupedPushText([first], EV).title, "Maria Santos RSVP'd: attending");
});

test('2 · a reply inside the window is held, and says when it may go', () => {
  const pushed = row({ at: T0, pushed_at: iso(T0) });
  const next = row({ at: T0 + 5 * MIN, name: 'Jose Reyes' });
  const d = decideGroupedPush([pushed, next], T0 + 5 * MIN);
  assert.equal(d.send, false);
  assert.ok(!d.send && d.reason === 'inside-window');
  assert.ok(!d.send && d.nextAtMs === T0 + RSVP_PUSH_WINDOW_MS);
});

test('3 · after the window, every held reply goes as ONE notice', () => {
  const pushed = row({ at: T0, pushed_at: iso(T0) });
  const a = row({ at: T0 + 2 * MIN, name: 'Jose Reyes' });
  const b = row({ at: T0 + 9 * MIN, name: 'Ana Cruz' });
  const c = row({ at: T0 + 14 * MIN, name: 'Liza Ocampo' });
  const now = T0 + RSVP_PUSH_WINDOW_MS + 1;
  const d = decideGroupedPush([pushed, a, b, c], now);
  assert.deepEqual(d, { send: true, ids: [a.notification_id, b.notification_id, c.notification_id] });
  const text = groupedPushText([a, b, c], EV);
  assert.equal(text.title, 'Liza Ocampo + 2 others replied');
  assert.equal(text.url, `/dashboard/${EV}/guests`);
});

test('3b · the window is twenty minutes (owner: "15–30")', () => {
  assert.ok(RSVP_PUSH_WINDOW_MS >= 15 * MIN && RSVP_PUSH_WINDOW_MS <= 30 * MIN);
});

test('4 · a reply the host already opened in the bell is not pushed', () => {
  const seen = row({ at: T0, read_at: iso(T0 + MIN) });
  assert.deepEqual(decideGroupedPush([seen], T0 + 2 * MIN), { send: false, reason: 'nothing-waiting' });
});

test('5 · nothing older than the horizon is ever pushed', () => {
  const old = row({ at: T0 });
  assert.equal(decideGroupedPush([old], T0 + RSVP_PUSH_HORIZON_MS + 1).send, false);
  assert.equal(decideGroupedPush([old], T0 + RSVP_PUSH_HORIZON_MS - 1).send, true);
});

test('6 · one guest answering twice is one person, not "+ 1 other"', () => {
  const a = row({ at: T0, guest: 'same', name: 'Maria Santos' });
  const b = row({ at: T0 + MIN, guest: 'same', name: 'Maria Santos', title: 'Maria Santos updated their details' });
  const text = groupedPushText([a, b], EV);
  assert.equal(text.title, 'Maria Santos updated their details');
  assert.equal(text.url, `/dashboard/${EV}/guests/same`);
});

test('6b · "+ 1 other" is singular, and every notice for an event shares one tag', () => {
  const a = row({ at: T0, name: 'Jose Reyes' });
  const b = row({ at: T0 + MIN, name: 'Maria Santos' });
  const two = groupedPushText([a, b], EV);
  assert.equal(two.title, 'Maria Santos + 1 other replied');
  assert.equal(two.tag, groupedPushText([a], EV).tag);
  assert.equal(two.tag, `rsvp-${EV}`);
});

test('7 · the name comes out of both title shapes the emit site writes', () => {
  assert.equal(guestNameFromRsvpTitle("Maria Santos RSVP'd: not attending"), 'Maria Santos');
  assert.equal(guestNameFromRsvpTitle('Jose updated their details'), 'Jose');
  assert.equal(guestNameFromRsvpTitle('something else entirely'), 'A guest');
  // The emit site — the titles these parse are written THERE, so a reword must fail here.
  const emit = readFileSync(join(process.cwd(), 'app', '[slug]', 'actions.ts'), 'utf8');
  assert.match(emit, /`\$\{guestName\} RSVP'd: \$\{statusLabel\}`/, 'the "RSVP\'d:" title moved — the push would say "A guest"');
  assert.match(emit, /`\$\{guestName\} updated their details`/, 'the "updated their details" title moved');
});
