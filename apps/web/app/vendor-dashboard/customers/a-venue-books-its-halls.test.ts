/**
 * a-venue-books-its-halls.test.ts — THE HALLS SCREENS (owner 2026-10-14 🏛 "Approve all" on the supplier prototype's
 * section 9 moments): Your halls (seated · standing · free on every plan) · a card's "Uses" (one or more halls) · the
 * day per hall + "Joined halls · Hall A is booked that day" · the A + B yes refused with the reason, offering the free
 * hall · Add from outside asks "Which halls". The rules live in the database (tests/db/not-available-repeats-and-
 * hours.db.test.ts, HALLS); this holds the screens to them.
 *
 * Sabotage (2026-10-14): `joinedCardOnDay` ignoring a taken hall → 1 red; the yes no longer reading
 * `vendor_card_halls_on` → 3 red; the Add sheet posting one `pool_id` for halls → 4 red.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets `"jsx": "preserve"`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { hallGuests, hallsAnswer, hallsOnDay, joinedCardOnDay } from '@/lib/vendor-halls';
import { lockAgreeHalls, lockAgreeHallsParam, lockAgreeNotice } from '@/lib/lock-answer-notice';

(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));
const VD = join(HERE, '..');
const code = (rel: string) => stripComments(readFileSync(join(VD, rel), 'utf8'));
const h = React.createElement;

const HALLS = [
  { poolId: 'a', name: 'Hall A', capacity: 1, seated: 150, standing: 250 },
  { poolId: 'b', name: 'Hall B', capacity: 1, seated: 200, standing: 350 },
  { poolId: 'c', name: 'Hall C', capacity: 1, seated: 120, standing: 200 },
];

test('1 · the day per hall: Hall A booked → A + B and the Grand Hall are not available, and say why; C stays free', () => {
  const state = hallsOnDay('2026-12-12', HALLS, [{ poolId: 'a', eventId: 'e1', title: 'Reyes wedding' }], []);
  assert.deepEqual(state.map((s) => s.taken), [true, false, false]);
  assert.deepEqual(hallsAnswer(state), { tone: 'ok', word: 'Hall B · Hall C free', line: 'Hall A booked' });
  assert.deepEqual(joinedCardOnDay({ serviceId: 'ab', name: 'A + B', poolIds: ['a', 'b'] }, state, HALLS), { free: false, line: 'Hall A is booked that day' });
  assert.deepEqual(joinedCardOnDay({ serviceId: 'bc', name: 'B + C', poolIds: ['b', 'c'] }, state, HALLS), { free: true, line: '320 seated · Hall B + Hall C' });
  // An outside booking takes its hall; an all-day closure takes every hall it covers.
  const outside = hallsOnDay('2026-12-05', HALLS, [], [{ poolId: 'b', source: 'external_client', startDate: '2026-12-05', endDate: '2026-12-05', clientName: 'Dizon', clientTime: '11:00' }]);
  assert.deepEqual(outside.map((s) => s.taken), [false, true, false]);
  const closed = hallsOnDay('2026-12-25', HALLS, [], [{ poolId: null, source: 'manual', startDate: '2026-12-25', endDate: '2026-12-25', label: 'Christmas' }]);
  assert.deepEqual(hallsAnswer(closed), { tone: 'bad', word: 'All halls taken', line: 'Hall A, Hall B and Hall C booked' });
  assert.equal(hallGuests(HALLS[0]!), '150 seated · 250 standing');
});

test('2 · the day screen draws a venue per hall, with Joined halls under it', async () => {
  const { DaySheet } = await import('./_components/day-sheet');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const act = async () => {};
  const html = renderToStaticMarkup(
    h(DaySheet, {
      data: {
        day: '2026-12-12', today: '2026-10-14', sub: '', backHref: '/x', answer: null, groups: [], holders: [], holdersMeasured: true,
        holdingCeiling: 5, waiting: 0, closures: [], holds: [], whoWorks: null, qrHref: '/q',
        venue: {
          answer: { tone: 'ok', word: 'Hall B · Hall C free', line: 'Hall A booked' },
          halls: [{ key: 'a', title: 'Hall A', line: 'Reyes wedding', badge: { tone: 'ok', word: 'Booked' }, href: null }],
          joined: [{ key: 'ab', title: 'A + B', line: 'Hall A is booked that day', free: false }],
        },
      },
      actions: { addManualBlock: act, removeBlock: act, setCalendarDayState: act, notifyWaitlistSlot: act },
    }),
  );
  assert.match(html, /<b class="font-semibold">Hall B · Hall C free<\/b> · Hall A booked/);
  assert.match(html, /data-dates-day-joined=""[^>]*>\s*Joined halls/);
  assert.match(html, /A \+ B[\s\S]{0,300}Hall A is booked that day[\s\S]{0,700}Not available/);
});

test('3 · the A + B yes is refused BEFORE it books, with the taken hall and the free halls to offer', () => {
  const actions = code('clients/[eventId]/actions.ts');
  const agree = actions.slice(actions.indexOf('export async function vendorAgreeToLock'));
  const pre = agree.indexOf("rpc('vendor_card_halls_on'");
  const yes = agree.indexOf("rpc('vendor_agree_to_lock'");
  assert.ok(pre > 0 && pre < yes, 'the yes does not ask the halls first');
  assert.match(agree.slice(pre, yes), /lock_agree=hall_taken\$\{lockAgreeHallsParam\(/);
  const n = lockAgreeNotice('hall_taken', { halls: { taken: ['Hall A'], free: ['Hall B', 'Hall C'] } })!;
  assert.equal(n.tone, 'refused');
  assert.equal(n.text, 'Hall A is booked that day, so this booking cannot be held. Offer Hall B or Hall C instead — they are free that day — or turn this one down.');
  assert.deepEqual(lockAgreeHalls('Hall%20A'.replace('%20', ' '), 'Hall B|Hall C'), { taken: ['Hall A'], free: ['Hall B', 'Hall C'] });
  assert.equal(lockAgreeHallsParam({ taken: ['Hall A'], free: [] }), '&taken=Hall%20A&free=');
  for (const page of ['page.tsx', 'clients/[eventId]/page.tsx', 'messages/[threadId]/page.tsx']) {
    assert.match(code(page), /halls: lockAgreeHalls\(/, `${page} does not say which hall`);
  }
});

test('4 · Your halls · Uses · Which halls — the screens post the shipped actions', () => {
  const folds = code('customers/_components/dates-folds.tsx');
  assert.match(folds, /title="Your halls"/);
  assert.match(folds, /word: 'Free on every plan'/);
  assert.match(folds, /<HallSheet createAction=\{actions\.createCalendar\}/, 'no New hall');
  const sheets = code('customers/_components/dates-sheets.tsx');
  assert.match(sheets, /name="is_hall" value="on"/);
  assert.match(sheets, /name="seated_capacity"[\s\S]{0,120}name="standing_capacity"/);
  const add = code('customers/_components/outside-client-add.tsx');
  assert.match(add, /halls \? picked\.map\(\(id\) => <input key=\{id\} type="hidden" name="pool_ids" value=\{id\} \/>\)/, 'Which halls does not post every hall');
  assert.match(add, /<FormRow name="Which halls"/);
  const calendar = code('calendar/actions.ts');
  assert.match(calendar, /for \(const hallId of hallIds\.slice\(1\)\)/, 'a booking from outside holds only its first hall');
  assert.match(calendar, /export async function setServiceHalls/);
  const manager = code('services/_components/services-manager.tsx');
  assert.match(manager, /<HallsUsesPick\b[\s\S]{0,400}action=\{setServiceHalls\}/, 'a card cannot say which halls it uses');
  const uses = code('services/_components/halls-uses-pick.tsx');
  assert.match(uses, /picked=\{picked\}/, '"Uses" is not one list with checkmarks');
});
