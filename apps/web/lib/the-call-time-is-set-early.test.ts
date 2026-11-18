/**
 * the-call-time-is-set-early.test.ts — 🕕 OWNER RULING A (2026-11-16): "the supplier can set a call time right away".
 * Builds on cut 5 (`supplier-cuts-own-times.test.ts`, which already holds: no chapters → Your times, never the dead line).
 *
 *   (a) the chat's "DUE NOW · Set your call time" pin OPENS the control — its Answer › used to have no body and did
 *       nothing; the blocker's "Set your call time" lands on the control too, not the top of the tab;
 *   (b) the control is where the link points (`#own-times`), and the pin clears once a call time is kept there.
 *   (c) 🕕 SCHEDULE MODEL (owner, DECISION_LOG 16 Nov; drawing event_pages_today_doors_2026-11-16): the couple's Booked
 *       row shows "Crew call 11:00 AM" APART from "On site from 1:00 PM · arrives 12:00 PM · done 10:00 PM" — or "No
 *       times yet" + "On site from 2:30 PM, from the moments you tagged them on" — never one "call time" for both;
 *   (d) the hosts get an IN-APP notice (never an email) when a supplier sets, changes or CLEARS their times, or presses
 *       Confirm my times — none for the same times again, none for a Confirm again with nothing changed, and never a
 *       "set" announced off a before-read that was refused;
 *   (e) Today's Schedule card carries "Lumière Studio set their times" with their times, read from the data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { isValidElement, type ReactElement } from 'react';

import { stripComments } from './strip-comments';
import { buildPinFacts } from './chat-pin-facts';
import type { PinFact } from './chat-pins';
import { CALL_TIME_ANCHOR, bookedTimesLines, crewCallWords, supplierTimesNotice, type BookedTimesLine } from './supplier-own-times';
import { timesFor } from './booked-rows';

// The chat bodies are classic-JSX .tsx under tsx — React must be on the global, as the repo's other render tests do.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const VIEW = 'app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx';

const base = { side: 'vendor' as const, nowMs: 0, themName: 'Ana & Marco', supplierName: 'Liwanag', mayReadMoney: true, todayPh: '2026-11-16' };
const facts = (at: string | null, side: 'vendor' | 'customer' = 'vendor') =>
  buildPinFacts({ ...base, side, callTime: { at } } as unknown as Parameters<typeof buildPinFacts>[0]);

function hrefsIn(n: unknown, out: string[] = []): string[] {
  if (Array.isArray(n)) n.forEach((x) => hrefsIn(x, out));
  else if (isValidElement(n)) {
    const p = (n as ReactElement<{ href?: string; children?: unknown }>).props;
    if (p.href) out.push(p.href);
    hrefsIn(p.children, out);
  }
  return out;
}

test('(a) the DUE NOW pin opens the call-time control; the couple’s pin is not sent there', async () => {
  const { schedulePinBodies, callTimeHref } = await import('../app/_components/chat/schedule-pin-bodies');
  assert.equal(callTimeHref('ev1'), `/vendor-dashboard/clients/ev1?tab=schedule#${CALL_TIME_ANCHOR}`);
  const pin = facts(null).find((f) => f.kind === 'call_time') as PinFact;
  assert.ok(pin, 'anti-vacuity: an unset call time pins');
  const body = schedulePinBodies([pin], 'th1', 'ev1')[pin.key];
  assert.ok(isValidElement(body), 'the DUE NOW pin has no body — its Answer › does nothing');
  assert.deepEqual(hrefsIn(body), [callTimeHref('ev1')], 'the pin does not open the call-time control');
  assert.equal(schedulePinBodies([pin], 'th1', null)[pin.key], undefined, 'a body with no event to link to');
  const couplePin = facts(null, 'customer').find((f) => f.kind === 'call_time') as PinFact;
  assert.ok(couplePin, 'anti-vacuity: the couple’s side pins too');
  assert.equal(schedulePinBodies([couplePin], 'th1', 'ev1')[couplePin.key], undefined, 'the couple was sent to the supplier’s tab');
  const page = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(page, /schedulePinBodies\(chatPins\.facts, threadId, thread\.event_id/, 'the supplier chat hands the pin no event');
  assert.match(page, /const scheduleHref = callTimeHref\(thread\.event_id\)/, 'the blocker’s Set your call time lands short of the control');
});

test('(b) the link lands on the control, and the pin clears once a call time is kept', () => {
  const view = read(VIEW);
  const form = view.slice(view.indexOf('function OwnTimesForm('), view.indexOf('function MyTimesSheet('));
  assert.ok(form.length > 500, 'anti-vacuity: OwnTimesForm was not found');
  assert.match(form, /<section id=\{CALL_TIME_ANCHOR\}/, 'the chat pin has nowhere to land');
  assert.match(view, /day\.chapters\.length === 0 \? \(\s*<OwnTimesForm /, 'the control is gone from the empty program');
  assert.equal(facts('own:06:00').some((f) => f.kind === 'call_time'), false, 'a kept call time still pins DUE NOW');
  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const branch = action.slice(action.indexOf("if (request === 'own_times')"), action.indexOf("if (request === 'times')"));
  assert.match(branch, /revalidatePath\('\/vendor-dashboard\/messages', 'layout'\)/, 'the chat keeps a stale DUE NOW after the save');
});

const words = (ls: readonly BookedTimesLine[] | null) => (ls ?? []).map((l) => `${l.lead}${l.clock ?? ''}${l.tail}`);

test('(c) the Booked row: two times, two names, in the drawing’s words', async () => {
  // The drawing's three rows, word for word.
  assert.deepEqual(words(bookedTimesLines({ call: '11:00', arrive: '12:00', done: '22:00' }, '1:00 PM')), [
    'Crew call 11:00 AM',
    'On site from 1:00 PM · arrives 12:00 PM · done 10:00 PM',
  ]);
  assert.deepEqual(words(bookedTimesLines(null, '2:30 PM')), ['No times yet', 'On site from 2:30 PM, from the moments you tagged them on']);
  // Never the old one-name fallback, and a refused read is said — never "No times yet".
  for (const own of [null, { call: '06:00', arrive: null, done: null }, 'unread'] as const) {
    for (const tagged of [null, '2:30 PM', 'unread'] as const) {
      const w = words(bookedTimesLines(own, tagged)).join(' | ');
      assert.doesNotMatch(w, /No call time yet|Call time /, `${JSON.stringify(own)} / ${tagged}: the old single "call time"`);
    }
  }
  assert.deepEqual(words(bookedTimesLines('unread', '2:30 PM')).slice(0, 1), ['We couldn’t check their times.'], 'a refused read drawn as No times yet');
  assert.deepEqual(words(bookedTimesLines({ call: null, arrive: '12:00', done: '22:00' }, null)), ['Arrives 12:00 PM · done 10:00 PM']);
  assert.equal(crewCallWords('06:00'), 'Crew call 6:00 AM');
  // The tagged moment is the couple's; the clocks are the supplier's, keyed by shop.
  const own = new Map([['p1', { call: '11:00', arrive: '12:00', done: '22:00' }]]);
  assert.deepEqual(words(timesFor({ kind: 'set', clock: '1:00 PM', moment: 'Getting ready' }, own, 'p1')), ['Crew call 11:00 AM', 'On site from 1:00 PM · arrives 12:00 PM · done 10:00 PM']);
  assert.deepEqual(words(timesFor({ kind: 'set', clock: '2:30 PM', moment: 'Ceremony' }, own, 'p2')), ['No times yet', 'On site from 2:30 PM, from the moments you tagged them on'], 'another shop’s times');
  assert.equal(timesFor(null, undefined, 'p1'), null, 'lines drawn where nobody asked');

  // End to end through the lab's real bookedView.
  const { labBookedView, labBookedMoney } = await import('../app/dev/suppliers-lab/booked-fixtures');
  const o = { crewCall: '1' as const, booked: true } as Parameters<typeof labBookedView>[0];
  const view = labBookedView(o, labBookedMoney(o));
  const sv = view.booked.find((r) => r.vendorId === 'v-santuario');
  assert.ok(sv, 'anti-vacuity: the lab has no booked Santuario row');
  assert.deepEqual(words(sv.times ?? null), ['Crew call 12:30 PM', 'On site from 2:00 PM · arrives 1:00 PM · done 5:00 PM']);
  assert.deepEqual(words(view.booked.find((r) => r.vendorId === 'v-seda')?.times ?? null), ['No times yet', 'On site from 10:00 AM, from the moments you tagged them on']);

  const row = read('app/dashboard/[eventId]/vendors/_components/booked-row.tsx');
  assert.match(row, /\{row\.times \? <TimesLines lines=\{row\.times\} \/> : null\}/, 'the times are not drawn from the one rule');
  assert.doesNotMatch(row, /No call time yet|set by them/, 'the old words are back');
  assert.match(read('app/dashboard/[eventId]/vendors/_components/booked-slot.tsx'), /readCrewCalls\(supabase, eventId\)[\s\S]{0,600}crewCalls,/);
  assert.match(read('lib/supplier-schedule-marks.server.ts'), /\.from\('supplier_own_times'\)\s*\.select\('vendor_profile_id, call_clock, arrive_clock, done_clock'\)/);
});

test('(d) the hosts are told in the app — set, changed, cleared, confirmed — and only of a real change', () => {
  const t = (before: { call: string | null; arrive: string | null; done: string | null } | null | 'unread', after: { call: string | null; arrive: string | null; done: string | null }) =>
    supplierTimesNotice({ kind: 'times', shop: 'Lumière Studio', before, after });
  assert.deepEqual(t(null, { call: '11:00', arrive: '12:00', done: '22:00' }), {
    title: 'Lumière Studio set their times',
    body: 'Crew call 11:00 AM · arrives 12:00 PM · done 10:00 PM',
  });
  assert.deepEqual(t({ call: '11:00', arrive: null, done: null }, { call: '10:30', arrive: '12:00', done: null }), {
    title: 'Lumière Studio changed their times',
    body: 'Crew call 10:30 AM · arrives 12:00 PM',
  });
  assert.equal(t({ call: '11:00', arrive: null, done: null }, { call: '11:00', arrive: null, done: null }), null, 'the same times again told the hosts');
  assert.equal(t('unread', { call: '11:00', arrive: null, done: null }), null, 'a refused before-read was announced as "set"');
  assert.deepEqual(t({ call: '11:00', arrive: null, done: null }, { call: null, arrive: null, done: null }), { title: 'Lumière Studio cleared their times', body: 'No times yet' }, 'clearing every time is a change');
  assert.equal(t(null, { call: null, arrive: null, done: null }), null, 'nothing kept, nothing cleared');
  const c = (alreadyConfirmed: boolean, changedSinceConfirm: boolean) =>
    supplierTimesNotice({ kind: 'confirmed', shop: 'Taal Vista Hotel', times: { call: null, arrive: '16:00', done: '22:30' }, alreadyConfirmed, changedSinceConfirm });
  assert.deepEqual(c(false, false), { title: 'Taal Vista Hotel confirmed their times', body: 'Arrives 4:00 PM · done 10:30 PM' });
  assert.equal(c(true, false), null, 'Confirm pressed again with nothing changed told the hosts');
  assert.ok(c(true, true), 'a Confirm after a change told nobody');

  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const branch = action.slice(action.indexOf("if (request === 'own_times')"), action.indexOf("if (request === 'times')"));
  assert.ok(branch.indexOf(".select('call_clock, arrive_clock, done_clock')") < branch.indexOf('.upsert('), 'the before is read after the write — every save looks unchanged');
  assert.match(branch, /before: beforeRes\.error \? 'unread' :/, 'a refused before-read is not passed on as "nothing before"');
  assert.match(branch, /supplierTimesNotice\(\{\s*kind: 'times'[\s\S]*notifySupplierTimes\(/, 'a set or changed time reaches no host');
  assert.doesNotMatch(action.slice(action.indexOf('function ownTimesFromForm('), action.indexOf('export async function suggestScheduleChange(')), /if \(!call && !arrive && !done\) return \{ ok: false/, 'clearing every time is refused again');
  const mark = action.slice(action.indexOf('const [markBefore, timesNow] ='), action.indexOf("if (request === 'own_times')"));
  assert.ok(mark.length > 300, 'anti-vacuity: the Confirm branch was not found');
  const readAt = mark.indexOf(".select('confirmed_at')");
  assert.ok(readAt > -1 && readAt < mark.indexOf("rpc('supplier_mark_schedule'"), 'the last Confirm is read after this one moved it');
  assert.match(mark, /kind: 'confirmed'[\s\S]*alreadyConfirmed: confirmedAt !== null[\s\S]*notifySupplierTimes\(/, 'Confirm my times reaches no host');
  const view = read(VIEW);
  assert.match(view, /if \(!next\.call && !next\.arrive && !next\.done && !own\?\.call && !own\?\.arrive && !own\?\.done\) return/, 'the form never sends a clear');

  const notify = read('lib/schedule-request-notify.server.ts');
  const fn = notify.slice(notify.indexOf('export async function notifySupplierTimes('), notify.indexOf('async function scheduleHosts('));
  assert.ok(fn.length > 100, 'anti-vacuity: notifySupplierTimes not found');
  assert.match(fn, /await scheduleHosts\(input\.eventId\)/, 'not the people who answer the supplier’s part of the day');
  assert.deepEqual([...fn.matchAll(/type: '([a-z_]+)'/g)].map((m) => m[1]), ['schedule_suggestion']);
  // In the app ONLY: the type is on neither email list.
  const emit = stripComments(readFileSync(join(WEB, 'lib/notification-emit.ts'), 'utf8'));
  for (const set of ['EMAIL_ENABLED_TYPES', 'MARKETING_GATED_EMAIL_TYPES']) {
    const at = emit.indexOf(`const ${set}`);
    assert.ok(at >= 0, `${set} moved`);
    const members = [...emit.slice(at, emit.indexOf(']);', at)).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    assert.ok(members.length > 0, `anti-vacuity: ${set} parsed empty`);
    assert.ok(!members.includes('schedule_suggestion'), `the supplier-times notice is emailed (${set})`);
  }
});

test('(e) Today’s Schedule card: "<shop> set their times", from the data', async () => {
  const { latestTimesSet } = await import('./home-schedule');
  const vendors = [{ vendor_name: 'Lumière Studio', marketplace_vendor_id: 'p-ls' }, { vendor_name: 'Taal Vista Hotel', marketplace_vendor_id: 'p-tv' }];
  const row = (vp: string, call: string | null, arrive: string | null, done: string | null, at: string) => ({ vendor_profile_id: vp, call_clock: call, arrive_clock: arrive, done_clock: done, updated_at: at });
  assert.deepEqual(latestTimesSet([row('p-ls', '11:00', '12:00', '22:00', '2026-11-16T10:00:00Z')], vendors), {
    shop: 'Lumière Studio',
    words: 'Crew call 11:00 AM · arrives 12:00 PM · done 10:00 PM',
  });
  assert.equal(latestTimesSet([row('p-ls', null, null, null, '2026-11-16T10:00:00Z')], vendors), null, 'a cleared row read as "set their times"');
  assert.equal(latestTimesSet([row('p-x', '11:00', null, null, '2026-11-16T10:00:00Z')], vendors), null, 'a shop not on this event');
  assert.equal(latestTimesSet([], vendors), null);
  const reader = read('lib/home-schedule.server.ts');
  assert.match(reader, /\.from\('supplier_own_times'\)[\s\S]{0,200}\.order\('updated_at', \{ ascending: false \}\)/, 'not the newest first');
  assert.match(reader, /requestsRes\.error \?\? vendorsRes\.error \?\? ownRes\.error/, 'a refused own-times read is not said');
  const faces = read('app/dashboard/[eventId]/_components/home-control-faces.ts');
  assert.match(faces, /title: `\$\{s\.timesSet\.shop\} set their times`, sub: s\.timesSet\.words/);
  assert.match(read('app/dashboard/[eventId]/_components/home-tile.tsx'), /data-home-sched-times=""/);
});
