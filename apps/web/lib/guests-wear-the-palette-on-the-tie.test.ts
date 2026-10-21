/**
 * 👔 A GUEST MAN WEARS THE PALETTE ON HIS TIE — owner, 2026-10-21, on the guest's invitation › Dress with us:
 * *"for the guests. the coat and pants is not the color theme. we set the tie as their palette and keep the coat and
 * pants black"*.
 *
 * Held here, each by executing it (never by reading a phrasing):
 *   1. the rule itself — a Guests-row man in a tie design with one option colour: zone `a` (coat & pants) is black,
 *      zone `t` (the tie, its pocket square with it) is the palette colour, the shirt white;
 *   2. every surface that draws a guest reaches it — the Studio's Guests row and the guest's Dress with us (the
 *      Guests card, as a guest and as the host see it; a plain guest has no panel of their own) — drawn and SAID
 *      ("Tie" under each option);
 *   3. what stays: colours given zone by zone are worn as given (the host's own); the entourage's suits keep dot 1 on
 *      the coat; the women are unchanged;
 *   5. an entourage man (groomsmen, sponsors, every male role in a suit, tuxedo or vest design) has THREE colour
 *      controls — Coat & pants · Tie & accent · Long sleeves (owner 2026-10-21: *"groomsmen, sponsors entourage men has
 *      3 palette controls. so the coat and pants can be a specific color / tie and accent a specific color / long
 *      sleeves a specific color"*) — each painting its own part of the drawing, a 3-piece's vest with Coat & pants;
 *   4. the guests' Barong Tagalog and Smart casual wear the palette on the TOP — the barong, the long-sleeve shirt —
 *      and the pants keep the approved neutral default (owner 2026-10-21: *"barong and smart casual will be their long
 *      sleeves or the barong can be tinted as well"*), drawn and said the same on the Studio and the Guests card.
 *
 * Run from `apps/web`: `npx tsx --test lib/guests-wear-the-palette-on-the-tie.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COAT_AND_PANTS, FIGURE_ART, GUEST_SUIT_BLACK, LONG_SLEEVES, TIE_AND_ACCENT, TIE_DESIGNS, zonesOf } from './attire-figures';
import { FIGURE_ROLES, FIGURE_ROLE_WHO, ROLE_DESIGNS, roleArtKey } from './attire-designs';
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

test('2a · the Studio’s Guests row draws the men in black with the palette on the tie — and says "Tie & accent"', async () => {
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
  assert.equal(men.split(`data-mood-board-dot-word="${TIE_AND_ACCENT.replace(/&/g, '&amp;')}"`).length - 1, GUESTS.length, `the Studio’s guest options do not say "${TIE_AND_ACCENT}"`);
});

test('2b · the guest’s Dress with us (the Guests card) draws and says the same — as a guest and as the host', async () => {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
  /* A plain guest has no panel of their own — Dress with us shows them the Guests card (2026-10-19); the host sees it too. */
  for (const guestRole of [null, 'guest']) {
    const html = renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config: CONFIG, rolePalette: PALETTE, guestRole, readerOnly: guestRole !== null }));
    assertTieWearers(html, guestRole ? 'a guest’s Dress with us' : 'the host’s Dress with us');
    const said = [...html.matchAll(/data-dot-word="([^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
    assert.equal(said.filter((w) => w === TIE_AND_ACCENT).length, GUESTS.length, `${guestRole ?? 'host'}: the Guests card does not say "Tie" under each man's option (${JSON.stringify(said)})`);
  }
  const stored = sanitizeRolePalette(PALETTE);
  const row = dressCodeForEveryone({ config: CONFIG, stored, board: resolveDisplayPalette(stored) }).rows.find((r) => r.rowKey === 'guest');
  const man = row?.picks.find((p) => p.who === 'm');
  assert.ok(man, 'precondition: the Guests card lists its man');
  assert.deepEqual(man!.dots.map((d) => d.word), GUESTS.map(() => TIE_AND_ACCENT), 'the Guests card does not say each option is the tie');
  assert.deepEqual(man!.dots.map((d) => d.hex), GUESTS, 'the Guests card’s colours are not the palette’s');
});

/* ── 3 · what stays ───────────────────────────────────────────────────────── */

test('3 · the host’s own zone colours win; the entourage and the women are unchanged', () => {
  /* colours given zone by zone are worn as given */
  assert.deepEqual(tintsOf('guest_m-suit', ['#2B3A55', '#7A1F3D', '#F7F2EC']), { a: '#2B3A55', t: '#7A1F3D', s: '#F7F2EC' });
  /* an entourage suit keeps dot 1 on the coat, the tie a shade deeper */
  for (const g of ['groom-suit', 'groomsman-suit', 'best_man-suit', 'father-suit', 'ninong-suit', 'sponsor_m-suit'] as const) {
    assert.deepEqual(tintsOf(g, ['#646B38']), { a: '#646B38', t: deeper('#646B38'), s: WHITE }, `${g} changed`);
  }
  assert.deepEqual(tintsOf('ring_bearer-vest_and_bow_tie', ['#646B38']).a, '#646B38', 'the ring bearer changed');
  /* the women — guests' too */
  assert.deepEqual(tintsOf('guest_w-long_gown', ['#7A1F3D']), { a: '#7A1F3D' });
  /* and the entourage's words */
  assert.deepEqual(pickDots('suit', ['#646B38'], 'groom').map((d) => d.word), [COAT_AND_PANTS, TIE_AND_ACCENT, LONG_SLEEVES]);
});

/* ── 4 · the guests' barong and smart casual: the top is the colour ──────── */

/** Each design's own neutral pants (the approved defaults), read from the zones — never typed here. */
const neutralPants = (style: 'barong_tagalog' | 'smart_casual') => {
  const z = zonesOf(style).find((x) => x.key === 'p');
  assert.ok(z && z.fallback.startsWith('#'), `${style}: precondition — its pants have a fixed neutral default`);
  return z!.fallback;
};
const TOP_WORD = { barong_tagalog: 'Barong', smart_casual: LONG_SLEEVES } as const;

test('4 · a guest man in a Barong Tagalog or Smart casual: the top wears the palette colour, the pants stay neutral', async () => {
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
  for (const style of ['barong_tagalog', 'smart_casual'] as const) {
    const pants = neutralPants(style);
    assert.ok(!GUESTS.includes(pants), 'precondition: the neutral pants are not a palette colour');
    /* the rule */
    const people = roleFigurePeople('guest', GUESTS, 'options', [{ who: 'm', style, colours: null, role: 'guest_m' }]);
    assert.equal(people.length, GUESTS.length);
    people.forEach((p, i) => {
      assert.equal(p.garment, `guest_m-${style}`);
      assert.deepEqual(tintsOf(p.garment, [...(p.colours ?? [p.main])]), { a: GUESTS[i], p: pants }, `${style} option ${i + 1}: the top is not the colour, or the pants are not neutral`);
    });
    /* the host's own zone colours still win */
    assert.deepEqual(tintsOf(`guest_m-${style}`, ['#7A1F3D', '#2B3A55']), { a: '#7A1F3D', p: '#2B3A55' });
    assert.deepEqual(pickDots(style, GUESTS, 'guest_m', true).map((d) => d.word), GUESTS.map(() => TOP_WORD[style]));
    /* every surface — the Studio's Guests row and the Guests card */
    const config = { roles: { guest: { style } }, women: { roles: { guest: { style: 'long_gown' } } } };
    const studio = renderToStaticMarkup(
      React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
        eventId: 'e', palette: PALETTE, fallbackFive: PALETTE.reception, frozenDressing: [], changes: [],
        attire: [{ tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null }],
        dressConfig: config, attireStyles: [], inspirations: [], autoThemes: [], regions: [], dosLists: null, startTab: 'attire',
      }),
    );
    const card = renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config, rolePalette: PALETTE, guestRole: 'guest', readerOnly: true }));
    for (const [where, html] of [['Studio', studio], ['Guests card', card]] as const) {
      const drawn = html.split(`data-garment="guest_m-${style}"`).slice(1).slice(0, GUESTS.length).map((c) => Object.fromEntries([...c.slice(0, c.indexOf('</span></span>') + 1 || c.length).matchAll(/data-zone="(\w)" data-zone-colour="(#[0-9A-Fa-f]{6})"/g)].map((m) => [m[1]!, m[2]!])));
      assert.equal(drawn.length, GUESTS.length, `${where} · ${style}: precondition — ${drawn.length} guest men drawn`);
      drawn.forEach((z, i) => assert.deepEqual(z, { a: GUESTS[i], p: pants }, `${where} · ${style} guest ${i + 1}: drawn ${JSON.stringify(z)}`));
    }
  }
});

/* ── 5 · an entourage man: three controls ─────────────────────────────────── */

test('5 · every entourage man in a suit, tuxedo or vest design has three controls — Coat & pants · Tie & accent · Long sleeves', async () => {
  /* the owner's own words, as he wrote them (DECISION_LOG 2026-10-21) — the one place they are spelled out */
  assert.deepEqual([COAT_AND_PANTS, TIE_AND_ACCENT, LONG_SLEEVES], ['Coat & pants', 'Tie & accent', 'Long sleeves'], 'the three controls are not in the owner’s words');
  const C = ['#2B3A55', '#7A1F3D', '#F3E5B9'];
  let checked = 0;
  for (const role of FIGURE_ROLES) {
    if (role === 'guest_m' || !['m', 'boy'].includes(FIGURE_ROLE_WHO[role])) continue;
    for (const { style } of ROLE_DESIGNS[role]) {
      if (!TIE_DESIGNS.includes(style)) continue;
      const zones = zonesOf(style);
      assert.deepEqual(zones.map((z) => z.key), ['a', 't', 's'], `${role} · ${style}: not exactly three controls (coat & pants · tie & accent · long sleeves)`);
      assert.deepEqual(zones.slice(1).map((z) => z.label), [TIE_AND_ACCENT, LONG_SLEEVES], `${role} · ${style}: the controls are not in the owner's words`);
      assert.ok(zones[0]!.label === COAT_AND_PANTS || /^Vest & pants$/.test(zones[0]!.label ?? ''), `${role} · ${style}: the first control is "${zones[0]!.label}"`);
      assert.deepEqual(pickDots(style, C, role).map((d) => d.word), zones.map((z) => z.label), `${role} · ${style}: the dots do not say the three controls`);
      const g: Exclude<Parameters<typeof zoneTints>[0], 'unset'> = roleArtKey(role, style)!;
      /* each control paints its own part; every mask the drawing has wears one of the three (a 3-piece's vest, the coat) */
      const t = tintsOf(g, C);
      assert.equal(t.a, C[0], `${g}: Coat & pants does not paint the coat`);
      assert.equal(t.t, C[1], `${g}: Tie & accent does not paint the tie`);
      assert.equal(t.s, C[2], `${g}: Long sleeves does not paint the shirt`);
      for (const z of FIGURE_ART[g].zones!) assert.ok(C.includes(t[z.key]!), `${g}: its ${z.key} mask wears ${t[z.key]}, not one of its three controls`);
      if (t.v) assert.equal(t.v, C[0], `${g}: the vest does not follow Coat & pants`);
      /* the shirt is white unless said */
      assert.equal(tintsOf(g, C.slice(0, 2)).s, WHITE, `${g}: Long sleeves is not white unless set`);
      checked++;
    }
  }
  assert.ok(checked >= 12, `precondition: only ${checked} entourage suit drawings checked`);
  /* the Studio draws the three, labelled, and the figure changes per control */
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const html = renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'e', palette: { ...PALETTE, groom: C, groomsmen: C, principal_sponsors: C, touched_roles: ['groom', 'groomsmen', 'principal_sponsors'] }, fallbackFive: PALETTE.reception, frozenDressing: [], changes: [],
      attire: [
        { tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: null },
        { tier: 'groups', key: 'groomsmen', label: 'Groomsmen', paletteKey: 'groomsmen', arrives: null },
        { tier: 'groups', key: 'principal_sponsors', label: 'Principal Sponsors', paletteKey: 'principal_sponsors', arrives: null },
      ],
      dressConfig: { roles: { groom: { style: 'three_piece_suit' } }, groups: { groomsmen: { style: 'suit' }, principal_sponsors: { style: 'suit' } } },
      attireStyles: [], inspirations: [], autoThemes: [], regions: [], dosLists: null, startTab: 'attire',
    }),
  );
  for (const key of ['groom', 'groomsmen', 'principal_sponsors']) {
    const at = html.indexOf(`data-mood-board-role="${key}"`);
    assert.ok(at >= 0, `${key} is not drawn`);
    const end = html.indexOf('data-mood-board-role="', at + 10);
    const sec = html.slice(at, end < 0 ? undefined : end);
    const said = [...sec.matchAll(/data-mood-board-dot-word="([^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
    assert.deepEqual(said.slice(0, 3), [COAT_AND_PANTS, TIE_AND_ACCENT, LONG_SLEEVES], `${key}: the Studio's three controls are ${JSON.stringify(said)}`);
    assert.equal((sec.match(/data-mood-board-role-colour=/g) ?? []).length >= 3, true, `${key}: fewer than three colour controls`);
    for (const [z, c] of [['a', C[0]], ['t', C[1]], ['s', C[2]]] as const) assert.ok(sec.includes(`data-zone="${z}" data-zone-colour="${c}"`), `${key}: the figure's ${z} is not its control's colour`);
  }
});

/* ── 6 · no two dots of one person say the same word ─────────────────────── */

test('6 · no two dots of one person share a word — on every role, every design, up to six colours', () => {
  const SIX = ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9', '#6B4226'];
  let checked = 0;
  for (const role of FIGURE_ROLES) {
    for (const style of [null, ...ROLE_DESIGNS[role].map((d) => d.style)]) {
      for (let n = 1; n <= SIX.length; n++) {
        const said = pickDots(style, SIX.slice(0, n), role).map((d) => d.word);
        assert.equal(new Set(said).size, said.length, `${role} · ${style ?? 'no Wear'} · ${n} colours: two dots say the same word ${JSON.stringify(said)}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 200, `precondition: only ${checked} cases`);
});
