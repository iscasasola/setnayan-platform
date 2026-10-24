/**
 * 🧍 A LONE LOOK IN THE DRESS CODE IS CENTRED — like a lone person in the wedding march.
 *
 * ⚖ Owner 2026-10-18, verbatim: *"dresscode should also adapt center like wedding march"*. The march centres a lone
 * walker (`entourage-section.tsx` `PairRow`, held by `a-lone-person-is-centred.test.ts`); the Dress code drew a row
 * holding ONE look (a bride, a groom, a crew dressed alike) with its figure on the LEFT and its words beside it.
 *
 * THE PROPERTY, in EVERY palette look (`PALETTE_LOOK_IDS`), over dress codes holding lone and paired rows:
 *   · a role row holding ONE look is centred — its heading, its figure, then its words and colours stacked UNDER the
 *     figure, nothing in it set to one side, its people never a column grid;
 *   · a row holding TWO looks keeps its two columns, each set from the left, exactly as before;
 *   · the reader's own look (the Welcome's "you" panel and Me's "What to wear") is centred when it is one look, and
 *     drawn as shipped when it is both of a role's picks;
 *   · the stylesheet centres every look's swatches inside a lone look.
 * It reads the row's LAYOUT (its classes, its order), so a renamed marker cannot walk past it.
 *
 * Sabotage (2026-10-18): the lone row's person block put back to `items-end` (the shipped figure-left drawing) → red.
 *
 * Run from `apps/web`: `npx tsx --test lib/a-lone-look-in-the-dress-code-is-centred.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PALETTE_LOOK_IDS } from './palette-looks';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
async function widget(props: Record<string, unknown>): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  return renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, ...props }));
}

/* A dress code shaped like cale-ice's after the owner's Apply (2026-10-17): the bride, the groom, the bridesmaids and
   the groomsmen are one look each; the family, the sponsors and the bearers are two; the guests are two options. */
const CONFIG = {
  dos: ['Lean into the palette'],
  donts: ['No white or ivory'],
  roles: { bride: { style: 'ball_gown' }, groom: { style: 'three_piece_suit' }, guest: { style: 'suit' } },
  women: {
    roles: { guest: { style: 'long_gown' } },
    groups: {
      vip_family: { style: 'long_gown', colours: ['#5C0700', '#248191', '#3E3350'] },
      principal_sponsors: { style: 'long_gown', colours: ['#8B7E74', '#6C6C6C'] },
      bearers_flower_girl: { style: 'tulle_dress' },
    },
  },
  groups: {
    groomsmen: { style: 'suit' },
    vip_family: { style: 'suit' },
    bridesmaids: { style: 'long_gown' },
    principal_sponsors: { style: 'suit' },
    secondary_sponsors: { style: 'suit' },
    bearers_flower_girl: { style: 'vest_and_bow_tie' },
  },
  show_figure: true,
};
const PALETTE = {
  guest: ['#5C2542', '#191970', '#C9A0A0', '#6B4226'],
  bride: ['#F7F2EC', '#F3DDE3'],
  groom: ['#F7F2EC', '#FFFFFF', '#FFFFFF'],
  groomsmen: ['#2C2A29', '#006400', '#669C35'],
  bridesmaids: ['#646B38', '#B51A00'],
  principal_sponsors: ['#2C2A29', '#808080', '#8B7E74'],
  secondary_sponsors: ['#2C2A29', '#006400', '#669C35'],
  bearers_flower_girl: ['#5C0700', '#5C0700'],
  parents_immediate_family: ['#2C2A29', '#2C2A29', '#5C0700'],
  reception: ['#5C0700', '#669C35', '#B51A00', '#F7F2EC', '#CFAFAF'],
  touched_roles: ['bearers_flower_girl', 'bride', 'bridesmaids', 'groom', 'groomsmen', 'guest', 'parents_immediate_family', 'principal_sponsors', 'secondary_sponsors'],
};
/* The same, with the guests' women's Wear cleared and their colours never picked — the guests' row holds ONE option
   (the men's), a lone OPTIONS row. */
const CONFIG_LONE_OPTIONS = { ...CONFIG, women: { ...CONFIG.women, roles: { guest: { style: null } } } };
const { guest: _guest, ...PALETTE_NO_GUEST } = PALETTE;
const PALETTE_LONE_OPTIONS = { ...PALETTE_NO_GUEST, touched_roles: PALETTE.touched_roles.filter((k) => k !== 'guest') };

const classOf = (attrs: string) => /class="([^"]*)"/.exec(attrs)?.[1]?.split(/\s+/).filter(Boolean) ?? [];

/** The element opening at `at`, to its own closing tag (nested same-name tags counted). */
function element(html: string, at: number): string {
  const tag = /^<([a-z]+)/.exec(html.slice(at))![1]!;
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = at;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(at, m.index + m[0].length);
  }
  return html.slice(at);
}

/** Each role row: its key, its own classes, its people container's classes, and each person block's classes + inside. */
function rows(html: string) {
  return [...html.matchAll(/<li([^>]*data-role-row="([^"]*)"[^>]*)>/g)].map((m) => {
    const inner = element(html, m.index!);
    const people = /<div([^>]*data-dress-code-people="(\d+)"[^>]*)>/.exec(inner);
    const persons = [...inner.matchAll(/<div([^>]*data-dress-code-person="[^"]*"[^>]*)>/g)].map((d) => ({ cls: classOf(d[1]!), attrs: d[1]!, inner: element(inner, d.index!) }));
    return { key: m[2]!, cls: classOf(m[1]!), peopleCls: people ? classOf(people[1]!) : [], count: people ? Number(people[2]) : 0, persons, inner };
  });
}

/** The figure's own alignment (its people stand on one line, `items-end`) is the drawing's, not the row's. */
const withoutFigure = (html: string) => html.replace(/(<[a-z]+[^>]*data-role-figure="[^"]*"[^>]*?)\sclass="[^"]*"/g, '$1').replace(/(<[a-z]+[^>]*?)\sclass="[^"]*"([^>]*data-role-figure=)/g, '$1$2');

const SIDED = /\b(items-start|items-end|justify-start|text-left|text-start|text-right|text-end)\b/;

function assertLone(row: ReturnType<typeof rows>[number], where: string) {
  const p = row.persons[0]!;
  const hasAttr = (attrs: string, name: string) => new RegExp(`\\s${name}=`).test(attrs);
  assert.ok(row.cls.includes('text-center'), `${where}: the heading of a lone look is not centred`);
  assert.ok(!row.peopleCls.some((c) => /^(sm:|lg:)?grid-cols-/.test(c)), `${where}: a lone look in a column grid`);
  assert.ok(row.peopleCls.includes('items-center'), `${where}: a lone look's people are not centred`);
  assert.ok(p.cls.includes('flex-col') && p.cls.includes('items-center') && p.cls.includes('text-center'), `${where}: a lone look is not stacked and centred (${p.cls.join(' ')})`);
  assert.doesNotMatch(withoutFigure(row.inner), new RegExp(`class="[^"]*${SIDED.source}`), `${where}: something in a lone look is set to one side`);
  assert.ok(hasAttr(p.attrs, 'data-dress-code-lone'), `${where}: the stylesheet's lone mark is missing, so its colours stay left`);
  const fig = p.inner.indexOf('data-role-figure=');
  const wordsAt = p.inner.search(/data-dress-code-pick=|aria-label="[^"]*colours"/);
  if (fig >= 0 && wordsAt >= 0) assert.ok(fig < wordsAt, `${where}: a lone look's words are not under its figure`);
  for (const dw of p.inner.matchAll(/<p([^>]*data-dot-words[^>]*)>/g)) assert.ok(classOf(dw[1]!).includes('justify-center'), `${where}: a lone look's colour words are not centred`);
}

for (const look of PALETTE_LOOK_IDS) {
  test(`${look}: a role holding one look is centred; a role holding two keeps its two columns`, async () => {
    for (const [name, config, rolePalette] of [['cale-now', CONFIG, PALETTE], ['one guest option', CONFIG_LONE_OPTIONS, PALETTE_LONE_OPTIONS]] as const) {
      const all = rows(await widget({ config, rolePalette, paletteLook: look }));
      const lone = all.filter((r) => r.persons.length === 1);
      const pairs = all.filter((r) => r.persons.length === 2);
      assert.ok(lone.length >= 4, `${name}: the fixture drew ${lone.length} lone rows — the guard would see nothing`);
      assert.ok(pairs.length >= 2, `${name}: the fixture drew ${pairs.length} paired rows`);
      for (const r of all) assert.equal(r.count, r.persons.length, `${name} · ${r.key}: the row counts its people wrong`);
      for (const r of lone) assertLone(r, `${look} · ${name} · ${r.key}`);
      for (const r of pairs) {
        const where = `${look} · ${name} · ${r.key}`;
        assert.ok(!r.cls.includes('text-center'), `${where}: a paired row's heading moved`);
        for (const p of r.persons) {
          assert.ok(p.cls.includes('flex-col') && p.cls.includes('items-start'), `${where}: a paired column is no longer set from the left`);
          assert.ok(!/\sdata-dress-code-lone=/.test(p.attrs), `${where}: a paired column carries the lone mark`);
        }
      }
      if (name === 'one guest option') {
        const guests = all.find((r) => r.key === 'guest');
        assert.ok(guests && guests.persons.length === 1, 'the lone options row did not draw');
      } else {
        assert.ok(all.find((r) => r.key === 'parents_immediate_family')?.peopleCls.includes('grid-cols-2'), 'a two-look row lost its two columns');
      }
    }
  });

  test(`${look}: the reader's own look is centred when it is one look, as shipped when it is two`, async () => {
    for (const part of ['all', 'wear'] as const) {
      const one = await widget({ config: CONFIG, rolePalette: PALETTE, paletteLook: look, guestRole: 'bride', part });
      const block = /<div([^>]*data-dress-code-lone[^>]*)>([\s\S]*)/.exec(one);
      assert.ok(block, `${look} · ${part}: a bride's own look is not centred`);
      const cls = classOf(block[1]!);
      assert.ok(cls.includes('flex-col') && cls.includes('items-center') && cls.includes('text-center'), `${look} · ${part}: a bride's own look is not stacked and centred`);
      const fig = block[2]!.indexOf('data-role-figure=');
      const colours = block[2]!.indexOf('data-your-colours');
      assert.ok(fig >= 0 && colours > fig, `${look} · ${part}: a bride's figure and colours are not in the centred look, figure first`);
      // (2026-10-24, the Me redraw: Me › What to wear draws the Studio's named circles — a centred list of its own.)
      if (look === 'tags' || part === 'wear') assert.match(block[2]!, /<(?:ul|div) class="[^"]*\bjustify-center\b/, `${part}: a bride's chips are not centred`);

      /* A principal sponsor the page cannot tell is a ninong or a ninang is shown both picks — two looks. */
      const two = await widget({ config: CONFIG, rolePalette: PALETTE, paletteLook: look, guestRole: 'principal_sponsor', part });
      assert.equal((two.match(/data-your-colours[\s\S]*$/)?.[0].match(/class="space-y-1\.5"/g) ?? []).length, 2, `${look} · ${part}: the sponsor's two looks did not draw`);
      assert.match(two, /data-your-colours/, `${look} · ${part}: a sponsor read with both picks drew no colours`);
      assert.doesNotMatch(two, /data-dress-code-lone/, `${look} · ${part}: a reader shown both picks was centred as one look`);
    }
  });
}

test('the stylesheet centres every look inside a lone look, and keeps Paint strokes a cascade', () => {
  const css = stripComments(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));
  const rule = (sel: RegExp) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => sel.test(m[1]!)).map((m) => m[2]!).join(';');
  assert.match(rule(/\[data-dress-code-lone\]\s+\.sn-pal\s*(,|$)/), /justify-content:\s*center/, 'a lone look\'s swatches are not centred');
  assert.match(rule(/\[data-dress-code-lone\]\s+\.sn-pal-legend/), /justify-content:\s*center/, 'a lone look\'s Circles legend is not centred');
  const strokes = rule(/\[data-dress-code-lone\]\s+\.sn-pal-strokes:not\(\.sn-pal-row\)/);
  assert.match(strokes, /align-items:\s*center/, 'a lone look\'s Paint strokes are not centred');
  assert.match(strokes, /flex-direction:\s*column/, 'a lone look\'s Paint strokes stopped stacking');
});
