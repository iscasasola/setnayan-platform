/**
 * 📞 ONLY A BOOKING OPENS A CALL — on both sides of the chat — and a number typed INTO the chat is still blocked.
 *
 * Owner 2026-11-04 (DECISION_LOG "SIX OWNER ANSWERS", item 2): *"We can call and video call suppliers as well on the
 * chat"*; 2026-11-05: *"yes for the video and voice call, have a button for it"* and *"supplier side. only for
 * booked"*. Each chat head gains Call (`tel:`) and Video call · Viber — hand-offs OUT of the app, never the in-app call
 * removed on 2026-10-28 — once the supplier is BOOKED on the event. `lib/no-door-out-of-the-app.test.ts`
 * (BOOKED_CALL_BILL) holds the source side; this file EXECUTES it:
 *
 *   1. the links — a mobile gets both, a landline gets Call only, junk gets nothing;
 *   2. the readers — an unbooked thread never reads a phone at all; a refused read is `unknown`, never `not_booked`;
 *      the supplier gets a number only for a person who HOSTS the event (a supplier can open a thread themselves);
 *   3. the render — an unbooked thread draws no `tel:` and no `viber:`, only the one hint line, in each side's voice;
 *   4. the pages — each mounts the row once, from its reader, and spells no scheme itself;
 *   5. the contact filter — a booked thread does not loosen it: the very number the button dials is blocked in a
 *      message, and the send gate consults no booking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { CALLS_OPEN_ONCE_BOOKED, phoneCallLinks, type BookedCall } from './booked-call';
import { evaluateMessage } from './chat-contact-filter';
import { CONFIRMED_VENDOR_STATUSES } from './events';

(globalThis as unknown as { React: unknown }).React = React;
{
  // The readers are `server-only`; under node:test that import resolves to nothing, as the other server tests do it.
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── 1 · the links ─────────────────────────────────────────────────────────────

test('a mobile gets Call and Video call · Viber; a landline gets Call only; junk gets nothing', () => {
  const m = phoneCallLinks('0917 123 4567');
  assert.deepEqual(m, {
    tel: 'tel:+639171234567',
    viber: 'viber://chat?number=%2B639171234567',
    display: '+63 917 123 4567',
  });
  // Every way a Filipino writes the same number lands on the same links.
  for (const raw of ['+63 917 123 4567', '639171234567', '9171234567', '(0917) 123-4567']) {
    assert.deepEqual(phoneCallLinks(raw), m, raw);
  }
  const l = phoneCallLinks('(02) 8123 4567');
  assert.equal(l?.tel, 'tel:+63281234567');
  assert.equal(l?.viber, null, 'Viber is a mobile app — a landline must not get a Video call button');
  for (const raw of [null, undefined, '', '   ', '12345', '+1 415 555 0100', 'call us']) {
    assert.equal(phoneCallLinks(raw), null, `${String(raw)} made a link`);
  }
});

// ── 2 · the readers ───────────────────────────────────────────────────────────

type Answer = { data: unknown; error: { message: string } | null };
type Call = { table: string; ops: Array<[string, unknown[]]> };
function fakeDb(answers: Partial<Record<string, Answer>>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const answer = answers[table] ?? { data: table === 'vendor_profiles' || table === 'users' ? null : [], error: null };
      const chain: Record<string, unknown> = {};
      for (const op of ['select', 'eq', 'in', 'is', 'not', 'limit', 'order']) {
        chain[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return chain;
        };
      }
      chain.maybeSingle = () => Promise.resolve(answer);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(answer).then(res, rej);
      return chain;
    },
  };
  return { db, calls };
}

const BOOKED: Answer = { data: [{ vendor_id: 'evv-1' }], error: null };
const HOST_ROW: Answer = { data: [{ event_id: 'ev-1', events: { archived: false } }], error: null };

async function coupleSide(answers: Partial<Record<string, Answer>>, vendorProfileId: string | null = 'vp-1') {
  const { readBookedSupplierCall } = await import('./booked-call.server');
  const { db, calls } = fakeDb(answers);
  const result = await readBookedSupplierCall(db as never, { eventId: 'ev-1', vendorProfileId });
  return { result, calls, tables: calls.map((c) => c.table) };
}

async function supplierSide(answers: Partial<Record<string, Answer>>, openedByUserId: string | null = 'u-bride') {
  const { readBookedCoupleCall } = await import('./booked-call.server');
  const { db, calls } = fakeDb(answers);
  const result = await readBookedCoupleCall(db as never, { eventId: 'ev-1', vendorProfileId: 'vp-1', openedByUserId });
  return { result, calls, tables: calls.map((c) => c.table) };
}

test('an UNBOOKED thread never reads a phone — on either side, the number is not fetched, so it cannot leak', async () => {
  const c = await coupleSide({ event_vendors: { data: [], error: null } });
  assert.deepEqual(c.result, { kind: 'not_booked' });
  assert.deepEqual(c.tables, ['event_vendors'], 'vendor_profiles was read for a shop that is not booked');
  // The booking read is the ONE meaning of "booked": this shop, this event, at-or-past contracted, not archived.
  const ops = c.calls[0]!.ops;
  assert.deepEqual(ops.find(([o, a]) => o === 'eq' && a[0] === 'event_id')?.[1], ['event_id', 'ev-1']);
  assert.deepEqual(ops.find(([o, a]) => o === 'eq' && a[0] === 'marketplace_vendor_id')?.[1], ['marketplace_vendor_id', 'vp-1']);
  assert.deepEqual(ops.find(([o]) => o === 'in')?.[1], ['status', [...CONFIRMED_VENDOR_STATUSES]]);
  assert.deepEqual(ops.find(([o]) => o === 'is')?.[1], ['archived_at', null]);

  const s = await supplierSide({ event_vendors: { data: [], error: null } });
  assert.deepEqual(s.result, { kind: 'not_booked' });
  assert.deepEqual(s.tables, ['event_vendors'], "the couple's account was read for a supplier who is not booked");
});

test('a thread with no shop on it reads nothing at all', async () => {
  const { result, tables } = await coupleSide({}, null);
  assert.deepEqual(result, { kind: 'not_booked' });
  assert.deepEqual(tables, []);
});

test('a REFUSED booking read is unknown — never "not booked", and no phone is read', async () => {
  const refused: Answer = { data: null, error: { message: 'permission denied' } };
  const c = await coupleSide({ event_vendors: refused });
  assert.deepEqual(c.result, { kind: 'unknown' });
  assert.deepEqual(c.tables, ['event_vendors']);
  const s = await supplierSide({ event_vendors: refused });
  assert.deepEqual(s.result, { kind: 'unknown' });
  assert.deepEqual(s.tables, ['event_vendors']);
});

test("couple side: booked + the shop's mobile → buttons; no phone → nothing; refused phone → unknown", async () => {
  const yes = await coupleSide({ event_vendors: BOOKED, vendor_profiles: { data: { contact_phone: '09171234567' }, error: null } });
  assert.equal(yes.result.kind, 'booked');
  assert.deepEqual(yes.tables, ['event_vendors', 'vendor_profiles']);
  const none = await coupleSide({ event_vendors: BOOKED, vendor_profiles: { data: { contact_phone: null }, error: null } });
  assert.deepEqual(none.result, { kind: 'booked_no_phone' });
  const junk = await coupleSide({ event_vendors: BOOKED, vendor_profiles: { data: { contact_phone: 'n/a' }, error: null } });
  assert.deepEqual(junk.result, { kind: 'booked_no_phone' });
  const refused = await coupleSide({ event_vendors: BOOKED, vendor_profiles: { data: null, error: { message: '42501' } } });
  assert.deepEqual(refused.result, { kind: 'unknown' });
});

test("supplier side: booked + the HOST's mobile → buttons, read off that host's own account", async () => {
  const yes = await supplierSide({
    event_vendors: BOOKED,
    event_members: HOST_ROW,
    users: { data: { phone: '0918 765 4321' }, error: null },
  });
  assert.deepEqual(yes.result, { kind: 'booked', links: phoneCallLinks('09187654321')! });
  assert.deepEqual(yes.tables, ['event_vendors', 'event_members', 'users']);
  const usersOps = yes.calls.find((c) => c.table === 'users')!.ops;
  assert.deepEqual(usersOps.find(([o]) => o === 'eq')?.[1], ['user_id', 'u-bride'], 'read somebody other than the host');
  // A co-host on the iteration-0048 model counts as a host too.
  const mod = await supplierSide({
    event_vendors: BOOKED,
    event_members: { data: [], error: null },
    event_moderators: HOST_ROW,
    users: { data: { phone: '09187654321' }, error: null },
  });
  assert.equal(mod.result.kind, 'booked');
});

test("supplier side: a thread the SUPPLIER opened never hands them a phone — not even their own as the couple's", async () => {
  // lib/vendor-invite-actions.ts seeds a thread with the claiming SUPPLIER as `created_by_user_id`.
  const notHost = await supplierSide({
    event_vendors: BOOKED,
    event_members: { data: [], error: null },
    event_moderators: { data: [], error: null },
    users: { data: { phone: '09170000000' }, error: null },
  });
  assert.deepEqual(notHost.result, { kind: 'booked_no_phone' });
  assert.ok(!notHost.tables.includes('users'), 'the account phone was read for somebody who does not host the event');
  const nobody = await supplierSide({ event_vendors: BOOKED }, null);
  assert.deepEqual(nobody.result, { kind: 'booked_no_phone' });
  assert.deepEqual(nobody.tables, ['event_vendors']);
});

test('supplier side: a refused host check or phone read is unknown; a host with no phone shows nothing', async () => {
  const hostRefused = await supplierSide({ event_vendors: BOOKED, event_members: { data: null, error: { message: '42501' } } });
  assert.deepEqual(hostRefused.result, { kind: 'unknown' });
  assert.ok(!hostRefused.tables.includes('users'));
  const phoneRefused = await supplierSide({ event_vendors: BOOKED, event_members: HOST_ROW, users: { data: null, error: { message: '42501' } } });
  assert.deepEqual(phoneRefused.result, { kind: 'unknown' });
  const noPhone = await supplierSide({ event_vendors: BOOKED, event_members: HOST_ROW, users: { data: { phone: null }, error: null } });
  assert.deepEqual(noPhone.result, { kind: 'booked_no_phone' });
});

// ── 3 · the render ────────────────────────────────────────────────────────────

async function render(call: BookedCall, side: 'couple' | 'vendor' = 'couple', showHint = true): Promise<string> {
  const { BookedCallRow } = await import('../app/_components/chat/booked-call-row');
  return renderToStaticMarkup(React.createElement(BookedCallRow, { call, showHint, side }));
}

test('an UNBOOKED thread renders no tel: and no viber: — only the one hint line, in each side’s voice', async () => {
  for (const side of ['couple', 'vendor'] as const) {
    const html = await render({ kind: 'not_booked' }, side);
    assert.doesNotMatch(html, /tel:|viber:/i, side);
    assert.ok(html.includes(CALLS_OPEN_ONCE_BOOKED[side].replace('’', '&#x27;')) || html.includes(CALLS_OPEN_ONCE_BOOKED[side]), `${side}: the hint is missing: ${html}`);
    // No greyed-out button teasing the door.
    assert.doesNotMatch(html, /<a\b|<button\b/, side);
    // A closed or blocked thread: not even the hint.
    assert.equal(await render({ kind: 'not_booked' }, side, false), '', side);
  }
  assert.equal(CALLS_OPEN_ONCE_BOOKED.couple, 'Calls open once you’ve booked.');
  assert.equal(CALLS_OPEN_ONCE_BOOKED.vendor, 'Calls open once they’ve booked you.');
});

test('unknown and booked-with-no-phone render nothing at all', async () => {
  for (const side of ['couple', 'vendor'] as const) {
    assert.equal(await render({ kind: 'unknown' }, side), '');
    assert.equal(await render({ kind: 'booked_no_phone' }, side), '');
  }
});

test('a BOOKED thread renders Call and Video call · Viber — and a landline renders Call only', async () => {
  const mobile = phoneCallLinks('09171234567')!;
  const html = await render({ kind: 'booked', links: mobile });
  // Anti-vacuity for the test above: the same render DOES carry both schemes when booked.
  assert.match(html, /href="tel:\+639171234567"/);
  assert.match(html, /href="viber:\/\/chat\?number=%2B639171234567"/);
  assert.ok(html.includes('>Call<'), 'the Call word is missing');
  assert.ok(html.includes('>Video call · Viber<'), 'the Video call · Viber word is missing — the app must be named');
  assert.match(html, /aria-label="Call the supplier · \+63 917 123 4567"/);
  assert.doesNotMatch(html, /once you/i);
  const vendorHtml = await render({ kind: 'booked', links: mobile }, 'vendor');
  assert.match(vendorHtml, /aria-label="Call the couple · /);
  const landline = await render({ kind: 'booked', links: phoneCallLinks('(02) 8123 4567')! });
  assert.match(landline, /href="tel:\+63281234567"/);
  assert.doesNotMatch(landline, /viber:/);
});

test('the row is a CLIENT component — the pages hand it plain data, never a function', () => {
  // Measured in the chat lab: a server file passing a lucide component to the client ActionButton crashed the whole
  // thread page ("Functions cannot be passed directly to Client Components"). The row is a client component (it runs
  // the house fit pass), so the icons live on the client side and the pages pass only `call`, `side` and `showHint`.
  const row = read('app/_components/chat/booked-call-row.tsx');
  assert.match(row, /^'use client';/, 'the row is a server component again — pass icons as elements, or put the directive back');
  assert.match(row, /useFitRow\(ref\)/, 'the row lost its fit pass — at 390 px Video call wraps to a second line');
});

// ── 4 · the pages ─────────────────────────────────────────────────────────────

test('each thread page feeds the row ONLY from its booked reader, and spells no scheme itself', () => {
  const couple = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(couple, /const bookedCallRead = readBookedSupplierCall\(createAdminClient\(\), \{/);
  assert.match(couple, /<BookedCallRow\s+call=\{blocked \? \{ kind: 'unknown' \} : bookedCall\}\s+side="couple"/);
  assert.doesNotMatch(couple, /tel:|viber:/, 'the couple page spells a call link itself');

  const vendor = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  // The supplier's read runs only after the page proved the thread is this shop's own.
  const own = vendor.indexOf('thread.vendor_profile_id !== profile.vendor_profile_id) notFound();');
  const readAt = vendor.indexOf('const bookedCallRead = readBookedCoupleCall(createAdminClient(), {');
  assert.ok(own > 0 && readAt > own, "the supplier's call read is no longer behind the own-shop check");
  assert.match(vendor.slice(readAt, readAt + 300), /openedByUserId: thread\.created_by_user_id/);
  assert.match(vendor, /<BookedCallRow\s+call=\{blocked \? \{ kind: 'unknown' \} : bookedCall\}\s+side="vendor"/);
  assert.doesNotMatch(vendor, /tel:|viber:/, "the supplier's page spells a call link itself");
});

// ── 5 · the contact filter is not loosened ───────────────────────────────────

test('a number typed INTO the chat is still blocked — including the very number the Call button dials', () => {
  const links = phoneCallLinks('09171234567')!;
  for (const body of [
    'call me 09171234567',
    links.display, // +63 917 123 4567
    links.tel,
    `add me ${links.viber}`,
    'viber me na lang po',
  ]) {
    assert.equal(evaluateMessage(body).blocked, true, `not blocked: ${body}`);
  }
});

test('the send gate consults no booking — a booked thread filters exactly like any other', () => {
  const send = read('lib/chat-send.ts');
  const gate = send.match(/if \(chatContactFilterEnabled\(\) && trimmed\.length > 0\) \{\s*const evaluation = evaluateMessage\(trimmed\);/);
  assert.ok(gate, 'the contact-filter gate in lib/chat-send.ts moved — re-read it before trusting this test');
  assert.doesNotMatch(send, /booked-call|BookedCall|CONFIRMED_VENDOR_STATUSES/, 'the send path now knows about bookings');
});
