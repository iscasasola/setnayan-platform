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
import { SPECIALIZED_TOOLS, specializedToolsFor, onTheDayHref } from './specialized-tools';
import { stripComments } from './strip-comments';

const WEB = process.cwd();

test('the ten tiles, Scanner first, the owner’s list', () => {
  assert.deepEqual(
    SPECIALIZED_TOOLS.map((t) => t.title),
    ['Scanner', 'Song bank', 'Song Desk', 'Emcee script', 'Floor Command + March', 'Run of show', 'Headcount', 'Live Watch', 'Papic challenge', '3D plan'],
  );
  for (const shop of [[], ['Live Band'], ['Catering'], ['Coordinator / Planner']]) {
    assert.equal(specializedToolsFor(shop, [])[0]!.tool.key, 'scanner', `Scanner is not first for ${shop.join(',') || 'a new shop'}`);
  }
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
