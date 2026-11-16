/**
 * the-call-time-is-set-early.test.ts — 🕕 OWNER RULING A (2026-11-16): "the supplier can set a call time right away".
 * Builds on cut 5 (`supplier-cuts-own-times.test.ts`, which already holds: no chapters → Your times, never the dead line).
 *
 *   (a) the chat's "DUE NOW · Set your call time" pin OPENS the control — its Answer › used to have no body and did
 *       nothing; the blocker's "Set your call time" lands on the control too, not the top of the tab;
 *   (b) the control is where the link points (`#own-times`), and the pin clears once a call time is kept there.
 *   (c) 🕕 SCHEDULE MODEL (owner, DECISION_LOG 16 Nov): the couple's Booked row shows the supplier's own "Crew call
 *       6:00 AM" APART from "On site from …" (the earliest moment the couple tagged them on) — never one "call time"
 *       for both — and stops saying "No call time yet" once a crew call exists;
 *   (d) the hosts get an IN-APP notice (never an email) when a supplier sets or changes their times, or presses
 *       Confirm my times — and none when the same times are saved again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { isValidElement, type ReactElement } from 'react';

import { stripComments } from './strip-comments';
import { buildPinFacts } from './chat-pin-facts';
import type { PinFact } from './chat-pins';
import { CALL_TIME_ANCHOR, crewCallWords, supplierTimesNotice } from './supplier-own-times';
import { crewCallFor } from './booked-rows';

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

test('(c) the Booked row: Crew call is the supplier’s own time, apart from On site from', async () => {
  assert.deepEqual(crewCallFor(new Map([['p1', '06:00']]), 'p1'), { kind: 'set', clock: '6:00 AM' });
  assert.equal(crewCallFor(new Map([['p1', '06:00']]), 'p2'), null, 'another shop’s crew call');
  assert.deepEqual(crewCallFor(null, 'p1'), { kind: 'unread' }, 'a refused read drawn as none');
  assert.equal(crewCallFor(undefined, 'p1'), null);
  assert.equal(crewCallFor(new Map([['p1', 'nonsense']]), 'p1'), null);
  assert.equal(crewCallWords('06:00'), 'Crew call 6:00 AM');

  // End to end through the lab's real bookedView: two lines on one row, from two different sources.
  const { labBookedView, labBookedMoney } = await import('../app/dev/suppliers-lab/booked-fixtures');
  const o = { crewCall: '1' as const, booked: true } as Parameters<typeof labBookedView>[0];
  const view = labBookedView(o, labBookedMoney(o));
  const sv = view.booked.find((r) => r.vendorId === 'v-santuario');
  assert.ok(sv, 'anti-vacuity: the lab has no booked Santuario row');
  assert.deepEqual(sv.crewCall, { kind: 'set', clock: '12:30 PM' }, 'the supplier’s own crew call is not on their row');
  assert.deepEqual(sv.callTime, { kind: 'set', clock: '2:00 PM', moment: 'Ceremony' }, 'On site from stopped being the tagged moment');
  assert.equal(view.booked.find((r) => r.vendorId === 'v-seda')?.crewCall, null, 'a crew call drawn for a shop that set none');

  const row = read('app/dashboard/[eventId]/vendors/_components/booked-row.tsx');
  assert.match(row, /\{row\.crewCall \? <CrewCallLine line=\{row\.crewCall\} \/> : null\}\s*\{row\.callTime \? <CallTimeLine line=\{row\.callTime\} crewCallSet=\{row\.crewCall\?\.kind === 'set'\} \/> : null\}/, 'not both lines');
  const line = row.slice(row.indexOf('function CallTimeLine('), row.indexOf('function CrewCallLine('));
  assert.match(line, />On site from </, 'the tagged moment is still called the call time');
  assert.doesNotMatch(line, />Call time </, 'one "call time" for both again');
  assert.match(line, /crewCallSet \? '[^']*' : 'No call time yet/, '"No call time yet" over a crew call that exists');
  assert.doesNotMatch(line.slice(line.indexOf('crewCallSet ?'), line.indexOf(':', line.indexOf('crewCallSet ?'))), /No call time yet/);
  const crew = row.slice(row.indexOf('function CrewCallLine('), row.indexOf('function ClaimDoor('));
  assert.match(crew, />Crew call </);
  assert.match(read('app/dashboard/[eventId]/vendors/_components/booked-slot.tsx'), /readCrewCalls\(supabase, eventId\)[\s\S]{0,600}crewCalls,/);
  assert.match(read('lib/supplier-schedule-marks.server.ts'), /\.from\('supplier_own_times'\)\s*\.select\('vendor_profile_id, call_clock'\)/);
});

test('(d) the hosts are told in the app — set, changed, confirmed — never emailed, never for the same times', () => {
  const t = (before: { call: string | null; arrive: string | null; done: string | null } | null, after: { call: string | null; arrive: string | null; done: string | null }) =>
    supplierTimesNotice({ kind: 'times', shop: 'Liwanag', before, after });
  assert.deepEqual(t(null, { call: '06:00', arrive: null, done: null }), { title: 'Liwanag set their times', body: 'Crew call 6:00 AM' });
  assert.deepEqual(t({ call: '06:00', arrive: null, done: null }, { call: '05:30', arrive: '07:30', done: null }), {
    title: 'Liwanag changed their times',
    body: 'Crew call 5:30 AM · arrive 7:30 AM',
  });
  assert.equal(t({ call: '06:00', arrive: null, done: null }, { call: '06:00', arrive: null, done: null }), null, 'the same times saved again told the hosts');
  assert.equal(supplierTimesNotice({ kind: 'confirmed', shop: 'Liwanag' })?.title, 'Liwanag confirmed their times');

  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const branch = action.slice(action.indexOf("if (request === 'own_times')"), action.indexOf("if (request === 'times')"));
  assert.ok(branch.indexOf(".select('call_clock, arrive_clock, done_clock')") < branch.indexOf('.upsert('), 'the before is read after the write — every save looks unchanged');
  assert.match(branch, /supplierTimesNotice\(\{\s*kind: 'times'[\s\S]*notifySupplierTimes\(/, 'a set or changed time reaches no host');
  const mark = action.slice(action.indexOf('if (isMark) {'), action.indexOf("if (request === 'own_times')"));
  assert.match(mark, /if \(request === 'confirm'\) \{[\s\S]*kind: 'confirmed'[\s\S]*notifySupplierTimes\(/, 'Confirm my times reaches no host');

  const notify = read('lib/schedule-request-notify.server.ts');
  const fn = notify.slice(notify.indexOf('export async function notifySupplierTimes('), notify.indexOf('async function scheduleHosts('));
  assert.ok(fn.length > 100, 'anti-vacuity: notifySupplierTimes not found');
  assert.match(fn, /await scheduleHosts\(input\.eventId\)/, 'not the people who answer the supplier’s part of the day');
  const types = [...fn.matchAll(/type: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(types, ['schedule_suggestion']);
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
