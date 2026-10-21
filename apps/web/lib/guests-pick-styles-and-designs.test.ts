/**
 * 👔 GUESTS PICK A STYLE — AND UP TO FIVE DESIGNS INSIDE IT. Owner, 2026-10-21: *"For the guests they can pick
 * different outfit styles. This means we need different attire looks as well."* → *"Show me a prototype. Where up to 5
 * different attires. Meaning 5 different smart casual, 5 coat and tie, 5 barong"* (prototype
 * `attire_five_designs_per_style_2026-10-21.html`; DECISION_LOG 2026-10-21 "STYLE → UP TO FIVE DESIGNS").
 *
 * Held as PROPERTIES, each by executing the code (the library, the reader, the writer, the guest page, the Studio):
 *   1 · the library: ≤ 5 designs a style, each style the role's own, every DRAWN design has its files and every file
 *       under a style's folder is a drawn design (a drawing that lands without its registry row is caught);
 *   2 · nothing undrawn is ever drawn — not on the guest page, not in the Studio's Wear ▾;
 *   3 · every allowed (drawn) design renders on the guest's board, under its style, and each wears the next colour;
 *   4 · a legacy single `style` (every dress code before today) renders byte for byte as before — and so does a
 *       column ticked back to one whole style;
 *   5 · one tap on a style allows all its designs; unticking narrows; the stored `style` is always the first tick's;
 *   6 · each design takes the palette by its OWN zones: a guest man's suit the colour on the tie over black and a
 *       white shirt; a barong its body with the pants charcoal; smart casual its top with the chinos khaki; a woman's
 *       dress all of it — never a colour by position (no khaki or plum pants on a barong);
 *   7 · the stored ticks survive every other write to the column, and paper says what the page draws.
 *
 * Run from `apps/web`: `npx tsx --test lib/guests-pick-styles-and-designs.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DESIGN_LIBRARY, DESIGNS_PER_STYLE_MAX, isDrawn, variantArtKey, type LibraryDesign } from './attire-library';
import { allowedDesigns, allowedStyles, designArt, drawnDesigns, libraryStyles, picksWithDesigns, sanitizeDesignTicks, toggleDesignTick, styleKey, designKey, withColumnDesigns } from './attire-design-picks';
import { FIGURE_ART, GUEST_SUIT_BLACK, TIE_DESIGNS, DESIGN_ZONES, type FigureGarment } from './attire-figures';
import { roleArtKey, roleDesigns, type FigureRole } from './attire-designs';
import { attireRow, sanitizeSecondPicks, withSecondColours } from './attire-rows';
import type { AttireStyle } from './role-dress-code';
import { zoneTints } from './role-figure';
import { withAttireStyle, withCallTime } from './mood-board-studio';
import { dressCodeForEveryone, dressCodeLines } from './dress-code-for-everyone';
import { resolveDisplayPalette } from './room-palette';
import { sanitizeRolePalette } from './mood-board';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (/(?:^|\/)(?:actions|wizard-actions|hub-draft-actions|colour-access-actions)$/.test(request)) {
      return new Proxy({}, { get: () => async () => ({}) });
    }
    return load.call(this, request, ...rest);
  };
}

const PUBLIC = join(__dirname, '..', 'public');
const ROLES = Object.keys(DESIGN_LIBRARY) as FigureRole[];
const GUEST_ROW = attireRow('roles', 'guest')!;
const COLOURS = ['#5E2A48', '#1C1F7A', '#C9A3A6', '#7B4A26'];

const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
async function widget(config: Record<string, unknown>, colours: readonly string[] = COLOURS): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  return renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config, rolePalette: { guest: [...colours], touched_roles: ['guest'] }, ceremonyType: 'catholic' }));
}
function guestRow(html: string): string {
  const at = html.indexOf('data-role-row="guest"');
  assert.ok(at >= 0, 'the Guests row is not drawn');
  const end = html.indexOf('data-role-row="', at + 10);
  return end < 0 ? html.slice(at) : html.slice(at, end);
}
async function studio(dressConfig: Record<string, unknown>): Promise<string> {
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const html = renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'e',
      palette: { reception: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'], guest: [...COLOURS], touched_roles: ['guest'] },
      fallbackFive: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'],
      frozenDressing: [],
      changes: [],
      attire: [{ tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null }],
      dressConfig,
      attireStyles: [],
      inspirations: [],
      autoThemes: [],
      regions: [],
      dosLists: null,
      startTab: 'attire',
    }),
  );
  const at = html.indexOf('data-mood-board-role="guest"');
  assert.ok(at >= 0, 'the Studio draws no Guests row');
  return html.slice(at);
}
/** A guests' dress code: the men's column and the women's, each a list of ticks (first = the column's Wear). */
function config(men: readonly string[] | null, women: readonly string[] | null): Record<string, unknown> {
  const first = (t: readonly string[]) => t[0]!.split('/')[0]!;
  return {
    roles: men ? { guest: { style: first(men), designs: [...men] } } : {},
    women: women ? { roles: { guest: { style: first(women), designs: [...women] } } } : {},
  };
}
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
/** Every tick a column of `role` could hold — whole styles and every design (drawn or not). */
const allTicks = (role: FigureRole) => libraryStyles(role).flatMap((s) => [s, ...(DESIGN_LIBRARY[role] ?? []).filter((d) => d.style === s).map((d) => `${s}/${d.variant}`)]);
function fuzzTicks(role: FigureRole, r: () => number): string[] {
  const pool = allTicks(role);
  const out: string[] = [];
  const n = 1 + Math.floor(r() * 5);
  for (let i = 0; i < n; i += 1) out.push(pool[Math.floor(r() * pool.length)]!);
  return out;
}

/* ── 1 · the library ─────────────────────────────────────────────────────── */

test('1 · the library: ≤ 5 designs a style, each style the role’s own, its first design the shipped drawing', () => {
  assert.ok(ROLES.includes('guest_m') && ROLES.includes('guest_w'), 'the guests have no library');
  for (const role of ROLES) {
    const lib = DESIGN_LIBRARY[role]!;
    assert.deepEqual([...libraryStyles(role)].sort(), [...roleDesigns(role)].sort(), `${role}: the library's styles are not the role's own Wear ▾`);
    for (const s of libraryStyles(role)) {
      const of = lib.filter((d) => d.style === s);
      assert.ok(of.length <= DESIGNS_PER_STYLE_MAX, `${role} ${s}: ${of.length} designs — more than five`);
      assert.equal(new Set(of.map((d) => d.variant)).size, of.length, `${role} ${s}: a design key is used twice`);
      assert.equal(of[0]!.art, roleArtKey(role, s), `${role} ${s}: its first design is not the shipped drawing`);
    }
  }
});

test('1 · every DRAWN design has its files; every file under a style’s folder is a drawn design', () => {
  for (const role of ROLES) {
    for (const d of DESIGN_LIBRARY[role]!) {
      if (!isDrawn(d)) {
        assert.ok(!(variantArtKey(role, d) in FIGURE_ART), `${role} ${d.style}/${d.variant} is not drawn but has a drawing entry`);
        continue;
      }
      const art = FIGURE_ART[designArt(role, d) as Exclude<FigureGarment, 'unset'>];
      assert.ok(art, `${role} ${d.style}/${d.variant}: drawn, but no drawing`);
      for (const f of [art.src, ...(art.zones ?? []).map((z) => z.mask)]) assert.ok(existsSync(join(PUBLIC, f)), `${f} is missing — a drawn design needs its drawing and every zone mask`);
    }
    for (const s of libraryStyles(role)) {
      const dir = join(PUBLIC, 'attire', 'roles', `${role}-${s}`);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.webp'))) {
        const variant = f.replace(/\.webp$/, '').replace(/-[atsvp]$/, '');
        const d = DESIGN_LIBRARY[role]!.find((x) => x.style === s && x.variant === variant);
        assert.ok(d && typeof d.w === 'number', `public/attire/roles/${role}-${s}/${f} landed, but its registry row (lib/attire-library.ts) has no \`w\` — set the width build-role-attire.py printed`);
      }
    }
  }
});

/* ── 2 · nothing undrawn is drawn ────────────────────────────────────────── */

test('2 · an allowed design with no drawing yet is never drawn — reader, guest page, Studio', async () => {
  const r = rng(21);
  for (let i = 0; i < 40; i += 1) {
    const men = fuzzTicks('guest_m', r);
    const women = fuzzTicks('guest_w', r);
    for (const [role, ticks] of [['guest_m', men], ['guest_w', women]] as const) {
      const clean = sanitizeDesignTicks(role, ticks[0]!.split('/')[0] as AttireStyle, ticks);
      for (const d of allowedDesigns(role, ticks[0]!.split('/')[0] as AttireStyle, clean)) assert.ok(d.art in FIGURE_ART, `${d.id} reached the board undrawn`);
    }
    const page = await widget(config(men, women));
    const studioHtml = await studio(config(men, women));
    for (const html of [page, studioHtml]) {
      for (const m of html.matchAll(/data-garment="([^"]+)"/g)) assert.ok(m[1] === 'unset' || m[1]! in FIGURE_ART, `a figure draws ${m[1]} — not a drawing`);
    }
    const undrawn = (role: FigureRole) => DESIGN_LIBRARY[role]!.filter((d) => !isDrawn(d)).map((d) => `${d.style}/${d.variant}`);
    for (const id of [...undrawn('guest_m'), ...undrawn('guest_w')]) {
      assert.ok(!page.includes(`data-dress-code-design="${id}"`), `${id} is drawn on the guest page with no drawing`);
      assert.ok(!studioHtml.includes(`data-pick-option="${designKey(id)}"`), `${id} is offered in the Studio with no drawing`);
    }
  }
});

/* ── 3 · every allowed design renders, in the next colour ────────────────── */

test('3 · every allowed (drawn) design renders on the guest’s board, under its style, wearing the colours in turn', async () => {
  const r = rng(7);
  let boards = 0;
  for (let i = 0; i < 60; i += 1) {
    const men = fuzzTicks('guest_m', r);
    const women = fuzzTicks('guest_w', r);
    const row = guestRow(await widget(config(men, women)));
    const cols = [
      { role: 'guest_m' as const, ticks: men },
      { role: 'guest_w' as const, ticks: women },
    ].map((c) => {
      const style = c.ticks[0]!.split('/')[0] as AttireStyle;
      return { ...c, allowed: allowedStyles(c.role, style, sanitizeDesignTicks(c.role, style, c.ticks)) };
    });
    const isBoard = cols.some((c) => c.allowed.flatMap((a) => a.designs).length > 1);
    assert.equal(row.includes('data-dress-code-board='), isBoard, `seed ${i}: the board shows ${!isBoard} for ${JSON.stringify([men, women])}`);
    if (!isBoard) continue;
    boards += 1;
    for (const c of cols) {
      for (const a of c.allowed) {
        assert.ok(row.includes(`data-dress-code-style="${a.style}"`), `seed ${i}: ${c.role} ${a.style} is allowed and not drawn`);
        a.designs.forEach((d, j) => {
          const at = row.indexOf(`data-dress-code-design="${d.id}"`);
          assert.ok(at >= 0, `seed ${i}: ${d.id} is allowed and not drawn`);
          const colour = /data-colour="([^"]+)"/.exec(row.slice(at))![1];
          assert.equal(colour, COLOURS[j % COLOURS.length], `${d.id} (${j + 1}th of its style) does not wear the colour in turn`);
        });
      }
    }
  }
  assert.ok(boards >= 10, `the fuzz drew only ${boards} boards`);
});

test('3 · once a style has several drawings, its designs wear the colours in turn along the row', async () => {
  /* Draw every suit design for this test only — each borrowing the shipped suit's files — as a landed drawing would be. */
  const lib = DESIGN_LIBRARY.guest_m! as LibraryDesign[];
  const extra = lib.filter((d) => d.style === 'suit' && !isDrawn(d));
  const art = FIGURE_ART as Record<string, unknown>;
  for (const d of extra) {
    (d as { w?: number }).w = 76;
    art[variantArtKey('guest_m', d)] = FIGURE_ART['guest_m-suit'];
  }
  try {
    const row = guestRow(await widget(config(['suit'], ['long_gown'])));
    const ids = ['suit/classic', ...extra.map((d) => `suit/${d.variant}`)];
    assert.equal(ids.length, DESIGNS_PER_STYLE_MAX);
    assert.match(row, /any of five/);
    ids.forEach((id, j) => {
      const at = row.indexOf(`data-dress-code-design="${id}"`);
      assert.ok(at >= 0, `${id} is allowed (the whole style) and not drawn`);
      assert.equal(/data-colour="([^"]+)"/.exec(row.slice(at))![1], COLOURS[j % COLOURS.length], `${id} does not wear colour ${(j % COLOURS.length) + 1}`);
      /* …and on the tie, over black — the guest man's rule, for every suit design. */
      assert.equal(/data-zone="t" data-zone-colour="([^"]+)"/.exec(row.slice(at))![1], COLOURS[j % COLOURS.length]);
    });
  } finally {
    for (const d of extra) {
      delete (d as { w?: number }).w;
      delete art[variantArtKey('guest_m', d)];
    }
  }
});

/* ── 4 · the legacy shape renders as it did ──────────────────────────────── */

test('4 · a legacy single `style` renders exactly as before — and a column ticked back to one whole style stores it so', async () => {
  for (const [m, w] of [['suit', 'long_gown'], ['barong_tagalog', 'filipiniana'], ['smart_casual', 'cocktail_dress']] as const) {
    const legacy = { roles: { guest: { style: m } }, women: { roles: { guest: { style: w } } } };
    const same = { roles: { guest: { style: m, designs: [m] } }, women: { roles: { guest: { style: w, designs: [w] } } } };
    const a = await widget(legacy);
    assert.equal(a, await widget(same), 'designs: [style] is not the legacy row');
    assert.ok(!a.includes('data-dress-code-board'), 'a one-design column drew the board');
    assert.equal((guestRow(a).match(/data-garment="/g) ?? []).length, 2 * COLOURS.length, 'the legacy row is one person per colour per column');
    assert.ok(guestRow(a).includes(`data-garment="guest_m-${m}"`) && guestRow(a).includes(`data-garment="guest_w-${w}"`));
    /* A stale `designs` (an older writer changed `style`) is ignored — `style` wins. */
    const stale = { roles: { guest: { style: m, designs: ['smart_casual' === m ? 'suit' : 'smart_casual', m] } } };
    assert.equal(picksWithDesigns(stale, GUEST_ROW)[0]!.designs ?? null, null, 'designs written for another Wear were read');
    /* Ticked back to one whole style: no `designs` stored — the legacy shape exactly. */
    const back = withColumnDesigns({ roles: { guest: { style: m, designs: [m, 'suit/classic'] } } }, 'roles', 'guest', 0, m, [m], withAttireStyle);
    /* (The women's Wear is pinned to what they read, as every first-column write does — `withFirstStyle`.) */
    assert.deepEqual(back.roles, { guest: { style: m } });
  }
  /* Every other role's row is untouched by a library it does not have. */
  const sponsors = { groups: { principal_sponsors: { style: 'suit', designs: ['suit', 'barong_tagalog'] } } };
  assert.equal(picksWithDesigns(sponsors, attireRow('groups', 'principal_sponsors')!)[0]!.designs ?? null, null, 'a role with no library read designs');
});

/* ── 5 · the writer ──────────────────────────────────────────────────────── */

test('5 · one tap on a style allows all its designs; unticking narrows; `style` is always the first tick’s', () => {
  /* Give suit three drawn designs for this test only (the drawings land later); the reader reads the library live. */
  const lib = DESIGN_LIBRARY.guest_m! as LibraryDesign[];
  const patched = lib.filter((d) => d.style === 'suit' && !isDrawn(d)).slice(0, 2) as Array<LibraryDesign & { w?: number }>;
  for (const d of patched) (d as { w?: number }).w = 80;
  try {
    let st: { style: AttireStyle | null; designs: string[] } = { style: null, designs: [] };
    const tap = (k: string) => (st = toggleDesignTick('guest_m', st.style, st.designs, k));
    tap(styleKey('suit'));
    assert.deepEqual(st, { style: 'suit', designs: ['suit'] }, 'one tap on a style is not all of it');
    assert.equal(allowedDesigns('guest_m', st.style, st.designs).length, 3, 'a whole style does not allow every drawn design');
    tap(styleKey('barong_tagalog'));
    assert.deepEqual(st.designs, ['suit', 'barong_tagalog']);
    tap(designKey(`suit/${patched[0]!.variant}`));
    assert.deepEqual(st.designs, ['suit/classic', `suit/${patched[1]!.variant}`, 'barong_tagalog'], 'unticking a design did not narrow its style in place');
    assert.equal(st.style, 'suit');
    tap(designKey(`suit/${patched[0]!.variant}`));
    assert.deepEqual(st.designs, ['suit', 'barong_tagalog'], 'every design ticked again is not the whole style');
    tap(styleKey('suit'));
    assert.deepEqual(st, { style: 'barong_tagalog', designs: ['barong_tagalog'] }, 'the first style went, and `style` did not follow the first tick');
    tap(designKey('barong_tagalog/pina'));
    assert.deepEqual(st, { style: null, designs: [] }, 'unticking the last design left a Wear');
    /* Never more than five a style, whatever is stored. */
    for (const s of libraryStyles('guest_m')) assert.ok(drawnDesigns('guest_m', s).length <= DESIGNS_PER_STYLE_MAX);
  } finally {
    for (const d of patched) delete (d as { w?: number }).w;
  }
  /* The write round-trips through the one reader, for both columns. */
  const c0 = withColumnDesigns({}, 'roles', 'guest', 0, 'barong_tagalog', ['barong_tagalog', 'suit'], withAttireStyle);
  const c1 = withColumnDesigns(c0, 'roles', 'guest', 1, 'cocktail_dress', ['cocktail_dress', 'filipiniana'], withAttireStyle);
  const [men, women] = picksWithDesigns(c1, GUEST_ROW);
  assert.equal(men!.style, 'barong_tagalog');
  assert.deepEqual(men!.designs, ['barong_tagalog', 'suit']);
  assert.equal(women!.style, 'cocktail_dress');
  assert.deepEqual(women!.designs, ['cocktail_dress', 'filipiniana']);
});

test('5 · the Studio’s Wear ▾ lists the styles, then their drawn designs, ticked as stored; the pill says the count', async () => {
  const html = await studio(config(['suit', 'barong_tagalog'], ['long_gown']));
  assert.match(html, /aria-label="Guests — for men · Wear: Suit and tie \+1 · 2 designs"/);
  assert.match(html, /aria-label="Guests — for women · Wear: Long dress"/);
  assert.match(html, /data-mood-board-wear-allowed=""/);
  assert.match(html, /data-mood-board-wear-designs="2"/);
  /* The colour people wear the first allowed design. */
  assert.ok(html.includes('data-garment="guest_m-suit"'));
});

/* ── 6 · each design takes the palette by its own zones ──────────────────── */

test('6 · every drawn guest design takes the palette by its own zones — never by position', () => {
  const PANTS: Partial<Record<AttireStyle, string>> = Object.fromEntries(
    Object.entries(DESIGN_ZONES).flatMap(([s, zs]) => (zs ?? []).filter((z) => z.key === 'p').map((z) => [s, z.fallback])),
  );
  for (const role of ROLES) {
    for (const s of libraryStyles(role)) {
      for (const d of drawnDesigns(role, s)) {
        for (const c of COLOURS) {
          const t = Object.fromEntries(zoneTints(designArt(role, d), [c]).map((z) => [z.key, z.colour]));
          if (role === 'guest_w') assert.deepEqual(t, { a: c }, `${d.label}: a woman's dress is one colour`);
          else if (TIE_DESIGNS.includes(s)) {
            assert.equal(t.t, c, `${d.label}: the guest man's colour is not on the tie`);
            assert.equal(t.a, GUEST_SUIT_BLACK, `${d.label}: the coat & pants are not black`);
            assert.equal(t.s, '#FFFFFF', `${d.label}: the shirt is not white`);
            if ('v' in t) assert.equal(t.v, GUEST_SUIT_BLACK, `${d.label}: the vest does not follow the coat`);
          } else {
            assert.equal(t.a, c, `${d.label}: its top does not take the colour`);
            assert.equal(t.p, PANTS[s], `${d.label}: its pants took a palette colour`);
          }
        }
      }
    }
  }
  assert.equal(PANTS.barong_tagalog, '#33302C');
  assert.equal(PANTS.smart_casual, '#C9AD7E');
});

/* ── 7 · the stored ticks survive every reader ───────────────────────────── */

test('7 · the stored ticks survive every other write, and paper says every allowed style', () => {
  const stored = config(['suit', 'barong_tagalog/pina'], ['long_gown', 'filipiniana']);
  assert.deepEqual(sanitizeSecondPicks(stored.women).roles?.guest?.designs, ['long_gown', 'filipiniana']);
  /* Every other write to a column keeps its ticks — a colour change rebuilds the women's picks through the sanitizer,
     the men's Wear line is spread as stored (`withAttireStyle`). */
  const recoloured = withSecondColours(stored, 'roles', 'guest', ['#123456']);
  assert.deepEqual(picksWithDesigns(recoloured, GUEST_ROW)[1]!.designs, ['long_gown', 'filipiniana'], 'a colour change dropped the women’s designs');
  const renoted = withCallTime(stored, 'roles', 'guest', '14:00');
  assert.deepEqual(picksWithDesigns(renoted, GUEST_ROW)[0]!.designs, ['suit', 'barong_tagalog/pina'], 'a call time dropped the men’s designs');
  const palette = sanitizeRolePalette({ guest: COLOURS, touched_roles: ['guest'] });
  const everyone = dressCodeForEveryone({ config: stored, stored: palette, board: resolveDisplayPalette(palette) });
  const line = dressCodeLines(everyone).find((l) => l.label === 'Guest');
  assert.ok(line, 'the guests have no printed line');
  assert.match(line!.line, /For men: Suit and tie or Barong Tagalog/);
  assert.match(line!.line, /For women: Long dress or Filipiniana/);
});
