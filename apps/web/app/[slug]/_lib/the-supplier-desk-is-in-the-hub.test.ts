/**
 * THE SUPPLIER'S DESK IS IN THE HUB — and this is what stops it becoming a leak.
 *
 * S3, 2026-08-27. The doorway strip a booked supplier already sees on the
 * celebration's own page opens IN PLACE on the day and carries that day's
 * facts: the venue, the running order (the organiser's private cues included,
 * marked), the headcount, their tools. No new page, no new route — the owner
 * corrected that shape twice before a line was written.
 *
 * ── WHY THE ASSERTIONS ARE WHAT THEY ARE ────────────────────────────────────
 * Three of the four things that can go wrong here are invisible at runtime:
 *
 *   1. Reading the celebration's content with the ADMIN client that is already
 *      in scope on that page. One line, works immediately, and permanently
 *      removes the database's opinion about who may read a private schedule.
 *      Nothing would look wrong.
 *   2. Rendering the desk without the capability — the desk would appear for a
 *      guest, and a guest cannot tell they are seeing something they should not.
 *   3. Dropping the day gate — the desk would sit on a stranger's celebration
 *      page for a booked supplier eleven months early.
 *   4. Losing the private-line marking — a supplier reads a withheld cue aloud.
 *
 * So the first three are asserted BY SOURCE, which is the only place they are
 * visible, and the fourth is asserted on the rule and on the rendered markup.
 *
 * Run from inside this directory: `npx tsx --test ./the-supplier-desk-is-in-the-hub.test.ts`
 * 🪤 With a bracketed path it prints "# tests 0" and exits GREEN — and so does
 * every `--test` invocation that matches nothing. Require a NON-ZERO count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  supplierDeskIsOpen,
  deskTools,
  PRIVATE_LINE_NOTE,
} from '../../../lib/supplier-desk-rule';
import { dayOfModuleHref, DAY_OF_CONSOLE_HREF } from '../../../lib/vendor-dayof-module-href';

const SLUG_TREE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(SLUG_TREE, '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const LOADER = 'app/[slug]/_lib/supplier-desk.server.ts';
const PAGE = 'app/[slug]/page.tsx';
const DOORWAY = 'app/[slug]/_components/vendor-doorway.tsx';
const DESK = 'app/[slug]/_components/supplier-desk.tsx';

/** Comments explain this work at length; prose about the defect must never read
 *  as the defect. Block and line comments, and JSX comment wrappers. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'block' | 'line' | 'sq' | 'dq' | 'tick' = 'code';
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (mode === 'code') {
      if (two === '/*') { mode = 'block'; i += 2; continue; }
      if (two === '//') { mode = 'line'; i += 2; continue; }
      const c = src[i];
      if (c === "'") mode = 'sq';
      else if (c === '"') mode = 'dq';
      else if (c === '`') mode = 'tick';
      out += c; i += 1; continue;
    }
    if (mode === 'block') { if (two === '*/') { mode = 'code'; i += 2; } else i += 1; continue; }
    if (mode === 'line') { if (src[i] === '\n') { mode = 'code'; out += '\n'; } i += 1; continue; }
    const c = src[i];
    out += c;
    if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tick' && c === '`')) {
      mode = 'code';
    }
    i += 1;
  }
  return out;
}

// ── 1 · THE DAY GATE ───────────────────────────────────────────────────────

const TZ = 'Asia/Manila';
/** 2026-02-14 00:00 Manila = 2026-02-13T16:00Z. */
const DAY_START = Date.parse('2026-02-13T16:00:00Z');
const H = 3_600_000;

test('the desk is shut months out, and open on the day', () => {
  const base = { eventDate: '2026-02-14', tz: TZ };
  assert.equal(supplierDeskIsOpen({ ...base, nowMs: DAY_START - 60 * 24 * H }), false);
  assert.equal(supplierDeskIsOpen({ ...base, nowMs: DAY_START + 10 * H }), true, 'mid-afternoon on the day');
  assert.equal(supplierDeskIsOpen({ ...base, nowMs: DAY_START + 20 * H }), true, 'an 8pm reception');
});

test('the desk survives midnight and lets go at six the next morning', () => {
  const base = { eventDate: '2026-02-14', tz: TZ };
  assert.equal(
    supplierDeskIsOpen({ ...base, nowMs: DAY_START + 26 * H }),
    true,
    'a reception still running at 2am must not lose the desk because the calendar rolled over',
  );
  assert.equal(
    supplierDeskIsOpen({ ...base, nowMs: DAY_START + 30 * H + 1 }),
    false,
    'by 6am the next morning the night is over',
  );
});

test('a celebration that spans days keeps the desk open through its middle days', () => {
  // Day three of a five-day celebration. `isEventDayActive` only ever sees the
  // FIRST day, so without the end date this is exactly where the desk goes dark
  // while the celebration is still running.
  const mid = DAY_START + 3 * 24 * H;
  assert.equal(
    supplierDeskIsOpen({ eventDate: '2026-02-14', eventEndDate: '2026-02-18', tz: TZ, nowMs: mid }),
    true,
  );
  assert.equal(
    supplierDeskIsOpen({ eventDate: '2026-02-14', tz: TZ, nowMs: mid }),
    false,
    'and with no end date the same instant is past the single day — which is why the column had to be selected',
  );
});

test('a closed-out celebration has no desk, and neither has one with no date', () => {
  assert.equal(
    supplierDeskIsOpen({
      eventDate: '2026-02-14',
      clearedAt: '2026-02-15T02:00:00Z',
      tz: TZ,
      nowMs: DAY_START + 10 * H,
    }),
    false,
  );
  assert.equal(supplierDeskIsOpen({ eventDate: null, tz: TZ, nowMs: DAY_START + 10 * H }), false);
});

test('the timezone is not decoration — UTC would open the desk on the wrong side of midnight', () => {
  // 23:30 Manila on the 13th is 15:30Z — still the 13th in UTC, and 8 hours from
  // the venue's midnight. The window is wide enough that both answer `true`
  // here; what must NOT happen is the two agreeing by accident at the edge.
  const manila = supplierDeskIsOpen({ eventDate: '2026-02-14', tz: TZ, nowMs: DAY_START + 30 * H });
  const utc = supplierDeskIsOpen({ eventDate: '2026-02-14', tz: 'UTC', nowMs: DAY_START + 30 * H });
  assert.notEqual(manila, utc, 'the zone must move the answer at the closing edge');
});

// ── 2 · WHAT THE DESK MAY LINK TO ──────────────────────────────────────────

const MOD = (id: string, enabled = true) =>
  ({ id, label: id, blurb: id, enabled }) as Parameters<typeof deskTools>[0][number];

test('the desk never links to a tool that has no address of its own', () => {
  const tools = deskTools(
    [MOD('qr_scanner'), MOD('review_qr'), MOD('live_reviews'), MOD('guest_delivery')],
    'E1',
  );
  assert.deepEqual(tools, [], 'these are panels ON the floor console, not destinations');
  for (const id of ['qr_scanner', 'review_qr', 'live_reviews', 'guest_delivery'] as const) {
    assert.equal(dayOfModuleHref(id, 'E1'), null, `${id} gained an address — re-read this rule`);
  }
});

test('the five modules that share the console picker are not five tiles', () => {
  const tools = deskTools(
    [MOD('run_of_show'), MOD('pax_headcount'), MOD('shot_list'), MOD('issues_log'), MOD('delivery_handover')],
    'E1',
  );
  assert.deepEqual(tools, []);
  assert.equal(dayOfModuleHref('run_of_show', 'E1'), DAY_OF_CONSOLE_HREF);
});

test('the tools that DO live somewhere else are offered, with their own address', () => {
  const tools = deskTools([MOD('production_sheet'), MOD('setlist')], 'E1');
  assert.deepEqual(
    tools.map((t) => [t.id, t.href]),
    [
      ['production_sheet', '/vendor-dashboard/clients/E1/production-sheet'],
      ['setlist', '/vendor-dashboard/repertoire'],
    ],
  );
});

test('a module the supplier switched off is not on the desk', () => {
  assert.deepEqual(deskTools([MOD('production_sheet', false)], 'E1'), []);
});

test('the capture tool never moves onto the celebration page', () => {
  // Day-bound (its page bounces anyone whose booking is not dated today) and
  // held back by the build plan until the capture INSERT policy is read out of
  // production. A camera does not arrive as a side effect of a redesign.
  assert.deepEqual(deskTools([MOD('vendor_papic')], 'E1'), []);
  assert.equal(
    dayOfModuleHref('vendor_papic', 'E1'),
    '/vendor-dashboard/on-the-day/live/E1/papic',
    'it still has an address — the desk declines it deliberately, it is not missing',
  );
});

// ── 3 · THE THINGS ONLY SOURCE CAN SEE ─────────────────────────────────────

test('the desk reads the celebration under the supplier’s own session, never with the admin client', () => {
  const src = stripComments(read(LOADER));
  assert.equal(
    (src.match(/createAdminClient/g) ?? []).length,
    0,
    'the celebration page renders with the service role and an admin client is already in scope ' +
      'where this is called — one import here and every rule keeping a supplier out of the guest ' +
      'list and the private cues stops applying, with nothing looking wrong',
  );
  assert.match(src, /createClient\(\)/, 'it must open its own cookie-scoped client');
});

test('the desk is not taken from the brief’s timeline, which carries coordinator-only lines', () => {
  const src = stripComments(read(LOADER));
  assert.match(src, /fetchRunOfShowBlocks\(/);
  assert.doesNotMatch(
    src,
    /brief\??\.?\s*\.?timeline/,
    'get_vendor_event_brief is SECURITY DEFINER and its timeline select has NO visibility filter — ' +
      'it includes the coordinator-only lines the booked-supplier policy excludes',
  );
});

test('a brief that refuses gives back the door, never an empty desk', () => {
  const src = stripComments(read(LOADER));
  assert.match(src, /if \(briefError \|\| !briefData\) return null;/);
  assert.match(
    src,
    /brief\.stage !== 'booked'/,
    'the capability is minted off one column and the brief gates on another — they agree today ' +
      'and can diverge, and a desk built on that divergence is a page of empty panels',
  );
});

test('the desk cannot render without the capability, and cannot render off the day', () => {
  const page = stripComments(read(PAGE));
  assert.match(
    page,
    /const supplierDesk =\s*\n?\s*vendorCapability &&\s*\n?\s*supplierDeskIsOpen\(/,
    'both gates, in this order — the capability first, because it is what proves an account',
  );
  const door = stripComments(read(DOORWAY));
  assert.match(
    door,
    /if \(desk\) return <SupplierDesk/,
    'the desk must hang off the doorway’s own guarded mount point — a second mount is a second gate',
  );
  const desk = stripComments(read(DESK));
  assert.equal(
    (desk.match(/createClient|createAdminClient|\.from\(|\.rpc\(/g) ?? []).length,
    0,
    'the desk component must render from its model and read nothing itself',
  );
});

test('the private lines are shown AND marked — the owner ruled on both halves', () => {
  const desk = stripComments(read(DESK));
  assert.match(
    desk,
    /is_public === false/,
    'the marking is the only thing distinguishing a withheld cue: the booked-supplier read policy ' +
      'on event_schedule_blocks has no public/private filter, while the anonymous one does',
  );
  assert.match(desk, /PRIVATE_LINE_NOTE/);
  assert.doesNotMatch(
    desk,
    /\.filter\(\([^)]*\) => [a-z]*\.is_public\)/,
    'the private lines are NOT filtered out — owner 2026-08-27 chose the same notes in a new place ' +
      'over "schedule only"',
  );
  assert.match(PRIVATE_LINE_NOTE, /read aloud/);
});

test('the two columns the day gate depends on are actually SELECTED', () => {
  // 🔑 THE RULE ABOVE IS ONLY AS REAL AS THE READ UNDER IT. Both fields were
  // being cast for on the page while the event shell's select named neither, so
  // the multi-day arm resolved `undefined` forever and nothing could see it.
  // The shell reads with the service role, which holds table-level SELECT on
  // `events`, so naming a column here cannot trip the per-column allowlist that
  // makes PostgREST refuse the whole query for a user session.
  const loaders = stripComments(read('app/[slug]/_lib/loaders.ts'));
  assert.match(loaders, /event_date, event_end_date, cleared_at,/);
});

test('the desk brings this day and nothing else — no other client, no money', () => {
  const desk = stripComments(read(DESK)).toLowerCase();
  for (const forbidden of ['invoice', 'payout', 'earnings', 'centavos', '₱']) {
    assert.ok(
      !desk.includes(forbidden),
      `"${forbidden}" reached the desk — a supplier works many bookings, and their week, their ` +
        'invoices and their other clients do not belong inside one celebration’s page',
    );
  }
});
