/**
 * 🚩 EVERY CHAT PAGE HAS A REPORT DOOR (ship-controller ruling 20 Nov 2026, on the #8047 review: "KEEP the 'Report a
 * problem' row in the (+) until Part G (#8048) lands … A chat page must never be left with no in-chat Report.").
 *
 * Part B made the (+) hold only things you send, and Report's new home is the ⋯ menu — Part G, still a draft. Until G
 * lands, the (+) row IS the in-chat Report on both thread pages. Held here, for each:
 *   1 · the (+) rows carry "Report a problem", last, on every state of that side;
 *   2 · its door goes somewhere — the host's to their disputes page, the supplier's to the shipped report tool;
 *   3 · the thread page mounts the (+) sheet that draws those rows.
 * When G lands and moves Report into the ⋯, change THIS test to point at the ⋯ — never delete it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostPlusRows, supplierPlusRows } from './chat-plus';
import { VENDOR_THREAD_TOOLS } from './vendor-thread-tools';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

test('1 · the host’s (+) ends with Report a problem, in every state', () => {
  for (const rows of [hostPlusRows({ canLogPayment: true }), hostPlusRows({ canLogPayment: false, booked: true }), hostPlusRows({ canLogPayment: true, pollOpen: true })]) {
    const last = rows[rows.length - 1];
    assert.equal(last?.key, 'report', 'the host’s (+) has no Report row — and Part G’s ⋯ has not landed');
    assert.equal(last?.label, 'Report a problem');
    assert.equal(last?.door, 'host-report');
  }
});

test('1 · the supplier’s (+) ends with Report a problem, in every state', () => {
  for (const rows of [supplierPlusRows({ paid: false }), supplierPlusRows({ paid: true, booked: true }), supplierPlusRows({ paid: false, hasQuote: false })]) {
    const last = rows[rows.length - 1];
    assert.equal(last?.key, 'report', 'the supplier’s (+) has no Report row — and Part G’s ⋯ has not landed');
    assert.equal(last?.door, 'report-problem');
  }
});

test('2 · each Report door goes somewhere', async () => {
  const { plusDoor } = await import('@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet');
  assert.deepEqual(plusDoor('couple', 'host-report', 'E1'), { href: '/dashboard/E1/disputes' });
  const tool = VENDOR_THREAD_TOOLS.find((t) => t.key === 'report-problem');
  assert.ok(tool && 'link' in tool && tool.link === 'disputes', 'the supplier’s report tool lost its page');
  const door = plusDoor('vendor', 'report-problem', 'E1');
  assert.ok(door && 'href' in door && door.href, 'the supplier’s Report row opens nothing');
});

test('3 · both thread pages mount the (+) sheet that draws the Report row', () => {
  const sheet = read('app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
  assert.match(sheet, /plusSheetRows\(supplierPlusRows\(/);
  assert.match(sheet, /plusSheetRows\(hostPlusRows\(/);
  assert.match(sheet, /r\.key === 'report' \? 'problem'/, 'the Report row lost its icon');
  const host = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(host, /lead=\{<CoupleThreadToolsSheet /, 'the host’s thread page draws no (+) — no Report');
  const supplier = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(supplier, /lead=\{<ThreadToolsSheet /, 'the supplier’s thread page draws no (+) — no Report');
});
