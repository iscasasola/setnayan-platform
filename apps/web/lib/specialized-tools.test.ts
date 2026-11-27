/**
 * 🔒 SHOP › MAKERS › SPECIALIZED TOOLS (lib/specialized-tools.ts — Build 3 Lane E item 13).
 *   · Scanner is the FIRST tile, for every shop.
 *   · EVERY tile is open to every shop — the shop's categories only order them (suggested first).
 *   · Doors only: every page tile names a route that ships; no price, no "Make your own", no Manpower.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SPECIALIZED_TOOLS, WIDGET_SHELVES, listedWidgets, specializedToolsFor, onTheDayHref } from './specialized-tools';
import { HUB_TOOL_LIBRARY } from './hub-tools';
import { routes } from './routes';
import { stripComments } from './strip-comments';

const WEB = process.cwd();

test('the widgets, Scanner first: the owner’s eleven (Cake Maker joined 21 Nov, Attire Maker 27 Nov), then Spaces, then the seven shipped Event Hub widgets (v19 PR 2, "Yes, include them")', () => {
  assert.deepEqual(
    SPECIALIZED_TOOLS.map((t) => t.title),
    [
      'Scanner', 'Cake Maker', 'Attire Maker', 'Song bank', 'Song Desk', 'Emcee script', 'Floor Command + March', 'Run of show', 'Headcount', 'Live Watch', 'Papic challenge', '3D plan', 'Spaces',
      'Shot list', 'Issues log', 'Production sheet', 'Live reviews', 'Hand over to the couple', 'Seat plan', 'Papic camera',
    ],
  );
  for (const shop of [[], ['Live Band'], ['Catering'], ['Coordinator / Planner']]) {
    const order = specializedToolsFor(shop, []);
    assert.equal(order[0]!.tool.key, 'scanner', `Scanner is not first for ${shop.join(',') || 'a new shop'}`);
    // Owner 19 Nov (Shop final pick 2): "Specialized tools (Spaces inside, after Scanner)".
    assert.equal(order[1]!.tool.key, 'spaces', `Spaces is not right after Scanner for ${shop.join(',') || 'a new shop'}`);
  }
  assert.ok(!SPECIALIZED_TOOLS.some((t) => /rooms.?seating/i.test(t.key + t.title)), 'the 18 Nov Rooms & seating tile came back (owner 19 Nov: dropped)');
});

test('every tile is open to every shop — suggested ones first, none dropped', () => {
  const band = specializedToolsFor(['Live Band'], ['live_band']);
  assert.equal(band.length, SPECIALIZED_TOOLS.length, 'a tile was dropped for a shop outside its categories');
  const keys = band.map((t) => t.tool.key);
  assert.ok(keys.indexOf('song_desk') < keys.indexOf('headcount'), 'a band’s Song Desk is not suggested before Headcount');
  assert.ok(keys.indexOf('song_bank') < keys.indexOf('emcee_script'), 'a band’s Song bank is not suggested first');
  const caterer = specializedToolsFor(['Catering'], ['catering']).map((t) => t.tool.key);
  assert.ok(caterer.indexOf('headcount') < caterer.indexOf('song_desk'), 'a caterer’s Headcount is not suggested first');
});

test('doors only: each page tile is a route that ships; per-event tiles open the day screen', () => {
  for (const t of SPECIALIZED_TOOLS) {
    if (t.door.kind !== 'page') continue;
    const path = t.door.href.split('#')[0]!.replace(/^\//, '');
    assert.ok(existsSync(join(WEB, 'app', path, 'page.tsx')), `${t.title} points at ${t.door.href}, which does not ship`);
  }
  assert.ok(existsSync(join(WEB, 'app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx')));
  assert.equal(onTheDayHref('e1'), '/vendor-dashboard/on-the-day/live/e1');
  const src = stripComments(readFileSync(join(WEB, 'lib/specialized-tools.ts'), 'utf8'));
  assert.doesNotMatch(src, /₱|price_php|Make your own|manpower/i, 'a price, a "Make your own" tile or a Manpower door crept in');
  // 2026-11-14 ("SIMPLER SUPPLIER PLANS"): the Papic challenge and 3D booth cards left the Plan page (the tools come
  // with Plus and up), so their doors open the Plan page itself — never an #anchor that lands nowhere.
  for (const t of SPECIALIZED_TOOLS) {
    if (t.door.kind === 'page') assert.doesNotMatch(t.door.href, /#(papic-challenge|booth-addon)$/, `${t.title} points at a card that left`);
  }
});

test('v19 PR 2: every Event Hub widget IS a shipped hub tool — the library can never call it unshipped again', () => {
  // A widget whose door is the day itself (the per-event screen, the On the day console or a booked client's page) is
  // the shipped form of the hub tools it names. Page doors (Papic challenge, 3D plan) only borrow hub keys to SUGGEST
  // themselves, so they are not held here.
  const lib = new Map<string, boolean>(HUB_TOOL_LIBRARY.map((t) => [t.key, t.shipped]));
  for (const t of SPECIALIZED_TOOLS) {
    if (t.door.kind !== 'per_event' && t.door.kind !== 'day_console' && t.door.kind !== 'client_page') continue;
    for (const k of t.hubKeys) {
      assert.ok(lib.has(k), `${t.title} names hub tool "${k}", which is not in the library`);
      assert.equal(lib.get(k), true, `${t.title} ships, but HUB_TOOL_LIBRARY says "${k}" is not shipped`);
    }
  }
  for (const k of ['shot_list', 'incident_log', 'tables_and_seating']) assert.equal(lib.get(k), true, `${k} is flagged unshipped again`);
});

test('v19 PR 2: every widget sits on a v19 shelf, every new door is a real address, and the Papic camera waits on its switch', () => {
  for (const t of SPECIALIZED_TOOLS) {
    assert.ok(t.shelves.length > 0, `${t.title} sits on no shelf`);
    for (const sh of t.shelves) assert.ok((WIDGET_SHELVES as readonly string[]).includes(sh), `${t.title}: unknown shelf ${sh}`);
  }
  assert.ok(existsSync(join(WEB, 'app/vendor-dashboard/on-the-day/page.tsx')), 'the On the day console does not ship');
  for (const t of SPECIALIZED_TOOLS) {
    if (t.door.kind !== 'client_page') continue;
    const href = routes.vendorDashboard.clients[t.door.page]('e1');
    const path = href.replace(/^\//, '').replace('/e1', '/[eventId]');
    assert.ok(existsSync(join(WEB, 'app', path, 'page.tsx')), `${t.title} opens ${href}, which does not ship`);
  }
  assert.ok(!listedWidgets(false).some((t) => t.key === 'papic_camera'), 'the Papic camera is listed with its switch off');
  assert.ok(listedWidgets(true).some((t) => t.key === 'papic_camera'));
  const keys = SPECIALIZED_TOOLS.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length, 'a widget is listed twice');
  // Scanner stays ONE item (one per service, never counted per service).
  assert.equal(keys.filter((k) => k === 'scanner').length, 1);
});
