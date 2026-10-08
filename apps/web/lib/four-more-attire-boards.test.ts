/**
 * 👗 FOUR MORE ATTIRE BOARDS — Bridesmaids · Groomsmen · Flower girl · Ring bearer
 * (owner 2026-10-08, verbatim: *"Inspiration can go more. Bridal Gown, Groom's Suit, Groomsmen,
 * Bridesmaid, Flowergirl, Ring Bearer"* · *"this simply means on attire, they can upload inspiration
 * photos and also search from the photos uploaded by vendors"*; the database change: *"go"*).
 *
 * Studio › Mood Board & Dress Code › Attire holds seven boards, in his order with the whole party's
 * board kept last: Bridal gown · Groom's suit · Bridesmaids · Groomsmen · Flower girl · Ring bearer ·
 * Entourage. Each is the shipped board — the couple's own photos (＋) and the suppliers' photos
 * (Search ideas ›) — on a slot of its own.
 *
 * What is held here:
 *   1 · the four are STORED slots, each on the trades that dress those people — and the honest answer
 *       about children's attire: no tile of its own; the flower girl's dress is a service under
 *       Women's Attire, the ring bearer's suit one under Men's Attire;
 *   2 · the migration widens BOTH slot gates by exactly the four, and the app's list is the gates';
 *   3 · Attire DRAWS every board exactly once whatever the guest list holds — under its role's row, or
 *       after the rows — each with its own ＋ and its own Search ideas › (the real component, rendered);
 *   4 · the ＋ can open the file picker from Attire: the ONE file input is mounted on every tab;
 *   5 · a board's search reads its OWN shelf, and an empty shelf says so in words;
 *   6 · nothing waits for a slot any more;
 *   7 · the four move nothing a paid render or a supplier's sign-off reads;
 *   8 · a tailor is offered the shelf — the supplier's side of the same slot.
 *
 * 🛡 Sabotaged once each (2026-10-08, builder A1), each red alone: `ring_bearer` given
 * `['womens_attire']` → 1; `'groomsmen'` left out of the gallery's gate in the migration → 2; the
 * `flower_girl` card removed from `STUDIO_INSPIRATION_SLOTS` → 3; `beside` dropped from `ring_bearer`
 * → 3; `attireBoardsAfter` made to return nothing → 3; the Search ideas › button removed from
 * `slotBoard` → 3; the file input moved back inside the Inspiration tab → 4; `fetchGalleryAssets`
 * made to read the `entourage` shelf for every attire board → 5; the empty sentence blanked → 5;
 * "Bridesmaids" put back in `AWAITING_A_SLOT` → 6; `bridesmaids` aliased onto the wedding party in
 * `SLOT_ROLE` → 7; `flower_girl`'s shelf label nulled → 8.
 *
 * `globalThis.React` before the dynamic imports: tsx compiles JSX to the classic runtime here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MOODBOARD_SLOT_KEYS, MOODBOARD_PART_TRADES } from './moodboard-slots';
import { MOODBOARD_SLOT_TRADES, canonicalServicesForSlot, normalizeGalleryQuery, shapeGalleryPage } from './moodboard-gallery';
import { GALLERY_SLOT_LABEL, uploadableSlotsForShop } from './moodboard-gallery-upload';
import { AWAITING_A_SLOT, STUDIO_INSPIRATION_SLOTS, attireBoardsAfter, attireBoardsUnder } from './inspiration-slots';
import { inspirationSlotsForPart } from './moodboard-render-parts';
import { renderPartIdsForSlot } from './moodboard-render-pool';
import { tradesForPart } from './moodboard-finalization';
import { WEDDING_TILE_LABEL } from './taxonomy';
import { canonicalServicesForTile } from './vendor-counts';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The Studio's server actions, the router and the server-only marker have no place in a unit render. */
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

const FOUR = ['bridesmaids', 'groomsmen', 'flower_girl', 'ring_bearer'] as const;
const SEVEN: ReadonlyArray<readonly [string, string]> = [
  ['bride', 'Bridal gown'],
  ['groom', 'Groom’s suit'],
  ['bridesmaids', 'Bridesmaids'],
  ['groomsmen', 'Groomsmen'],
  ['flower_girl', 'Flower girl'],
  ['ring_bearer', 'Ring bearer'],
  ['entourage', 'Entourage'],
];

const WEB = join(__dirname, '..');
const MB = 'app/dashboard/[eventId]/studio/mood-board';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const sql = (suffix: string) => readFileSync(join(MIGRATIONS, readdirSync(MIGRATIONS).find((f) => f.endsWith(suffix))!), 'utf8');
/** The values of the `IN (…)` list that follows `after` — the constraint's own list, not the file's prose. */
const listed = (src: string, after: string) => {
  const at = src.lastIndexOf(after);
  assert.ok(at >= 0, `${after} not found`);
  const m = src.slice(at).match(/IN \(([\s\S]*?)\)/);
  return m![1]!.split(',').map((v) => v.trim().replace(/'/g, '')).filter(Boolean);
};

/* ── the real component, drawn ─────────────────────────────────────────────── */

type Row = { tier: 'roles' | 'groups'; key: string; label: string; paletteKey: string | null; arrives: string | null };
/** The rows `studioAttireRows` builds: the couple always, a group only when the guest list has it, the guests last. */
const COUPLE: Row[] = [
  { tier: 'roles', key: 'bride', label: 'The bride', paletteKey: 'bride', arrives: null },
  { tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: null },
];
const GUESTS: Row = { tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null };
const PARTY: Row[] = [
  { tier: 'groups', key: 'bridesmaids', label: 'Bridesmaids', paletteKey: 'bridesmaids', arrives: null },
  { tier: 'groups', key: 'groomsmen', label: 'Groomsmen', paletteKey: 'groomsmen', arrives: null },
  { tier: 'groups', key: 'bearers_flower_girl', label: 'Bearers & Flower Girl', paletteKey: 'bearers_flower_girl', arrives: null },
];

/**
 * The Studio's Mood Board, drawn on one tab. The tab is component state with no prop to set it, so
 * the first `useState('colours')` of the render is answered with the tab asked for — the component's
 * own code draws everything else.
 */
async function drawn(tab: 'colours' | 'attire' | 'insp' | 'dos', attire: readonly Row[]): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoodBoardStudio } = await import(`../${MB}/_components/mood-board-studio`);
  const R = require('react') as { useState: (init: unknown) => unknown };
  const real = R.useState;
  let answered = false;
  R.useState = (init: unknown) => {
    if (init === 'colours' && !answered) {
      answered = true;
      return [tab, () => {}];
    }
    return real(init);
  };
  try {
    const out = renderToStaticMarkup(
      React.createElement(MoodBoardStudio, {
        eventId: 'e',
        palette: { reception: ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'] },
        fallbackFive: ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'],
        frozenDressing: [],
        changes: [],
        attire,
        dressConfig: {},
        attireStyles: [],
        inspirations: [],
        autoThemes: [],
        regions: [],
        dos: React.createElement('i', { 'data-stub': 'dos' }),
      }),
    );
    assert.ok(answered, 'the Mood Board no longer opens on a tab named "colours" — this render cannot choose its tab');
    return out;
  } finally {
    R.useState = real;
  }
}

/** One board's own markup: from its wrapper to the next board's wrapper (or the end). */
function boardOf(markup: string, slot: string): string {
  const at = markup.indexOf(`data-mood-board-attire-board="${slot}"`);
  if (at < 0) return '';
  const next = markup.indexOf('data-mood-board-attire-board="', at + 10);
  return markup.slice(at, next < 0 ? undefined : next);
}
const boardOrder = (markup: string) => [...markup.matchAll(/data-mood-board-attire-board="([a-z_]+)"/g)].map((m) => m[1]!);

/* ── 1 ─────────────────────────────────────────────────────────────────────── */

test('1 · the four are stored slots, each on the trades that dress those people — and no children’s tile is invented', () => {
  for (const k of FOUR) assert.ok((MOODBOARD_SLOT_KEYS as readonly string[]).includes(k), `${k} is not a stored slot`);
  assert.deepEqual([...MOODBOARD_SLOT_TRADES.bridesmaids], ['womens_attire', 'filipiniana_barongs']);
  assert.deepEqual([...MOODBOARD_SLOT_TRADES.groomsmen], ['mens_attire', 'filipiniana_barongs']);
  assert.deepEqual([...MOODBOARD_SLOT_TRADES.flower_girl], ['womens_attire', 'filipiniana_barongs']);
  assert.deepEqual([...MOODBOARD_SLOT_TRADES.ring_bearer], ['mens_attire', 'filipiniana_barongs']);
  /* Nothing invented: every one of them is a tile the whole party's board already names. */
  for (const k of FOUR) for (const t of MOODBOARD_SLOT_TRADES[k]) {
    assert.ok(t in WEDDING_TILE_LABEL, `${k} → ${t} is not a taxonomy tile`);
    assert.ok(MOODBOARD_SLOT_TRADES.entourage.includes(t), `${k} → ${t} is not one of the entourage’s own trades`);
  }
  /* The service each board is about is really reached — and the other half's is not. */
  const reach = (slot: string) => new Set(canonicalServicesForSlot(slot));
  assert.ok(reach('bridesmaids').has('bridesmaid_dress') && !reach('bridesmaids').has('groomsman_set'), 'Bridesmaids does not reach bridesmaid dresses (or reaches the groomsmen’s)');
  assert.ok(reach('groomsmen').has('groomsman_set') && !reach('groomsmen').has('bridesmaid_dress'), 'Groomsmen does not reach groomsmen’s sets (or reaches the bridesmaids’)');
  assert.ok(reach('flower_girl').has('flower_girl_dress') && !reach('flower_girl').has('ring_bearer_suit'), 'Flower girl does not reach flower-girl dresses (or reaches the ring bearer’s)');
  assert.ok(reach('ring_bearer').has('ring_bearer_suit') && !reach('ring_bearer').has('flower_girl_dress'), 'Ring bearer does not reach ring-bearer suits (or reaches the flower girl’s)');
  /* 🧒 The honest answer about children's attire: no tile of its own — the two services live under the grown-ups' tiles. */
  assert.ok(!Object.keys(WEDDING_TILE_LABEL).some((t) => /child|kids?_attire|flower_girl|ring_bearer/.test(t)), 'a children’s-attire tile now exists — give Flower girl and Ring bearer that tile');
  assert.ok(canonicalServicesForTile('womens_attire').includes('flower_girl_dress'), 'the flower girl’s dress is no longer under Women’s Attire');
  assert.ok(canonicalServicesForTile('mens_attire').includes('ring_bearer_suit'), 'the ring bearer’s suit is no longer under Men’s Attire');
});

/* ── 2 ─────────────────────────────────────────────────────────────────────── */

test('2 · the migration widens BOTH slot gates by exactly the four — and the app’s list is the gates’', () => {
  const before = sql('_studio_missing_fields.sql');
  const ours = sql('_attire_boards_four_more_slots.sql');
  for (const gate of ['ADD CONSTRAINT event_inspiration_assets_slot_key_check_v3', 'ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape']) {
    assert.deepEqual(listed(ours, gate), [...listed(before, gate), ...FOUR], `${gate}: not the latest list plus exactly the four`);
    assert.deepEqual([...listed(ours, gate)].sort(), [...MOODBOARD_SLOT_KEYS].sort(), `${gate}: the app and the database disagree`);
  }
  /* Idempotent, additive, and nothing but the two CHECKs. */
  const body = ours.replace(/--.*$/gm, '');
  assert.equal((body.match(/DROP CONSTRAINT IF EXISTS/g) ?? []).length, 2, 'a CHECK is re-added without being dropped first (not idempotent)');
  assert.doesNotMatch(body, /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP TABLE|DROP COLUMN|ADD COLUMN|CREATE TABLE|GRANT|REVOKE|CREATE POLICY)\b/, 'the migration does more than widen two CHECKs');
  /* It is the LATEST word on both gates. */
  const later = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const mine = later.findIndex((f) => f.endsWith('_attire_boards_four_more_slots.sql'));
  for (const f of later.slice(mine + 1)) {
    assert.doesNotMatch(readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--.*$/gm, ''), /event_inspiration_assets_slot_key_check|moodboard_library_assets_supplier_gallery_shape/, `${f} re-lists a slot gate after this one — point this test at it`);
  }
});

/* ── 3 ─────────────────────────────────────────────────────────────────────── */

test('3 · Attire holds seven boards in the owner’s order, each exactly once whatever the guest list holds', () => {
  assert.deepEqual(STUDIO_INSPIRATION_SLOTS.filter((s) => s.attire).map((s) => [s.slotKey, s.label]), SEVEN, 'not Bridal gown · Groom’s suit · Bridesmaids · Groomsmen · Flower girl · Ring bearer · Entourage');
  const placed = (rows: string[]) => [...rows.flatMap((r) => attireBoardsUnder(r)), ...attireBoardsAfter(rows)].map((s) => s.slotKey);
  /* Nobody but the couple yet: bride and groom under their rows, the other five after, in order. */
  assert.deepEqual(placed(['bride', 'groom', 'guest']), SEVEN.map(([k]) => k));
  /* The whole party on the list: each under its own row; the bearers' ONE row holds two boards. */
  assert.deepEqual(placed(['bride', 'groom', 'bridesmaids', 'groomsmen', 'bearers_flower_girl', 'guest']), SEVEN.map(([k]) => k));
  assert.deepEqual(attireBoardsUnder('bearers_flower_girl').map((s) => s.slotKey), ['flower_girl', 'ring_bearer']);
  /* Any mix: every board once, never twice, never lost. */
  for (const rows of [[], ['guest'], ['bride', 'groom', 'groomsmen', 'guest'], ['bride', 'groom', 'bearers_flower_girl'], ['celebrant', 'bride', 'groom', 'vip_family', 'bridesmaids', 'officiants', 'guest']]) {
    assert.deepEqual([...placed(rows)].sort(), SEVEN.map(([k]) => k).sort(), `rows ${rows.join(',') || '(none)'}: a board is missing or drawn twice`);
  }
});

test('3 · drawn: each board mounts in Attire with its own ＋ and its own Search ideas ›, under its role', async () => {
  for (const [what, rows] of [['the couple alone', [...COUPLE, GUESTS]], ['the whole party', [...COUPLE, ...PARTY, GUESTS]]] as const) {
    const out = await drawn('attire', rows);
    assert.match(out, /data-mood-board-attire=""/, `${what}: the Attire tab was not drawn`);
    assert.deepEqual(boardOrder(out), SEVEN.map(([k]) => k), `${what}: the boards are not the seven, in order, once each`);
    for (const [slot, label] of SEVEN) {
      const board = boardOf(out, slot);
      assert.match(board, new RegExp(`<b[^>]*>${label}</b>`), `${what}: ${label} is not named on its board`);
      assert.match(board, new RegExp(`<button[^>]*aria-label="Add a photo to ${label}"`), `${what}: ${label} cannot take the couple’s own photo`);
      assert.match(board, new RegExp(`<button[^>]*data-mood-board-search="${slot}"[^>]*>Search ideas ›</button>`), `${what}: ${label} cannot search the suppliers’ photos`);
      assert.match(board, /Add photos to get its palette/, `${what}: an empty ${label} does not say how it gets a palette`);
    }
  }
  /* Under its role: the bearers' row holds Flower girl and Ring bearer; a role's board is inside that role's row. */
  const out = await drawn('attire', [...COUPLE, ...PARTY, GUESTS]);
  const rowOf = (key: string) => {
    const at = out.indexOf(`data-mood-board-role="${key}"`);
    const next = out.indexOf('data-mood-board-role="', at + 10);
    return out.slice(at, next < 0 ? undefined : next);
  };
  assert.deepEqual(boardOrder(rowOf('bridesmaids')), ['bridesmaids']);
  assert.deepEqual(boardOrder(rowOf('groomsmen')), ['groomsmen']);
  assert.deepEqual(boardOrder(rowOf('bearers_flower_girl')), ['flower_girl', 'ring_bearer']);
  /* …and Inspiration draws none of them: an attire board lives in Attire only. */
  const insp = await drawn('insp', [...COUPLE, GUESTS]);
  for (const [slot] of SEVEN) assert.doesNotMatch(insp, new RegExp(`data-mood-board-slot="${slot}"`), `Inspiration also draws the ${slot} board`);
  /* The board IS the shipped one — its ＋ and its search are the two the other boards use. */
  const src = read(`${MB}/_components/mood-board-studio.tsx`);
  const board = src.slice(src.indexOf('const slotBoard = '), src.indexOf('const bar = ('));
  assert.match(board, /onClick=\{\(\) => openUpload\(slot\.slotKey\)\}/, 'a board’s ＋ does not open the upload for ITS slot');
  assert.match(board, /onClick=\{\(\) => setSheet\(\{ kind: 'browse', slot \}\)\}[^>]*data-mood-board-search=\{slot\.slotKey\}/, 'a board’s Search ideas › does not open the suppliers’ photos for ITS slot');
});

/* ── 4 ─────────────────────────────────────────────────────────────────────── */

test('4 · the ＋ can open the file picker from Attire: the one file input is mounted on every tab', async () => {
  for (const tab of ['colours', 'attire', 'insp', 'dos'] as const) {
    const out = await drawn(tab, [...COUPLE, GUESTS]);
    const inputs = out.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
    assert.equal(inputs.length, 1, `on the ${tab} tab there ${inputs.length === 0 ? 'is no file input — a board’s ＋ opens nothing' : 'are several file inputs'}`);
    assert.match(inputs[0]!, /accept="image\/png,image\/jpeg,image\/webp"/, 'the file input takes something other than a photo');
  }
});

/* ── 5 ─────────────────────────────────────────────────────────────────────── */

test('5 · a board’s search reads its OWN shelf, and an empty shelf says so in words', async () => {
  for (const k of FOUR) {
    const q = normalizeGalleryQuery({ slotKey: k });
    assert.ok(q, `${k}: Search ideas › would be refused ("No supplier gallery for that slot")`);
    assert.equal(q!.slotKey, k, `${k}: the search asks another board’s shelf`);
    assert.deepEqual(shapeGalleryPage(k, []), { assets: [], withheld: 0 });
  }
  /* The read and the save both name the shelf by the board's own key — never a neighbour's photos. */
  const actions = read(`${MB}/actions.ts`);
  const fetch = actions.slice(actions.indexOf('export async function fetchGalleryAssets('), actions.indexOf('export async function applyGalleryPick('));
  assert.match(fetch, /\.eq\('asset_subtype', query\.slotKey\)/, 'the search no longer reads the board’s own shelf');
  const pick = actions.slice(actions.indexOf('export async function applyGalleryPick('), actions.indexOf('export async function fetchRenderPool('));
  assert.match(pick, /\.eq\('asset_subtype', input\.slotKey\)/, 'a photo from another shelf could be saved onto this board');
  /* An empty shelf, drawn: the picker as it stands when the shelf holds nothing. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GalleryPicker } = await import(`../${MB}/_components/gallery-picker`);
  for (const [slot, label] of SEVEN.filter(([k]) => (FOUR as readonly string[]).includes(k))) {
    const out = renderToStaticMarkup(
      React.createElement(GalleryPicker, {
        eventId: 'e',
        slotKey: slot,
        slotLabel: label,
        emptyPositions: [1, 2, 3],
        fetchAction: async () => ({ assets: [], total: 0, withheld: 0, offset: 0, limit: 6, hasMore: false }),
        applyAction: async () => ({ status: 'error' as const }),
        onSaved: () => {},
        onClose: () => {},
        studio: { mainFive: [], regions: [] },
      }),
    );
    assert.match(out, new RegExp(`aria-label="Supplier photos for ${label}"`), `${label}: the picker is not this board’s`);
    assert.match(out, /No supplier has added photos for this yet\. Nothing is wrong — the shelf is new\./, `${label}: an empty shelf is silent`);
    assert.doesNotMatch(out, /<li\b/, `${label}: an empty shelf draws a photo`);
  }
});

/* ── 6 ─────────────────────────────────────────────────────────────────────── */

test('6 · nothing waits for a slot any more', () => {
  const waiting = AWAITING_A_SLOT.map((a) => a.label);
  for (const label of ['Groomsmen', 'Bridesmaids', 'Flower girl', 'Ring bearer']) {
    assert.ok(!waiting.includes(label), `${label} still waits for a slot it now has`);
    assert.ok(STUDIO_INSPIRATION_SLOTS.some((s) => s.label === label && s.attire), `${label} has no board in Attire`);
  }
});

/* ── 7 ─────────────────────────────────────────────────────────────────────── */

test('7 · the four move nothing a paid render or a supplier’s sign-off reads', () => {
  /* The wedding party's render is still conditioned by the entourage's photos alone… */
  assert.deepEqual(inspirationSlotsForPart('people:wedding_party'), ['entourage']);
  /* …the bearers' part keeps the trades the owner decided (2026-09-04), not a board's… */
  assert.deepEqual(inspirationSlotsForPart('people:bearers_flower_girl'), []);
  assert.deepEqual(tradesForPart('people:bearers_flower_girl'), [...MOODBOARD_PART_TRADES['people:bearers_flower_girl']!]);
  /* …and a board of the four offers the shared-render pool only the whole look, like any card that is not a part. */
  for (const k of FOUR) assert.deepEqual(renderPartIdsForSlot(k), renderPartIdsForSlot('bridal_bouquet'), `${k} became a render part`);
});

/* ── 8 ─────────────────────────────────────────────────────────────────────── */

test('8 · a tailor is offered the shelf — the supplier’s side of the same slot', () => {
  assert.equal(GALLERY_SLOT_LABEL.bridesmaids, 'Bridesmaids’ attire');
  assert.equal(GALLERY_SLOT_LABEL.groomsmen, 'Groomsmen’s attire');
  assert.equal(GALLERY_SLOT_LABEL.flower_girl, 'Flower girl’s attire');
  assert.equal(GALLERY_SLOT_LABEL.ring_bearer, 'Ring bearer’s attire');
  const shelves = (services: string[]) => uploadableSlotsForShop(services).map((s) => s.key as string);
  const women = shelves(['bridesmaid_dress']);
  const men = shelves(['groomsman_set']);
  assert.ok(women.includes('bridesmaids') && women.includes('flower_girl'), 'a dressmaker is not offered the Bridesmaids and Flower girl shelves');
  assert.ok(!women.includes('groomsmen') && !women.includes('ring_bearer'), 'a dressmaker is offered the men’s shelves');
  assert.ok(men.includes('groomsmen') && men.includes('ring_bearer'), 'a tailor is not offered the Groomsmen and Ring bearer shelves');
  assert.ok(!men.includes('bridesmaids') && !men.includes('flower_girl'), 'a tailor is offered the women’s shelves');
  assert.deepEqual(shelves(['florist_bouquets_only_not_a_service']).filter((k) => (FOUR as readonly string[]).includes(k)), [], 'a shop with no attire service is offered an attire shelf');
});
