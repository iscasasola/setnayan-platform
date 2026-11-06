/**
 * 🧍 A LONE PERSON IN THE ENTOURAGE IS CENTRED — never left in one column of a pair.
 *
 * ⚖ Owner 2026-10-17 (DECISION_LOG "A LONE PERSON IN THE ENTOURAGE / WEDDING MARCH / STANDING WITH US IS CENTRED"),
 * verbatim: *"on the entourage/wedding march/standing with us, if they are just 1 and no partner, center it instead
 * of just 1 side."* The Entourage scene, the Maker's "Wedding March" part (`maker-parts.ts`, canvas `f:entourage`)
 * and the "Standing with us" heading are one renderer: `EntourageSection` (`entourage-section.tsx`) and its march
 * (`entourage-styles.tsx`).
 *
 * THE PROPERTY, for EVERY entourage style the registry lists (plus no pick and the withdrawn `two-sides`), on a cast
 * that holds a lone person in every kind of group — a sided group (a Ninang with no Ninong), a two-role group (a
 * Bridesmaid with no Groomsman), a by-role group (a Coin sponsor alone), a one-role group (a Ring Bearer):
 *   a drawn row that holds exactly ONE person is not a column grid, holds no empty partner cell, sets nothing to
 *   one side, and is centred.
 * It reads the row's LAYOUT (its grid, its cells, its alignment), not a marker the component chooses to print, so
 * renaming `data-solo-row` cannot walk past it.
 *
 * Sabotage (2026-10-17): the shipped On the axis solo (`grid grid-cols-2`, the partner cell blank, the name
 * `text-right`) → red, "On the axis: a lone person in a column grid".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { buildEntourage, type EntourageGroup, type EntourageGuestRow } from './entourage';
import { STAGE_SCENE_STYLE_SETS } from './scene-styles-stages';

/* 🪤 The components are `"jsx": "preserve"` — React must be global before their dynamic import. */
(globalThis as unknown as { React: unknown }).React = React;

const STAND_IN = JSON.parse(
  readFileSync(join(__dirname, 'the-entourage-second-column-is-the-partner.cast.json'), 'utf8'),
) as EntourageGuestRow[];

/** Stand-in names only. [id, first, last, role, walk, place] — a walk is a pair walking together. */
const ROWS: Array<[string, string, string, string, number, number]> = [
  ['n1', 'Ramil', 'Abad', 'principal_sponsor_ninong', 1, 0],
  ['w1', 'Nora', 'Abad', 'principal_sponsor_ninang', 1, 1],
  ['w2', 'Lita', 'Bago', 'principal_sponsor_ninang', 2, 1], // a Ninang alone — a sided group
  ['c1', 'Pio', 'Cuenca', 'candle_sponsor', 3, 0],
  ['c2', 'Ines', 'Cuenca', 'candle_sponsor', 3, 1],
  ['k1', 'Tomas', 'Dizon', 'coin_sponsor', 4, 0], // a Coin sponsor alone — a by-role group
  ['b1', 'Mila', 'Esteban', 'bridesmaid', 5, 0],
  ['g1', 'Noel', 'Esteban', 'groomsman', 5, 1],
  ['b2', 'Rhea', 'Feliciano', 'bridesmaid', 6, 0], // a Bridesmaid alone — a two-role group
  ['r1', 'Bito', 'Galang', 'ring_bearer', 7, 0], // a Ring Bearer alone — a one-role group
];
const LONE: EntourageGuestRow[] = ROWS.map(([id, first, last, role, walk, place]) => ({
  guest_id: id,
  name_prefix: null,
  first_name: first,
  last_name: last,
  role,
  extra_roles: [],
  march: { walk_no: walk, place_in_walk: place },
})) as unknown as EntourageGuestRow[];

const CASTS: Array<[string, EntourageGroup[]]> = [
  ['the lone cast', buildEntourage(LONE)],
  ['the stand-in cast', buildEntourage(STAND_IN)],
];

const decode = (s: string) =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function render(groups: readonly EntourageGroup[], sceneStyle: string | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('../app/[slug]/_components/entourage-section');
  return decode(renderToStaticMarkup(React.createElement(EntourageSection as never, { groups, sceneStyle })));
}

const classOf = (attrs: string) => /class="([^"]*)"/.exec(attrs)?.[1]?.split(/\s+/) ?? [];

/** Every drawn row holding ONE person: its own classes, and everything inside it. */
function loneRows(html: string): Array<{ cls: string[]; inner: string; who: string }> {
  return [...html.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].flatMap((m) => {
    const people = [...m[2]!.matchAll(/data-person=""[^>]*>([^<]*)</g)].map((x) => x[1]!.trim());
    return people.length === 1 ? [{ cls: classOf(m[1]!), inner: m[2]!, who: people[0]! }] : [];
  });
}

const STYLES: Array<string | null> = [
  ...(STAGE_SCENE_STYLE_SETS.find((s) => s.type === 'entourage')?.styles.map((s) => s.id) ?? []).filter((id) => id !== 'march'),
  null,
  'two-sides',
];

test('the fixture holds a lone person in every kind of group, and the registry still lists the styles', () => {
  assert.ok(STYLES.includes('roll-call') && STYLES.includes('lines'), `the entourage styles moved: ${STYLES.join(', ')}`);
  const groups = buildEntourage(LONE);
  const loneIn = (key: string) => groups.find((g) => g.key === key)?.rows.filter((r) => r.filter(Boolean).length === 1).length ?? 0;
  for (const key of ['principal_sponsors', 'secondary_sponsors', 'bridesmaids_groomsmen', 'bearers']) {
    assert.ok(loneIn(key) > 0, `no lone person in ${key} — the guard would not see that kind of group`);
  }
});

for (const [castName, groups] of CASTS) {
  for (const style of STYLES) {
    test(`${style ?? 'no pick'} · ${castName}: every lone person is centred across the row, never in one column`, async () => {
      const lone = loneRows(await render(groups, style));
      assert.ok(lone.length > 0, 'no lone person drew — the guard sees nothing');
      const look = style === 'lines' ? 'Lines' : 'On the axis';
      for (const r of lone) {
        assert.ok(!r.cls.some((c) => /^grid-cols-/.test(c)), `${look}: a lone person in a column grid — ${r.who}`);
        assert.doesNotMatch(r.inner, /<(span|div)[^>]*><\/\1>/, `${look}: a lone person beside an empty partner cell — ${r.who}`);
        assert.doesNotMatch(r.inner, /class="[^"]*\btext-(right|left|start|end)\b/, `${look}: a lone person set to one side — ${r.who}`);
        assert.ok(r.cls.includes('text-center'), `${look}: a lone person not centred — ${r.who}`);
      }
    });
  }
}

/* The march is one column for everybody — numbered lines, names joined — so nobody stands on a side of it. */
test('the march · no line is a column grid, so a lone walker stands where a pair does', async () => {
  for (const [, groups] of CASTS) {
    const html = await render(groups, 'march');
    const lines = [...html.matchAll(/<li([^>]*data-march-line[^>]*)>/g)].map((m) => classOf(m[1]!));
    assert.ok(lines.length > 0);
    for (const cls of lines) assert.ok(!cls.some((c) => /^grid-cols-/.test(c)), 'a march line drawn in columns');
  }
});
