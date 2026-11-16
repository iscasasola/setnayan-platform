/**
 * the-call-time-is-set-early.test.ts — 🕕 OWNER RULING A (2026-11-16): "the supplier can set a call time right away".
 * Builds on cut 5 (`supplier-cuts-own-times.test.ts`, which already holds: no chapters → Your times, never the dead line).
 *
 *   (a) the chat's "DUE NOW · Set your call time" pin OPENS the control — its Answer › used to have no body and did
 *       nothing; the blocker's "Set your call time" lands on the control too, not the top of the tab;
 *   (b) the control is where the link points (`#own-times`), and the pin clears once a call time is kept there.
 *
 * Step 3 (the couple's Schedule showing the supplier's call time) is HELD for an owner ruling — nothing here asserts it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { isValidElement, type ReactElement } from 'react';

import { stripComments } from './strip-comments';
import { buildPinFacts } from './chat-pin-facts';
import type { PinFact } from './chat-pins';
import { CALL_TIME_ANCHOR } from './supplier-own-times';

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
