/**
 * home-hub-view-opens-a-new-tab.test.ts — "VIEW EVENT HUB" NEVER TAKES HOME AWAY (owner 2026-10-24: *"view event hub
 * opens to a new browser if browser based"*).
 *
 *   1 · On the web every View (the card's button, the tile's eye, the "live" face) is a real new-tab link to the
 *       couple's public page: `target="_blank" rel="noopener noreferrer"`. "Edit in Maker" stays in the same tab.
 *   2 · A press goes through `openEventHub(url)` — on the web `window.open(url, '_blank', 'noopener')`; the app shell's
 *       in-app browser replaces that one function (its own branch), never the links.
 *
 * SABOTAGE (seen red): `target` dropped from HubViewLink (1 red) · `openEventHub` opening `_self` (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
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

test('2 · a press goes through openEventHub — window.open, a new tab, no opener', () => {
  const helper = read('_components/open-event-hub.ts');
  assert.match(helper, /export function openEventHub\(url: string\): void/);
  assert.match(helper, /window\.open\(url, '_blank', 'noopener'\)/);
  const tile = read('_components/home-tile.tsx');
  assert.match(tile, /e\.preventDefault\(\);\s*if \(skip\?\.\(\)\) return;\s*openEventHub\(url\);/, 'the View link does not go through openEventHub');
});
