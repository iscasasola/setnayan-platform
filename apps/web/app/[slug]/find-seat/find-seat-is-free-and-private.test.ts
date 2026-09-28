/**
 * 🪑 FIND YOUR SEAT — FREE FOR A KEY HOLDER, SILENT TO A STRANGER.
 *
 * Owner 2026-09-27, "ok to all" (spec corpus `DECISION_LOG.md` row "FIND YOUR
 * SEAT, REDESIGNED", prototype `prototypes/find_your_seat_2026-09-27.html`).
 * Each block below holds one of the rulings as a PROPERTY, executed — not a
 * phrase in a file — except where the property is structural (which branch a
 * component renders in), and those read code with comments stripped.
 *
 *   1 · a stranger's open search carries NO NAME — not in the response, not in
 *       the render, whatever the RPC returns;
 *   2 · a key holder NEVER sees the field;
 *   3 · a key holder who is not seated gets A4, the honest "you're on the list"
 *       — and the open link never says it (ONE merged message there);
 *   4 · the quiet rate limit: ~10 a minute per DEVICE, not per connection;
 *   5 · the table, the map and the door pass need no CUSTOM_QR_GUEST.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { rateLimit } from '@/lib/rate-limit';
import {
  findSeatMode,
  isSeatDeviceId,
  noTableForThatName,
  openSeatMatches,
  publicDisplayName,
  seatLookupDeviceKey,
  seatsStillOpen,
  postmarkDate,
  SEAT_LOOKUP_DEVICE_BUCKET,
  SEAT_LOOKUP_DEVICE_LIMIT,
  SEAT_LOOKUP_DEVICE_WINDOW_SECS,
  type SeatViewerKind,
} from '@/lib/find-your-seat';
import type { SeatLookupRow } from '@/lib/seat-lookup';
import type { EventTableRow } from '@/lib/seating';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const WEB = join(HERE, '..', '..', '..');
const read = (...p: string[]) => stripComments(readFileSync(join(...p), 'utf8'));

/** A `'use client'` module lands under `.default` when imported under tsx. */
async function load<T>(path: string, name: string): Promise<T> {
  const mod = (await import(path)) as Record<string, unknown> & { default?: Record<string, unknown> };
  const v = (mod[name] ?? mod.default?.[name]) as T | undefined;
  assert.ok(v, `${path} lost its ${name} export — re-anchor this guard rather than deleting it`);
  return v;
}

const TABLES: EventTableRow[] = [1, 2, 3, 4, 5].map((n, i) => ({
  table_id: `t${n}`,
  public_id: `S89T-${n}`,
  event_id: 'e1',
  table_label: `Table ${n}`,
  table_type: 'round_8',
  capacity: 8,
  sort_order: i,
  x_pos: 15 + i * 17,
  y_pos: 30 + (i % 2) * 30,
})) as EventTableRow[];
const ENTRANCE = { x: 50, y: 95 } as never;

// A tiny seeded PRNG so a failure prints a reproducible case.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const FIRST = ['Ana', 'Ben', 'Lola Mercedes', 'Boy', 'Nene', 'Carla', 'José', 'María Clara', 'Ñiño', 'Zed'];
const LAST = ['Reyes', 'Santos', 'Dela Cruz', 'Ocampo', 'Bautista', "O'Brien", 'Lim', 'Tan'];

// ═══ 1 · A STRANGER'S SEARCH CARRIES NO NAME ════════════════════════════════

test('1a · the open response never carries a name — 500 random RPC answers', () => {
  const r = rng(20260927);
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(r() * 6);
    const rows: SeatLookupRow[] = [];
    const names: string[] = [];
    for (let k = 0; k < n; k++) {
      const name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`;
      names.push(name);
      rows.push({
        display_name: name,
        table_label: `Table ${1 + Math.floor(r() * 9)}`,
        walk_zone_label: r() > 0.5 ? 'Garden' : null,
        walk_video_key: r() > 0.7 ? 'r2://setnayan-media/walk.mp4' : null,
      });
    }
    const out = openSeatMatches(rows, new Map([['r2://setnayan-media/walk.mp4', 'https://x/walk.mp4']]));
    const wire = JSON.stringify({ matches: out });
    for (const name of names) {
      assert.ok(!wire.includes(name), `case ${i}: the response carries "${name}": ${wire}`);
    }
    assert.ok(!/display_name|first_name|last_name/.test(wire), `case ${i}: a name FIELD reached the wire: ${wire}`);
    for (const m of out) {
      assert.deepEqual(Object.keys(m).sort(), ['table_label', 'walk_video_url', 'walk_zone_label']);
    }
  }
});

test('1b · the route sends only what openSeatMatches built — the RPC row never reaches the response', () => {
  const route = read(WEB, 'app', 'api', 'seat-lookup', '[slug]', 'route.ts');
  assert.match(route, /const matches = openSeatMatches\(rows, keyToUrl\);/, 'the route no longer builds its answer through openSeatMatches');
  const responses = [...route.matchAll(/NextResponse\.json\(([^)]*)\)/g)].map((m) => m[1]!);
  assert.ok(responses.length >= 3, `found ${responses.length} responses — this guard is blind`);
  for (const body of responses) {
    assert.ok(!/rows|data|display_name/.test(body), `a response sends raw RPC data: NextResponse.json(${body})`);
  }
});

test('1c · the found card renders no name, even if a name were smuggled into the match', async () => {
  const FoundCard = await load<React.FC<Record<string, unknown>>>('./_components/name-search', 'FoundCard');
  const smuggled = { table_label: 'Table 3', walk_zone_label: null, walk_video_url: null, display_name: 'Ana Reyes', first_name: 'Ana' };
  const html = renderToStaticMarkup(
    React.createElement(FoundCard, { matches: [smuggled], tables: TABLES, entrance: ENTRANCE, litId: 't3' }),
  );
  assert.match(html, /Table 3/, 'the found card did not render the table — this test is looking at nothing');
  assert.ok(!html.includes('Ana'), 'the found card rendered a name');
  assert.match(html, /You/, 'the lit table carries no YOU pin');
});

// ═══ 2 · A KEY HOLDER NEVER TYPES ═══════════════════════════════════════════

test('2a · the mode: a key holder is never given the search; a stranger never a seat', () => {
  for (const viewer of ['cookie', 'seat', 'anonymous'] as SeatViewerKind[]) {
    for (const published of [true, false]) {
      for (const tableId of ['t3', null]) {
        const mode = findSeatMode({ viewer, published, tableId });
        if (viewer === 'anonymous') {
          assert.ok(mode === 'search' || mode === 'not_posted', `${viewer}/${published}/${tableId} → ${mode}`);
        } else {
          assert.ok(mode === 'your_seat' || mode === 'not_seated', `${viewer}/${published}/${tableId} → ${mode}`);
        }
      }
    }
  }
  // A draft never reveals a seat, even to its owner.
  assert.equal(findSeatMode({ viewer: 'seat', published: false, tableId: 't3' }), 'not_seated');
});

test('2b · the page mounts the search ONLY inside the anonymous branch', () => {
  const page = read(HERE, 'page.tsx');
  const anon = page.indexOf("if (viewer.kind === 'anonymous') {");
  const known = page.indexOf('const guestId = viewer.session.guest_id;');
  const search = [...page.matchAll(/<NameSearch\b/g)].map((m) => m.index!);
  assert.ok(anon > 0 && known > anon, 'the anonymous branch is not where this guard expects — re-anchor it');
  assert.equal(search.length, 1, `NameSearch is mounted ${search.length} times`);
  assert.ok(search[0]! > anon && search[0]! < known, 'NameSearch renders outside the anonymous branch — a key holder would be asked to type');
  assert.match(page, /readGuestViewerForEvent\(event\.event_id\)/, 'the page no longer asks the ONE resolver who is looking');
});

const SEAT_PROPS = {
  firstName: 'Ana',
  names: 'Indalecio & Claire',
  occasionLine: 'Reception · December 18, 2026',
  doorsOpenLabel: 'Today · doors open 5:00 pm',
  published: true,
  tables: TABLES,
  entrance: ENTRANCE,
  mates: [
    { name: 'Ana R.', you: true },
    { name: 'Ben R.', you: false },
  ],
  seatsOpen: 6,
  venueHref: '/x/venue',
  inviteHref: '/x',
  plural: true,
  pass: {
    names: 'Indalecio & Claire',
    dateLabel: 'December 18, 2026',
    tableLabel: 'Table 3',
    guestName: 'Ana Reyes',
    partyLine: null,
    qrSvg: '<svg></svg>',
    seal: 'I&C',
    checkedInAt: null,
  },
};

test('2c · A1 and A2 render no field — and exactly one button', async () => {
  const YourSeat = await load<React.FC<Record<string, unknown>>>('./_components/your-seat', 'YourSeat');
  for (const dayOf of [false, true]) {
    const html = renderToStaticMarkup(
      React.createElement(YourSeat, { ...SEAT_PROPS, dayOf, table: { table_id: 't3', table_label: 'Table 3', capacity: 8 } }),
    );
    assert.match(html, /Table 3/, 'the seat did not render — this test is looking at nothing');
    assert.doesNotMatch(html, /<input|<form|<textarea/, `${dayOf ? 'A2' : 'A1'} renders a field`);
    assert.equal((html.match(/<button/g) ?? []).length, 1, `${dayOf ? 'A2' : 'A1'} has more than one button`);
    assert.match(html, /Show at the door/);
    assert.match(html, /Walk the room in 3D/, '3D is a quiet link on the seat');
  }
});

// ═══ 3 · A4 FOR THE KEY HOLDER; ONE MESSAGE ON THE OPEN LINK ════════════════

test('3a · A4 when unseated: the honest line, the faint room, no button', async () => {
  const YourSeat = await load<React.FC<Record<string, unknown>>>('./_components/your-seat', 'YourSeat');
  for (const published of [true, false]) {
    const html = renderToStaticMarkup(
      React.createElement(YourSeat, { ...SEAT_PROPS, published, dayOf: false, table: null, mates: [], pass: null }),
    );
    assert.match(html, /You(’|&#x27;|')re on the list, Ana\./, 'A4 does not tell a key holder they are on the list');
    assert.match(html, /Your table will appear here/);
    assert.doesNotMatch(html, /<button|<input/, 'A4 has a button or a field — there is nothing to do');
    assert.doesNotMatch(html, /Show at the door/);
  }
});

test('3b · the open link says ONE thing for "not on the list" and "not seated"', () => {
  const search = read(HERE, '_components', 'name-search.tsx');
  // The honest sentence belongs to the key holder only.
  assert.doesNotMatch(search, /on the list/i, 'the open search tells a stranger somebody is on the list');
  // Exactly one not-found render, fed by the one message.
  assert.equal((search.match(/data-no-table/g) ?? []).length, 1, 'more than one not-found render on the open link');
  assert.match(search, /noTableForThatName\(names\)/);
  // And zero matches is the ONLY road to it — a failure has its own words.
  assert.match(search, /kind: 'failed'/, 'a failed lookup no longer has its own state');
  const m = noTableForThatName('Indalecio & Claire');
  assert.equal(m.title, 'No table for that name yet');
  assert.ok(m.lines.every((l) => !/on the list,? *(you|Ana)|isn.t set/i.test(l)), 'the merged message leaks which case it is');
});

test('3c · a failed RPC read is a 503, never the empty answer that reads as "no table"', () => {
  const route = read(WEB, 'app', 'api', 'seat-lookup', '[slug]', 'route.ts');
  const at = route.indexOf("admin.rpc('public_seat_lookup'");
  const after = route.slice(at, at + 600);
  assert.match(after, /if \(error\) \{[\s\S]*?status: 503/, 'an RPC error answers something other than 503');
});

// ═══ 4 · THE QUIET RATE LIMIT ═══════════════════════════════════════════════

test('4a · ten a minute per device — the eleventh waits, another device does not', () => {
  assert.equal(SEAT_LOOKUP_DEVICE_LIMIT, 10);
  assert.equal(SEAT_LOOKUP_DEVICE_WINDOW_SECS, 60);
  const a = seatLookupDeviceKey({ slug: 'cale-test', deviceId: 'a'.repeat(24), ip: '10.0.0.1', userAgent: 'iPhone' });
  const b = seatLookupDeviceKey({ slug: 'cale-test', deviceId: 'b'.repeat(24), ip: '10.0.0.1', userAgent: 'iPhone' });
  const key = (k: string) => `${SEAT_LOOKUP_DEVICE_BUCKET}:${k}:${Date.now()}:${Math.random()}`;
  const ka = key(a);
  const kb = key(b);
  for (let i = 1; i <= SEAT_LOOKUP_DEVICE_LIMIT; i++) {
    assert.ok(rateLimit(ka, SEAT_LOOKUP_DEVICE_LIMIT, SEAT_LOOKUP_DEVICE_WINDOW_SECS * 1000).ok, `try ${i} was refused`);
  }
  assert.equal(rateLimit(ka, SEAT_LOOKUP_DEVICE_LIMIT, SEAT_LOOKUP_DEVICE_WINDOW_SECS * 1000).ok, false, 'the 11th try in a minute went through');
  assert.ok(rateLimit(kb, SEAT_LOOKUP_DEVICE_LIMIT, SEAT_LOOKUP_DEVICE_WINDOW_SECS * 1000).ok, 'a second phone on the same wifi was throttled');
});

test('4b · the key: one device on one event; no id → connection + browser; a forged id is ignored', () => {
  const base = { slug: 'Cale-Test', ip: '10.0.0.1', userAgent: 'Mozilla/5.0 (iPhone)' };
  const id = '0123456789abcdef01234567';
  assert.equal(seatLookupDeviceKey({ ...base, deviceId: id }), seatLookupDeviceKey({ ...base, deviceId: id, ip: '10.9.9.9' }), 'the device key moved with the IP');
  assert.notEqual(seatLookupDeviceKey({ ...base, deviceId: id }), seatLookupDeviceKey({ ...base, slug: 'other', deviceId: id }), 'one budget spans two events');
  const noId = seatLookupDeviceKey({ ...base, deviceId: null });
  assert.equal(seatLookupDeviceKey({ ...base, deviceId: 'Robert; DROP' }), noId, 'a malformed id was trusted');
  assert.notEqual(noId, seatLookupDeviceKey({ ...base, deviceId: null, userAgent: 'Android' }), 'two browsers on one wifi share a budget');
  assert.ok(!noId.includes('iPhone'), 'the raw user agent is stored in the limiter key');
  assert.ok(isSeatDeviceId(id) && !isSeatDeviceId('abc') && !isSeatDeviceId(null));
});

test('4c · the route spends the device budget, beside — not instead of — the connection one', () => {
  const route = read(WEB, 'app', 'api', 'seat-lookup', '[slug]', 'route.ts');
  assert.match(route, /enforceRateLimit\('seat_lookup', clientIp\(req\.headers\)/, 'the per-connection limit is gone');
  assert.match(
    route,
    /enforceRateLimit\(\s*SEAT_LOOKUP_DEVICE_BUCKET,\s*seatLookupDeviceKey\([\s\S]*?\{ limit: SEAT_LOOKUP_DEVICE_LIMIT, windowSecs: SEAT_LOOKUP_DEVICE_WINDOW_SECS \}/,
    'the per-device limit is not applied with its own numbers',
  );
  const lookup = route.indexOf("admin.rpc('public_seat_lookup'");
  const spend = route.indexOf('SEAT_LOOKUP_DEVICE_BUCKET,');
  assert.ok(spend > 0 && spend < lookup, 'the device budget is checked AFTER the lookup ran');
  // Spending the budget is not enforcing it: the refusal must turn the request
  // away before the lookup, or the limit is a counter nobody reads.
  const refuse = route.search(/if \(!(\w+)\.ok\) return rateLimited429\(\1\.retryAfterSecs\);[\s\S]*?admin\.rpc\('public_seat_lookup'/);
  const deviceVar = /const (\w+) = await enforceRateLimit\(\s*SEAT_LOOKUP_DEVICE_BUCKET/.exec(route)?.[1];
  assert.ok(deviceVar, 'the device limit result is no longer kept');
  assert.ok(
    new RegExp(`if \\(!${deviceVar}\\.ok\\) return rateLimited429\\(${deviceVar}\\.retryAfterSecs\\);`).test(route) &&
      route.indexOf(`if (!${deviceVar}.ok)`) < lookup,
    'the device limit is counted but never refuses anyone',
  );
  assert.ok(refuse > 0, 'no limit refuses before the lookup');
  const client = read(HERE, '_components', 'name-search.tsx');
  assert.match(client, /headers\[SEAT_DEVICE_HEADER\] = id/, 'the search no longer sends its device id');
});

// ═══ 5 · FREE: NO SKU ON THE WAY TO THE TABLE, THE MAP OR THE PASS ══════════

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

test('5a · nothing under /find-seat asks for CUSTOM_QR_GUEST (or any SKU)', () => {
  const files = walk(HERE);
  assert.ok(files.length >= 6, `walked ${files.length} files — this guard is blind`);
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(
      src,
      /CUSTOM_QR_GUEST|eventOwnsCustomQrGuest|eventSkuActive|eventOwnsSku|seat-pass'/,
      `${f.slice(HERE.length)} gates the free seat on a purchase`,
    );
  }
});

test('5b · the pass is built for every seated key holder — the only condition is the seat', () => {
  const page = read(HERE, 'page.tsx');
  const open = page.indexOf('if (table) {');
  const build = page.indexOf('pass = {');
  assert.ok(open > 0 && build > open, 'the pass is not built inside the seated branch — re-anchor this guard');
  // Between the seat and its pass, the only branches allowed are "a read
  // failed → throw" and "this table has people on it". Anything else is a new
  // condition on a free thing.
  const between = page
    .slice(open + 'if (table) {'.length, build)
    .replace(/if \(\w+Err\) throw [^;]*;/g, '')
    .replace(/if \(ids\.length > 0\) \{/g, '');
  assert.doesNotMatch(between, /\bif \(/, 'a new condition now stands between a seat and its pass');
  assert.match(page, /renderInvitationQrSvg\(/, 'the pass no longer carries the invitation QR the door scans');
});

test('5c · the event page links the seat without asking about ownership', () => {
  const loaders = read(WEB, 'app', '[slug]', '_lib', 'loaders.ts');
  const at = loaders.indexOf('const seatPassActive');
  const expr = loaders.slice(at, loaders.indexOf(';', at));
  assert.doesNotMatch(expr, /ownsCustomQr|eventOwnsCustomQrGuest/, 'the seat link is gated on the paid SKU again');
  const body = read(WEB, 'app', '[slug]', '_components', 'site-body.tsx');
  assert.equal((body.match(/<SeatDoorLine\b/g) ?? []).length, 1, 'the Details scene lost (or doubled) its seat line');
  const page = read(WEB, 'app', '[slug]', 'page.tsx');
  assert.equal((page.match(/<SeatDoorLine\b/g) ?? []).length, 1, 'the Me panel lost (or doubled) its seat line');
});

// ═══ the small pure pieces ══════════════════════════════════════════════════

test('tablemates read "Ben R."; open seats never go negative; the postmark reads the calendar', () => {
  assert.equal(publicDisplayName('Ben', 'Reyes'), 'Ben R.');
  assert.equal(publicDisplayName('Lola Mercedes', 'reyes'), 'Lola Mercedes R.');
  assert.equal(publicDisplayName('  ', 'Reyes'), 'R.');
  assert.equal(seatsStillOpen(8, 6), 2);
  assert.equal(seatsStillOpen(8, 10), 0);
  assert.equal(seatsStillOpen(null, 3), 0);
  assert.equal(postmarkDate('2026-12-18'), '18 · XII · 2026');
  assert.equal(postmarkDate(null), null);
});
