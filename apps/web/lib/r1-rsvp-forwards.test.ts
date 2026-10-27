/**
 * r1-rsvp-forwards.test.ts — R1 · RSVP LEFT STUDIO FOR GUESTS ⚙, AND EVERY OLD DOOR LANDS THERE.
 *
 * Owner, 2026-10-27/28 (DECISION_LOG "GUESTS = LIST · MAP · SEATS · MARCH; RSVP SETTINGS LIVE IN THE GUESTS ⚙",
 * "STUDIO IS LOOK AND WORDS ONLY", "EVERY OLD DOOR FORWARDS — 'ALL MAPPING WILL BE KEPT'"): *"Why is the event hub's
 * studio pages are all still there"* → R1. The RSVP questions and the reply-by date live in Guests ⚙ (the shipped
 * `GuestSetupRows`); only the Reply page stays in the Hub, inside the Invitation stage. A guard per move:
 *
 *   1 · STUDIO — no RSVP tile: not a key, not an editor a tile opens, not a card on the Studio home.
 *   2 · THE OLD ADDRESS — `/launch?tool=details&item=rsvp` lands on Guests ⚙ open on the row (the launch page asks
 *       `makerItemMovedHref` before it reads anything), and that row is one Guests ⚙ really draws.
 *   3 · THE PART'S DOOR — the RSVP stage's form (and its Reply card) open Guests ⚙, never "Studio › RSVP".
 *   4 · THE GUIDED FLOW (Home's progress, the Maker's What's left) — How guests get in · What to ask · Reply by are
 *       links to their Guests ⚙ rows, counted as before; no guided step opens the Maker's RSVP item.
 *   5 · NOTHING LOST — what ONLY the tile held (How guests answer, Replies open · close) is drawn by Guests ⚙, once,
 *       with the rows that were already there; each `?row=` a door names lands on a drawn row.
 *
 * Sabotage (2026-10-28, each seen red, then restored): 'rsvp' put back in `STUDIO_TILE_KEYS` → 1 red · the launch
 * page's forward removed → 2 red · `rsvp` part's source back to `studio:rsvp` → 3 red · the `guests` door dropped from
 * the guided 'reply-by' step → 4 red · the How guests answer row dropped from `GuestSetupRows` → 5 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { STUDIO_TILE_ITEM, STUDIO_TILE_KEYS } from './studio-tile-defs';
import { STUDIO_TILES } from './studio-tiles';
import { MAKER_ITEMS_MOVED_TO_GUESTS, SETTINGS_ROWS, guestsSettingsHref, makerItemMovedHref, settingsRowsOf } from './event-settings-record';
import { MAKER_PARTS, makerPartQuietRow, makerPartStudioDoor, type MakerGuestsRow, type MakerPartKey } from './maker-parts';
import { GUIDED_STEPS, buildGuidedPlan, guidedLinkHref, type GuidedGuestsRow, type GuidedItem } from './details-guided-flow';
import { setupProgress } from './stage-setup';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EID = 'S89E-ABCDEFGHIJ';
/** The rows a guided link or a part's door may name — each must be a Guests ⚙ row (the types restate them). */
const GUIDED_ROWS: readonly GuidedGuestsRow[] = ['get-in', 'asks', 'reply-by'];
const PART_ROWS: readonly MakerGuestsRow[] = ['asks'];

test('1 · Studio has no RSVP tile — not a key, not an editor, not a card', async () => {
  assert.ok(!(STUDIO_TILE_KEYS as readonly string[]).includes('rsvp'), 'the RSVP tile is back in Studio');
  assert.ok(!Object.values(STUDIO_TILE_ITEM).includes('rsvp'), 'a Studio tile still opens the Maker’s RSVP item');
  assert.ok(!('rsvp' in STUDIO_TILES), 'the RSVP tile’s words are back');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioHome } = await import('../app/dashboard/[eventId]/launch/_components/studio-home');
  const tiles = STUDIO_TILE_KEYS.map((key) => ({ key, label: STUDIO_TILES[key].label, short: STUDIO_TILES[key].short, item: STUDIO_TILES[key].item, immersive: false, done: true, status: '' }));
  const html = renderToStaticMarkup(React.createElement(StudioHome, { tiles, onOpen: () => {} }));
  const drawn = [...html.matchAll(/data-studio-tile="([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(drawn.length, STUDIO_TILE_KEYS.length, 'anti-vacuity: the Studio home drew no cards');
  assert.ok(!drawn.includes('rsvp'), 'the Studio home draws an RSVP card');
  assert.match(html, new RegExp(`>\\d+ of ${STUDIO_TILE_KEYS.length} ready<`), 'Studio’s "n of N ready" does not count the tiles that are there');
  console.log(`  studio: ${drawn.length} cards — ${drawn.join(' · ')}`);
});

test('2 · the old Maker address lands on Guests ⚙, on a row it draws — before anything is read', () => {
  assert.equal(makerItemMovedHref(EID, 'rsvp'), `/dashboard/${EID}/guests?settings=1&row=asks`);
  assert.equal(makerItemMovedHref(EID, 'rsvp'), guestsSettingsHref(EID, 'asks'));
  for (const item of [undefined, '', 'names', 'gifts', 'love-story', 'constructor', 'toString']) {
    assert.equal(makerItemMovedHref(EID, item), null, `item=${String(item)} forwards, but it never moved`);
  }
  for (const [from, row] of Object.entries(MAKER_ITEMS_MOVED_TO_GUESTS)) {
    assert.equal(SETTINGS_ROWS[row].menu, 'guests', `item=${from} lands on ${row}, which is not a Guests ⚙ row`);
  }
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  const body = page.slice(page.indexOf('export default async function LaunchHubPage'));
  const fwd = body.indexOf('const movedItem = makerItemMovedHref(eventId, one(search.item));');
  assert.ok(fwd > 0, 'the launch page does not forward a moved item');
  assert.match(body.slice(fwd, fwd + 160), /if \(movedItem\) redirect\(movedItem\);/);
  // First thing after the address is read — before the session, the event or the draft.
  for (const later of ['await getUser', 'createClient(', '.from(']) {
    const at = body.indexOf(later);
    if (at >= 0) assert.ok(at > fwd, `the launch page reads (${later}) before it forwards a moved item`);
  }
});

test('3 · the RSVP stage’s form and its Reply card open Guests ⚙ — never Studio › RSVP', () => {
  const sources = (Object.keys(MAKER_PARTS) as MakerPartKey[]).map((k) => [k, MAKER_PARTS[k].source] as const);
  assert.deepEqual(sources.filter(([, s]) => s === 'studio:rsvp'), [], 'a part still names the Studio RSVP tile as its source');
  for (const k of ['rsvp', 'rsvpcard'] as const) {
    const q = makerPartQuietRow(k);
    assert.ok(q && 'guests' in q.to, `${k}: its door is not Guests ⚙`);
    assert.equal((q.to as { guests: string }).guests, 'asks');
    assert.doesNotMatch(q.words, /Studio/, `${k}: its door still says Studio`);
    assert.equal(makerPartStudioDoor(k), null, `${k}: a Style-bar jump would open a Studio tile`);
  }
  for (const row of PART_ROWS) assert.equal(SETTINGS_ROWS[row].menu, 'guests', `the part door names ${row}, not a Guests ⚙ row`);
  // The toolbar turns that door into a plain link to the sheet's row (another page of the app, like Suppliers).
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /else if \('guests' in q\.to\) quiet = maker \? \{ kind: 'guests', words: q\.words, href: guestsSettingsHref\(maker\.eventId, q\.to\.guests\) \} : null;/);
  assert.match(read('app/dashboard/[eventId]/launch/_components/stage-panel/kit.tsx'), /quiet\.kind === 'guests' \? \([\s\S]{0,200}?href=\{quiet\.href\}/);
});

test('4 · the guided flow (Home’s count, What’s left) opens the three reply settings in Guests ⚙ — counted as before', () => {
  const byKey = new Map(GUIDED_STEPS.map((d) => [d.key, d]));
  for (const [key, row] of [['who', 'get-in'], ['rsvp', 'asks'], ['reply-by', 'reply-by']] as const) {
    assert.equal(byKey.get(key)?.guests, row, `the guided "${key}" step is not a door to Guests ⚙ › ${row}`);
  }
  for (const row of GUIDED_ROWS) assert.equal(SETTINGS_ROWS[row].menu, 'guests', `a guided link names ${row}, not a Guests ⚙ row`);
  // A wedding's plan: the three are LINKS (state from the same facts), no step opens the Maker's RSVP item.
  const items: GuidedItem[] = ['names', 'date', 'theme', 'logo', 'hero', 'rsvp', 'schedule', 'venues'].map((k) => ({ key: k as GuidedItem['key'], label: k, done: k === 'rsvp' ? undefined : true }));
  const plan = buildGuidedPlan(items, { solemn: false, parentsOffered: false });
  assert.equal(plan.steps.some((s) => s.items.includes('rsvp')), false, 'a guided step still opens the Maker’s RSVP item');
  const links = plan.links.filter((l) => l.guests);
  assert.deepEqual(links.map((l) => [l.key, l.guests]), [['who', 'get-in'], ['rsvp', 'asks'], ['reply-by', 'reply-by']]);
  // Home counts every fact once — the three still count (in place: look-overs), so nothing reads "Missing".
  const whole = setupProgress(plan);
  assert.equal(whole.total, plan.steps.length + plan.links.length);
  assert.ok(links.every((l) => l.state !== 'left'), 'a reply setting nobody measured reads as not done');
  // Its door: Guests ⚙ open on the row; with no door handed in, no link at all (never a link to nowhere).
  const doors = { guestsHref: `/dashboard/${EID}/guests/import`, guestsSettingsHref: guestsSettingsHref(EID) };
  for (const l of links) assert.equal(guidedLinkHref(l, doors), guestsSettingsHref(EID, l.guests!));
  assert.equal(guidedLinkHref({}, doors), doors.guestsHref, 'the guests’ names lost their own door');
  assert.equal(guidedLinkHref(links[0]!, { guestsHref: doors.guestsHref }), null);
  // The Maker hands the door in, and both of the flow's link places draw it.
  assert.match(read('app/dashboard/[eventId]/launch/_components/maker-details.tsx'), /guestsSettingsHref: guestsSettingsHref\(eventId\),/);
  const guide = read('app/dashboard/[eventId]/launch/_components/details-guide.tsx');
  assert.equal((guide.match(/guidedLinkHref\(l, actions\)|guidedLinkHref\(l, actions\) : null/g) ?? []).length, 2, 'the Ready list and the link screen do not both take the link’s own door');
});

test('5 · nothing lost: Guests ⚙ draws what only the tile held, once, beside what was there', async () => {
  const { renderSetup } = await import('../app/dashboard/[eventId]/_components/guest-setup/render-setup');
  const html = await renderSetup({ getIn: 'list' });
  const rows = [...html.matchAll(/data-setup-row="([a-z-]+)"/g)].map((m) => m[1]!);
  for (const row of ['asks', 'answer', 'reply-by', 'replies-window', 'requests']) {
    assert.equal(rows.filter((r) => r === row).length, 1, `Guests ⚙ does not draw "${row}" exactly once`);
  }
  for (const row of settingsRowsOf('guests').filter((r) => SETTINGS_ROWS[r].cluster === 'Replies')) assert.ok(rows.includes(row), `${row} is mapped to Replies but not drawn`);
  // How guests answer: the two named choices, the stored one pressed — a pill selector (the templates).
  const pill = html.slice(html.indexOf('data-pill-selector="setup-answer"'));
  assert.ok(html.includes('data-pill-selector="setup-answer"'), 'How guests answer is not the pill selector');
  assert.match(pill.slice(0, 1800), /aria-pressed="true"[^>]*data-seg="all"[^>]*>All at once</);
  // Replies open ▾ is the shared part, its row keyed for `?row=replies-window`.
  assert.match(html, /data-rsvp-setting="replies-open"[^>]*data-setup-row="replies-window"|data-setup-row="replies-window"[^>]*data-rsvp-setting="replies-open"/);
  // Every row a moved door names is drawn — `?row=` lands on something.
  for (const row of [...Object.values(MAKER_ITEMS_MOVED_TO_GUESTS), ...GUIDED_ROWS, ...PART_ROWS]) {
    assert.ok(rows.includes(row), `a door lands on ?row=${row}, which Guests ⚙ does not draw`);
  }
  console.log(`  guests ⚙ (they reply): ${rows.join(' · ')}`);
});
