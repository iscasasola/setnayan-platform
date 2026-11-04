/**
 * ⏰ A TIME-TBA CHAPTER SHOWS SUPPLIERS "TIME TBA", NEVER HIDDEN (owner 2026-11-02, corpus DECISION_LOG "TEN OWNER YESES"
 * item 4; plan SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01 §3 "Chapter time TBA = no call time").
 *
 * A supplier on a chapter whose time is not set yet must still SEE that chapter — with "Time TBA" and no call time.
 * Hiding it reads, to the supplier, as "you are not on it". Held over the REAL readers a supplier sees:
 *
 *   1 · their Schedule view (Customer › Schedule, `SupplierSchedule` over `buildSupplierDay`) keeps the chapter and its
 *       moments, each reading "Time TBA" — drawn, never 12:00 AM — and sorts it after the day's timed chapters;
 *   2 · the page that feeds that view reads EVERY block (no `onlyTimedBlocks` on its read) — driven with a fake client;
 *   3 · the booked Team row and the quote (`readBookedSchedule`, `readQuoteWhere`): the chapter stays in Where, and it
 *       gives no call time — nor does a moment inside it (found by this guard: such a moment gave a 12:00 AM call);
 *   4 · their calendar file writes it as an all-day "· Time TBA" item;
 *   5 · the host's View as › Suppliers by time lists its suppliers "Time TBA" (and View as › a supplier keeps it);
 *   6 · EVERY supplier-side `onlyTimedBlocks` fence (app/vendor-dashboard, app/join, lib/supplier-*) is a clock reader —
 *       a call time, "now / next", a live cue list — listed below with its reason. A new fence there fails until it
 *       says why a TBA chapter is not the supplier's to see.
 *
 * Sabotage (recorded in the PR): put `onlyTimedBlocks(` back on the Customer page's block read → (2) and (6) red; drop
 * TBA chapters in `buildSupplierDay` (`.filter((b) => !b.time_tba)`) → (1) red; `suppliersByTime` without `tba` → (5) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { blocksWithAClock, buildSupplierDay, type SupplierBlockRow } from './supplier-schedule';
import { whereChaptersFrom } from './supplier-where';
import { timelineIcsEvents } from './supplier-timeline-ics';
import { TIME_TBA, chaptersFromBlocks } from './schedule-chapters';
import { supplierDay, suppliersByTime, type ViewAsData, type ViewMoment } from './schedule-view-as';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The view imports the shipped server actions (`server-only`); a CSS module is its class names. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const { SupplierSchedule } = require('../app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule') as typeof import('../app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule');
const { readBookedSchedule, readQuoteWhere } = require('./booked-call-times.server') as typeof import('./booked-call-times.server');

const WEB = join(__dirname, '..');
const DAY = '2026-12-18';
const T = (hhmm: string) => `${DAY}T${hhmm}:00.000Z`;
const ME = 'ev-me';
const MIDNIGHT = /12:00\s*AM/i;

const block = (over: Partial<SupplierBlockRow> & Pick<SupplierBlockRow, 'block_id' | 'label'>): SupplierBlockRow => ({
  parent_block_id: null,
  start_at: T('10:00'),
  end_at: null,
  location: null,
  spot: null,
  time_tba: false,
  is_optional: false,
  responsible_vendor_ids: [],
  created_at: null,
  updated_at: null,
  ...over,
});
/** A TBA chapter keeps only its DAY in start_at, at the placeholder 00:00. */
const BLOCKS: SupplierBlockRow[] = [
  block({ block_id: 'send', label: 'Send-off', start_at: T('00:00'), time_tba: true, responsible_vendor_ids: [ME] }),
  block({ block_id: 's1', parent_block_id: 'send', label: 'Sparkler exit photos', start_at: T('00:00'), responsible_vendor_ids: [ME] }),
  block({ block_id: 'cer', label: 'Ceremony', start_at: T('15:00'), end_at: T('16:00'), location: 'San Vicente', responsible_vendor_ids: [ME] }),
  block({ block_id: 'c1', parent_block_id: 'cer', label: 'Processional', start_at: T('15:00') }),
];

test('1 · the supplier’s Schedule view keeps a TBA chapter, reads "Time TBA", never 12:00 AM, after the timed ones', () => {
  const day = buildSupplierDay({ blocks: BLOCKS, myBookingIds: [ME], tasks: [], requests: [] });
  const send = day.chapters.find((c) => c.block_id === 'send');
  assert.ok(send, 'the Time-TBA chapter was dropped from the supplier’s day');
  assert.equal(send!.time_tba, true);
  assert.equal(send!.linked, true, 'the supplier is on the TBA chapter and it reads as not theirs');
  assert.deepEqual(send!.moments.map((m) => m.clock), [TIME_TBA], 'a moment in a TBA chapter must read "Time TBA"');
  assert.deepEqual(day.chapters.map((c) => c.block_id), ['cer', 'send'], 'a TBA chapter sorted as if at midnight');

  const html = renderToStaticMarkup(
    React.createElement(SupplierSchedule, { eventId: 'e', lab: true, day, autoAgree: false, marks: { seenAt: null, confirmedAt: null }, changed: false, finalWeek: false, tasksRead: true, answered: [] }),
  );
  const sendHtml = html.slice(html.indexOf('data-supplier-chapter="send"'));
  assert.ok(html.includes('data-supplier-chapter="send"'), 'the TBA chapter is not drawn on the supplier’s Schedule');
  assert.match(sendHtml, /Send-off/);
  assert.ok((sendHtml.match(/Time TBA/g) ?? []).length >= 2, 'the chapter and its moment must each say "Time TBA"');
  assert.doesNotMatch(html, MIDNIGHT, 'a TBA chapter was drawn at 12:00 AM');
});

/** A fake client that answers `from(table).select().eq()…` with `rows`, honouring every `.eq(column, value)` filter. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>) {
  const seen: Array<{ table: string; column: string; value: unknown }> = [];
  const chain = (table: string, rows: Record<string, unknown>[]): unknown => {
    const q = {
      select: () => q,
      order: () => q,
      is: () => q,
      eq: (column: string, value: unknown) => {
        seen.push({ table, column, value });
        return chain(table, rows.filter((r) => !(column in r) || r[column] === value));
      },
      then: (ok: (v: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok),
    };
    return q;
  };
  return { client: { from: (table: string) => chain(table, tables[table] ?? []) } as never, seen };
}

const DB_BLOCKS = BLOCKS.map((b) => ({ ...b, event_id: 'e' }));

test('2 · the Customer page reads every block: no Time-TBA fence on the read its Schedule view is built from', () => {
  const page = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/clients/[eventId]/page.tsx'), 'utf8'));
  assert.doesNotMatch(page, /onlyTimedBlocks\(/, 'the Customer page fences Time-TBA chapters out of the read its Schedule view is built from');
  assert.doesNotMatch(page, /\.eq\(\s*'time_tba'\s*,\s*false\s*\)/, 'the Customer page filters time_tba = false');
  assert.match(page, /buildSupplierDay\(\{\s*blocks:\s*everyBlock\b/, 'the supplier’s day is built from a narrowed block list');
  // …and the clock readers on the same page (timeline, run of show, call time) drop the TBA chapter AND its moments.
  assert.deepEqual(blocksWithAClock(BLOCKS).map((b) => b.block_id), ['cer', 'c1'], 'a TBA chapter or its moment reached a clock reader');
});

test('3 · the Team row and the quote keep a TBA chapter in Where and give it no call time', async () => {
  const { client, seen } = fakeClient({ event_schedule_blocks: DB_BLOCKS });
  const read = await readBookedSchedule(client, 'e', [ME]);
  assert.ok(read, 'the fake read was refused');
  assert.deepEqual(seen.filter((s) => s.column === 'time_tba'), [], 'the Team row’s read fences TBA chapters out');
  assert.ok(read!.chapters.some((c) => c.blockId === 'send'), 'the TBA chapter left the Team row’s Where');
  assert.equal(read!.callTimes.get(ME)?.label, 'Ceremony', 'a TBA chapter gave the call time (or the timed one was lost)');
  assert.doesNotMatch(read!.callTimes.get(ME)?.startAt ?? '', /T00:00/);

  const quote = fakeClient({
    event_schedule_blocks: DB_BLOCKS,
    event_vendors: [{ event_id: 'e', vendor_id: ME, vendor_name: 'Lumina', category: 'photography', status: 'booked', archived_at: null, marketplace_vendor_id: 'shop' }],
  });
  const q = await readQuoteWhere(quote.client, 'e', 'shop');
  assert.equal(q.kind, 'ok');
  assert.deepEqual(quote.seen.filter((s) => s.column === 'time_tba'), [], 'the quote’s read fences TBA chapters out');
  assert.ok(whereChaptersFrom(DB_BLOCKS).some((c) => c.blockId === 'send'), 'Where drops a TBA chapter');
  assert.match(JSON.stringify(q), /send/, 'the TBA chapter left the quote’s Where');
});

test('4 · the supplier’s calendar file writes a TBA chapter as an all-day "· Time TBA" item', () => {
  const lines = timelineIcsEvents([{ block_id: 'send', label: 'Send-off', start_at: `${DAY}T00:00:00+00:00`, end_at: null, location: null, time_tba: true }], '20261101T000000Z');
  assert.ok(lines.includes(`SUMMARY:Send-off · ${TIME_TBA}`), lines.join('\n'));
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20261218'), lines.join('\n'));
});

test('5 · Suppliers by time and View as › a supplier list a TBA chapter’s suppliers "Time TBA"', () => {
  const tba = chaptersFromBlocks(DB_BLOCKS).find((c) => c.block_id === 'send')!;
  assert.equal(tba.time_tba, true);
  const m: ViewMoment = {
    block_id: 's1', parent_block_id: 'send', label: 'Sparkler exit photos', start_at: T('00:00'), end_at: null, is_public: false, staged: false,
    audience: null, responsible_vendor_ids: [ME], location: null, spot: null, travel_from: null, travel_to: null,
  };
  const data: ViewAsData = { moments: [m], tasks: [], suppliers: [{ vendor_id: ME, name: 'Lumina', booked: true }], groups: {}, roleNames: {} };
  const byTime = suppliersByTime([tba], data);
  assert.equal(byTime.stretches.length, 0, 'a TBA chapter has no clock to overlap on');
  const items = byTime.tba.flatMap((g) => g.items);
  assert.ok(items.some((i) => i.vendorId === ME), 'Suppliers by time hid the TBA chapter’s supplier');
  for (const i of items) {
    assert.equal(i.time, TIME_TBA);
    assert.equal(i.until, '', 'a TBA line has no "until"');
  }
  const mine = supplierDay([tba], data, ME, null);
  assert.ok(mine.chapters.some((c) => c.chapter.block_id === 'send'), 'View as › the supplier hid the TBA chapter');
  assert.equal(mine.call, null, 'a TBA chapter gave a call time');
});

/**
 * Supplier-side readers that fence Time-TBA chapters out ON PURPOSE — each a CLOCK reader, where a TBA chapter has no
 * clock to give. The chapter itself still reaches the supplier through their Schedule view, their calendar file and Where.
 */
const FENCED_ON_PURPOSE: Record<string, string> = {
  'app/vendor-dashboard/clients/[eventId]/_components/script-tab.tsx': 'the timed MC script (cue by cue at a clock time) — a TBA chapter has no cue time',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/stage-script/stage-script.tsx': 'the live stage script on the day — cues by clock',
  'lib/supplier-today.server.ts': 'the event-day numbers — "started at" and "next" are clocks; a TBA 00:00 would read as started at midnight',
  'lib/supplier-night-before-email.ts': 'the night-before call time — a TBA chapter gives none (plan §3)',
  'app/join/crew/[token]/page.tsx': "a crew member's on-the-day run of show (`HubRunOfShow`, the live now / next list) — clocks only; their shop's Schedule view lists the TBA chapter",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('6 · every supplier-side Time-TBA fence is a clock reader that says why', () => {
  const files = [
    ...walk(join(WEB, 'app/vendor-dashboard')),
    ...walk(join(WEB, 'app/join')),
    ...readdirSync(join(WEB, 'lib')).filter((n) => /^supplier-.*\.tsx?$/.test(n) && !/\.test\./.test(n)).map((n) => join(WEB, 'lib', n)),
  ];
  assert.ok(files.length > 50, `only ${files.length} supplier files scanned — the scan is not seeing the tree`);
  const fenced = files
    .filter((p) => /onlyTimedBlocks\(|\.eq\(\s*'time_tba'\s*,\s*false\s*\)/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p))
    .sort();
  console.log(`[tba-supplier] fenced supplier readers: ${fenced.length} of ${files.length} files`);
  assert.deepEqual(
    fenced.filter((f) => !(f in FENCED_ON_PURPOSE)),
    [],
    'a supplier reader drops Time-TBA chapters — show them "Time TBA" instead, or list it here with why a clock reader may',
  );
  const stale = Object.keys(FENCED_ON_PURPOSE).filter((f) => !fenced.includes(f));
  assert.deepEqual(stale, [], `remove these lines — the file no longer fences TBA out: ${stale.join(', ')}`);
});
