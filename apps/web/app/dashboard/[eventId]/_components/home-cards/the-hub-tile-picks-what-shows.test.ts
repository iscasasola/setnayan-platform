/**
 * the-hub-tile-picks-what-shows.test.ts — THE EVENT HUB TILE (owner 2026-10-24, on the live new Home):
 *
 *   1 · A TAP ON THE TILE OPENS THE EVENT HUB — every face's door is the public page, through `openEventHub` (a new tab
 *       on the web, the in-app sheet in the app). With no public link yet, the Maker (there is no page to open).
 *   2 · TWO SMALL BUTTONS, 32 px, the label in `aria-label`, the ⓘ beside the tile's label: "Pick what shows" (a sheet
 *       IN PLACE — the shared `Sheet`) and "Maker" (the Event Hub Maker, as the pen was).
 *   3 · THE SHEET REUSES WHAT SHIPPED (owner: "don't invent a new mechanism") — PR-C's `HubPartsSwitches` (the page
 *       picker + a switch per part, each written into the Maker's draft with its ↺), its table read by Home's own Event
 *       Hub reader (`readHomeHubCard`) ON THE TAP, hosts only (the draft's own gate), loaded lazily so Home's first load
 *       carries none of it; and the Maker's Apply bar, `HubDraftDock`, rendered by Home and handed in.
 *   4 · A press inside the sheet (portalled to <body>, but still inside the tile in React's tree) never swipes the tile.
 *
 * SABOTAGE (seen red, then restored): the hub-next face back on `/launch?stage=` (1 red) · the pick button drawn as a
 * Link (2 red) · the body importing a new switch list instead of `HubPartsSwitches` (3 red) · the action without
 * `requireHostMembershipOrThrow` (3 red) · the `outside(e)` check removed from the tile's pointer handler (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { homeControlTiles } from '../home-control-faces';
import { fixtureControl } from '@/lib/home-control-fixture';
import { drawHome, loadHome, slice } from '../../home-render.harness';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const EVENT = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(EVENT, ...rel.split('/')), 'utf8'));
const PUBLIC = 'https://setnayan.com/ana-and-miguel';

test('1 · every face of the Event Hub tile opens the Event Hub', () => {
  const hub = homeControlTiles(fixtureControl('e1')).tiles.find((t) => t.key === 'hub')!;
  assert.ok(hub.faces.length >= 2, 'premise: the tile has its now and next faces');
  for (const f of hub.faces) {
    assert.equal(f.href, PUBLIC, `hub/${f.id} opens ${f.href}, not the Event Hub`);
    assert.equal(f.external, true, `hub/${f.id} does not go through openEventHub`);
  }
  assert.equal(hub.door, PUBLIC);
  // No public link yet → the Maker, never a dead tap.
  const base = fixtureControl('e1');
  const noLink = homeControlTiles({ ...base, hub: { ...(base.hub as Exclude<typeof base.hub, null | 'unread'>), publicUrl: null } }).tiles.find((t) => t.key === 'hub')!;
  for (const f of noLink.faces) assert.equal(f.href, '/dashboard/e1/launch', `hub/${f.id} with no link opens ${f.href}`);
});

test('2 · two 32-px buttons, labels in aria, the ⓘ beside the label', () => {
  const html = drawHome();
  const tile = slice(html, 'data-home-tile="hub"', ['data-home-tile="', 'data-home-control="detail"']);
  const pick = (tile.match(/<button [^>]*data-home-hub-pick-open="tile"[^>]*>/) ?? [''])[0];
  assert.ok(pick, 'the tile has no "Pick what shows" button');
  assert.match(pick, /class="hc-tiny"/, 'the pick button is not the 32-px tiny button');
  assert.match(pick, /aria-label="Pick what shows"/);
  assert.match(pick, /aria-haspopup="dialog"/, 'the pick button does not say it opens a sheet');
  assert.match(tile, /<a [^>]*href="\/dashboard\/e1\/launch[^"]*"[^>]*aria-label="Maker"|<a [^>]*aria-label="Maker"[^>]*href="\/dashboard\/e1\/launch/, 'the tile has no Maker button');
  assert.match(tile, /aria-label="About Event Hub"/, 'the tile has no ⓘ');
  assert.doesNotMatch(tile, /aria-label="View Event Hub"/, 'the tile still carries a View button — the tile itself is the View');
  const css = readFileSync(join(HERE, '..', '..', '..', '..', 'globals.css'), 'utf8');
  assert.match(css, /\.hc-tiny \{[^}]*width: 32px; height: 32px;/, 'the tiny buttons are no longer 32 px');
  // The md+ card carries the same sheet, with its word.
  const card = slice(html, 'data-home-card-key="hub"', ['data-home-card-key="']);
  assert.match(card, /data-testid="home-hub-pick-open-card"/, 'the md+ card has no "Pick what shows"');
});

test('3 · the sheet is the shipped switches + Apply bar, read on the tap, hosts only, lazy', () => {
  const button = read('_components/home-cards/hub-pick-button.tsx');
  assert.match(button, /import \{ Sheet \} from '@\/app\/_components\/sheet';/, 'not the shared Sheet');
  assert.match(button, /dynamic\(\(\) => import\([^)]*'\.\/hub-pick-body'\)/, 'the body is not loaded lazily');
  assert.doesNotMatch(button, /from '\.\/hub-pick-body'/, 'the body is imported eagerly');
  const body = read('_components/home-cards/hub-pick-body.tsx');
  assert.match(body, /import \{ HubPartsSwitches \} from '\.\/hub-parts-switches';/, 'the sheet does not reuse the shipped part switches');
  assert.match(body, /<HubPartsSwitches eventId=\{eventId\} table=\{read\.table\} now=\{read\.stage\} \/>/);
  // The Apply bar is the shipped `HubDraftDock`, RENDERED by Home (its loader reads the view switch — never a server
  // action's: `lib/view-as-free-never-changes-a-save.test.ts`) and drawn by the sheet under the switches.
  assert.match(body, /data-home-hub-apply="">\s*\{apply\}/, 'the sheet does not draw the Apply bar it is handed');
  assert.match(read('page.tsx'), /hubApply=\{[\s\S]{0,200}?<HubDraftDock eventId=\{eventId\} \/>/, 'Home does not hand the sheet the shipped Apply bar');
  assert.match(body, /readHomeHubPick\(eventId\)/, 'the sheet does not read on the tap');
  const action = read('_components/home-cards/hub-pick-actions.ts');
  assert.match(action, /^'use server';/, 'the read is not a server action');
  assert.match(action, /await requireHostMembershipOrThrow\(eventId\)/, 'the read is not hosts-only');
  assert.match(action, /readHomeHubCard\(supabase, eventId\)/, 'the read is not Home\'s own Event Hub reader');
  assert.doesNotMatch(action, /loadHubDraftBarData/, 'the tap\'s server action reads the view switch');
  // Home's first screen never reads it on the view.
  assert.doesNotMatch(read('page.tsx'), /readHomeHubPick/, 'Home reads the pick sheet on every view');
});

test('4 · a press inside the sheet never swipes the tile', () => {
  const tile = read('_components/home-tile.tsx');
  assert.match(tile, /const outside = \(e: \{ target: EventTarget \}\) => !root\.current\?\.contains\(e\.target as Node\);/);
  assert.match(tile, /const onPointerDown = [^\n]*\n\s*if \(count < 2 \|\| outside\(e\)/, 'a press in the sheet starts a swipe of the tile');
  assert.match(tile, /const onKeyDown = [^\n]*\n\s*if \(count < 2 \|\| outside\(e\)\)/, '← → typed in the sheet turn the tile');
});
