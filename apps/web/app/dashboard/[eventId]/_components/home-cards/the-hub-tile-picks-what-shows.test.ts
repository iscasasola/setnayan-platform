/**
 * the-hub-tile-picks-what-shows.test.ts — THE EVENT HUB TILE (owner 2026-10-24, on the live new Home):
 *
 *   1 · A TAP ON THE TILE OPENS THE EVENT HUB — every face's door is the public page, through `openEventHub` (a new tab
 *       on the web, the in-app sheet in the app). With no public link yet, the Maker (there is no page to open).
 *   2 · TWO SMALL BUTTONS, 32 px, the label in `aria-label`, the ⓘ beside the tile's label: "Pick what shows" (a sheet
 *       IN PLACE — the shared `Sheet`) and "Maker" (the Event Hub Maker, as the pen was).
 *   3 · THE SHEET IS ONE CHOICE OF FOUR ROWS (owner 2026-10-25: *"pick what shows makes them choose between Save the
 *       Date, Invitation, The Day, Post Event only"*, then *"make it choices. remove the guests see and place the
 *       choices there"*) — four single-select rows (`role="radio"`) in the sheet itself, the one guests see now marked ✓
 *       "Now", each a 44-px press with its stage's one-line ⓘ. ⚠ A DELIBERATE EXCEPTION to "any set of choices is a
 *       dropdown" (`lib/choices-are-one-dropdown.test.ts`), on the owner's word — this guard holds the exception to
 *       THIS sheet. Written by the SHIPPED `setLaunchPhase` (the Maker's "Which version guests see" door, host-gated,
 *       live — the pin is not drafted, so no Apply bar). No part switches, no page picker: parts stay in the Maker.
 *       The pin is read on the tap, hosts only; Home's tile honours the pin (`manualLaunchPhase(…) ?? resolveHubStage`).
 *   4 · A press inside the sheet (portalled to <body>, but still inside the tile in React's tree) never swipes the tile.
 *
 * SABOTAGE (seen red, then restored): the hub-next face back on `/launch?stage=` (1 red) · the part switches put back
 * in the body (3 red) · the rows put back behind a PickMenu (3 red) · the action without `requireHostMembershipOrThrow` (3 red) · Home's stage reading the date
 * only (3 red) · the `outside(e)` check removed from the tile's pointer handler (4 red).
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
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';

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

test('3 · the sheet is four stage rows, one choice, written by the shipped setLaunchPhase', () => {
  const button = read('_components/home-cards/hub-pick-button.tsx');
  assert.match(button, /import \{ Sheet \} from '@\/app\/_components\/sheet';/, 'not the shared Sheet');
  // NOT a `next/dynamic` chunk: a new async chunk grows webpack's shared runtime, and the shared budget had no headroom
  // (CI 2026-10-24). The body is mounted only when the sheet opens, and its data is read then.
  assert.doesNotMatch(button, /next\/dynamic/, 'a lazy chunk again — it grows the shared runtime every page loads');
  assert.match(button, /const sheet = open \? \(\s*<Sheet open/, 'the sheet (and its body) is drawn before it is opened');
  const body = read('_components/home-cards/hub-pick-body.tsx');
  // Four choice ROWS in the sheet (owner 2026-10-25, "make it choices") — the exception to the one-dropdown rule.
  assert.match(body, /role="radiogroup"/, 'the four stages are not one single-select group');
  assert.match(body, /\{PUBLIC_STAGE_ORDER\.map\(\(s\) => \{[\s\S]*?role="radio"\s+aria-checked=\{on\}/, 'the stages are not drawn as choice rows');
  assert.doesNotMatch(body, /<PickMenu\b|Guests see/, 'the "Guests see" dropdown is back — the owner asked for the choices themselves');
  assert.match(body, /className="absolute inset-0 min-h-11 rounded-2xl"/, 'a row\'s press is not the whole row at 44 px');
  assert.match(body, /min-h-\[52px\][^"]*rounded-2xl border/, 'a row lost its frame (it is pressable, so it has one)');
  assert.match(body, /<InfoTip label=\{PUBLIC_STAGE_LABELS\[s\]\}[\s\S]*?\{hint\}/, 'a row lost its one-line ⓘ');
  assert.match(body, /\{on \? \([\s\S]{0,200}?Now[\s\S]{0,120}?<Check /, 'the stage guests see now is not marked ✓ Now');
  assert.deepEqual([...PUBLIC_STAGE_ORDER], ['save_the_date', 'rsvp', 'event', 'editorial']);
  assert.deepEqual(PUBLIC_STAGE_ORDER.map((s) => PUBLIC_STAGE_LABELS[s]), ['Save the Date', 'Invitation', 'The Day', 'Post Event']);
  // The shipped write, with its own landing back on Home.
  assert.match(body, /import \{ setLaunchPhase \} from '\.\.\/\.\.\/website\/editor\/actions';/, 'not the shipped stage setter');
  assert.match(body, /fd\.set\('launch_phase', next\)/);
  assert.match(body, /fd\.set\('return_to', /, 'the pick does not land back on Home');
  // No part switches, no page picker, no Apply bar.
  assert.doesNotMatch(body, /HubPartsSwitches|HubDraftToolbar|hubDraftAction|role="switch"/, 'parts are back in the sheet — they stay in the Maker');
  const action = read('_components/home-cards/hub-pick-actions.ts');
  assert.match(action, /^'use server';/, 'the read is not a server action');
  assert.match(action, /await requireHostMembershipOrThrow\(eventId\)/, 'the read is not hosts-only');
  assert.match(action, /pinned: manualLaunchPhase\(e\.launch_mode, e\.manual_phase\)/, 'the read does not know the pin');
  assert.doesNotMatch(action, /loadHubDraftBarData/, 'the tap\'s server action reads the view switch');
  assert.doesNotMatch(read('page.tsx'), /readHomeHubPick|HubDraftDock/, 'Home reads the sheet, or draws an Apply bar, on every view');
  // The tile says the page guests really see: a pin wins over the date.
  const server = readFileSync(join(EVENT, '..', '..', '..', 'lib', 'home-control.server.ts'), 'utf8');
  assert.match(server, /const stage = manualLaunchPhase\(ev\.launch_mode, ev\.manual_phase\) \?\? resolveHubStage\(/, 'Home\'s tile ignores the pin');
});

test('4 · a press inside the sheet never swipes the tile', () => {
  const tile = read('_components/home-tile.tsx');
  assert.match(tile, /const outside = \(e: \{ target: EventTarget \}\) => !root\.current\?\.contains\(e\.target as Node\);/);
  assert.match(tile, /const onPointerDown = [^\n]*\n\s*if \(count < 2 \|\| outside\(e\)/, 'a press in the sheet starts a swipe of the tile');
  assert.match(tile, /const onKeyDown = [^\n]*\n\s*if \(count < 2 \|\| outside\(e\)\)/, '← → typed in the sheet turn the tile');
});
