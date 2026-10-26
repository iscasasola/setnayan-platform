/**
 * every-palette-part-reaches-the-supplier-library.test.ts — 🌱🖼 SUPPLIERS FILL THE INSPIRATION LIBRARY WITHOUT AN
 * EVENT (owner 2026-10-19, DECISION_LOG row of that name: *"first, we need to allow the suppliers to fill up the
 * inspiration board even if it has not come from an event. to help us create more inspirations faster"* → *"go"*;
 * on the mapping: *"keep the mapping consistent and don't let me trace it"*).
 *
 * ONE guard over the whole chain, iterating EVERY part the couple's Studio draws a photos line for (the Palette's
 * Venue & decor · the room · the flowers · Cake, then the Attire boards). For each part:
 *
 *   1 · it has a library slot the database accepts for a supplier's photo, and that slot has at least one supplying
 *       trade (a real taxonomy tile with real services under it) — a NEW part with no supplier mapping fails here;
 *   2 · the supplier's library offers it — by the couple's name, in the couple's order — to a shop of each of its
 *       trades, and the couple's own "Which part?" reads the same list (the two can never drift);
 *   3 · the round trip, through the shipped code: that shop's upload is allowed → an approved photo on that slot →
 *       the couple's Search ideas on THAT part lists it, credited to the shop by name and trade; a shop of a trade
 *       that does not dress the part is refused;
 *   4 · the way in: "Add to the inspiration library" is drawn on Today (Shop group) and on Shop (Your shop), only for
 *       a shop the library would let in, and the bottom nav lights Shop on the library's page.
 *
 * Sabotaged, seen red, restored (see the PR body): a part's trades emptied → 1 · the supplier list re-ordered → 2 ·
 * a part's slot dropped from the gallery's slot list → 3 · the Today row unmounted → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { CAKE_LANE_PARTS, FLORIST_LANE_PARTS, ROOM_LANE_PARTS } from './colour-access';
import { MAIN_PALETTE_BOARD, STUDIO_INSPIRATION_SLOTS, libraryPhotoParts, palettePhotoParts, paletteBoardOf } from './inspiration-slots';
import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';
import { GALLERY_SLOT_KEYS, MOODBOARD_SLOT_TRADES, normalizeGalleryQuery, shapeGalleryPage, type RawGalleryRow } from './moodboard-gallery';
import { libraryPartLabel, slotUploadVerdict, uploadableSlotsForShop } from './moodboard-gallery-upload';
import { moodboardLibraryAccessForProfile } from './moodboard-library-access';
import { dbAcceptedSlotKeys } from './inspiration-parts-gate.test-helper';
import { canonicalServicesForTile } from './vendor-counts';
import { WEDDING_TILE_LABEL, type WeddingTile } from './taxonomy';
import { INSPIRATION_LIBRARY_HREF, INSPIRATION_LIBRARY_ROW } from './inspiration-library-entry';
import type { VendorProfileRow } from './vendor-profile';
import { fallbackInspirationParts } from './inspiration-parts';

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
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── THE COUPLE'S PARTS, read from where the couple's Studio reads them — never restated here ─────────────────── */
const PALETTE_PARTS = [...ROOM_LANE_PARTS, ...FLORIST_LANE_PARTS, ...CAKE_LANE_PARTS];
const MAIN = STUDIO_INSPIRATION_SLOTS.find((s) => s.slotKey === MAIN_PALETTE_BOARD)!;
const ATTIRE = STUDIO_INSPIRATION_SLOTS.filter((s) => s.attire);
/** Every part the couple sees a photos line on, in the couple's order: Venue & decor → room → flowers → cake → attire. */
const COUPLE_PARTS: { label: string; slot: string }[] = [
  { label: MAIN.label, slot: MAIN.slotKey },
  ...PALETTE_PARTS.map((p) => ({ label: p.label, slot: paletteBoardOf(p.field)?.slotKey ?? `(no board for ${p.label})` })),
  ...ATTIRE.map((s) => ({ label: s.label, slot: s.slotKey })),
];

/**
 * The slots a supplier photo may name, as the database holds them. 🧩 Since step ② (PLAN
 * admin_inspiration_groups_2026-10-25) that is not an IN-list any more: the trigger
 * `moodboard_library_assets_subtype_is_a_part` admits exactly the rows of `inspiration_parts`, seeded from the
 * consts — `dbAcceptedSlotKeys` asserts the gate really points there and returns the seeded keys.
 */
function galleryGateSlots(): string[] {
  return dbAcceptedSlotKeys();
}

const shopOf = (services: string[]) => services;

test('1 · every couple part has a library slot the database accepts, with at least one real supplying trade', () => {
  assert.ok(COUPLE_PARTS.length >= 20, `only ${COUPLE_PARTS.length} parts were read — the list is broken, not the guard`);
  const gate = new Set(galleryGateSlots());
  for (const p of COUPLE_PARTS) {
    assert.ok((MOODBOARD_SLOT_KEYS as readonly string[]).includes(p.slot), `${p.label} has no library slot (${p.slot})`);
    assert.ok(gate.has(p.slot), `${p.label} → ${p.slot}: the database refuses a supplier's photo on it (supplier_gallery_shape)`);
    const trades = MOODBOARD_SLOT_TRADES[p.slot as keyof typeof MOODBOARD_SLOT_TRADES] ?? [];
    assert.ok(trades.length > 0, `${p.label} → ${p.slot} has NO supplying trade — no supplier can ever add a photo to it`);
    for (const t of trades) {
      assert.ok(t in WEDDING_TILE_LABEL, `${p.label} → ${t} is not a taxonomy tile`);
      assert.ok(canonicalServicesForTile(t).length > 0, `${p.label} → ${t} has no services under it, so no shop can hold it`);
    }
    assert.ok((GALLERY_SLOT_KEYS as readonly string[]).includes(p.slot), `${p.label} → ${p.slot} is not a gallery shelf`);
  }
});

test('2 · the supplier library lists every part by the couple’s name, in the couple’s order — the one list both read', () => {
  const lib = libraryPhotoParts(fallbackInspirationParts());
  assert.deepEqual(
    lib.map((p) => `${p.label}=${p.key}`),
    COUPLE_PARTS.map((p) => `${p.label}=${p.slot}`),
    'the supplier’s library is not the couple’s parts, by name, in order',
  );
  assert.deepEqual(palettePhotoParts(fallbackInspirationParts()), lib.filter((p) => p.group !== 'attire'), 'the Palette half is not the couple’s Palette');
  for (const p of COUPLE_PARTS) assert.equal(libraryPartLabel(p.slot, fallbackInspirationParts()), p.label, `${p.slot} is called something else to the supplier`);

  /* The couple's Studio upload bar reads the same function — no second list to drift. */
  const studio = code('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx');
  assert.match(studio, /const uploadOptions = palettePhotoParts\(props\.inspirationParts\)/, 'the couple’s “Which part?” no longer reads palettePhotoParts (from the parts snapshot)');
  /* …and the supplier's dropdown is fed by `uploadableSlotsForShop`, whose order IS that list. */
  const access = code('lib/moodboard-library-access.ts');
  assert.match(access, /uploadableSlotsForShop\(profile\.services, parts\)/);
  const upload = code('lib/moodboard-gallery-upload.ts');
  const fn = upload.slice(upload.indexOf('export function uploadableSlotsForShop('));
  assert.ok(fn.indexOf('libraryPhotoParts(parts)') > 0 && fn.indexOf('libraryPhotoParts(parts)') < fn.indexOf('parts.parts'), 'the couple’s parts are not listed first');

  /* A shop of every trade sees every part it dresses, by the couple's name, in the couple's relative order. */
  const order = new Map(COUPLE_PARTS.map((p, i) => [p.slot, i]));
  for (const p of COUPLE_PARTS) {
    for (const t of MOODBOARD_SLOT_TRADES[p.slot as keyof typeof MOODBOARD_SLOT_TRADES]) {
      const offered = uploadableSlotsForShop(shopOf(canonicalServicesForTile(t)), fallbackInspirationParts());
      const hit = offered.find((s) => s.key === p.slot);
      assert.ok(hit, `a ${WEDDING_TILE_LABEL[t]} shop is not offered ${p.label}`);
      assert.equal(hit!.label, p.label, `${p.label} is offered to a ${WEDDING_TILE_LABEL[t]} shop as “${hit!.label}”`);
      const idx = offered.filter((s) => order.has(s.key)).map((s) => order.get(s.key)!);
      assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `a ${WEDDING_TILE_LABEL[t]} shop's list is out of the couple's order`);
      assert.ok(offered.findIndex((s) => s.group === 'more') === -1 || offered.findIndex((s) => s.group === 'more') > offered.findIndex((s) => s.key === p.slot), 'an older board sits above a couple part');
    }
  }
});

test('3 · the round trip: a shop of the part’s trade adds a photo → approved → the couple’s Search ideas on that part shows it, credited', () => {
  const allTiles = Object.keys(WEDDING_TILE_LABEL) as WeddingTile[];
  for (const p of COUPLE_PARTS) {
    const trades = MOODBOARD_SLOT_TRADES[p.slot as keyof typeof MOODBOARD_SLOT_TRADES];
    const trade = trades[0]!;
    const services = canonicalServicesForTile(trade);
    /* The supplier: the library lets this shop in, and its upload to this part is allowed. */
    const profile = { vendor_profile_id: 'S89V-LAB0000001', services } as unknown as VendorProfileRow;
    const access = moodboardLibraryAccessForProfile(profile, fallbackInspirationParts());
    assert.ok(access.allowed && access.slots.some((s) => s.key === p.slot), `a ${WEDDING_TILE_LABEL[trade]} shop cannot open the library at ${p.label}`);
    const verdict = slotUploadVerdict(p.slot, services, fallbackInspirationParts());
    assert.ok(verdict.allowed, `a ${WEDDING_TILE_LABEL[trade]} shop is refused ${p.label}`);
    /* Setnayan approves it: the row is published (the public read is approved_at set, retired_at null). */
    const row: RawGalleryRow = {
      asset_id: `lab-${p.slot}`,
      label: `Our ${p.label.toLowerCase()}`,
      storage_path: `https://lab.invalid/${p.slot}.jpg`,
      vendor_profile_id: 'S89V-LAB0000001',
      shop: { business_name: 'Bloom & Vine', services, business_slug: 'bloom-and-vine' },
      ranges: [{ slot_id: 1, sampled_hex: '#5B4A6B' }],
      is_event_linked: false,
    };
    /* The couple: Search ideas on THAT part asks for THAT slot, and the photo comes back credited to the shop. */
    const q = normalizeGalleryQuery({ slotKey: p.slot }, fallbackInspirationParts());
    assert.ok(q && q.slotKey === p.slot, `Search ideas on ${p.label} cannot ask for ${p.slot}`);
    const page = shapeGalleryPage(q!.slotKey, [row], fallbackInspirationParts());
    assert.equal(page.withheld, 0, `${p.label}: the approved photo was withheld`);
    assert.equal(page.assets.length, 1);
    assert.equal(page.assets[0]!.credit, `Bloom & Vine · ${WEDDING_TILE_LABEL[trade]}`, `${p.label}: not credited to the shop by its trade`);
    assert.equal(page.assets[0]!.shopSlug, 'bloom-and-vine');
    /* …and a shop whose trade does not dress this part is refused it, in plain words. */
    const stranger = allTiles.find((t) => !trades.includes(t) && canonicalServicesForTile(t).every((c) => !trades.some((x) => canonicalServicesForTile(x).includes(c))) && canonicalServicesForTile(t).length > 0)!;
    const refused = slotUploadVerdict(p.slot, canonicalServicesForTile(stranger), fallbackInspirationParts());
    assert.ok(!refused.allowed && refused.reason === 'wrong_trade', `${p.label} was open to a ${WEDDING_TILE_LABEL[stranger]} shop`);
    assert.match(refused.message, new RegExp(`cover ${p.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`), `${p.label}: the refusal does not name the part by its name`);
  }
});

test('4 · the way in: Today and Shop draw “Add to the inspiration library” for a shop the library lets in, and Shop’s tab stays lit', async () => {
  assert.equal(INSPIRATION_LIBRARY_HREF, '/vendor-dashboard/moodboard-library');
  assert.equal(INSPIRATION_LIBRARY_ROW.label, 'Add to the inspiration library');

  /* Today — drawn: the row is IN the Shop group, after How is business, and only when `library` is true. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('../app/vendor-dashboard/_components/supplier-today-screen');
  const { assembleSupplierToday } = await import('./supplier-today-view');
  const NOW = Date.parse('2026-10-19T02:00:00Z');
  const view = assembleSupplierToday({
    needsAnswer: [],
    closed: [],
    deskIncomplete: false,
    upcoming: [],
    schedules: { pools: [{ id: 'main', name: 'Main team' }], outside: [], complete: true },
    firstSteps: null,
    verified: true,
    findable: true,
    findability: null,
    feeBills: [],
    feeEnforced: true,
    earnings: { confirmedPhp: 0, expectedPhp: 0, paydayMeasured: true },
    credit: null,
    payoutReadiness: 'ready',
    payoutHref: '/vendor-dashboard/shop',
    shop: { name: 'Bloom & Vine', categoryWord: 'Florist', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 12,
    inquiries28: 3,
    dayFacts: null,
    todayIso: '2026-10-19',
    now: NOW,
    since: () => new Date(NOW),
  } as unknown as Parameters<typeof assembleSupplierToday>[0]);
  const noop = async () => {};
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  const draw = (library: boolean) =>
    renderToStaticMarkup(
      React.createElement(SupplierTodayScreen, { view, outcome: null, feeForecasts: {}, cards: [], askStatus: '', deskIncomplete: false, actions, library }),
    );
  const on = draw(true);
  const shop = on.slice(on.indexOf('data-today-shop'));
  const row = shop.indexOf(`href="${INSPIRATION_LIBRARY_HREF}"`);
  assert.ok(row > 0, 'Today does not draw the library row in the Shop group');
  assert.ok(row > shop.indexOf('/vendor-dashboard/performance'), 'the library row is not under How is business');
  const words = shop.slice(row).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(words, /Add to the inspiration library Your photos help couples find you/);
  assert.equal(draw(false).includes(INSPIRATION_LIBRARY_HREF), false, 'Today draws the row for a shop the library would refuse');
  const page = code('app/vendor-dashboard/page.tsx');
  // The shared predicate first; since 2026-10-23 also "not while it is a first step still to do" (personal invite B6).
  /* ③0-b: the predicate is asked of the LIVE parts (`getInspirationParts()`), the snapshot the real upload gate reads. */
  assert.match(page, /const inspirationPartsRead = getInspirationParts\(\);/, 'the Today page does not read the live parts');
  assert.match(page, /const libraryOpen = moodboardLibraryAccessForProfile\(profile, await inspirationPartsRead\)\.allowed;/, 'the Today page does not ask the shared predicate of the live parts');
  assert.match(page, /library=\{\s*libraryOpen\b/, 'the Today page does not pass the shared predicate');
  const screen = code('app/vendor-dashboard/_components/supplier-today-screen.tsx');
  assert.match(screen, /library=\{library\}/, 'the Today screen drops the flag');

  /* Shop — Your shop, beside Your collections, behind the same predicate (one row per component, counted). */
  const shopSrc = code('app/vendor-dashboard/shop/page.tsx');
  assert.equal((shopSrc.match(/href=\{INSPIRATION_LIBRARY_HREF\}/g) ?? []).length, 1, 'Shop must draw the library row exactly once');
  const at = shopSrc.indexOf('data="shop-inspiration-library"');
  assert.ok(at > shopSrc.indexOf('data="shop-collections"'), 'the library row is not under Your collections');
  assert.match(shopSrc.slice(at - 200, at), /\{data\.libraryOpen \? \(/, 'Shop draws the row without asking whether the library lets the shop in');
  assert.match(shopSrc, /libraryOpen: moodboardLibraryAccessForProfile\(profile, await getInspirationParts\(\)\)\.allowed/);

  /* The bottom nav lights Shop on the library's page (a door that leaves the tab unlit reads as lost). */
  const nav = code('app/vendor-dashboard/_components/vendor-bottom-nav.tsx');
  assert.match(nav, /'\/vendor-dashboard\/moodboard-library'/);
});

/* 🤝🖼 THE SAME CHAIN, ON AN EVENT (owner 2026-10-19, "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE
 * INCLUDED" + "FIVE CONTROLLER RECOMMENDATIONS APPROVED" item 4): a supplier BOOKED on the event may SUGGEST a photo to
 * every couple part its trade dresses, and to no other — the one map, the library's own `slotUploadVerdict`. */
test('5 · every couple part takes a suggestion from a booked shop of each of its trades — and from no other trade', async () => {
  const { suggestablePartsForShop } = await import('./inspiration-suggestion-parts');
  const allTiles = Object.keys(WEDDING_TILE_LABEL) as WeddingTile[];
  for (const p of COUPLE_PARTS) {
    const trades = MOODBOARD_SLOT_TRADES[p.slot as keyof typeof MOODBOARD_SLOT_TRADES];
    for (const t of trades) {
      const offered = suggestablePartsForShop(canonicalServicesForTile(t), fallbackInspirationParts());
      assert.ok(offered.some((x) => x.key === p.slot && x.label === p.label), `a booked ${WEDDING_TILE_LABEL[t]} shop cannot suggest a photo to ${p.label}`);
    }
    const wanted = new Set(trades.flatMap((t) => canonicalServicesForTile(t)));
    for (const t of allTiles) {
      const services = canonicalServicesForTile(t);
      if (services.some((c) => wanted.has(c))) continue;
      assert.ok(!suggestablePartsForShop(services, fallbackInspirationParts()).some((x) => x.key === p.slot), `a ${WEDDING_TILE_LABEL[t]} shop may suggest to ${p.label}, which its trade does not dress`);
    }
  }
});
