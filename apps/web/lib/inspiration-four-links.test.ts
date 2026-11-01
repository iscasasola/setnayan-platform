/**
 * inspiration-four-links.test.ts — 🔗🖼 A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS (owner 2026-10-30,
 * DECISION_LOG row of that name). The rules and the doors; the schema half is
 * `tests/db/an-inspiration-photo-names-its-own-card.db.test.ts`.
 *
 *   1 · THE CARD: only this shop's LIVE cards whose Service links the part; exactly one fit is preselected; a card of
 *       another shop, a paused card or a card for another part is refused in words; a refused card read FAILS CLOSED.
 *   2 · THE THREE SHEETS each carry the one dropdown, and the server re-checks what they send (never trusts it).
 *   3 · THE POOL: a suggestion reaches the library only through the library's own door (storeScreenedAsset — no second
 *       insert), PENDING (nothing writes approved_at), with the quota decided before the bytes are stored, and an
 *       EVENT-ALBUM photo refused before anything is read.
 *   4 · THE PAGE'S READ asks for exactly the public pool narrowed to one shop, and never reads the event id.
 */
import '../tests/db/supabase-over-pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  CARD_REFUSAL,
  cardChoicesByPart,
  cardVerdict,
  cardsForPart,
  preselectedCard,
  type ShopCardRow,
} from '@/lib/inspiration-card-link';
import { isFromAlbumPageRef } from '@/lib/put-photo-on-my-page';
import { fallbackInspirationParts } from '@/lib/inspiration-parts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const row = (o: Partial<ShopCardRow> & Pick<ShopCardRow, 'vendor_service_id' | 'category'>): ShopCardRow => ({
  title: null,
  starting_price_php: 25000,
  is_active: true,
  is_linked_only: false,
  ...o,
});
const FLORALS = row({ vendor_service_id: 'card-florals', category: 'florals', title: 'Bridal bouquets' });
const LIGHTS = row({ vendor_service_id: 'card-lights', category: 'lights_sound' });
const PAUSED = row({ vendor_service_id: 'card-paused', category: 'florals', is_active: false });
const LINKED = row({ vendor_service_id: 'card-linked', category: 'florals', is_linked_only: true });

/* ── 1 · the card ───────────────────────────────────────────────────────── */

test('1 · only LIVE cards whose Service links the part are offered', () => {
  const fit = cardsForPart([FLORALS, LIGHTS, PAUSED, LINKED], ['florals', 'florist']);
  assert.deepEqual(fit.map((c) => c.vendor_service_id), ['card-florals'], 'a paused, linked-only or other-part card was offered');
});

test('1b · exactly one fit is preselected; two or none preselect nothing', () => {
  assert.equal(preselectedCard([{ id: 'a', label: 'A', priceLabel: null }]), 'a');
  assert.equal(preselectedCard([{ id: 'a', label: 'A', priceLabel: null }, { id: 'b', label: 'B', priceLabel: null }]), '');
  assert.equal(preselectedCard([]), '');
});

test('1c · the server verdict: none is fine; another shop / paused / wrong part refused; an unread list fails CLOSED', () => {
  const shopCards = [FLORALS, LIGHTS, PAUSED];
  const parts = ['florals'];
  assert.deepEqual(cardVerdict({ requested: '', shopCards, partServices: parts }), { ok: true, vendorServiceId: null });
  assert.deepEqual(cardVerdict({ requested: null, shopCards: null, partServices: parts }), { ok: true, vendorServiceId: null }, 'no card asked must not need the list');
  assert.deepEqual(cardVerdict({ requested: 'card-florals', shopCards, partServices: parts }), { ok: true, vendorServiceId: 'card-florals' });
  assert.deepEqual(cardVerdict({ requested: 'someone-elses', shopCards, partServices: parts }), { ok: false, message: CARD_REFUSAL.notYours });
  assert.deepEqual(cardVerdict({ requested: 'card-paused', shopCards, partServices: parts }), { ok: false, message: CARD_REFUSAL.notYours });
  assert.deepEqual(cardVerdict({ requested: 'card-lights', shopCards, partServices: parts }), { ok: false, message: CARD_REFUSAL.wrongPart });
  assert.deepEqual(cardVerdict({ requested: 'card-florals', shopCards: null, partServices: parts }), { ok: false, message: CARD_REFUSAL.unreadable });
});

test('1d · choices per part: [] when none fits, null when the cards could not be read', () => {
  const byPart = cardChoicesByPart({
    slots: ['bridal_bouquet', 'stage'],
    shopCards: [FLORALS],
    servicesForSlot: (s) => (s === 'bridal_bouquet' ? ['florals'] : ['stylist_decorator']),
    labelOf: (r) => r.title ?? r.category ?? '',
    priceOf: () => 'from ₱25,000',
  });
  assert.deepEqual(byPart, { bridal_bouquet: [{ id: 'card-florals', label: 'Bridal bouquets', priceLabel: 'from ₱25,000' }], stage: [] });
  assert.equal(cardChoicesByPart({ slots: ['stage'], shopCards: null, servicesForSlot: () => [], labelOf: () => '', priceOf: () => null }), null);
});

/* ── 2 · the three sheets, and the server's re-check ─────────────────────── */

test('2 · the library upload, the event import and the suggestion sheet each carry the ONE dropdown', () => {
  const editor = code('app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx');
  assert.equal((editor.match(/<InspirationCardPick\b/g) ?? []).length, 2, 'the upload or the import lost its card dropdown');
  assert.match(editor, /vendorServiceId: cardFor\(importSlot\) \|\| null/);
  const board = code('app/vendor-dashboard/clients/[eventId]/_components/supplier-suggest-board.tsx');
  assert.match(board, /<InspirationCardPick\b/);
  assert.match(board, /fd\.set\('vendorServiceId', card\)/);
  const pick = code('app/_components/inspiration-card-pick.tsx');
  assert.match(pick, /<PickMenu\b/, 'the card choice is not the shipped PickMenu');
  assert.doesNotMatch(pick, /<select\b/);
});

test('2b · every door re-checks the card against the shop it PROVED — never the id as sent', () => {
  const actions = code('app/vendor-dashboard/moodboard-library/actions.ts');
  for (const fn of ['export async function uploadStylistAsset(', 'export async function importEditorialMediaToGallery(', 'async function importSuggestionToGallery(']) {
    const at = actions.indexOf(fn);
    assert.notEqual(at, -1, fn);
    const next = actions.indexOf('\n}\n', at);
    const body = actions.slice(at, next);
    assert.match(body, /verifyCardForPart\(admin, \{\s*vendorProfileId: profile\.vendor_profile_id,/, `${fn} does not re-check the card for the caller's own shop`);
    assert.match(body, /if \(!card\.ok\) throw new Error\(card\.message\);/, `${fn} ignores a refused card`);
  }
  const sugg = code('app/vendor-dashboard/clients/[eventId]/mood-board/suggestion-actions.ts');
  assert.match(sugg, /verifyCardForPart\(admin, \{\s*vendorProfileId: door\.vendor_profile_id,/, 'the suggestion trusts a shop other than the one the SQL door proved');
  assert.match(sugg, /vendor_service_id: card\.vendorServiceId,/);
});

/* ── 3 · the pool ───────────────────────────────────────────────────────── */

test('3 · a suggestion reaches the pool only through storeScreenedAsset, PENDING, quota first, album refused first', () => {
  const actions = code('app/vendor-dashboard/moodboard-library/actions.ts');
  assert.equal((actions.match(/\.insert\(\{/g) ?? []).length, 1, 'a second insert into the library — a door around the screen');
  assert.doesNotMatch(actions, /approved_at:\s/, 'a supplier action writes approved_at — the pool copy must wait for an admin');
  const at = actions.indexOf('async function importSuggestionToGallery(');
  const body = actions.slice(at, actions.indexOf('\n}\n', at));
  const album = body.indexOf('isFromAlbumPageRef(input.sourceRef)');
  const read = body.indexOf(".from('event_inspiration_suggestions')");
  const quota = body.indexOf('backCatalogueQuotaVerdict({');
  const store = body.indexOf('storeScreenedAsset({');
  assert.ok(album > 0 && album < read, 'an album ref is not refused before anything is read');
  assert.ok(quota > 0 && quota < store, 'the quota is not decided before the bytes are stored');
  assert.match(body, /rightsWarranted/);
  assert.match(body, /source_suggestion_id: sugg\.suggestion_id,/);
  assert.match(body, /source_event_id: sugg\.event_id,/, 'the pool copy lost its event link');
  assert.match(body, /if \(!sugg\.event_vendor_id\) throw/, 'the booking is not re-checked');
  /* The suggestion send routes the pool half through that door. */
  const sugg = code('app/vendor-dashboard/clients/[eventId]/mood-board/suggestion-actions.ts');
  assert.match(sugg, /importEditorialMediaToGallery\(\{\s*suggestionId:/);
  assert.doesNotMatch(sugg, /from\('moodboard_library_assets'\)\s*\.insert/, 'the suggestion action inserts into the library itself');
});

test('3b · the suggestion quota counts suggestion pool copies too (an event link is not a quota exemption here)', () => {
  const actions = code('app/vendor-dashboard/moodboard-library/actions.ts');
  assert.match(actions, /\.not\('source_suggestion_id', 'is', null\)/);
  const upload = actions.slice(actions.indexOf('export async function uploadStylistAsset('));
  assert.match(upload.slice(0, upload.indexOf('\n}\n')), /await countQuotaUsed\(admin, profile\.vendor_profile_id, slot\.slotKey\)/);
});

test('3c · an event-album photo is never offered for a suggestion, and is recognised by its ref', () => {
  assert.equal(isFromAlbumPageRef('r2://setnayan-media/vendors/S89V-X/portfolio/from-album/a.jpg'), true);
  assert.equal(isFromAlbumPageRef('r2://setnayan-media/vendors/S89V-X/portfolio/a.jpg'), false);
  const own = code('lib/shop-own-photos.server.ts');
  assert.match(own, /if \(isFromAlbumPageRef\(ref\)\) return;/, 'the shop-photo picker offers album copies again');
  const sugg = code('app/vendor-dashboard/clients/[eventId]/mood-board/suggestion-actions.ts');
  assert.match(sugg, /sourceRef: shopPhotoRef/, 'the pool door is not told which shop photo the suggestion came from');
});

/* ── 4 · the page's read ─────────────────────────────────────────────────── */

test('4 · /v/[slug] asks for the public pool narrowed to ONE shop — and never reads the event', async () => {
  const { fetchShopInspirationLooks } = await import('@/lib/shop-inspiration.server');
  const calls: string[] = [];
  const q = {
    eq(c: string, v: string) { calls.push(`eq ${c}=${v}`); return q; },
    not(c: string) { calls.push(`not-null ${c}`); return q; },
    is(c: string) { calls.push(`null ${c}`); return q; },
    order(c: string) { calls.push(`order ${c}`); return q; },
    async range() { return { data: [], error: null, count: 0 }; },
  };
  let cols = '';
  const looks = await fetchShopInspirationLooks(
    { from: () => ({ select: (c: string) => { cols = c; return q; } }) },
    'S89V-SHOP',
    fallbackInspirationParts(),
  );
  assert.deepEqual(looks, []);
  for (const want of ['eq vendor_profile_id=S89V-SHOP', 'eq asset_type=supplier_gallery', 'not-null approved_at', 'null retired_at', 'null rejected_at']) {
    assert.ok(calls.includes(want), `the page read lost: ${want}`);
  }
  assert.match(cols, /vendor_service_id/, 'the page read lost the card link');
  assert.doesNotMatch(cols, /source_event_id|source_suggestion_id/, 'the public page reads which event a photo came from');
});

test('4b · a failed or unfinished read is null — the page then draws no section, never a partial one', async () => {
  const { fetchShopInspirationLooks } = await import('@/lib/shop-inspiration.server');
  const q = {
    eq() { return q; }, not() { return q; }, is() { return q; }, order() { return q; },
    async range() { return { data: null, error: { message: 'boom' }, count: null }; },
  };
  assert.equal(await fetchShopInspirationLooks({ from: () => ({ select: () => q }) }, 'S89V-SHOP', fallbackInspirationParts()), null);
  const page = code('app/v/[slug]/page.tsx');
  assert.match(page, /const inspirationByService = shopInspiration === null \? null : looksByCard\(shownLooks\);/);
  assert.match(page, /<ShopInspirationSection tiles=\{inspirationTiles\}/);
});
