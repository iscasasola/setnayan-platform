/**
 * home-hub-view-opens-a-new-tab.test.ts — "VIEW EVENT HUB" NEVER TAKES HOME AWAY (owner 2026-10-24: *"view event hub
 * opens to a new browser if browser based"*).
 *
 *   1 · On the web every View (the card's button, the tile's eye, the "live" face) is a real new-tab link to the
 *       couple's public page: `target="_blank" rel="noopener noreferrer"`. "Edit in Maker" stays in the same tab.
 *   2 · A press goes through the ONE shared `openEventHub(url)` (`lib/open-external.ts`, #6866) — on the web a new tab
 *       (`window.open(…, '_blank', 'noopener')`), in the app the in-app browser sheet. Home keeps no copy of its own.
 *
 * SABOTAGE (seen red): `target` dropped from HubViewLink (1 red) · the tile importing a local stand-in again (2 red) ·
 * the click no longer calling `openEventHub` (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { openEventHub } from '@/lib/open-external';
import { drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));
const PUBLIC = 'https://setnayan.com/ana-and-miguel';

test('1 · every View is a new-tab link on the web; Edit in Maker stays in the tab', () => {
  const html = drawHome();
  const views = [...html.matchAll(/<a [^>]*data-home-hub-view="[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.ok(views.length >= 3, `premise: the card button, the tile's eye and the live face — found ${views.length}`);
  for (const a of views) {
    assert.match(a, new RegExp(`href="${PUBLIC}"`), 'a View that does not open the public page');
    assert.match(a, /target="_blank"/, 'a View that would leave Home');
    assert.match(a, /rel="noopener noreferrer"/, 'a new tab that can reach back into Home');
  }
  const hub = slice(html, 'data-home-card-key="hub"', ['data-home-card-key="']);
  const edit = (hub.match(/<a [^>]*aria-label="Edit in Maker"[^>]*>/) ?? [''])[0];
  assert.ok(edit, 'premise: Edit in Maker is drawn');
  assert.doesNotMatch(edit, /target=/, 'Edit in Maker opens a new tab');
});

test('2 · a press goes through the shared openEventHub — a new tab on the web, no opener', () => {
  const tile = read('_components/home-tile.tsx');
  assert.match(tile, /import \{ openEventHub \} from '@\/lib\/open-external';/, 'Home opens the Event Hub with its own copy, not the shared helper');
  assert.match(tile, /e\.preventDefault\(\);\s*if \(skip\?\.\(\)\) return;\s*openEventHub\(url\);/, 'the View link does not go through openEventHub');
  // The shared helper's web arm, driven: a new tab, no opener, the address untouched.
  const opened: string[][] = [];
  const way = openEventHub(PUBLIC, { location: { href: 'https://setnayan.com/dashboard/e1', assign: () => assert.fail('the web left Home') }, open: (...a: string[]) => { opened.push(a); return null; } });
  assert.equal(way, 'new-tab');
  assert.deepEqual(opened, [[PUBLIC, '_blank', 'noopener']]);
});
