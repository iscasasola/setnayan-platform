/**
 * 🎁 STUDIO › E-GIFTS › WISH LIST FOLLOWS THE APPROVED DRAWING (owner 2026-10-08,
 * "ok wish list"; design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 + § 6 E-PR2;
 * prototype `egifts_wish_list_2026-10-08_fable.html` frames 02 · 03 · 09 · 10 · 11).
 *
 * The section is RENDERED on the prototype's own seed and read back, so a state
 * that stops matching the drawing goes red here, not on the owner's phone:
 *
 *   1 · five wishes — the rows' lines, "4 wishes · 1 got", the got wish last with
 *       Got it ✓, the ONE creating button, and "Gifts sent to you" as a count;
 *   2 · empty — sample shapes that are the editor's alone (aria-hidden), "No
 *       wishes yet.", the add button, and no gifts row;
 *   3 · 🔴 a REFUSED read says "Couldn't load your wish list." with Try again —
 *       never "No wishes yet", never an add button under it;
 *   4 · no way to give switched on — the list is still drawn (kept) and the amber
 *       line says guests are not shown it;
 *   5 · Accept gifts? No — nothing below the answer: no ways to give, no wish
 *       list, no thank-you row; the two lines that say it is all kept;
 *   6 · LIVE, under the one note: the section adds no second "Guests see this
 *       right away", and carries no draft field;
 *   7 · every Studio piece is lazy: the section is reached only through the
 *       `StudioTool` door, and the Maker's first-load files never import it;
 *   8 · +0 server actions: the four writes ride the E-Gifts page's one door.
 *
 * `globalThis.React` before the dynamic imports: tsx compiles these to the
 * classic runtime (see `lib/studio-screens-follow-the-prototype.test.ts`).
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • the unread branch removed (falls through to the list)      → 3 red;
 *   • the sample shapes drawn without `aria-hidden`              → 2 red;
 *   • the no-way line dropped                                    → 4 red;
 *   • the giftsOff branch removed from maker-details             → 5 red;
 *   • `HUB_LIVE_WORDS` printed again inside the section          → 6 red;
 *   • `studio-wish-list` imported by maker-details directly      → 7 red;
 *   • `export async function saveWishItem` added to actions.ts   → 8 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { labWishList } from '../app/dev/details-lab/wish-list-fixture';
import { GIFTS_OFF_LINE, GIFTS_OFF_TITLE } from './wish-list-studio';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const P = 'app/dashboard/[eventId]/pabuya';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const EVENT = '00000000-0000-4000-8000-000000000000';
const WAY_ON = [{ is_enabled: true }];
const WAY_OFF = [{ is_enabled: false }];

async function section(state: Parameters<typeof labWishList>[0], methods = WAY_ON): Promise<string> {
  const { StudioWishList } = await import(`../${L}/studio-wish-list`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const send = async () => ({ ok: true as const });
  return renderToStaticMarkup(React.createElement(StudioWishList, { eventId: EVENT, methods, list: labWishList(state), send, retry: () => {} }));
}

/** What a person reads: tags out, entities back, spaces settled. */
const words = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

test('1 · five wishes: the rows, the count, the got wish last, one creating button, the gifts as a count', async () => {
  const html = await section('five');
  const text = words(html);
  assert.match(html, /data-studio-wish-list="list"/);
  assert.match(text, /4 wishes · 1 got/);
  assert.match(text, /Air fryer ₱4,000 sent of ₱4,500 · 2 gifts/);
  assert.match(text, /Rice cooker ₱3,200/);
  assert.match(text, /Luggage set ₱3,000 sent of ₱8,900 · 1 gift/);
  assert.match(text, /Coffee maker ₱6,000/);
  assert.match(text, /Bed linen ₱2,500 sent of ₱2,500 Got it ✓/);

  const rows = [...html.matchAll(/data-wish-row="(open|got)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['open', 'open', 'open', 'open', 'got'], 'the got wish sinks to the end');
  assert.equal(html.match(/data-wish-meter="filling"/g)?.length, 2, 'a meter only where a gift was sent');
  assert.equal(html.match(/data-wish-meter="got"/g)?.length, 1);

  assert.equal(html.match(/data-testid="wish-add"/g)?.length, 1, 'ONE creating button');
  assert.match(text, /Gifts sent to you ₱14,500 said sent · 5 gifts/);
  assert.doesNotMatch(html, /data-wish-no-way/, 'a way to give is on — no warning');
  assert.doesNotMatch(text, /No wishes yet/);
});

test('2 · empty: the editor’s own sample shapes, "No wishes yet.", the add button — and no gifts row', async () => {
  const html = await section('empty');
  assert.match(html, /data-studio-wish-list="empty"/);
  assert.match(html, /<div aria-hidden="true" data-wish-samples=""/, 'the sample shapes must be hidden from a screen reader — they are not wishes');
  assert.match(words(html), /No wishes yet\./);
  assert.equal(html.match(/data-testid="wish-add"/g)?.length, 1);
  assert.doesNotMatch(html, /data-wish-row=/, 'a sample shape is not a row');
  assert.doesNotMatch(html, /data-studio-gifts-sent/);
});

test('3 · a refused read is SAID — never "No wishes yet", never an add button', async () => {
  const html = await section('fail');
  const text = words(html);
  assert.match(html, /data-studio-wish-list="unread"/);
  assert.match(text, /Couldn’t load your wish list\./);
  assert.match(text, /Your wishes and gifts are still there — this phone couldn’t fetch them\./);
  assert.match(html, /data-testid="wish-retry"/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(text, /No wishes yet/, 'a refused read was drawn as an empty list');
  assert.doesNotMatch(html, /data-testid="wish-add"/, 'an add button under a list that could not be read');
  assert.doesNotMatch(html, /data-wish-samples|data-wish-row=|data-studio-gifts-sent/);
  assert.doesNotMatch(text, /\d+ wish/, 'a count nobody could read');
});

test('4 · no way to give on: the list is KEPT and drawn, and the line says guests are not shown it', async () => {
  const html = await section('noway', WAY_OFF);
  assert.match(html, /data-wish-no-way=""/);
  assert.match(words(html), /Switch on a way to give — guests can’t send for a wish without one, so the list is kept but not shown\./);
  assert.equal([...html.matchAll(/data-wish-row=/g)].length, 5, 'the wishes are still there for the couple');
  assert.equal(html.match(/data-testid="wish-add"/g)?.length, 1, 'they can still add to it');
  const none = await section('empty', WAY_OFF);
  assert.doesNotMatch(none, /data-wish-no-way/, 'nothing to keep, nothing to warn about');
});

test('5 · Accept gifts? No: nothing below the answer, and the two lines that say it is kept', () => {
  const md = read(`${L}/maker-details.tsx`);
  const from = md.indexOf('if (editors.gifts && giftsOff) {');
  const to = md.indexOf('} else if (editors.gifts && st.egiftMethods) {');
  assert.ok(from > 0 && to > from, 'the No branch is gone, or no longer comes first');
  const off = md.slice(from, to);
  assert.match(off, /\{ap\.editors\.gifts\}/, 'the answer itself must stay, so it can be switched back');
  assert.match(off, /\{GIFTS_OFF_TITLE\}/);
  assert.match(off, /\{GIFTS_OFF_LINE\}/);
  assert.doesNotMatch(off, /StudioTool/, 'a tool is drawn under "No"');
  assert.match(md, /const giftsOff = props\.answers\?\.gifts\.offered === true && props\.answers\.gifts\.value === false;/);
  assert.match(md, /items: g\.items\.filter\(\(i\) => i\.key !== 'thank-you'\)/, 'the thank-you row is still drawn under "No"');
  assert.equal(GIFTS_OFF_TITLE, 'Guests see no E-Gifts.');
  assert.equal(GIFTS_OFF_LINE, 'Your ways to give, wish list and gifts are kept for when you switch it back on.');
});

test('6 · live, under the ONE note: no second "Guests see this right away", no draft field', () => {
  const wl = read(`${L}/studio-wish-list.tsx`);
  assert.doesNotMatch(wl, /HUB_LIVE_WORDS|Guests see this right away/i, 'a second live note');
  assert.doesNotMatch(wl, /HUB_DRAFT_FIELD|hubDraftAction|HubDraftField/, 'the wish list is live — it must not be sent to the draft');
  assert.doesNotMatch(wl, />\s*Save\s*<|label="Save"|Saved/, 'a Save button or a "Saved" chip');

  const tools = read(`${L}/studio-tools.tsx`);
  assert.equal(tools.match(/\{HUB_LIVE_WORDS\}/g)?.length, 1, 'E-Gifts prints the live note exactly once');
  const md = read(`${L}/maker-details.tsx`);
  const gifts = md.slice(md.indexOf('} else if (editors.gifts && st.egiftMethods) {'));
  const tool = gifts.indexOf('part="gifts"');
  const wish = gifts.indexOf('part="wish-list"');
  assert.ok(tool > 0 && wish > tool, 'the wish list must sit AFTER the ways to give (and their note), before the thank-you item');
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('7 · lazy: the section is reached only through the StudioTool door', () => {
  const importers = walk(join(WEB, 'app'))
    .filter((f) => /from '[^']*\/studio-wish-list'/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(WEB.length + 1));
  assert.deepEqual(importers, [`${L}/studio-tools.tsx`], 'the wish list is imported outside the lazy Studio tools');

  const lazy = read(`${L}/details-lazy.tsx`);
  assert.match(lazy, /export const StudioTool = dynamic\(\(\) => import\(\s*'\.\/studio-tools'\)/);
  const md = read(`${L}/maker-details.tsx`);
  assert.match(md, /import \{ StudioTool \} from '\.\/details-lazy';/);
  assert.match(md, /<StudioTool part="wish-list" eventId=\{eventId\} methods=\{st\.egiftMethods\} list=\{wishList\} \/>/);
  /* A type-only import is erased; a VALUE import of the Studio tools would be first-load weight. */
  assert.doesNotMatch(md, /^import \{[^}]*\} from '\.\/studio-(tools|wish-list)'/m, 'the Maker’s details import the Studio tools directly — that is first-load weight');

  /* What the Maker's own (first-load) files may know of the wish list: its TYPE and two strings. */
  const fromLib = [...md.matchAll(/import \{([^}]*)\} from '@\/lib\/wish-list-studio';/g)].map((m) => m[1]!.trim());
  assert.deepEqual(fromLib, ['GIFTS_OFF_LINE, GIFTS_OFF_TITLE, studioWishIsGot, type StudioWishList']);
});

test('8 · +0 server actions: four writes, one existing door', () => {
  const actions = read(`${P}/actions.ts`);
  const exported = [...actions.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(
    exported,
    ['deleteEgiftMethod', 'moveEgiftMethod', 'saveEgiftMethod', 'savePabuyaMessage', 'setEgiftMethodEnabled'],
    'the E-Gifts page gained an exported server action — each one is a Vercel route',
  );
  const door = actions.slice(actions.indexOf('export async function saveEgiftMethod('), actions.indexOf('const methodKind = str(formData,'));
  assert.match(door, /if \(formData\.has\('wish_op'\)\) \{\s*const wish = await wishListWrite\(eventId, formData\);/);

  const writes = readFileSync(join(WEB, `${P}/wish-items.server.ts`), 'utf8');
  assert.doesNotMatch(writes, /^\s*['"]use server['"]/m, 'wish-items.server.ts became a "use server" file — its four exports would each be a route');
  assert.match(writes, /^import 'server-only';/);
  for (const fn of ['saveWishItem', 'deleteWishItem', 'moveWishItem', 'setWishItemGot']) {
    assert.match(writes, new RegExp(`export async function ${fn}\\(`), `${fn} is missing`);
  }
  /* The screen asks through the ONE door the lazy Studio tools hand it — and imports no action itself. */
  const wl = read(`${L}/studio-wish-list.tsx`);
  assert.doesNotMatch(wl, /pabuya\/actions|hub-draft-actions/, 'the wish list imports a server action of its own');
  const tools = read(`${L}/studio-tools.tsx`);
  const live = tools.slice(tools.indexOf('function StudioWishListLive('), tools.indexOf('export type StudioToolProps'));
  assert.match(live, /makerSave\(\(\) => \{[\s\S]{0,260}return saveEgiftMethod\(form\);\s*\}, requestMakerRefresh\)/);
  for (const op of ['save', 'delete', 'move', 'got']) assert.match(wl, new RegExp(`wish_op: '${op}'`), `the screen never asks for "${op}"`);
});
