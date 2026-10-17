/**
 * 👔 EACH ROLE HAS ITS OWN DESIGNS, EACH DRAWN IN ITS OWN ZONES — owner, 2026-10-16 (DECISION_LOG, five rows:
 * "ATTIRE COLOUR ZONES…", "GUESTS: UP TO FIVE COLOUR OPTIONS…", "EACH ROLE HAS ITS OWN LIST OF DESIGNS…", "THE 15 ROLE
 * DRAWINGS", "ALL 45 ROLE × DESIGN DRAWINGS"): *"Approved — use all 45 drawings and start the per-role attire build."*
 *
 * Held here, each by executing it:
 *   1. a role's Wear ▾ offers ONLY its designs — the decision row's table, copied here as the owner wrote it;
 *   2. a Wear stored before this reads into the role's design, or "Not said yet" — never a guess;
 *   3. the zones paint the right areas — the art's own masks, decoded: the tie at the chest, the pants below the waist,
 *      nothing outside the figure; and a pick's second colour reaches its second mask;
 *   4. an entourage role's colours are FIXED — one labelled dot per zone, and no "+";
 *   5. the guests offer at most FIVE colour options — the sanitizers, the writer, the drawing and the "+";
 *   6. the art budget holds — 45 drawings, their masks, the byte class.
 *
 * Run from `apps/web`: `npx tsx --test lib/each-role-has-its-own-designs.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { DESIGN_ZONES, FIGURE_ART, ROLE_ART_KEYS, designOfArt, zonesOf } from './attire-figures';
import { FIGURE_ROLES, GUEST_OPTIONS_MAX, ROLE_DESIGNS, ROW_FIGURE_ROLES, designLabel, designOf, roleArtKey, wearLabelFor, type FigureRole } from './attire-designs';
import { ATTIRE_ROWS, attireRow, pickOptions, picksOf, readerAttire, sanitizeSecondPicks, withSecondColours } from './attire-rows';
import { ATTIRE_STYLES, ATTIRE_STYLE_LABEL, type AttireStyle } from './role-dress-code';
import { deeper, roleFigurePeople, singleWearerOf, zoneTints } from './role-figure';
import { PALETTE_LIMITS, sanitizeRolePalette } from './mood-board';
import { withRoleColours } from './mood-board-studio';

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

const WEB = join(__dirname, '..');
const PUBLIC = join(WEB, 'public');

/* ── 1 · the owner's table, as he wrote it ───────────────────────────────── */

/** DECISION_LOG 2026-10-16 "EACH ROLE HAS ITS OWN LIST OF DESIGNS", word for word (the guests' woman: "Long dress"). */
const THE_TABLE: Readonly<Record<FigureRole, readonly string[]>> = {
  groom: ['Suit and tie', '3-piece suit', 'Barong Tagalog', 'Tuxedo'],
  best_man: ['Suit and tie', '3-piece suit', 'Barong Tagalog', 'Tuxedo'],
  groomsman: ['Suit and tie', 'Vest and tie', 'Barong Tagalog'],
  ninong: ['Barong Tagalog', 'Suit and tie'],
  father: ['Barong Tagalog', 'Suit and tie'],
  sponsor_m: ['Barong Tagalog', 'Suit and tie'],
  bride: ['Ball gown', 'Mermaid', 'A-line', 'Filipiniana (terno)'],
  maid_of_honor: ['Long gown', 'Cocktail dress', 'Filipiniana'],
  bridesmaid: ['Long gown', 'Cocktail dress', 'Filipiniana'],
  ninang: ['Filipiniana', 'Long gown'],
  mother: ['Filipiniana', 'Long gown'],
  sponsor_w: ['Long gown', 'Filipiniana'],
  ring_bearer: ['Vest and bow tie', 'Barong Tagalog'],
  bible_bearer: ['Vest and bow tie', 'Barong Tagalog'],
  flower_girl: ['Tulle dress', 'Filipiniana dress'],
  guest_m: ['Barong Tagalog', 'Suit and tie', 'Smart casual'],
  guest_w: ['Long dress', 'Cocktail dress', 'Filipiniana'],
};

test('1 · every role offers exactly its own designs — the owner’s table — and each has its drawing', () => {
  assert.deepEqual([...FIGURE_ROLES].sort(), Object.keys(THE_TABLE).sort());
  let drawings = 0;
  for (const role of FIGURE_ROLES) {
    assert.deepEqual(ROLE_DESIGNS[role].map((x) => x.label), THE_TABLE[role], `${role}: its Wear ▾ is not the owner's list`);
    for (const { style } of ROLE_DESIGNS[role]) {
      assert.ok((ATTIRE_STYLES as readonly string[]).includes(style), `${role}: "${style}" is not in the one vocabulary`);
      const art = roleArtKey(role, style);
      assert.ok(art && ROLE_ART_KEYS.includes(art), `${role} has no drawing of ${style}`);
      drawings += 1;
    }
  }
  assert.equal(drawings, 45, 'the 45 approved drawings');
  assert.equal(ROLE_ART_KEYS.length, 45);
  /* The Studio's rows: each column lists ITS role's designs — a men's never a gown, the bride's never a suit. */
  for (const row of ATTIRE_ROWS) {
    const roles = ROW_FIGURE_ROLES[row.key];
    if (!roles) continue;
    roles.forEach((role, i) => assert.deepEqual([...pickOptions(row, i as 0 | 1)], ROLE_DESIGNS[role].map((x) => x.style), `${row.key} column ${i}`));
  }
  assert.deepEqual(pickOptions(attireRow('roles', 'groom')!), ['suit', 'three_piece_suit', 'barong_tagalog', 'tuxedo']);
  assert.deepEqual(pickOptions(attireRow('groups', 'principal_sponsors')!, 0), ['barong_tagalog', 'suit']);
  assert.deepEqual(pickOptions(attireRow('groups', 'principal_sponsors')!, 1), ['filipiniana', 'long_gown']);
  assert.deepEqual(pickOptions(attireRow('groups', 'bearers_flower_girl')!, 1), ['tulle_dress', 'filipiniana']);
  /* Rows with no designs of their own keep the shipped seven. */
  assert.ok(pickOptions(attireRow('groups', 'officiants')!).includes('formal'));
});

/* ── 2 · old data ─────────────────────────────────────────────────────────── */

/** THE OLD-DATA TABLE — stored style × role → what it reads as (null = "Not said yet"). */
const OLD_DATA: ReadonlyArray<readonly [FigureRole, AttireStyle, AttireStyle | null]> = [
  ['groom', 'barong_tagalog', 'barong_tagalog'],
  ['groom', 'suit', 'suit'],
  ['groom', 'formal', 'tuxedo'],
  ['groom', 'smart_casual', null],
  ['groom', 'long_gown', null],
  ['groomsman', 'formal', null],
  ['ninong', 'formal', null],
  ['ninong', 'suit', 'suit'],
  ['guest_m', 'smart_casual', 'smart_casual'],
  ['guest_m', 'formal', null],
  ['bride', 'long_gown', null],
  ['bride', 'filipiniana', 'filipiniana'],
  ['bride', 'formal', null],
  ['bridesmaid', 'long_gown', 'long_gown'],
  ['bridesmaid', 'formal', 'long_gown'],
  ['bridesmaid', 'smart_casual', null],
  ['ninang', 'formal', 'long_gown'],
  ['ninang', 'barong_tagalog', null],
  ['guest_w', 'long_gown', 'long_gown'],
  ['guest_w', 'formal', 'long_gown'],
  ['guest_w', 'suit', null],
  ['ring_bearer', 'suit', 'vest_and_bow_tie'],
  ['ring_bearer', 'barong_tagalog', 'barong_tagalog'],
  ['ring_bearer', 'formal', null],
  ['flower_girl', 'filipiniana', 'filipiniana'],
  ['flower_girl', 'cocktail_dress', null],
  ['flower_girl', 'long_gown', null],
];

test('2 · a stored Wear reads into the role’s design, or "Not said yet" — never a guess', () => {
  for (const [role, stored, reads] of OLD_DATA) assert.equal(designOf(role, stored), reads, `${role} × ${stored}`);
  /* Every stored word × every role: it is the role's own design, or null. */
  for (const role of FIGURE_ROLES) {
    for (const s of ATTIRE_STYLES) {
      const r = designOf(role, s);
      assert.ok(r === null || ROLE_DESIGNS[role].some((x) => x.style === r), `${role} × ${s} → ${r} is not the role's`);
    }
  }
  /* Through the rows the Studio and the guest page read (`picksOf`). */
  const sponsors = attireRow('groups', 'principal_sponsors')!;
  assert.deepEqual(picksOf({ groups: { principal_sponsors: { style: 'long_gown' } } }, sponsors).map((p) => p.style), [null, 'long_gown']);
  assert.deepEqual(picksOf({ groups: { principal_sponsors: { style: 'formal' } } }, sponsors).map((p) => p.style), [null, 'long_gown']);
  assert.deepEqual(picksOf({ roles: { groom: { style: 'formal' } } }, attireRow('roles', 'groom')!).map((p) => [p.style, p.role]), [['tuxedo', 'groom']]);
  assert.deepEqual(picksOf({ roles: { bride: { style: 'long_gown' } } }, attireRow('roles', 'bride')!).map((p) => p.style), [null]);
  /* The words a guest reads. */
  assert.equal(wearLabelFor('bride', 'filipiniana'), 'Filipiniana (terno)');
  assert.equal(wearLabelFor('groom', 'formal'), 'Tuxedo');
  assert.equal(wearLabelFor('bride', 'long_gown'), null, 'the bride is told a garment not hers');
  assert.equal(designLabel('guest_w', 'long_gown'), 'Long dress');
  const reader = readerAttire({
    role: 'principal_sponsor_ninong',
    attire: null,
    source: 'group',
    config: { groups: { principal_sponsors: { style: 'suit' } }, women: { groups: { principal_sponsors: { style: 'filipiniana' } } } },
    style: 'suit',
    hexes: ['#5C0700'],
    label: (s) => ATTIRE_STYLE_LABEL[s],
    single: singleWearerOf,
  });
  assert.equal(reader.styleLabel, 'Suit and tie');
  assert.deepEqual(reader.picks.map((p) => [p.role, p.style]), [['ninong', 'suit']]);
});

/* ── 3 · the zones paint the right areas ─────────────────────────────────── */

type Alpha = { w: number; h: number; a: Uint8Array };
async function alphaOf(src: string): Promise<Alpha> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(join(PUBLIC, src)).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, a: new Uint8Array(data) };
}
function centroid({ w, h, a }: Alpha): { x: number; y: number; area: number } {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = a[y * w + x]!; if (v > 127) { sx += x; sy += y; n++; } }
  return { x: n ? sx / n / w : 0, y: n ? sy / n / h : 0, area: n / (w * h) };
}

test('3 · each zone’s mask paints its own part of the figure, and nothing outside it', async () => {
  for (const key of ROLE_ART_KEYS) {
    const art = FIGURE_ART[key];
    const style = designOfArt(key)!;
    assert.deepEqual(art.zones!.map((z) => z.key), zonesOf(style).map((z) => z.key), `${key}: its masks are not its design's zones`);
    const drawing = await alphaOf(art.src);
    assert.equal(drawing.h, 280, `${key} is not 280 tall`);
    const masks: Record<string, Alpha> = {};
    for (const z of art.zones!) {
      masks[z.key] = await alphaOf(z.mask);
      assert.deepEqual([masks[z.key]!.w, masks[z.key]!.h], [drawing.w, drawing.h], `${key}-${z.key} is not the drawing's size`);
      /* Nothing outside the figure: a tint there would colour the page. */
      const m = masks[z.key]!;
      let outside = 0;
      for (let i = 0; i < m.a.length; i++) if (m.a[i]! > 127 && drawing.a[i]! < 64) outside++;
      assert.ok(outside < 0.002 * m.a.length, `${key}-${z.key} paints ${outside} px outside the figure`);
    }
    const c = Object.fromEntries(Object.entries(masks).map(([k, m]) => [k, centroid(m)]));
    assert.ok(c.a!.area > 0.15, `${key}: the garment zone is ${c.a!.area.toFixed(2)} of the frame`);
    /* An accent is smaller than its garment — the tie, the shirt, the vest (pants are long: a shirt's chinos may be bigger). */
    for (const k of ['t', 's', 'v']) if (c[k]) assert.ok(c[k]!.area < c.a!.area, `${key}: ${k} is bigger than the garment`);
    if (c.t) {
      assert.ok(c.t.y < 0.45 && Math.abs(c.t.x - 0.5) < 0.2, `${key}: the tie is not at the chest (${c.t.x.toFixed(2)}, ${c.t.y.toFixed(2)})`);
      assert.ok(c.t.area > 0.002, `${key}: no tie`);
    }
    if (c.s) assert.ok(c.s.y < 0.5 && c.s.area > 0.002, `${key}: the shirt is not above the waist (${c.s.y.toFixed(2)})`);
    if (c.v) assert.ok(c.v.y > 0.2 && c.v.y < 0.55, `${key}: the vest is not at the torso`);
    if (c.p) assert.ok(c.p.y > 0.55 && c.p.area > 0.05, `${key}: the pants are not below the waist (${c.p.y.toFixed(2)})`);
  }
});

test('3 · a pick’s colours reach their zones — dot 2 the accent, dot 3 the shirt; with one colour the defaults', () => {
  const tints = (g: Parameters<typeof zoneTints>[0], c: string[]) => Object.fromEntries(zoneTints(g, c).map((t) => [t.key, t.colour]));
  assert.deepEqual(tints('groom-suit', ['#646B38']), { a: '#646B38', t: deeper('#646B38'), s: '#FFFFFF' }, 'one colour: the tie deeper, the shirt white');
  assert.deepEqual(tints('groom-suit', ['#646B38', '#F3E5B9', '#F7F2EC']), { a: '#646B38', t: '#F3E5B9', s: '#F7F2EC' });
  assert.deepEqual(tints('groom-three_piece_suit', ['#646B38', '#F3E5B9', '#F7F2EC', '#6B4226']), { a: '#646B38', t: '#F3E5B9', s: '#F7F2EC', v: '#6B4226' });
  assert.equal(tints('groom-three_piece_suit', ['#646B38']).v, '#646B38', 'a 3-piece vest is the suit’s cloth unless said');
  assert.deepEqual(Object.keys(tints('ninong-barong_tagalog', ['#5C0700'])), ['a', 'p']);
  assert.deepEqual(tints('bride-mermaid', ['#F7F2EC', '#5C0700']), { a: '#F7F2EC' }, 'a gown is one colour');
  /* A zone's mask is its own file. */
  for (const t of zoneTints('groom-tuxedo', ['#5C0700', '#F3E5B9'])) assert.equal(t.mask, `/attire/roles/groom-tuxedo-${t.key}.webp`);
  for (const [style, zones] of Object.entries(DESIGN_ZONES)) assert.equal(zones![0]!.key, 'a', `${style}: dot 1 is not the garment`);
});

/* ── 4 · roles have fixed dots, and no "+" ───────────────────────────────── */

type Row = { tier: 'roles' | 'groups'; key: string; label: string; paletteKey: string | null; arrives: string | null };
const ROWS: Row[] = [
  { tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: null },
  { tier: 'roles', key: 'bride', label: 'The bride', paletteKey: 'bride', arrives: null },
  { tier: 'groups', key: 'principal_sponsors', label: 'Principal Sponsors', paletteKey: 'principal_sponsors', arrives: null },
  { tier: 'groups', key: 'bearers_flower_girl', label: 'Bearers & Flower Girl', paletteKey: 'bearers_flower_girl', arrives: null },
  { tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null },
];
async function studio(palette: Record<string, unknown>, dressConfig: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  return renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'e',
      palette: { reception: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'], ...palette, touched_roles: Object.keys(palette) },
      fallbackFive: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'],
      frozenDressing: [],
      changes: [],
      attire: ROWS,
      dressConfig,
      attireStyles: [],
      inspirations: [],
      autoThemes: [],
      regions: [],
      dosLists: null,
      startTab: 'attire',
    }),
  );
}
const section = (html: string, key: string) => {
  const at = html.indexOf(`data-mood-board-role="${key}"`);
  assert.ok(at >= 0, `${key} is not drawn`);
  const end = html.indexOf('data-mood-board-role="', at + 10);
  return end < 0 ? html.slice(at) : html.slice(at, end);
};
const CONFIG = {
  roles: { groom: { style: 'three_piece_suit' }, bride: { style: 'mermaid' }, guest: { style: 'barong_tagalog' } },
  groups: { principal_sponsors: { style: 'barong_tagalog' }, bearers_flower_girl: { style: 'vest_and_bow_tie' } },
  women: { groups: { principal_sponsors: { style: 'filipiniana' }, bearers_flower_girl: { style: 'tulle_dress' } }, roles: { guest: { style: 'long_gown' } } },
};

test('4 · an entourage role wears one labelled dot per zone and offers no "+"; the drawing is the role’s own', async () => {
  const html = await studio({ groom: ['#646B38', '#F3E5B9'], principal_sponsors: ['#5C0700'], guest: ['#5C0700', '#669C35'] }, CONFIG);
  const groom = section(html, 'groom');
  assert.match(groom, /data-garment="groom-three_piece_suit"/, 'the groom is not drawn as the groom in his 3-piece');
  assert.match(groom, /data-mood-board-zones="4"/);
  for (const word of ['Coat &amp; pants', 'Tie', 'Shirt', 'Vest']) assert.ok(groom.includes(`>${word}</small>`), `the groom's "${word}" dot has no label`);
  assert.doesNotMatch(groom, /Add a colour/, 'the groom offers "+ add a colour"');
  /* Dot 2 is the tie as said; dot 3 the shirt, white by default; the figure wears them zone by zone. */
  assert.match(groom, /data-zone="t" data-zone-colour="#F3E5B9"/);
  assert.match(groom, /data-zone="s" data-zone-colour="#FFFFFF"/);
  const sponsors = section(html, 'principal_sponsors');
  assert.match(sponsors, /data-garment="ninong-barong_tagalog"[\s\S]*data-garment="ninang-filipiniana"/);
  assert.ok(sponsors.includes('>Barong</small>') && sponsors.includes('>Pants</small>'), 'the barong’s two dots are not labelled');
  assert.doesNotMatch(sponsors, /Add a colour/);
  const bride = section(html, 'bride');
  assert.match(bride, /data-garment="bride-mermaid"/);
  assert.match(bride, /data-mood-board-zones="1"/);
  /* Re-anchored 2026-10-17 (owner: "for the dress code of women, there are palettes but no indication of what the
     colors control"): a one-colour design's dot is labelled with the design itself — the prototype's "nothing under a
     one-zone garment" is superseded. */
  assert.ok(bride.includes('>Mermaid</small>'), 'a gown’s one dot does not say what it colours');
  assert.doesNotMatch(bride, /Add a colour/);
  assert.match(section(html, 'bearers_flower_girl'), /data-garment="ring_bearer-vest_and_bow_tie"[\s\S]*data-garment="flower_girl-tulle_dress"/);
  /* The Wear ▾ names the design in the role's own words. */
  assert.match(bride, /Mermaid/);
});

/* ── 5 · guests: five options at most ────────────────────────────────────── */

const SIX = ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9', '#6B4226'];
test('5 · the guests offer at most five colour options — stored, written, drawn and offered', async () => {
  assert.equal(GUEST_OPTIONS_MAX, 5);
  assert.equal(PALETTE_LIMITS.guest.max, 5);
  assert.equal(sanitizeRolePalette({ guest: SIX }).guest!.length, 5, 'the guests’ palette keeps six');
  assert.equal(withRoleColours({}, 'guest', SIX).guest!.length, 5);
  assert.equal(sanitizeSecondPicks({ roles: { guest: { colours: SIX } } }).roles!.guest!.colours!.length, 5, 'the women’s own options keep six');
  assert.equal((withSecondColours({}, 'roles', 'guest', SIX) as { women: { roles: { guest: { colours: string[] } } } }).women.roles.guest.colours.length, 5);
  /* Each option its own figure, per column — five men, five women. */
  const people = roleFigurePeople('guest', SIX, 'options', [
    { who: 'm', style: 'barong_tagalog', colours: null, role: 'guest_m' },
    { who: 'f', style: 'long_gown', colours: null, role: 'guest_w' },
  ]);
  assert.equal(people.length, 10);
  assert.deepEqual(new Set(people.map((p) => p.garment)), new Set(['guest_m-barong_tagalog', 'guest_w-long_gown']));
  /* The Studio: five figures a column, and no "+" at five; a "+" below it. */
  const full = section(await studio({ guest: SIX.slice(0, 5) }, CONFIG), 'guest');
  assert.equal((full.match(/data-mood-board-option="/g) ?? []).length, 5 * 2);
  assert.doesNotMatch(full, /Add a colour option for Guests"/, 'a sixth option is offered');
  const two = section(await studio({ guest: SIX.slice(0, 2) }, CONFIG), 'guest');
  assert.equal((two.match(/data-mood-board-option="/g) ?? []).length, 2 * 2);
  assert.match(two, /Add a colour option for Guests/);
  assert.match(two, /data-garment="guest_m-barong_tagalog"[\s\S]*data-garment="guest_w-long_gown"/);
});

/* ── 6 · the art budget ──────────────────────────────────────────────────── */

test('6 · the art budget holds — 45 drawings and their masks, in the shipped byte class', () => {
  const dir = join(PUBLIC, 'attire', 'roles');
  const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
  let total = 0;
  for (const key of ROLE_ART_KEYS) {
    const art = FIGURE_ART[key];
    for (const src of [art.src, ...art.zones!.map((z) => z.mask)]) assert.ok(existsSync(join(PUBLIC, src)), `${src} is missing`);
    const draw = statSync(join(PUBLIC, art.src)).size;
    assert.ok(draw <= 10 * 1024, `${key}.webp is ${draw} B — over the drawing class (~7–9 KB)`);
    total += draw;
    for (const z of art.zones!) {
      const b = statSync(join(PUBLIC, z.mask)).size;
      assert.ok(b <= 10 * 1024, `${z.mask} is ${b} B — over ~10 KB`);
      total += b;
    }
  }
  assert.equal(files.length, ROLE_ART_KEYS.reduce((n, k) => n + 1 + FIGURE_ART[k].zones!.length, 0), 'a file in public/attire/roles is not a drawing or one of its masks');
  assert.ok(total <= 640 * 1024, `the 45 drawings weigh ${total} B`);
});
