/**
 * 🪞 THE DRESS CODE SHOWS EVERY PICK — AND NOTHING ELSE.
 *
 * Owner, 2026-10-17, on his own live page: *"the website does not reflect what is picked on attires on mood board &
 * dress code"*, then *"if on moodboard&dress code, nothing is picked, then nothing should show"*, then *"for the dress
 * code of women, there are palettes but no indication of what the colors control"* and *"why do they have different
 * palette icon?"*.
 *
 * Measured (production, SELECT-only, cale-ice): the guest page built its rows from the Mood Board's palette KEYS and
 * its words from a per-role tier the Studio no longer shows — Maid / Matron of Honor, Best Man / Best Woman and
 * Wedding Party rows the Studio has no row for, "Parents of the Groom · Long gown" (a father told to wear a gown),
 * empty headings, eleven "Our colours" against the five picked. AND the Studio read its own dress code through a
 * parser that dropped every women's pick and the bride's, groom's and guests' Wear — so the editor itself showed
 * "Not said yet" for saved picks after a reload, and its next save wrote them away.
 *
 * Every property here is held as a PROPERTY over many dress codes (a seeded fuzz over every Studio row, every Wear a
 * column offers, old words, women's own colours, picked and unpicked colours, legacy per-role lines), not over one
 * phrasing:
 *   1 · every pick the Studio shows renders on the guest page, in the person's own word;
 *   2 · no row, and no person, renders with nothing picked (never a bare heading);
 *   3 · every colour a guest sees says what it colours, and the Studio's dots say the same words;
 *   4 · the Studio reads back exactly what the page reads (one fact, one reader);
 *   5 · no "Our colours" in this scene — each role's figure and colours (owner 2026-10-17); a reader keeps theirs;
 *   6 · a reader is dressed by their Studio row — a father is never handed a gown;
 *   7 · at row size every palette look keeps its full-size edge, shading, card and rim.
 *
 * Run from `apps/web`: `npx tsx --test lib/the-dress-code-shows-every-pick.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ATTIRE_ROWS, PICK_LABEL, picksOf, pickOptions, readerAttire, studioRowOf, type AttireRowDef } from './attire-rows';
import { designLabel } from './attire-designs';
import { pickDots, singleWearerOf } from './role-figure';
import { stripComments } from './strip-comments';
import { ATTIRE_STYLE_LABEL, type AttireStyle } from './role-dress-code';
import { resolveDisplayPalette } from './room-palette';
import { sanitizeRolePalette, type RolePalette } from './mood-board';
import { dressCodeForEveryone } from './dress-code-for-everyone';
import { PALETTE_LOOK_IDS } from './palette-looks';

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
function rowHtml(html: string, key: string): string {
  const at = html.indexOf(`data-role-row="${key}"`);
  if (at < 0) return '';
  const end = html.indexOf('data-role-row="', at + 10);
  return end < 0 ? html.slice(at) : html.slice(at, end);
}
const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
/** The text of every `[data-dress-code-pick]` line in a row. */
const pickLines = (row: string) => [...row.matchAll(/data-dress-code-pick=""[^>]*>([^<]*)</g)].map((m) => unescape(m[1]!.trim()));
/** Each person block of a row: its swatch count and its words. */
function people(row: string): Array<{ who: string; swatches: number; words: string[] }> {
  const parts = row.split(/data-dress-code-person="/).slice(1);
  return parts.map((p) => {
    const who = p.slice(0, p.indexOf('"'));
    /* The person's swatch list is the first <ul> in their block (a person with no colours has none — and must not
       borrow the next row's <li>). */
    const list = /<ul[^>]*aria-label="[^"]*colours"[^>]*>([\s\S]*?)<\/ul>/.exec(p.slice(0, p.search(/data-dress-code-person="|data-role-row="/) >>> 0 || p.length));
    const swatches = list ? (list[1]!.match(/<li\b/g) ?? []).length : 0;
    const words = [...p.matchAll(/data-dot-word="([^"]*)"/g)].map((m) => unescape(m[1]!));
    return { who, swatches, words };
  });
}

/* ── a seeded fuzz of dress codes, shaped like what the Studio can save (and what older forms left behind) ── */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const HEXES = ['#5C0700', '#669C35', '#B51A00', '#F7F2EC', '#CFAFAF', '#2C2A29', '#803236', '#646B38', '#191970', '#8B7E74'];
function fuzzCase(seed: number): { config: Record<string, unknown>; palette: RolePalette } {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const colours = (n: number) => Array.from({ length: n }, () => pick(HEXES));
  const config: Record<string, unknown> = { roles: {}, groups: {}, women: { roles: {}, groups: {} }, dos: ['Lean into the palette'], palette: [{ name: 'Oxblood', hex: '#351115' }] };
  const palette: Record<string, unknown> = { reception: colours(5), touched_roles: [] as string[] };
  for (const row of ATTIRE_ROWS) {
    const roll = r();
    const tier = config[row.tier] as Record<string, unknown>;
    /* the first column: nothing · one of its own options · an old word (`formal`) · another person's word */
    if (roll < 0.25) {
      /* nothing */
    } else if (roll < 0.75) tier[row.key] = { style: pick(pickOptions(row, 0)) };
    else tier[row.key] = { style: pick(['formal', 'long_gown', 'suit', 'tulle_dress'] as const) };
    if (row.who.length === 2) {
      const w = (config.women as Record<string, Record<string, unknown>>)[row.tier]!;
      const r2 = r();
      if (r2 < 0.3) w[row.key] = { style: pick(pickOptions(row, 1)) };
      else if (r2 < 0.45) w[row.key] = { style: null };
      else if (r2 < 0.6) w[row.key] = { style: pick(pickOptions(row, 1)), colours: colours(1 + Math.floor(r() * 3)) };
      else if (r2 < 0.7) w[row.key] = { colours: colours(2) };
    }
    if (row.paletteKey && r() < 0.6) {
      palette[row.paletteKey] = colours(1 + Math.floor(r() * 3));
      (palette.touched_roles as string[]).push(row.paletteKey);
    }
  }
  /* legacy per-role lines and palette keys the Studio has no row for */
  if (r() < 0.7) (config.roles as Record<string, unknown>).groom_parents = { style: 'long_gown' };
  if (r() < 0.7) (config.roles as Record<string, unknown>).best_woman = { style: 'long_gown' };
  if (r() < 0.5) {
    palette.wedding_party = colours(3);
    palette.maid_of_honor = colours(1);
    (palette.touched_roles as string[]).push('wedding_party', 'maid_of_honor');
  }
  return { config, palette: palette as RolePalette };
}
const CASES = Array.from({ length: 60 }, (_, i) => fuzzCase(1009 + i * 7919));

/* cale-ice, exactly as production held it 2026-10-17 before the owner's Apply (controller's SELECT-only read). */
const CALE = {
  config: {
    dos: ['Lean into the palette'],
    donts: ['No white or ivory'],
    roles: { best_man: { style: 'suit' }, best_woman: { style: 'long_gown' }, groom_parents: { style: 'long_gown' } },
    women: { groups: { vip_family: { style: 'long_gown' }, principal_sponsors: { style: 'long_gown' } } },
    groups: { vip_family: { style: 'formal' }, bridesmaids: { style: 'long_gown' }, principal_sponsors: { style: 'suit' }, secondary_sponsors: { style: 'suit' } },
    palette: ['#351115', '#646B38', '#F3E5B9', '#E6C0B3', '#803236', '#6B4226'].map((hex) => ({ hex, name: hex })),
    show_figure: true,
  },
  palette: {
    bride: ['#FFFFFF', '#FFFFFF'],
    groom: ['#FFFFFF', '#FFFFFF'],
    guest: ['#6B4226', '#C9A0A0', '#191970', '#5C2542'],
    best_man: ['#803236'],
    groomsmen: ['#646B38'],
    reception: ['#5C0700', '#669C35', '#B51A00', '#F7F2EC', '#CFAFAF'],
    bridesmaids: ['#646B38', '#B51A00'],
    maid_of_honor: ['#803236'],
    wedding_party: ['#6B4226', '#C9A0A0', '#191970', '#5C2542'],
    principal_sponsors: ['#8B7E74', '#6C6C6C'],
    secondary_sponsors: ['#7A8B6F'],
    parents_immediate_family: ['#5C0700', '#669C35', '#B51A00'],
    touched_roles: ['best_man', 'bride', 'bridesmaids', 'groom', 'groomsmen', 'guest', 'maid_of_honor', 'parents_immediate_family', 'principal_sponsors', 'secondary_sponsors', 'wedding_party'],
  } as RolePalette,
};

/** What the Studio shows for a row: each column's Wear, and whether the couple picked the row's colours. */
function studioShows(config: Record<string, unknown>, palette: RolePalette, row: AttireRowDef) {
  const touched = new Set(palette.touched_roles ?? []);
  const colourPicked = row.paletteKey ? touched.has(row.paletteKey) || (palette[row.paletteKey]?.length ?? 0) > 0 : false;
  /* 🤵‍♂️ An `optionalSecond` column (the man of honor's, 2026-10-19) is the Studio's only when its person is on the list —
     which a guest page cannot see — so the page lists it only once it holds a Wear or its own colours. */
  return picksOf(config, row)
    .filter((p, i) => !(row.optionalSecond && i === 1 && !p.style && !(p.colours && p.colours.length)))
    .map((p) => ({ ...p, shown: Boolean(p.style || (p.colours && p.colours.length) || colourPicked) }));
}

test('1 · every pick the Studio shows renders on the guest page, in the person’s own word (60 dress codes + cale-ice)', async () => {
  for (const { config, palette } of [...CASES, CALE]) {
    const html = await widget({ config, rolePalette: palette, ceremonyType: 'catholic' });
    for (const row of ATTIRE_ROWS) {
      if (row.key === 'muslim_principals') continue;
      const key = row.paletteKey ?? row.key;
      const lines = pickLines(rowHtml(html, key));
      const columns = studioShows(config, palette, row);
      for (const p of columns) {
        if (!p.style) continue;
        const said = p.role ? designLabel(p.role, p.style) : ATTIRE_STYLE_LABEL[p.style];
        const want = columns.length === 2 ? `${PICK_LABEL[p.who]} · ${said}` : said;
        assert.ok(lines.includes(want), `${key}: the Studio's "${want}" is not on the guest page (lines: ${JSON.stringify(lines)})`);
      }
    }
  }
});

test('2 · nothing picked, nothing shown — no bare heading, no person without a pick, no row the Studio does not have', async () => {
  const studioKeys = new Set(ATTIRE_ROWS.map((r) => r.paletteKey ?? r.key));
  for (const { config, palette } of [...CASES, CALE]) {
    const html = await widget({ config, rolePalette: palette, ceremonyType: 'catholic' });
    for (const [, key] of html.matchAll(/data-role-row="([^"]+)"/g)) {
      assert.ok(studioKeys.has(key!), `a "${key}" row is drawn — Studio › Mood Board & Dress Code has no such row`);
      const row = ATTIRE_ROWS.find((r) => (r.paletteKey ?? r.key) === key)!;
      const shown = studioShows(config, palette, row).filter((p) => p.shown);
      assert.ok(shown.length > 0, `${key}: drawn with nothing picked`);
      const drawn = people(rowHtml(html, key!));
      assert.ok(drawn.length > 0, `${key}: a bare heading`);
      assert.deepEqual(drawn.map((d) => d.who).sort(), shown.map((p) => p.who).sort(), `${key}: the people drawn are not the people picked`);
    }
    for (const row of ATTIRE_ROWS) {
      if (row.key === 'muslim_principals') continue;
      const anything = studioShows(config, palette, row).some((p) => p.shown);
      if (!anything) assert.equal(rowHtml(html, row.paletteKey ?? row.key), '', `${row.key}: drawn with nothing picked`);
    }
  }
});

test('2 · the scene says nothing at all when nothing is picked (only the couple’s own lists)', async () => {
  const html = await widget({ config: {}, rolePalette: {}, hideWhenEmpty: true });
  assert.equal(html, '', 'an empty dress code still drew something for a guest');
  const listsOnly = await widget({ config: { dos: ['Lean into the palette'] }, rolePalette: {}, hideWhenEmpty: true });
  assert.ok(!/data-role-row=/.test(listsOnly) && !/data-dress-code="ours"/.test(listsOnly), 'rows or colours drawn with none picked');
});

test('3 · every colour a guest sees says what it colours — and the Studio’s dots use the same words', async () => {
  for (const look of PALETTE_LOOK_IDS) {
    for (const { config, palette } of [...CASES.slice(0, 15), CALE]) {
      const html = await widget({ config, rolePalette: palette, paletteLook: look, ceremonyType: 'catholic' });
      const general = dressCodeForEveryone({ config, stored: sanitizeRolePalette(palette), board: resolveDisplayPalette(sanitizeRolePalette(palette)), ceremonyType: 'catholic' });
      for (const row of general.rows) {
        const drawn = people(rowHtml(html, row.key));
        for (const p of row.picks) {
          const d = drawn.find((x) => x.who === p.who)!;
          assert.equal(d.swatches, p.dots.length, `${look} · ${row.key}/${p.who}: ${d.swatches} swatches for ${p.dots.length} colours`);
          assert.equal(d.words.length, d.swatches, `${look} · ${row.key}/${p.who}: ${d.swatches} colours but ${d.words.length} words`);
          assert.ok(d.words.every((w) => w.trim().length > 0), `${look} · ${row.key}: a colour with no word`);
          /* the Studio's own words for the same colours */
          assert.deepEqual(d.words, pickDots(p.style, p.colours, p.role, row.meaning === 'options').map((x) => x.word));
        }
      }
    }
  }
  /* the Studio's dots are drawn from `pickDots` and nothing else (a source fact: the client island cannot be rendered here) */
  const studio = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'studio', 'mood-board', '_components', 'mood-board-studio.tsx'), 'utf8');
  const dotSites = studio.match(/<RoleColourDot\b/g)?.length ?? 0;
  const worded = studio.match(/data-mood-board-dot-word=/g)?.length ?? 0;
  assert.ok(dotSites > 0 && worded >= dotSites, `the Studio draws ${dotSites} kinds of colour dot but only ${worded} carry a word`);
});

test('3 · a women’s gown says it is the gown; a colour past the garment says it is an accent', () => {
  const dots = pickDots('long_gown', ['#5C0700', '#248191', '#3E3350'], 'mother');
  assert.deepEqual(dots.map((d) => d.word), ['Long gown', 'Accent', 'Accent']);
  const suit = pickDots('suit', ['#2C2A29'], 'father');
  assert.deepEqual(suit.map((d) => d.word), ['Coat & pants', 'Tie', 'Shirt']);
  assert.deepEqual(pickDots(null, ['#2C2A29', '#808080'], null).map((d) => d.word), ['Outfit', 'Accent']);
});

test('4 · the Studio reads back exactly what the page reads — the women’s picks and the couple’s own Wear survive the reader', async () => {
  const { normalizeDressCodeConfig } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/dress-code-fields');
  const after = {
    ...CALE.config,
    roles: { ...CALE.config.roles, bride: { style: 'ball_gown' }, groom: { style: 'three_piece_suit' }, guest: { style: 'suit' } },
    women: { roles: { guest: { style: 'long_gown' } }, groups: { ...CALE.config.women.groups, secondary_sponsors: { style: 'long_gown', colours: ['#5C0700'] } } },
  };
  for (const config of [after, ...CASES.map((c) => c.config)]) {
    const studio = normalizeDressCodeConfig(config) as unknown as Record<string, unknown>;
    for (const row of ATTIRE_ROWS) {
      assert.deepEqual(picksOf(studio, row), picksOf(config, row), `${row.key}: the Studio reads a different Wear than the guest page`);
    }
  }
});

test('4 · the Studio’s loader keeps every stored key — what it does not show, its whole-config save cannot delete', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'studio', 'mood-board', '_components', 'mood-board-editor.tsx'), 'utf8');
  const at = src.indexOf('dressConfig = ');
  assert.ok(at > 0, 'precondition: the Studio’s dress code is bound');
  const rhs = src.slice(at, src.indexOf(';', at));
  assert.match(rhs, /\.\.\.\(stored/, 'the Studio is handed only the parsed config — a key it drops, its next save deletes');
});

test('5 · no "Our colours" in the dress code — it is each role’s figure and colours (owner 2026-10-17)', async () => {
  for (const look of PALETTE_LOOK_IDS) {
    for (const sceneStyle of [null, 'palette', 'line']) {
      const html = await widget({ config: CALE.config, rolePalette: CALE.palette, paletteLook: look, sceneStyle });
      assert.ok(!/data-dress-code="ours"|>Our colours</.test(html), `${look} · ${sceneStyle}: "Our colours" is back in the dress code`);
      /* not one of the five main colours is drawn on its own — every colour on the page is a role's */
      const general = dressCodeForEveryone({ config: CALE.config, stored: sanitizeRolePalette(CALE.palette), board: resolveDisplayPalette(sanitizeRolePalette(CALE.palette)) });
      const roleHexes = new Set(general.rows.flatMap((r) => r.hexes.map((h) => h.toUpperCase())));
      for (const hex of CALE.palette.reception!) if (!roleHexes.has(hex.toUpperCase())) assert.ok(!html.toUpperCase().includes(hex.toUpperCase()), `${look} · ${sceneStyle}: the main colour ${hex} is drawn`);
    }
  }
  /* the reader keeps their own colours — that IS their dress code */
  const mine = await widget({ config: CALE.config, rolePalette: CALE.palette, guestRole: 'principal_sponsor_ninang' });
  assert.match(mine, /aria-label="Your colours/);
});

test('6 · a reader is dressed by their Studio row: the groom’s father reads the men’s Wear, never the parents’ gown', async () => {
  const config = { ...CALE.config, groups: { ...CALE.config.groups, vip_family: { style: 'suit' } } };
  assert.equal(studioRowOf('groom_parents')?.key, 'vip_family');
  assert.equal(studioRowOf('best_woman')?.key, 'groomsmen');
  const father = readerAttire({ role: 'groom_parents', attire: 'suit', source: 'group', config, style: 'suit', hexes: ['#2C2A29'], label: (s: AttireStyle) => ATTIRE_STYLE_LABEL[s], single: singleWearerOf });
  assert.equal(father.styleLabel, 'Suit and tie');
  const html = await widget({ config, rolePalette: CALE.palette, guestRole: 'groom_parents', guestAttire: 'suit' });
  assert.ok(!/Long gown/.test(html.slice(html.indexOf('data-dress-code="you"'))), 'the father was told "Long gown"');
  assert.ok(/Suit and tie/.test(html), 'the father was not told his row’s Wear');
  /* a best woman is dressed by the Groomsmen row — never by the per-role "Long gown" the older form stored */
  const bestWoman = await widget({ config: { ...config, groups: { ...config.groups, groomsmen: { style: 'suit' } } }, rolePalette: CALE.palette, guestRole: 'best_woman' });
  assert.ok(!/Long gown/.test(bestWoman.slice(bestWoman.indexOf('data-dress-code="you"'))), 'the best woman read the per-role line the Studio does not show');
  /* and the general view draws no per-role line the Studio does not show. (👯 2026-10-19: the Studio HAS a Best Man &
     Best Woman row and a Maid / Matron of Honor row now — `the-honour-attendants-have-their-own-rows.test.ts` — so
     those are no longer "a row it does not have"; the old per-role "Long gown" for the best woman still is.) */
  const general = await widget({ config: CALE.config, rolePalette: CALE.palette });
  assert.ok(!/Parents of the Groom|Maid \/ Matron|Wedding Party/.test(unescape(general)), 'a row or line the Studio has no row for is drawn');
  assert.ok(!/For women · Long gown/.test(unescape(general.slice(general.indexOf('data-role-row="best_man"')))), 'the best woman’s old per-role line is drawn');
});

/* ── 7 · the row-size look is the full-size look, smaller ─────────────────────────────────────────────────────── */
type Decls = Record<string, string>;
function topLevelRules(css: string): Array<{ selectors: string[]; body: string }> {
  const out: Array<{ selectors: string[]; body: string }> = [];
  let depth = 0;
  let start = 0;
  let sel = '';
  const clean = stripComments(css);
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === '{') {
      if (depth === 0) {
        sel = clean.slice(start, i).trim();
        start = i + 1;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        if (!sel.startsWith('@')) out.push({ selectors: sel.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body: clean.slice(start, i) });
        start = i + 1;
      }
    }
  }
  return out;
}
function decls(body: string): Decls {
  const d: Decls = {};
  for (const part of body.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    d[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return d;
}
/** The effective declarations on one part of a look's swatch, full size or row size (rules applied in source order). */
/* `plain` — a swatch with no structural pseudo-class (the middle of a row); `first` — the first one (some looks cut
   their ends: the ribbon's notch). A rule on `:nth-child(…)` applies to neither — so a look's edge must be on its plain
   swatch, not only on every second or third. */
function effective(rules: ReturnType<typeof topLevelRules>, look: string, part: 'ul' | 'li' | 'i' | 'i::before' | 'i::after', row: boolean, variant: 'plain' | 'first' = 'plain'): Decls {
  const tail = { ul: '', li: ' > li', i: ' > li > i', 'i::before': ' > li > i::before', 'i::after': ' > li > i::after' }[part];
  const base = `.sn-editorial .sn-pal-${look}`;
  const rowSel = `.sn-editorial .sn-pal-row.sn-pal-${look}`;
  const rowAlt = `.sn-editorial [data-dress-code] .sn-pal-row.sn-pal-${look}`;
  const out: Decls = {};
  for (const r of rules) {
    for (const s0 of r.selectors) {
      if (/:nth-|:last-child|:only-child/.test(s0)) continue;
      if (variant === 'plain' && /:first-child/.test(s0)) continue;
      const s = s0.replace(/:first-child/g, '');
      const fullHit = s === base + tail;
      const rowHit = row && (s === rowSel + tail || s === rowAlt + tail);
      if (fullHit || rowHit) Object.assign(out, decls(r.body));
    }
  }
  return out;
}
function features(rules: ReturnType<typeof topLevelRules>, look: string, row: boolean, variant: 'plain' | 'first'): Set<string> {
  const ul = effective(rules, look, 'ul', row, variant);
  const li = effective(rules, look, 'li', row, variant);
  const i = effective(rules, look, 'i', row, variant);
  const f = new Set<string>();
  const paints = (d: Decls) => [d.background, d['background-image']].filter(Boolean).join(' ');
  if (/url\(/.test(i.filter ?? '') || /url\(/.test(i.mask ?? '') || /url\(/.test(i['mask-image'] ?? '')) f.add('bled edge');
  if (/gradient/.test(paints(i)) || /gradient/.test(paints(li))) f.add('shading');
  if (i['clip-path'] && i['clip-path'] !== 'none') f.add('cut edge');
  if (i['box-shadow'] && /inset/.test(i['box-shadow']) && i['box-shadow'] !== 'none') f.add('relief');
  if (ul.background && ul.background !== 'none' && ul['box-shadow'] && ul['box-shadow'] !== 'none') f.add('card');
  for (const pseudo of ['i::before', 'i::after'] as const) {
    const d = effective(rules, look, pseudo, row, variant);
    if (d.content !== undefined && d.display !== 'none') f.add(`rim ${pseudo}`);
  }
  return f;
}

test('7 · at row size every palette look keeps its edge, shading, card and rim — the same look, smaller', () => {
  const rules = topLevelRules(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));
  for (const look of PALETTE_LOOK_IDS) {
    if (look === 'tags') continue; // the shipped chips, one class at both sizes
    for (const variant of ['plain', 'first'] as const) {
      const full = features(rules, look, false, variant);
      const row = features(rules, look, true, variant);
      assert.ok(full.size > 0, `${look}: no look found at full size — the reader of globals.css is blind`);
      for (const f of full) assert.ok(row.has(f), `${look} (${variant} swatch): the row size loses its "${f}" (full: ${[...full]}, row: ${[...row]})`);
    }
  }
});

test('7 · the row-size bled edge is the full size’s own filter, pre-rendered — its masks ship', () => {
  for (const n of [1, 2, 3]) {
    const png = readFileSync(join(__dirname, '..', 'public', 'palette', `wc-edge-${n}.png`));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.length < 4096, `wc-edge-${n}.png is ${png.length} bytes`);
  }
});

/* ── 8 · each role is presented by its figure and its colours (owner 2026-10-17: "dress code must present a better
   way using the image their role and the colors") ───────────────────────────────────────────────────────────────── */
const TAILWIND_PX: Record<string, number> = { 'h-16': 64, 'h-20': 80, 'h-24': 96, 'h-28': 112, 'h-32': 128, 'h-36': 144, 'h-40': 160 };
test('8 · every dressed person leads with their figure, large enough to read at 375 (≥ 112 px), then their words and colours', async () => {
  for (const { config, palette } of [...CASES.slice(0, 20), CALE]) {
    const html = await widget({ config, rolePalette: palette, ceremonyType: 'catholic' });
    const general = dressCodeForEveryone({ config, stored: sanitizeRolePalette(palette), board: resolveDisplayPalette(sanitizeRolePalette(palette)), ceremonyType: 'catholic' });
    for (const row of general.rows) {
      const parts = rowHtml(html, row.key).split(/data-dress-code-person="/).slice(1);
      for (const p of row.picks) {
        const part = parts.find((x) => x.startsWith(`${p.who}"`))!;
        const fig = /data-role-figure="[^"]*" class="([^"]*)"/.exec(part);
        if (!p.style || p.colours.length === 0) {
          assert.equal(fig, null, `${row.key}/${p.who}: drawn in a Wear nobody picked`);
          continue;
        }
        assert.ok(fig, `${row.key}/${p.who}: a dressed person without their figure`);
        const h = Math.max(...fig![1]!.split(/\s+/).map((c) => TAILWIND_PX[c] ?? 0));
        assert.ok(h >= 112, `${row.key}/${p.who}: the figure is ${h}px tall — too small to read at 375`);
        assert.ok(part.indexOf('data-role-figure') < part.indexOf('data-dress-code-pick') || part.indexOf('data-dress-code-pick') < 0, `${row.key}/${p.who}: the words lead, not the figure`);
      }
    }
  }
});

test('8 · the roles are blocks, never framed boxes (nothing in them is pressed): a hairline above each, one per row on a phone', async () => {
  const html = await widget({ config: CALE.config, rolePalette: CALE.palette });
  const list = /<ul class="([^"]*)" data-dress-code="roles"/.exec(html);
  assert.ok(list && /\bgrid-cols-1\b/.test(list[1]!) && /\bsm:grid-cols-2\b/.test(list[1]!), 'one role per row on a phone, more across on wider screens');
  for (const [, cls] of html.matchAll(/<li class="([^"]*)" data-role-row=/g)) {
    assert.ok(!/\b(rounded|shadow|ring-|border )\b|\bborder-(?!t\b|ink\/)/.test(cls!), `a role is a framed box: "${cls}"`);
    assert.match(cls!, /\bborder-t\b/, 'a role block without its hairline');
  }
});
