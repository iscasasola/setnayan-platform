/**
 * 👗🎨 THE DRESS CODE WEARS THE MOOD BOARD.
 *
 * Owner, 2026-09-28, looking at the Maker's Dress code scene: *"we already have
 * a palette and it adjusts real time with the event hub. if in general, show
 * our theme and the palettes of each role. but if there is an account
 * specified to this, show their palette only."*
 *
 * Measured on his own event the same day: a Mood Board holding the main five
 * colours plus ten roles (1–4 colours each), and the Maker's scene showing
 * "YOU ARE IN THE ENTOURAGE · Outfit to be confirmed" with ONE swatch —
 * #FAF7F2, the groom's first colour, near-white on a pink box. The general
 * palette row read only `dress_code_config.palette`, which was empty, so the
 * Mood Board never appeared; the stranger's door was not handed the Mood Board
 * at all.
 *
 * Every property below RENDERS the scene — through the real dispatchers where
 * the question is "who is asking" — and reads the markup a phone would get. A
 * source grep is used only for the one fact that is about wiring, not output.
 *
 * Run from `apps/web`: `npx tsx --test lib/the-dress-code-wears-the-mood-board.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PALETTE_ORDER,
  resolveAttirePaletteColor,
  resolveAttirePaletteColors,
  sanitizeRolePalette,
  type RolePalette,
} from './mood-board';
import { resolveDisplayPalette } from './room-palette';
import { dressCodeForEveryone, ourColoursWith, speaksToThisReader } from './dress-code-for-everyone';
import { ROLE_LABELS, type GuestRole } from './guests';

(globalThis as unknown as { React: unknown }).React = React;
{
  // No `server-only` package exists outside Next's bundler — stubbed exactly as
  // `scene-words-follow-the-ground.test.ts` does, so the REAL dispatchers load.
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const APP = join(__dirname, '..', 'app', '[slug]', '_components');

/* The owner's board, in shape: five main colours and ten dressed roles, 1–4
   colours each. Every role is TOUCHED, so what the Mood Board shows for it is
   exactly what is stored — the colours below are the colours on the page. */
const BOARD: RolePalette = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC', '#2B1D14', '#8E3B5B'],
  bride: ['#FFFFFF', '#F4E9DC'],
  groom: ['#FAF7F2'],
  best_man: ['#2B1D14'],
  maid_of_honor: ['#8E3B5B'],
  bridesmaids: ['#8E3B5B', '#C9A24B', '#F4E9DC'],
  groomsmen: ['#2B1D14', '#7A1F2B', '#C9A24B'],
  wedding_party: ['#7A1F2B', '#C9A24B', '#8E3B5B'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  secondary_sponsors: ['#7A1F2B', '#F4E9DC'],
  guest: ['#2B1D14', '#8E3B5B', '#C9A24B', '#F4E9DC'],
  touched_roles: [
    'bride', 'groom', 'best_man', 'maid_of_honor', 'bridesmaids', 'groomsmen',
    'wedding_party', 'principal_sponsors', 'secondary_sponsors', 'guest',
  ],
};
/* …and the owner's dress-code config, exactly as measured: two roles, nothing else. */
const CONFIG = {
  roles: {
    principal_sponsor_ninang: { style: 'long_gown', note: 'in the wedding colours' },
    principal_sponsor_ninong: { style: 'barong_tagalog' },
  },
};
const ROLES_ON_THE_BOARD = [
  'bride', 'groom', 'best_man', 'maid_of_honor', 'bridesmaids', 'groomsmen',
  'wedding_party', 'principal_sponsors', 'secondary_sponsors', 'guest',
] as const;

const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;

async function widget(props: Record<string, unknown>): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  return renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config: CONFIG, ...props }));
}

/** Every `background-color` a chip in `html` is painted, upper-cased, in order. */
function chipColours(html: string): string[] {
  return [...html.matchAll(/class="pahina-swatch[^"]*"[^>]*style="background-color:\s*(#[0-9A-Fa-f]{6})/g)].map((m) =>
    m[1]!.toUpperCase(),
  );
}
/** The markup of one role row, by its `data-role-row` key. */
function rowHtml(html: string, key: string): string {
  const at = html.indexOf(`data-role-row="${key}"`);
  if (at < 0) return '';
  const end = html.indexOf('data-role-row="', at + 10);
  return end < 0 ? html.slice(at) : html.slice(at, end);
}
function rowOrder(html: string): string[] {
  return [...html.matchAll(/data-role-row="([^"]+)"/g)].map((m) => m[1]!);
}

/* ══ GENERAL — "if in general, show our theme and the palettes of each role" ══ */

test('🌐 a stranger (no role) sees our colours AND every dressed role, each with ALL its colours', async () => {
  const html = await widget({ rolePalette: BOARD, hideWhenEmpty: true });
  assert.notEqual(html, '', 'a board with colours is a dress code — the scene shows for guests');
  assert.doesNotMatch(html, /You are/, 'nobody is identified, so nobody is answered for');

  const ours = html.slice(html.indexOf('data-dress-code="ours"'), html.indexOf('data-dress-code="roles"'));
  assert.match(ours, /Our colours/);
  assert.deepEqual(chipColours(ours), BOARD.reception!.map((h) => h.toUpperCase()), 'the five main colours, in order');

  const rows = rowOrder(html);
  assert.deepEqual([...rows].sort(), [...ROLES_ON_THE_BOARD].sort(), 'one row per role the couple dressed — no more, no fewer');
  for (const key of ROLES_ON_THE_BOARD) {
    const row = rowHtml(html, key);
    assert.deepEqual(
      chipColours(row),
      (BOARD[key] as string[]).map((h) => h.toUpperCase()),
      `${key}: every colour the Mood Board holds, not just its first`,
    );
  }
});

test('🌐 the rows run couple → entourage → sponsors → guests, in the Mood Board’s own order', async () => {
  const rows = rowOrder(await widget({ rolePalette: BOARD }));
  const at = (k: string) => rows.indexOf(k);
  assert.ok(at('bride') === 0 && at('groom') === 1, `the couple leads (got ${rows.join(', ')})`);
  assert.ok(at('principal_sponsors') < at('bridesmaids'), 'principal sponsors before the entourage (the board’s rank 3 → 4)');
  assert.ok(at('bridesmaids') < at('secondary_sponsors'), 'the entourage before the secondary sponsors');
  assert.equal(rows[rows.length - 1], 'guest', 'guests close the list');
  assert.deepEqual(rows, dressCodeForEveryone({
    stored: sanitizeRolePalette(BOARD),
    board: resolveDisplayPalette(sanitizeRolePalette(BOARD)),
    roles: {},
    groups: {},
  }).rows.map((r) => r.key), 'the page draws the builder’s order, not its own');
});

test('🌐 the ninang’s and ninong’s outfit lines sit under the Principal Sponsors row', async () => {
  const row = rowHtml(await widget({ rolePalette: BOARD }), 'principal_sponsors');
  assert.match(row, /Principal Sponsors/);
  assert.match(row, /Ninang · Long gown — in the wedding colours/);
  assert.match(row, /Ninong · Barong Tagalog/);
});

test('🌐 a role with no colours on the board is left out — the rows never draw empty', async () => {
  const html = await widget({ rolePalette: { ...BOARD, secondary_sponsors: [] }, config: null });
  assert.equal(rowHtml(html, 'secondary_sponsors'), '', 'no colours, no outfit → no row');
  assert.equal(rowHtml(html, 'officiants'), '', 'a role the couple never dressed is not listed');
});

test('🌐 a Nikah Principals row waits for a muslim ceremony', () => {
  const board = { reception: ['#111111'], muslim_principals: ['#059669'] } as RolePalette;
  const catholic = dressCodeForEveryone({ stored: board, board, roles: {}, groups: {}, ceremonyType: 'catholic' });
  const muslim = dressCodeForEveryone({ stored: board, board, roles: {}, groups: {}, ceremonyType: 'muslim' });
  assert.ok(!catholic.rows.some((r) => r.key === 'muslim_principals'));
  assert.ok(muslim.rows.some((r) => r.key === 'muslim_principals'));
});

test('🌐 the colours are the ones the Mood Board SHOWS, not the raw stored ones', async () => {
  /* An UNTOUCHED role: the board displays a colour derived from the main five,
     and the 3D room dresses people in it. The scene must agree with both. */
  const untouched: RolePalette = { reception: BOARD.reception, bridesmaids: ['#000001', '#000002', '#000003'] };
  const shown = resolveDisplayPalette(sanitizeRolePalette(untouched));
  assert.notDeepEqual(shown.bridesmaids, untouched.bridesmaids, 'precondition: the board really does derive this role');
  const row = dressCodeForEveryone({
    stored: sanitizeRolePalette(untouched),
    board: shown,
    roles: {},
    groups: {},
  }).rows.find((r) => r.key === 'bridesmaids');
  assert.deepEqual(row?.hexes, shown.bridesmaids);
  /* …and the PAGE draws those, in both views — the builder being right is not
     the scene being right. */
  const general = await widget({ rolePalette: untouched, config: null });
  assert.deepEqual(chipColours(rowHtml(general, 'bridesmaids')), shown.bridesmaids!.map((h) => h.toUpperCase()));
  const hers = await widget({ rolePalette: untouched, config: null, guestRole: 'bridesmaid' });
  assert.deepEqual(chipColours(hers), shown.bridesmaids!.map((h) => h.toUpperCase()), 'her own panel agrees with the board too');
});

/* ══ THE MAKER — the couple editing the hub is "general" ════════════════════ */

async function dispatcher(guestView: boolean, role: GuestRole): Promise<string> {
  const { HideableWidgetRender } = await import('../app/[slug]/_components/hideable-widget-render');
  const Render = HideableWidgetRender as unknown as React.FunctionComponent<Record<string, unknown>>;
  return renderToStaticMarkup(
    React.createElement(Render, {
      widget: { widget_id: 'W1', event_id: 'E1', widget_type: 'dress_code', is_always_on: false, is_visible: true, config_json: {} },
      guestView,
      event: { event_id: 'E1', public_id: 'S89E-TESTTESTTE', dress_code_config: CONFIG, role_palette: BOARD, ceremony_type: 'catholic' },
      words,
      guest: { guest_id: 'G1', first_name: 'Ice', last_name: 'C', display_name: null, role, side: 'groom', group_category: 'family', plus_one_of_guest_id: null, plus_one_mode: null, plus_one_allowed: false },
      sideLabel: 'Groom',
      scheduleBlocks: [],
      isLive: false,
      isLimitedPlusOne: false,
      ourPhotoUrls: [],
    }),
  );
}

test('🛠 the Maker canvas (host = the groom) shows the GENERAL view, not the host’s own row', async () => {
  const canvas = await dispatcher(false, 'groom');
  assert.doesNotMatch(canvas, /You are/, 'the couple sees what their guests read, not a panel about themselves');
  assert.match(canvas, /data-dress-code="ours"/);
  assert.equal(rowOrder(canvas).length, ROLES_ON_THE_BOARD.length, 'every dressed role is on the canvas');
});

test('👤 the same groom, as a GUEST (not the canvas), is answered for his role only', async () => {
  const guest = await dispatcher(true, 'groom');
  assert.match(guest, /You are Groom/);
  assert.doesNotMatch(guest, /data-dress-code="roles"/, 'no other role’s colours');
  assert.doesNotMatch(guest, /data-dress-code="ours"/);
});

/* ══ SPECIFIC — "if there is an account specified to this, show their palette only" ══ */

test('👤 a bridesmaid sees ONLY her role, and ALL of its colours', async () => {
  const html = await widget({ rolePalette: BOARD, guestRole: 'bridesmaid', hideWhenEmpty: true });
  assert.match(html, /You are Bridesmaid/);
  assert.deepEqual(chipColours(html), BOARD.bridesmaids!.map((h) => h.toUpperCase()), 'three colours, not the first one');
  assert.doesNotMatch(html, /data-dress-code="roles"|data-dress-code="ours"/, 'nobody else’s instructions');
});

test('👤 a ninang keeps her call time FIRST, then her outfit, then her colours', async () => {
  const config = {
    roles: { principal_sponsor_ninang: { style: 'long_gown', note: 'in the wedding colours', callTime: '13:00' } },
  };
  const html = await widget({ rolePalette: BOARD, guestRole: 'principal_sponsor_ninang', config });
  const time = html.indexOf('1:00 PM');
  const outfit = html.indexOf('Long gown');
  const chips = html.indexOf('pahina-swatch');
  assert.ok(time > 0 && time < outfit && outfit < chips, 'call time → outfit → colours');
  assert.deepEqual(chipColours(html), BOARD.principal_sponsors!.map((h) => h.toUpperCase()));
});

test('👤 a role with NOTHING to say (no colour, no outfit, no time) gets the general view', async () => {
  /* No majors, no bearers palette, no wedding-party fallback: a ring bearer's
     own panel could only print his role's name. */
  const board: RolePalette = { guest: ['#2B1D14', '#8E3B5B', '#C9A24B'] };
  const html = await widget({ rolePalette: board, guestRole: 'ring_bearer', config: null, hideWhenEmpty: true });
  assert.doesNotMatch(html, /You are/);
  assert.match(html, /data-role-row="guest"/, 'he reads everyone’s colours instead');
});

test('👤 …but with no general view to fall back to, the name-tag panel stays (the scene does not vanish)', async () => {
  const html = await widget({ rolePalette: null, guestRole: 'principal_sponsor_ninang', config: null, hideWhenEmpty: true });
  assert.match(html, /You are Ninang/, 'where it showed before, it still shows');
});

test('👤 speaksToThisReader keeps any panel that carries a colour, an outfit or a time', () => {
  type Panel = NonNullable<Parameters<typeof speaksToThisReader>[0]['panel']>;
  const base: Panel = { roleLabel: 'Ninang', style: null, styleLabel: null, note: null, callTime: null, hex: null, hexes: [] };
  const keep = (p: Panel) => speaksToThisReader({ panel: p, source: null }, true).panel;
  assert.equal(keep(base), null, 'a name alone stands down');
  assert.ok(keep({ ...base, hexes: ['#111111'], hex: '#111111' }));
  assert.ok(keep({ ...base, style: 'long_gown', styleLabel: 'Long gown' }));
  assert.ok(keep({ ...base, callTime: '1:00 PM' }));
});

/* ══ THE STRANGER'S DOOR is handed the Mood Board ══════════════════════════ */

test('🚪 the anonymous dispatcher passes the Mood Board — a stranger sees our colours', async () => {
  const { PublicHideableWidget } = await import('../app/[slug]/_components/public-hideable-widget');
  const Render = PublicHideableWidget as unknown as React.FunctionComponent<Record<string, unknown>>;
  const html = renderToStaticMarkup(
    React.createElement(Render, {
      widget: { widget_id: 'W1', event_id: 'E1', widget_type: 'dress_code', is_always_on: false, is_visible: true, config_json: {} },
      guestView: true,
      event: { event_id: 'E1', public_id: 'S89E-TESTTESTTE', dress_code_config: null, role_palette: BOARD, ceremony_type: 'catholic' },
      words,
      scheduleBlocks: [],
      isLive: false,
      ourPhotoUrls: [],
    }),
  );
  assert.match(html, /Our colours/, 'the stranger’s door used to pass no palette at all');
  assert.equal(rowOrder(html).length, ROLES_ON_THE_BOARD.length);
});

test('🔁 LIVE: both doors read the colours off the SAME event row the page’s theme is built from', () => {
  /* The hub's theme colours are `buildSitePaletteVars(event.role_palette)`; on
     the Maker canvas `event` is the draft-overlaid row. A scene handed any
     other source (a second query, a cached copy) would lag the Mood Board. */
  for (const door of ['hideable-widget-render.tsx', 'public-hideable-widget.tsx']) {
    const src = readFileSync(join(APP, door), 'utf8');
    const call = src.slice(src.indexOf('<DressCodeWidget'), src.indexOf('/>', src.indexOf('<DressCodeWidget')));
    assert.match(call, /rolePalette=\{event\.role_palette\}/, `${door}: the scene reads the row, not a copy`);
  }
});

/* ══ LOOK — a near-white colour is still a visible chip ════════════════════ */

test('🧵 every chip carries its own edge, and "you" no longer sits on the pink veil', async () => {
  for (const html of [
    await widget({ rolePalette: BOARD }),
    await widget({ rolePalette: BOARD, guestRole: 'groom' }),
  ]) {
    const chips = [...html.matchAll(/class="(pahina-swatch[^"]*)"/g)].map((m) => m[1]!);
    assert.ok(chips.length > 0, 'precondition: chips rendered');
    for (const c of chips) assert.match(c, /\boutline\b.*outline-ink\/20/, `a chip without an edge: "${c}"`);
  }
  const mine = await widget({ rolePalette: BOARD, guestRole: 'groom' });
  const box = mine.slice(mine.lastIndexOf('<div', mine.indexOf('data-dress-code="you"')), mine.indexOf('>', mine.indexOf('data-dress-code="you"')));
  assert.doesNotMatch(box, /bg-veil/, 'the groom’s #FAF7F2 used to vanish into a veil-tinted box');
  assert.deepEqual(chipColours(mine), ['#FAF7F2']);
});

/* ══ THE CHAIN — one walk, two readers ═══════════════════════════════════════ */

test('⛓ resolveAttirePaletteColors[0] IS resolveAttirePaletteColor, for every role × every board shape', () => {
  const boards: RolePalette[] = [
    {},
    BOARD,
    { wedding_party: ['#222222', '#333333'] },
    { bridesmaids: ['#111111'], wedding_party: ['#222222'] },
    { guest: ['#444444', '#555555'] },
  ];
  let n = 0;
  for (const role of Object.keys(ROLE_LABELS) as GuestRole[]) {
    for (const b of boards) {
      for (const side of [null, '#999999']) {
        const all = resolveAttirePaletteColors(role, b, side);
        assert.equal(all[0] ?? null, resolveAttirePaletteColor(role, b, side), `${role} · ${JSON.stringify(b)} · ${side}`);
        n++;
      }
    }
  }
  assert.ok(n > 100, `anti-vacuity: ${n} cases`);
  assert.deepEqual(resolveAttirePaletteColors('bridesmaid', BOARD, null), BOARD.bridesmaids, 'the whole list');
  assert.deepEqual(resolveAttirePaletteColors('bridesmaid', { wedding_party: ['#1', '#2'] as string[] }, null), ['#1', '#2'], 'the fallback list whole');
  assert.deepEqual(resolveAttirePaletteColors('bridesmaid', { bridesmaids: '#ABCDEF' } as never, null), [], 'a string is not indexed');
  assert.ok(PALETTE_ORDER.length > 0);
});

/* ══ AUTHORED DATA — the typed palette merges, it is never dropped ═════════ */

test('🖋 a typed dress-code palette MERGES into "Our colours": names lend, extras follow, nothing is lost', () => {
  const main = ['#7A1F2B', '#C9A24B'];
  const typed = [
    { name: 'Wine', hex: '#7a1f2b' },
    { name: 'Sage', hex: '#9CAF88' },
  ];
  assert.deepEqual(ourColoursWith(main, typed), [
    { name: 'Wine', hex: '#7A1F2B' },
    { name: '', hex: '#C9A24B' },
    { name: 'Sage', hex: '#9CAF88' },
  ]);
  assert.deepEqual(ourColoursWith([], typed), typed, 'no Mood Board → exactly what the couple typed, as before');
  assert.deepEqual(ourColoursWith(main, []), main.map((hex) => ({ name: '', hex })));
});
