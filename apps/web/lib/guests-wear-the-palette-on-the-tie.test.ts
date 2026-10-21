/**
 * 👔 A GUEST MAN WEARS THE PALETTE ON HIS TIE — owner, 2026-10-21, on the guest's invitation › Dress with us:
 * *"for the guests. the coat and pants is not the color theme. we set the tie as their palette and keep the coat and
 * pants black"*.
 *
 * Held here, each by executing it (never by reading a phrasing):
 *   1. the rule itself — a Guests-row man in a tie design with one option colour: zone `a` (coat & pants) is black,
 *      zone `t` (the tie, its pocket square with it) is the palette colour, the shirt white;
 *   2. every surface that draws a guest reaches it — the Studio's Guests row, the guest's Dress with us (the general
 *      Guests card) and a guest reader's own panel — drawn and SAID ("Tie" under each option);
 *   3. what stays: colours given zone by zone are worn as given (the host's own); the entourage's suits keep dot 1 on
 *      the coat; the women and the guests' barong / smart casual are unchanged.
 *
 * Run from `apps/web`: `npx tsx --test lib/guests-wear-the-palette-on-the-tie.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GUEST_SUIT_BLACK, TIE_DESIGNS, zonesOf } from './attire-figures';
import { deeper, lum, pickDots, roleFigurePeople, zoneTints } from './role-figure';
import { dressCodeForEveryone } from './dress-code-for-everyone';
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

const GUESTS = ['#7A1F3D', '#3E6B48', '#C9A227'];
const WHITE = '#FFFFFF';
const isBlack = (hex: string) => lum(hex) < 40;
const tintsOf = (garment: Parameters<typeof zoneTints>[0], colours: string[]) => Object.fromEntries(zoneTints(garment, colours).map((t) => [t.key, t.colour]));

/* ── 1 · the rule ─────────────────────────────────────────────────────────── */

test('1 · a guest man in a suit, no host override: coat & pants black, the tie the palette colour, the shirt white', () => {
  assert.ok(isBlack(GUEST_SUIT_BLACK), `the guests' coat colour ${GUEST_SUIT_BLACK} is not black`);
  const people = roleFigurePeople('guest', GUESTS, 'options', [{ who: 'm', style: 'suit', colours: null, role: 'guest_m' }]);
  assert.equal(people.length, GUESTS.length, 'precondition: one guest per colour option');
  people.forEach((p, i) => {
    assert.equal(p.garment, 'guest_m-suit', 'precondition: the guest man is drawn in his own suit');
    const t = tintsOf(p.garment, [...(p.colours ?? [p.main])]);
    assert.ok(isBlack(t.a!), `option ${i + 1}: the coat & pants wear ${t.a}, not black`);
    assert.equal(t.t, GUESTS[i], `option ${i + 1}: the tie does not wear the palette colour`);
    assert.equal(t.s, WHITE, `option ${i + 1}: the shirt is not white`);
  });
  /* Every design with a tie that a guest man could wear says it the same way — the tie is the colour. */
  for (const style of TIE_DESIGNS) {
    const z = zonesOf(style);
    assert.ok(z.some((x) => x.key === 't'), `${style}: precondition — it has a tie zone`);
  }
});

/* ── 2 · every surface ────────────────────────────────────────────────────── */

const CONFIG = { roles: { guest: { style: 'suit' } }, women: { roles: { guest: { style: 'long_gown' } } } };
const PALETTE = { reception: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'], guest: GUESTS, touched_roles: ['guest'] };

/** Every `data-zone` tint of every guest man drawn in `html`. */
function guestMen(html: string): Array<Record<string, string>> {
  return html
    .split('data-garment="guest_m-suit"')
    .slice(1)
    .map((chunk) => Object.fromEntries([...chunk.slice(0, chunk.indexOf('</span></span>') + 1 || chunk.length).matchAll(/data-zone="(\w)" data-zone-colour="(#[0-9A-Fa-f]{6})"/g)].map((m) => [m[1]!, m[2]!])));
}
function assertTieWearers(html: string, where: string) {
  const men = guestMen(html);
  assert.ok(men.length >= GUESTS.length, `${where}: precondition — ${men.length} guest men drawn, expected ${GUESTS.length}`);
  men.slice(0, GUESTS.length).forEach((z, i) => {
    assert.ok(z.a && isBlack(z.a), `${where}, guest ${i + 1}: the coat & pants wear ${z.a}, not black`);
    assert.equal(z.t, GUESTS[i], `${where}, guest ${i + 1}: the tie is not the palette colour`);
    assert.equal(z.s, WHITE, `${where}, guest ${i + 1}: the shirt is not white`);
  });
}

test('2a · the Studio’s Guests row draws the men in black with the palette on the tie — and says "Tie"', async () => {
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const html = renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'e',
      palette: PALETTE,
      fallbackFive: PALETTE.reception,
      frozenDressing: [],
      changes: [],
      attire: [{ tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null }],
      dressConfig: CONFIG,
      attireStyles: [],
      inspirations: [],
      autoThemes: [],
      regions: [],
      dosLists: null,
      startTab: 'attire',
    }),
  );
  assertTieWearers(html, 'Studio');
  const men = html.slice(html.indexOf('data-mood-board-pick="m"'), html.indexOf('data-mood-board-pick="f"'));
  assert.equal((men.match(/data-mood-board-dot-word="Tie"/g) ?? []).length, GUESTS.length, 'the Studio’s guest options do not say "Tie"');
});

test('2b · the guest’s Dress with us (the Guests card) and a guest’s own panel draw and say the same', async () => {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
  for (const guestRole of [null, 'guest']) {
    const html = renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config: CONFIG, rolePalette: PALETTE, guestRole, readerOnly: guestRole !== null }));
    assertTieWearers(html, guestRole ? 'a guest’s own panel' : 'the Guests card');
  }
  const stored = sanitizeRolePalette(PALETTE);
  const row = dressCodeForEveryone({ config: CONFIG, stored, board: resolveDisplayPalette(stored) }).rows.find((r) => r.rowKey === 'guest');
  const man = row?.picks.find((p) => p.who === 'm');
  assert.ok(man, 'precondition: the Guests card lists its man');
  assert.deepEqual(man!.dots.map((d) => d.word), GUESTS.map(() => 'Tie'), 'the Guests card does not say each option is the tie');
  assert.deepEqual(man!.dots.map((d) => d.hex), GUESTS, 'the Guests card’s colours are not the palette’s');
});

/* ── 3 · what stays ───────────────────────────────────────────────────────── */

test('3 · the host’s own zone colours win; the entourage, the women and the guests’ barong are unchanged', () => {
  /* colours given zone by zone are worn as given */
  assert.deepEqual(tintsOf('guest_m-suit', ['#2B3A55', '#7A1F3D', '#F7F2EC']), { a: '#2B3A55', t: '#7A1F3D', s: '#F7F2EC' });
  /* an entourage suit keeps dot 1 on the coat, the tie a shade deeper */
  for (const g of ['groom-suit', 'groomsman-suit', 'best_man-suit', 'father-suit', 'ninong-suit', 'sponsor_m-suit'] as const) {
    assert.deepEqual(tintsOf(g, ['#646B38']), { a: '#646B38', t: deeper('#646B38'), s: WHITE }, `${g} changed`);
  }
  assert.deepEqual(tintsOf('ring_bearer-vest_and_bow_tie', ['#646B38']).a, '#646B38', 'the ring bearer changed');
  /* the women — guests' too — and the guests' barong / smart casual */
  assert.deepEqual(tintsOf('guest_w-long_gown', ['#7A1F3D']), { a: '#7A1F3D' });
  assert.equal(tintsOf('guest_m-barong_tagalog', ['#7A1F3D']).a, '#7A1F3D');
  assert.equal(tintsOf('guest_m-smart_casual', ['#7A1F3D']).a, '#7A1F3D');
  /* and the entourage's words */
  assert.deepEqual(pickDots('suit', ['#646B38'], 'groom').map((d) => d.word), ['Coat & pants', 'Tie', 'Shirt']);
  assert.deepEqual(pickDots('barong_tagalog', GUESTS, 'guest_m', true).map((d) => d.word), GUESTS.map(() => 'Barong'));
});
