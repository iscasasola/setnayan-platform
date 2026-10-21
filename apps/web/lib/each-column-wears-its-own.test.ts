/**
 * 👫 EACH COLUMN WEARS ITS OWN — owner, 2026-10-16, on his own event's Attire (a role with "6 people", two columns):
 * *"the drawing is not following the type of attire."* FOR MEN drew a SUIT under a Wear ▾ reading "Long gown"; FOR
 * WOMEN read "Long gown" too. The row had been saved before the men/women split with ONE shared Wear — a women's one —
 * and the men's column both offered and showed it, drawing a suit because the drawing table mapped a man's "Long gown"
 * to a suit.
 *
 * Held here, each by executing it:
 *   1. a column's Wear ▾ offers ONLY its own person's styles — a men's column never names a gown, a dress or a
 *      Filipiniana; a girl's never a suit or a barong;
 *   2. each column's figure follows ITS OWN pick — changing the men's never moves the women's, and the reverse;
 *   3. a Wear stored once for everybody resolves per column: the person it fits keeps it, the other reads "Not said
 *      yet" (never the nearest style — no outfit is ever assumed, 2026-09-20) — in the Studio's reading, on the guest
 *      page's row, in the reader's own panel and on their checklist.
 *
 * Run from `apps/web`: `npx tsx --test lib/each-column-wears-its-own.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STYLE_ORDER, garmentFor, type FigureWho } from './attire-figures';
import { ATTIRE_ROWS, attireRow, pickOptions, picksOf, withFirstStyle, withSecondStyle } from './attire-rows';
import { ATTIRE_STYLES, GENERAL_ATTIRE_STYLES, type AttireStyle } from './role-dress-code';
import { ROW_FIGURE_ROLES, roleDesigns } from './attire-designs';
import { garmentOfPick } from './role-figure';
import { withAttireStyle } from './mood-board-studio';
import { stripComments } from './strip-comments';
import type { RolePalette } from './mood-board';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
/** Styles that are only ever a woman's or a girl's — never on a man's or a boy's list. */
const NEVER_HIS: readonly AttireStyle[] = ['long_gown', 'cocktail_dress', 'filipiniana'];
/** Styles that are a man's or a woman's — never a little girl's (there is no girl's suit or barong). */
const NEVER_A_GIRLS: readonly AttireStyle[] = ['suit', 'barong_tagalog'];

const SPONSORS = attireRow('groups', 'principal_sponsors')!;
const BEARERS = attireRow('groups', 'bearers_flower_girl')!;
/** cale-ice's live shape (read SELECT-only, 2026-10-16): the sponsors saved before the split, ONE Wear, a women's. */
const SHARED = { groups: { principal_sponsors: { style: 'long_gown' } } };

test('1 · a column offers only its own person’s styles', () => {
  for (const row of ATTIRE_ROWS) {
    row.who.forEach((who, i) => {
      const options = pickOptions(row, i as 0 | 1);
      assert.ok(options.length > 0, `${row.key} ${who}: an empty Wear ▾`);
      for (const s of options) assert.ok((ATTIRE_STYLES as readonly string[]).includes(s), `${row.key} ${who}: "${s}" is not in the ONE vocabulary`);
      if (row.who.length === 1 && row.either) return; // a reader or a judge may be either — held in its own test below
      /* 👔 2026-10-16: a row with its own designs lists ITS ROLE's (lib/each-role-has-its-own-designs.test.ts holds the table). */
      const role = ROW_FIGURE_ROLES[row.key]?.[i];
      assert.deepEqual(options, role ? roleDesigns(role) : STYLE_ORDER[who], `${row.key} ${who}: its Wear ▾ is not its person's list`);
      if (who === 'm' || who === 'boy') for (const s of NEVER_HIS) assert.ok(!options.includes(s), `${row.key}: a ${who === 'm' ? 'men' : 'boys'}' column offers "${s}"`);
      if (who === 'girl') for (const s of NEVER_A_GIRLS) assert.ok(!options.includes(s), `${row.key}: the girls' column offers "${s}"`);
    });
  }
  /* The ninong's two, the ninang's two — the owner's table (2026-10-16, "EACH ROLE HAS ITS OWN LIST OF DESIGNS"). */
  assert.deepEqual(pickOptions(SPONSORS, 0), ['barong_tagalog', 'suit']);
  assert.deepEqual(pickOptions(SPONSORS, 1), ['filipiniana', 'long_gown']);
  /* A one-pick row whose people may be either keeps every style; its person is whoever wears the style. */
  const officiants = attireRow('groups', 'officiants')!;
  assert.deepEqual([...pickOptions(officiants)].sort(), [...GENERAL_ATTIRE_STYLES].sort(), 'a reader in a gown lost her Wear');
  assert.deepEqual(picksOf({ groups: { officiants: { style: 'long_gown' } } }, officiants).map((p) => [p.who, garmentFor(p.who, p.style)]), [['f', 'gown']]);
  assert.deepEqual(picksOf({ groups: { officiants: { style: 'barong_tagalog' } } }, officiants).map((p) => [p.who, garmentFor(p.who, p.style)]), [['m', 'barong']]);
  /* The drawing table holds nothing a person is not offered — no man's "Long gown" drawn as a suit. */
  for (const who of ['f', 'm', 'girl', 'boy'] as FigureWho[]) {
    for (const s of ATTIRE_STYLES) if (!STYLE_ORDER[who].includes(s)) assert.equal(garmentFor(who, s), 'unset', `${who} "${s}" is drawn as something`);
  }
  /* The Studio's Wear ▾ is built from it — per column, never from the person's whole list or every style. */
  const studio = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'), 'utf8'));
  /* (2026-10-21: the one Wear ▾ takes its props as an object — `options: [` — beside the guests' styles-and-designs.) */
  assert.match(studio, /options(?:=\{|: )\[\{ key: '', label: 'Not said yet' \}, \.\.\.\(def \? pickOptions\(def, pi === 0 \? 0 : 1\)/, 'the Studio’s Wear ▾ is not the column’s own list');
  /* (2026-10-21: the guests' columns also read their ticks — `picksWithDesigns` wraps `picksOf` — and their people wear
     the column's first allowed design, `heroArt`, else the pick's own drawing as before.) */
  assert.match(studio, /const picks = def \? picks(?:Of|WithDesigns)\(dress, def\)/, 'the Studio does not read the picks per column');
  assert.match(
    studio,
    /const garment = (?:role \? garmentOfPick\(pick\) : garmentFor\(pick\.who, pick\.style\)|\(role \? \(heroArt\(pick\) \?\? garmentOfPick\(pick\)\) : null\) \?\? garmentFor\(pick\.who, pick\.style\));/,
    'a column’s figure is not drawn from its own pick',
  );
  assert.match(studio, /people=\{\[\{ who: pick\.who, garment, main:/, 'a column’s figure is not drawn from its own pick');
});

test('2 · each column’s figure follows its own pick, and only its own', () => {
  const drawn = (c: Record<string, unknown>, row = SPONSORS) => picksOf(c, row).map((p) => garmentOfPick(p));
  let c: Record<string, unknown> = { groups: { principal_sponsors: { style: 'barong_tagalog' } }, women: { groups: { principal_sponsors: { style: 'filipiniana' } } } };
  assert.deepEqual(drawn(c), ['ninong-barong_tagalog', 'ninang-filipiniana']);
  for (const s of pickOptions(SPONSORS, 0)) {
    c = withFirstStyle(c, 'groups', 'principal_sponsors', s, withAttireStyle);
    assert.deepEqual(drawn(c), [`ninong-${s}`, 'ninang-filipiniana'], `the men's ${s} moved the women's figure`);
  }
  for (const s of pickOptions(SPONSORS, 1)) {
    const after = withSecondStyle(c, 'groups', 'principal_sponsors', s);
    assert.deepEqual(drawn(after), [drawn(c)[0], `ninang-${s}`], `the women's ${s} moved the men's figure`);
  }
  /* The boys and the girls alike. */
  const kids = withSecondStyle(withFirstStyle({}, 'groups', 'bearers_flower_girl', 'barong_tagalog', withAttireStyle), 'groups', 'bearers_flower_girl', 'tulle_dress');
  assert.deepEqual(drawn(kids, BEARERS), ['ring_bearer-barong_tagalog', 'flower_girl-tulle_dress']);
});

test('3 · a Wear stored once for everybody resolves per column — the one it fits keeps it, the other is "Not said yet"', () => {
  assert.deepEqual(picksOf(SHARED, SPONSORS).map((p) => [p.who, p.style, garmentOfPick(p)]), [
    ['m', null, 'unset'],
    ['f', 'long_gown', 'ninang-long_gown'],
  ]);
  /* A shared style reads into each column's own design — `formal` is a woman's Long gown; a ninong has no tuxedo. */
  assert.deepEqual(picksOf({ groups: { principal_sponsors: { style: 'formal' } } }, SPONSORS).map((p) => p.style), [null, 'long_gown']);
  assert.deepEqual(picksOf({ groups: { principal_sponsors: { style: 'suit' } } }, SPONSORS).map((p) => p.style), ['suit', null]);
  /* A shared barong: the boys wear it, the girls are not told to. */
  assert.deepEqual(picksOf({ groups: { bearers_flower_girl: { style: 'barong_tagalog' } } }, BEARERS).map((p) => p.style), ['barong_tagalog', null]);
  /* The men's first pick pins the women's to what THEY read — the shared gown stays theirs; the boys' first pick pins
     the girls to "Not said yet", never to a barong. */
  const pinned = withFirstStyle(SHARED, 'groups', 'principal_sponsors', 'suit', withAttireStyle);
  assert.deepEqual(picksOf(pinned, SPONSORS).map((p) => p.style), ['suit', 'long_gown']);
  const kids = withFirstStyle({ groups: { bearers_flower_girl: { style: 'barong_tagalog' } } }, 'groups', 'bearers_flower_girl', 'suit', withAttireStyle);
  assert.deepEqual(((kids as Record<string, unknown>).women as { groups: Record<string, unknown> }).groups.bearers_flower_girl, { style: null });
});

/* ── the guest page reads the same truth ─────────────────────────────────── */

const BOARD: RolePalette = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC', '#2B1D14', '#8E3B5B'],
  principal_sponsors: ['#6B6B3A'],
  touched_roles: ['principal_sponsors'],
};
const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
async function scene(props: Record<string, unknown>): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  return renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config: {}, rolePalette: BOARD, ...props }));
}
function slice(html: string, from: string): string {
  const at = html.indexOf(from);
  if (at < 0) return '';
  const end = html.indexOf('data-role-row="', at + from.length);
  return end < 0 ? html.slice(at) : html.slice(at, end);
}
const figure = (html: string) => [...html.matchAll(/data-person="([a-z]+)" data-garment="([a-z_-]+)"/g)].map((m) => [m[1], m[2]]);

test('3 · the guest page: the sponsors’ row says and draws each column’s own Wear', async () => {
  const shared = slice(await scene({ config: SHARED }), 'data-role-row="principal_sponsors"');
  assert.ok(shared, 'the sponsors’ row is not drawn');
  assert.match(shared, /For women · Long gown/);
  assert.doesNotMatch(shared, /For men · Long gown/, 'the men are told the women’s gown');
  /* 2026-10-17 (owner: "if … nothing is picked, then nothing should show"): the men, whose Wear is not said, are drawn
     in no garment at all — never a plain suit assumed for them; their colours still show, said by what they colour. */
  assert.deepEqual(figure(shared), [['f', 'ninang-long_gown']], 'only the women, in the ninang’s gown — no garment assumed for the men');

  const split = slice(await scene({ config: { groups: { principal_sponsors: { style: 'barong_tagalog' } }, women: { groups: { principal_sponsors: { style: 'long_gown' } } } } }), 'data-role-row="principal_sponsors"');
  assert.match(split, /For men · Barong Tagalog[\s\S]*For women · Long gown/);
  assert.deepEqual(figure(split), [['m', 'ninong-barong_tagalog'], ['f', 'ninang-long_gown']]);
});

test('3 · the reader’s own panel and checklist: a ninong is never told the shared gown', async () => {
  const html = await scene({ config: SHARED, guestRole: 'principal_sponsor_ninong' });
  const you = html.slice(html.indexOf('data-dress-code="you"'));
  assert.ok(you, 'no panel for him');
  assert.doesNotMatch(you, />Long gown</, 'the ninong is told to wear a long gown');
  /* His Wear is not said: he is drawn in nothing assumed (owner 2026-10-17, "nothing is picked … nothing should show"). */
  assert.deepEqual(figure(you).map(([w]) => w), []);
  const her = (await scene({ config: SHARED, guestRole: 'principal_sponsor_ninang' }));
  assert.match(her.slice(her.indexOf('data-dress-code="you"')), />Long gown</, 'the ninang lost the gown that is hers');

  const { guestChecklistItems } = await import('../app/[slug]/_lib/guest-checklist-facts');
  const wearOf = (role: string) =>
    JSON.stringify(
      guestChecklistItems({ role: role as never, dressCodeConfig: SHARED, rolePalette: BOARD, arriveBy: null, venueName: null, venueAddress: null, venueLatitude: null, venueLongitude: null, tableLabel: null }),
    );
  assert.doesNotMatch(wearOf('principal_sponsor_ninong'), /Long gown/, 'the ninong’s checklist says the women’s gown');
  assert.match(wearOf('principal_sponsor_ninang'), /Long gown/, 'the ninang’s checklist lost her gown');
});
