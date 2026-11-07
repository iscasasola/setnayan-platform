/**
 * the-hub-has-doors-without-a-tab.test.ts — 🚪 THE HUB HAS DOORS WITHOUT A TAB (THE ONE BUILD S1 / guard G8, 8 Nov 2026).
 *
 * BARS LOCKED BY OWNER, 7 Nov 2026: the supplier bar is Today · Clients · Shop · Portfolio — the Event Hub room
 * (`/vendor-dashboard/on-the-day`) LEFT the bar. A room that leaves the bar must not become a room nobody can find, or a
 * room where no tab is lit. What it holds:
 *
 *   1. the room and everything under it lights CLIENTS — on the phone bar, on the desktop rail, and in the page menu;
 *   2. its back link (`page-home`) goes to Clients, never to a bar root that no longer exists;
 *   3. at least TWO code doors outside the room link into it, Today's being one of them;
 *   4. the Ugat no-door baseline does not carry it (a baseline line would excuse "nobody can reach this").
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): `/vendor-dashboard/on-the-day` removed from
 * `VENDOR_CLIENTS_EXTRA_MATCH` (red: test 1, the bar and rail light nothing); Today's `event-hub` case pointed at
 * `/vendor-dashboard/customers` (red: test 3, Today's door is gone).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { bottomNavItemMatches } from '@/app/_components/nav/bottom-nav';
import { activeRailKey } from '@/app/_components/frontdoor/rail-active';
import { pageHome } from '@/lib/page-home';
import { VENDOR_BOTTOM_NAV_ITEMS } from './_components/vendor-bottom-nav';
import { resolveVendorDestinations, vendorRailCandidates } from './_components/vendor-nav-destinations';

const WEB = join(__dirname, '..', '..');
const ROOM = '/vendor-dashboard/on-the-day';
const UNDER = [ROOM, `${ROOM}/live/S89E-TESTEVENT0`, `${ROOM}/live/S89E-TESTEVENT0/papic`, '/vendor-dashboard/events'];

test('the Hub room lights Clients on the bar and on the rail — and nothing else', () => {
  for (const path of UNDER) {
    const lit = VENDOR_BOTTOM_NAV_ITEMS.filter((i) => bottomNavItemMatches(path, i)).map((i) => i.key);
    assert.deepEqual(lit, ['customers'], `${path} lights ${JSON.stringify(lit)} on the phone bar — the Hub lives in Clients`);
    for (const role of ['owner', 'agent'] as const) {
      assert.equal(activeRailKey(vendorRailCandidates(resolveVendorDestinations({ role }), null), path), 'customers', `${path} (${role}) lights no Clients on the rail`);
    }
  }
});

test('the Hub room goes back to Clients', () => {
  const h = pageHome(ROOM);
  assert.equal(h.kind, 'home');
  assert.equal(h.kind === 'home' ? h.home : null, '/vendor-dashboard/customers', 'the Hub room no longer goes back to Clients');
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('at least two doors outside the room open it, Today’s among them', () => {
  const doors: string[] = [];
  for (const file of walk(join(WEB, 'app', 'vendor-dashboard'))) {
    const rel = relative(WEB, file);
    if (rel.startsWith('app/vendor-dashboard/on-the-day/') || rel === 'app/vendor-dashboard/events/page.tsx') continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    // An address into the room inside a string (a link, an href or a Link's target), not an import path.
    if (/['"`]\/vendor-dashboard\/on-the-day(?:['"`/#?]|\$\{)/.test(src)) doors.push(rel);
  }
  assert.ok(doors.length >= 2, `only ${doors.length} door(s) into the Hub room now that it has no tab: ${doors.join(', ')}`);
  const today = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx'), 'utf8'));
  assert.match(
    today,
    /case 'event-hub': \{\s*const href = '\/vendor-dashboard\/on-the-day';/,
    'Today’s Event Hub line no longer opens the Hub room',
  );
  // eslint-disable-next-line no-console
  console.log(`doors into the Hub room: ${doors.length} — ${doors.join(', ')}`);
});

test('the no-door baseline does not excuse the Hub room', () => {
  const base = readFileSync(join(WEB, 'lib/ugat/baselines/no-door.baseline.txt'), 'utf8');
  const lines = base.split('\n').filter((l) => /^\/vendor-dashboard\/(on-the-day|events)(\/|\s|$)/.test(l));
  assert.deepEqual(lines, [], 'the Ugat no-door baseline lists the Hub room — it has doors; fix the door, not the baseline');
});
