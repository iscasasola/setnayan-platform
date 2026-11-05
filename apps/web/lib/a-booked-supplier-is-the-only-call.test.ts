/**
 * 📞 A BOOKED SUPPLIER IS THE ONLY ONE YOU CAN CALL FROM THE CHAT — and a number typed INTO the chat is still blocked.
 *
 * Owner 2026-11-04 (DECISION_LOG "SIX OWNER ANSWERS", item 2): *"We can call and video call suppliers as well on the
 * chat"*; 2026-11-05: *"yes for the video and voice call, have a button for it."* The chat head gains Call (`tel:`) and
 * Video call · Viber — hand-offs OUT of the app, never the in-app call removed on 2026-10-28 — for a BOOKED supplier
 * only. `lib/no-door-out-of-the-app.test.ts` (BOOKED_SUPPLIER_CALL_BILL) holds the source side; this file EXECUTES it:
 *
 *   1. the links — a mobile gets both, a landline gets Call only, junk gets nothing;
 *   2. the reader — an unbooked thread never reads the phone at all; a refused read is `unknown`, never `not_booked`;
 *   3. the render — an unbooked thread draws no `tel:` and no `viber:`, only the one hint line;
 *   4. the contact filter — a booked thread does not loosen it: the very number the button dials is blocked in a
 *      message, and the send gate consults no booking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { CALLS_OPEN_ONCE_BOOKED, supplierCallLinks, type BookedSupplierCall } from './booked-supplier-call';
import { evaluateMessage } from './chat-contact-filter';
import { CONFIRMED_VENDOR_STATUSES } from './events';

(globalThis as unknown as { React: unknown }).React = React;
{
  // The reader is `server-only`; under node:test that import resolves to nothing, as the other server tests do it.
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
  const m = supplierCallLinks('0917 123 4567');
  assert.deepEqual(m, {
    tel: 'tel:+639171234567',
    viber: 'viber://chat?number=%2B639171234567',
    display: '+63 917 123 4567',
  });
  // Every way a Filipino writes the same number lands on the same links.
  for (const raw of ['+63 917 123 4567', '639171234567', '9171234567', '(0917) 123-4567']) {
    assert.deepEqual(supplierCallLinks(raw), m, raw);
  }
  const l = supplierCallLinks('(02) 8123 4567');
  assert.equal(l?.tel, 'tel:+63281234567');
  assert.equal(l?.viber, null, 'Viber is a mobile app — a landline must not get a Video call button');
  for (const raw of [null, undefined, '', '   ', '12345', '+1 415 555 0100', 'call us']) {
    assert.equal(supplierCallLinks(raw), null, `${String(raw)} made a link`);
  }
});

// ── 2 · the reader ────────────────────────────────────────────────────────────

type Call = { table: string; ops: Array<[string, unknown[]]> };
function fakeDb(answers: {
  bookings?: { data: unknown[] | null; error: { message: string } | null };
  shop?: { data: unknown; error: { message: string } | null };
}) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const answer =
        table === 'event_vendors'
          ? (answers.bookings ?? { data: [], error: null })
          : (answers.shop ?? { data: null, error: null });
      const chain: Record<string, unknown> = {};
      for (const op of ['select', 'eq', 'in', 'is', 'limit', 'order']) {
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

async function readWith(answers: Parameters<typeof fakeDb>[0], vendorProfileId: string | null = 'vp-1') {
  const { readBookedSupplierCall } = await import('./booked-supplier-call.server');
  const { db, calls } = fakeDb(answers);
  const result = await readBookedSupplierCall(db as never, { eventId: 'ev-1', vendorProfileId });
  return { result, calls, tables: calls.map((c) => c.table) };
}

test('an UNBOOKED thread never reads the phone — the number is not fetched, so it cannot leak', async () => {
  const { result, tables, calls } = await readWith({ bookings: { data: [], error: null } });
  assert.deepEqual(result, { kind: 'not_booked' });
  assert.deepEqual(tables, ['event_vendors'], 'vendor_profiles was read for a shop that is not booked');
  // The booking read is the ONE meaning of "booked": this shop, this event, at-or-past contracted, not archived.
  const ops = calls[0]!.ops;
  assert.deepEqual(ops.find(([o, a]) => o === 'eq' && a[0] === 'event_id')?.[1], ['event_id', 'ev-1']);
  assert.deepEqual(ops.find(([o, a]) => o === 'eq' && a[0] === 'marketplace_vendor_id')?.[1], ['marketplace_vendor_id', 'vp-1']);
  assert.deepEqual(ops.find(([o]) => o === 'in')?.[1], ['status', [...CONFIRMED_VENDOR_STATUSES]]);
  assert.deepEqual(ops.find(([o]) => o === 'is')?.[1], ['archived_at', null]);
});

test('a thread with no shop on it reads nothing at all', async () => {
  const { result, tables } = await readWith({}, null);
  assert.deepEqual(result, { kind: 'not_booked' });
  assert.deepEqual(tables, []);
});

test('a REFUSED booking read is unknown — never "not booked", and the phone is not read', async () => {
  const { result, tables } = await readWith({ bookings: { data: null, error: { message: 'permission denied' } } });
  assert.deepEqual(result, { kind: 'unknown' });
  assert.deepEqual(tables, ['event_vendors']);
});

test('booked + a mobile on file → both buttons; booked + no phone → nothing; refused phone → unknown', async () => {
  const booked = { data: [{ vendor_id: 'evv-1' }], error: null };
  const yes = await readWith({ bookings: booked, shop: { data: { contact_phone: '09171234567' }, error: null } });
  assert.equal(yes.result.kind, 'booked');
  assert.deepEqual(yes.tables, ['event_vendors', 'vendor_profiles']);
  const none = await readWith({ bookings: booked, shop: { data: { contact_phone: null }, error: null } });
  assert.deepEqual(none.result, { kind: 'booked_no_phone' });
  const junk = await readWith({ bookings: booked, shop: { data: { contact_phone: 'n/a' }, error: null } });
  assert.deepEqual(junk.result, { kind: 'booked_no_phone' });
  const refused = await readWith({ bookings: booked, shop: { data: null, error: { message: '42501' } } });
  assert.deepEqual(refused.result, { kind: 'unknown' });
});

// ── 3 · the render ────────────────────────────────────────────────────────────

async function render(call: BookedSupplierCall, showHint = true): Promise<string> {
  const { BookedCallRow } = await import('../app/_components/chat/booked-call-row');
  return renderToStaticMarkup(React.createElement(BookedCallRow, { call, showHint }));
}

test('an UNBOOKED thread renders no tel: and no viber: — only the one hint line', async () => {
  const html = await render({ kind: 'not_booked' });
  assert.doesNotMatch(html, /tel:|viber:/i);
  assert.ok(html.includes('Calls open once you'), `the hint is missing: ${html}`);
  assert.equal(CALLS_OPEN_ONCE_BOOKED, 'Calls open once you’ve booked.');
  // No greyed-out button teasing the door.
  assert.doesNotMatch(html, /<a\b|<button\b/);
  // A closed or blocked thread: not even the hint.
  assert.equal(await render({ kind: 'not_booked' }, false), '');
});

test('unknown and booked-with-no-phone render nothing at all', async () => {
  assert.equal(await render({ kind: 'unknown' }), '');
  assert.equal(await render({ kind: 'booked_no_phone' }), '');
});

test('a BOOKED thread renders Call and Video call · Viber — and a landline renders Call only', async () => {
  const mobile = supplierCallLinks('09171234567')!;
  const html = await render({ kind: 'booked', links: mobile });
  // Anti-vacuity for the test above: the same render DOES carry both schemes when booked.
  assert.match(html, /href="tel:\+639171234567"/);
  assert.match(html, /href="viber:\/\/chat\?number=%2B639171234567"/);
  assert.ok(html.includes('>Call<'), 'the Call word is missing');
  assert.ok(html.includes('>Video call · Viber<'), 'the Video call · Viber word is missing — the app must be named');
  assert.doesNotMatch(html, /hint|once you/i);
  const landline = await render({ kind: 'booked', links: supplierCallLinks('(02) 8123 4567')! });
  assert.match(landline, /href="tel:\+63281234567"/);
  assert.doesNotMatch(landline, /viber:/);
});

test('the row is a CLIENT component — the page hands it plain data, never a function', () => {
  // Measured in the chat lab: a server file passing a lucide component to the client ActionButton crashed the whole
  // thread page ("Functions cannot be passed directly to Client Components"). The row is a client component (it runs
  // the house fit pass), so the icons live on the client side and the page passes only `call` + `showHint`.
  const row = read('app/_components/chat/booked-call-row.tsx');
  assert.match(row, /^'use client';/, 'the row is a server component again — pass icons as elements, or put the directive back');
  assert.match(row, /useFitRow\(ref\)/, 'the row lost its fit pass — at 390 px Video call wraps to a second line');
});

test('the couple thread page feeds the row ONLY from the booked reader, and spells no scheme itself', () => {
  const page = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(page, /const bookedCallRead = readBookedSupplierCall\(createAdminClient\(\), \{/);
  assert.match(page, /<BookedCallRow\s+call=\{blocked \? \{ kind: 'unknown' \} : bookedCall\}/);
  assert.doesNotMatch(page, /tel:|viber:/, 'the page spells a call link itself — it must come from the booked reader');
  // Booked only on the COUPLE side for now: the supplier's thread does not mount it (see the PR's owner question —
  // the couple's own phone is not shared with a booked supplier anywhere in the app today).
  assert.doesNotMatch(read('app/vendor-dashboard/messages/[threadId]/page.tsx'), /BookedCallRow|booked-supplier-call/);
});

// ── 4 · the contact filter is not loosened ───────────────────────────────────

test('a number typed INTO the chat is still blocked — including the very number the Call button dials', () => {
  const links = supplierCallLinks('09171234567')!;
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
  assert.doesNotMatch(send, /booked-supplier-call|BookedSupplierCall|CONFIRMED_VENDOR_STATUSES/, 'the send path now knows about bookings');
});
