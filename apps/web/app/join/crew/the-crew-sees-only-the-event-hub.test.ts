/**
 * 📱 THE CREW SEES ONLY THE EVENT HUB (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND
 * SEE ONLY THE EVENT HUB": *"since they are just crew, they do not need to see today, customers and shop and the
 * settings of their event hub"*). The database half (a crew session reads nothing but its own pass) is
 * `tests/db/crew-pass-sees-only-its-event.db.test.ts`; this is the page half:
 *
 *   1. the crew's page lives OUTSIDE the supplier dashboard and draws none of its frame — no bar, no rail, no
 *      Today / Customers / Shop, no settings;
 *   2. it reads the event (with the admin client) ONLY after the database said the pass is effective AND the shop's
 *      booking fee gate is open, and every one of those reads is scoped to that ONE event (or the pass's shop's name);
 *   3. the role decides the tools, rendered: a Helper gets the scanner only, a Member the run of show too;
 *   4. the scanner asks the CREW door (`crew_seat_by_guest_qr`), never the coordinator's;
 *   5. 🔒 the crew never read MORE than the shop: the run of show (an admin-client read, past RLS) carries the booked
 *      shop's fence — no coordinator's unreleased prep (`visibility = 'coordinator_only'`). The db half, that the fence
 *      equals `event_schedule_blocks_booked_vendor_read` row for row, is in the crew db test;
 *   6. 🚪 a door that never opens is not drawn: the scanner is only for a COORDINATOR shop's crew (its door refuses
 *      every other shop), and a Helper of any other shop is told in words what the pass does give.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { crewRoleOpens, crewRowLine } from '@/lib/crew-pass';
import { onlyWhatABookedShopMaySee } from '@/lib/schedule';

(globalThis as { React?: typeof React }).React = React;

const HERE = import.meta.dirname;
const WEB = join(HERE, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = 'app/join/crew/[token]/page.tsx';
const SCREENS = 'app/join/crew/[token]/_components/crew-screens.tsx';

test('1 · the crew page is outside the supplier dashboard and draws none of its frame', () => {
  for (const f of [PAGE, SCREENS]) {
    const s = src(f);
    assert.doesNotMatch(s, /VendorBottomNav|VendorRailContext|vendorBarItems|FrontDoorShell|SupplierPageMenu|BottomNav\b/, `${f} draws the supplier's frame`);
    // Imports of shared drawing pieces are fine; a LINK into the dashboard is not.
    assert.doesNotMatch(s, /href=["{`][^"}`]*\/vendor-dashboard/, `${f} links into the supplier dashboard`);
  }
});

test('2 · the event is read only after the pass is proven effective — and only that event', () => {
  const s = src(PAGE);
  const proven = s.indexOf('if (!pass.effective) return');
  const admin = s.indexOf('createAdminClient()');
  const fee = s.indexOf("if (feeGate.stage !== 'unlocked') return");
  assert.ok(proven > 0, 'the page never asks whether the pass opens anything now');
  assert.ok(fee > proven, 'the shop’s booking-fee gate is not asked for its crew');
  assert.match(s, /const feeGate = await resolveEventFeeGate\(pass\.vendor_profile_id, eventId\);/, 'the fee gate is not the SHOP’s');
  assert.ok(admin > fee, 'the admin client is made before the pass and the fee are proven');
  assert.equal([...s.matchAll(/createAdminClient\(\)/g)].length, 1, 'a second admin client appeared');
  const reads = [...s.matchAll(/admin\s*\.from\('([a-z_]+)'\)([\s\S]*?)(?=admin\s*\.from|\]\);)/g)];
  assert.deepEqual(reads.map((m) => m[1]).sort(), ['event_schedule_blocks', 'events', 'vendor_profiles']);
  for (const [, table, rest] of reads) {
    const scoped = table === 'vendor_profiles' ? /\.eq\('vendor_profile_id', pass\.vendor_profile_id\)/ : /\.eq\('event_id', eventId\)/;
    assert.match(rest!, scoped, `${table} is read without its one-event scope`);
  }
  // The run of show is read only for a role that opens it.
  assert.match(s, /crewRoleReadsRunOfShow\(role\)\s*\?\s*onlyWhatABookedShopMaySee\(\s*admin/, 'the run of show is read for a Helper');
});

test('3 · the role decides the tools — rendered', async () => {
  assert.deepEqual(crewRoleOpens('helper', true), { runOfShow: false, scanner: true });
  assert.deepEqual(crewRoleOpens('member', true), { runOfShow: true, scanner: true });
  assert.equal(crewRowLine('waiting', 'helper', true), 'Wants to join · Helper · scanner only');
  const { CrewEventHub } = await import('./[token]/_components/crew-screens');
  const draw = (role: 'member' | 'helper') =>
    renderToStaticMarkup(
      React.createElement(CrewEventHub, {
        scanner: React.createElement('div', { 'data-stub-scanner': '' }),
        eventName: 'Indalecio & Claire',
        shopName: 'The Wedding Project',
        dayWords: 'Fri, Dec 18, 2026',
        place: null,
        name: 'Kuya Ben',
        role,
        coordinator: true,
        blocks: [{ block_id: 'b1', label: 'Processional', start_at: '2026-12-18T15:00:00+08:00', end_at: null, location: null, run_state: 'scheduled' as never, actual_start_at: null }],
        endsWords: 'ends Dec 19',
      }),
    );
  const helper = draw('helper');
  assert.match(helper, /data-crew-tool="scanner"/);
  assert.doesNotMatch(helper, /data-crew-tool="run-of-show"|Processional/, 'a Helper sees the run of show');
  const member = draw('member');
  assert.match(member, /data-crew-tool="run-of-show"/);
  assert.match(member, /Processional/);
});

test('4 · the crew scanner asks the crew door, never the coordinator’s', () => {
  const scanner = src('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/seat-scanner.tsx');
  assert.match(scanner, /res = await floorSeatByQr\(eventId, scan\.token, via\);/);
  const lookup = src('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts');
  assert.match(lookup, /if \(via === 'crew'\) \{\s*const \{ data, error \} = await supabase\.rpc\('crew_seat_by_guest_qr', \{ p_event_id: eventId, p_token: token \}\);/, 'the crew lookup is not the crew door');
  assert.match(src(PAGE), /scanner=\{<SeatScanner eventId=\{eventId\} via="crew" \/>\}/);
  assert.doesNotMatch(src(SCREENS), /SeatScanner|floorSeatByQr/, 'the crew screens reach a scanner of their own');
  const join = src('lib/crew-join-client.ts');
  assert.match(join, /supabase\.rpc\('crew_pass_request', \{ p_token: token, p_name: name \}\)/, 'joining is not the database’s door');
  for (const f of ['lib/crew-join-client.ts', 'app/join/crew/[token]/_components/crew-name-form.tsx']) {
    assert.doesNotMatch(src(f), /coordinator_seat_by_guest_qr|createAdminClient|from\('vendor_crew_passes'\)/, `${f} reaches past the database’s door`);
  }
});

test('5 · 🔒 the crew never read more than the shop — no coordinator’s unreleased prep', () => {
  // The fence, recorded: exactly the booked-shop policy's second condition, and nothing that would widen or narrow it.
  const calls: string[] = [];
  const stub = { neq: (c: string, v: string) => (calls.push(`neq ${c} ${v}`), stub) };
  assert.equal(onlyWhatABookedShopMaySee(stub), stub);
  assert.deepEqual(calls, ['neq visibility coordinator_only']);
  // …and it is the one the crew page's run of show goes through — inside the read, before it is ordered.
  const s = src(PAGE);
  const read = s.match(/onlyWhatABookedShopMaySee\(\s*admin\s*\.from\('event_schedule_blocks'\)[\s\S]*?\)\s*\.order\(/);
  assert.ok(read, 'the crew’s run of show is read without the booked shop’s fence');
  assert.equal([...s.matchAll(/\.from\('event_schedule_blocks'\)/g)].length, 1, 'a second, unfenced schedule read appeared');
  assert.doesNotMatch(s, /coordinator_only/, 'the page spells the fence by hand instead of the one helper');
});

test('6 · 🚪 the scanner is drawn only for a coordinator shop’s crew; any other Helper is told what the pass gives', async () => {
  assert.deepEqual(crewRoleOpens('helper', false), { runOfShow: false, scanner: false });
  assert.deepEqual(crewRoleOpens('member', false), { runOfShow: true, scanner: false });
  assert.equal(crewRowLine('waiting', 'helper', false), 'Wants to join · Helper · day and place only');
  assert.doesNotMatch(crewRowLine('allowed', 'member', false), /scanner/);
  // The page asks the shop's trade with the one list, and a refused shop read keeps the scanner (its door decides).
  const page = src(PAGE);
  assert.match(page, /select\('business_name, services'\)/, 'the shop’s trade is not read');
  assert.match(page, /const coordinator = shopRes\.error \? true : isCoordinatorTrade\(shop\?\.services\);/);
  assert.match(page, /coordinator=\{coordinator\}/);
  const { CrewEventHub } = await import('./[token]/_components/crew-screens');
  const draw = (role: 'member' | 'helper', coordinator: boolean) =>
    renderToStaticMarkup(
      React.createElement(CrewEventHub, {
        scanner: React.createElement('div', { 'data-stub-scanner': '' }),
        eventName: 'Indalecio & Claire',
        shopName: 'Bloom & Vine Styling',
        dayWords: 'Fri, Dec 18, 2026',
        place: null,
        name: 'Kuya Ben',
        role,
        coordinator,
        blocks: [],
        endsWords: 'ends Dec 19',
      }),
    );
  for (const role of ['helper', 'member'] as const) {
    const off = draw(role, false);
    assert.doesNotMatch(off, /data-stub-scanner|data-crew-tool="scanner"|scanner only/, `a ${role} of a non-coordinator shop is handed a scanner that always refuses`);
    assert.match(off, /data-crew-tool="none"/);
    assert.match(off, /Finding guests’ seats is for the coordinator’s crew\. Bloom &amp; Vine Styling tells you where you’re needed/);
    const on = draw(role, true);
    assert.match(on, /data-stub-scanner/, `a ${role} of a coordinator shop lost the scanner`);
    assert.doesNotMatch(on, /data-crew-tool="none"/);
  }
});

test('7 · the crew row’s line wraps — "Wants to join · Helper · …" is never cut to "Helpe…" at 390 px', () => {
  const panel = src('app/vendor-dashboard/on-the-day/_components/crew-panel.tsx');
  const line = panel.match(/<span className=\{`([^`]*)`\} data-crew-line="">\s*\{crewRowLine\(p\.status, p\.role, coordinator\)/);
  assert.ok(line, 'the crew row line moved — re-anchor this guard on it');
  assert.doesNotMatch(line![1]!, /\btruncate\b|\bline-clamp|\bwhitespace-nowrap\b/, 'the crew row line truncates again');
});
