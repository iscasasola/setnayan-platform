/**
 * 🎁 THE GUEST'S WISH LIST FOLLOWS THE APPROVED DRAWING (owner 2026-10-08, "ok
 * wish list" · "per item"; design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2
 * "Guest" + § 6 E-PR3; prototype `egifts_wish_list_2026-10-08_fable.html` frames
 * 12–17 · 21–24).
 *
 * The REAL list and the REAL gift door are rendered on the prototype's seed and
 * read back:
 *
 *   1 · Rows (The door): each wish's line, "4 wishes · 1 got", the got wish last,
 *       struck, "Got it ✓ · thank you", and the one line that says how;
 *   2 · the four looks are four drawings of the SAME list — no picker of its own;
 *   3 · a wish that reached its price is got; a long list keeps its got wishes at
 *       the end; a list with no prices says "Any amount" and marks nothing;
 *   4 · 🔒 the rendered list holds no giver's name, words or screenshot;
 *   5 · the door's one extra line — only while a wish is open, never on a solemn
 *       page, and never without a door;
 *   6 · the page: the list sits ABOVE the ways to give, is shown by the Studio's
 *       own one-setting rule, wears the picked E-Gifts look, and hands its send
 *       sheet the page's own (withheld) cards;
 *   7 · the guest read takes the sum's three columns and the guest's wish columns
 *       — never the couple's full record;
 *   8 · "I sent it" and the sentence that promises it are drawn only when the page says who is reading.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • the got styling (struck / dashed) dropped                         → 1 red;
 *   • every look drawn as rows                                          → 2 red;
 *   • the door line drawn on a solemn page                              → 5 red;
 *   • the list mounted BELOW the ways to give                           → 6 red;
 *   • the sheet handed `methods` (identifiers not withheld)             → 6 red;
 *   • the page drawing the list without `wishListShownToGuests`         → 6 red;
 *   • the guest read selecting `GIFT_RECORD_SELECT`                     → 7 red;
 *   • the screenshot sentence printed with no reader handed in         → 8 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { labGuestWishList, type LabGuestWishState } from '../app/dev/details-lab/wish-list-fixture';
import { GUEST_WISH_HOW, type WishListShape } from './wish-list-guest';
import { resolveGuestDoorways } from '../app/[slug]/_lib/site-nav';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const flat = (rel: string) => read(rel).replace(/\s+/g, ' ');

/** What a person reads: tags out, entities back, spaces settled. */
const words = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

async function list(state: LabGuestWishState, shape: WishListShape = 'rows', extra: Record<string, unknown> = {}): Promise<string> {
  const { WishList } = await import('../app/[slug]/pabuya/_components/wish-list');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const view = labGuestWishList(state);
  assert.ok(view.read);
  return renderToStaticMarkup(
    React.createElement(WishList, {
      wishes: view.wishes,
      shape,
      hostName: 'Maria & Jose',
      hostPossessive: 'Maria & Jose’s',
      ways: React.createElement('ul', { 'data-ways': '' }),
      ...extra,
    }),
  );
}

test('1 · Rows: each wish’s line, the count, the got wish last and struck, and how to send', async () => {
  const html = await list('five');
  const text = words(html);
  assert.match(html, /data-wish-list="" data-wish-look="rows"/);
  assert.match(text, /Wish list 4 wishes · 1 got/);
  assert.match(text, /Air fryer ₱4,000 of ₱4,500 sent/);
  assert.match(text, /Rice cooker ₱3,200/);
  assert.match(text, /Luggage set ₱3,000 of ₱8,900 sent/);
  assert.match(text, /Coffee maker ₱6,000/);
  assert.match(text, /Bed linen Got it ✓ · thank you/);
  assert.ok(text.includes(GUEST_WISH_HOW));

  const order = [...html.matchAll(/data-wish="(open|got)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['open', 'open', 'open', 'open', 'got']);
  const got = html.slice(html.indexOf('data-wish="got"'));
  assert.match(got, /border-dashed/, 'a got wish is dashed');
  assert.match(got, /line-through/, 'a got wish’s name is struck through');
  assert.equal(html.match(/data-wish-meter="filling"/g)?.length, 2, 'a meter only where something was sent');
  assert.equal(html.match(/data-wish-meter="got"/g)?.length, 1);
  assert.equal(html.match(/data-wish-no-photo=""/g)?.length, 5, 'a wish with no photo draws the gift glyph, never an empty square');
  assert.doesNotMatch(html, /data-wish-send=""/, 'the sheet is closed until a wish is tapped');
});

test('2 · the four looks are four drawings of one list', async () => {
  const by: Record<WishListShape, string> = {
    rows: await list('five', 'rows'),
    side: await list('five', 'side'),
    tiles: await list('five', 'tiles'),
    ruled: await list('five', 'ruled'),
  };
  for (const s of ['rows', 'side', 'tiles', 'ruled'] as const) {
    assert.match(by[s], new RegExp(`data-wish-look="${s}"`));
    assert.equal([...by[s].matchAll(/data-wish="(open|got)"/g)].length, 5, `${s} lost a wish`);
    assert.match(words(by[s]), /Air fryer ₱4,000 of ₱4,500 sent/, `${s} lost the line`);
  }
  /* Rows: bordered rows with an arrow. Side rule: a rule down the left, no box. */
  assert.match(by.rows, /rounded-2xl border border-ink\/10/);
  assert.match(by.side, /border-l-2 border-gild/);
  assert.doesNotMatch(by.side, /rounded-2xl border border-ink\/10/);
  /* Tiles: two across, the photo on top, no arrow, centred head. */
  assert.match(by.tiles, /grid grid-cols-2/);
  assert.match(by.tiles, /h-\[110px\] w-full/);
  /* Ruled: between two rules, no boxes. */
  assert.match(by.ruled, /border-y border-gild\/70/);
  assert.doesNotMatch(by.ruled, /rounded-2xl border/);
  const arrows = (h: string) => h.match(/lucide-arrow-right/g)?.length ?? 0;
  assert.equal(arrows(by.rows), 5);
  assert.equal(arrows(by.side), 5);
  assert.equal(arrows(by.tiles), 0);
  assert.equal(arrows(by.ruled), 0);
  assert.notEqual(by.rows, by.tiles, 'every look drew the same thing');
});

test('3 · a reached wish is got; a long list sinks its got wishes; no prices means "Any amount"', async () => {
  const got = words(await list('got'));
  assert.match(got, /3 wishes · 2 got/);
  assert.match(got, /Air fryer Got it ✓ · thank you/);

  const long = await list('long');
  assert.match(words(long), /11 wishes · 3 got/);
  const order = [...long.matchAll(/data-wish="(open|got)"/g)].map((m) => m[1]);
  assert.equal(order.length, 14);
  assert.deepEqual(order.slice(11), ['got', 'got', 'got'], 'a got wish was left among the open ones');
  assert.ok(!order.slice(0, 11).includes('got'));

  const none = await list('noprice');
  const text = words(none);
  assert.match(text, /5 wishes/);
  assert.doesNotMatch(text, /got/i, 'a wish with no price marked itself');
  assert.match(text, /Air fryer Any amount · ₱4,000 sent so far/);
  assert.match(text, /Rice cooker Any amount/);
  assert.doesNotMatch(none, /data-wish-meter/, 'a wish with no price has no meter to fill');
});

test('4 · 🔒 the rendered list holds no giver’s name, words or screenshot', async () => {
  for (const state of ['five', 'got', 'long', 'noprice'] as const) {
    const html = await list(state);
    for (const priv of ['Tita Nene', 'Kuya Jun', 'Ate Grace', 'Lola Cely', 'Ninong Bert', 'merienda', 'gift-shots', 'r2://']) {
      assert.ok(!html.includes(priv), `${state}: "${priv}" reached a guest`);
    }
  }
});

test('5 · the door’s extra line: only with a door, only while a wish is open, never on a solemn page', async () => {
  const { WelcomeGifts } = await import('../app/[slug]/_components/guest-doorway-strip');
  const { eventWordsFor } = await import('../app/[slug]/_lib/event-words');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const wedding = await eventWordsFor('wedding');
  const door = (wishes: number, w = wedding) => renderToStaticMarkup(React.createElement(WelcomeGifts, { href: '/maria-and-jose/pabuya', words: w, wishes }));

  const four = door(4);
  assert.match(words(four), /E-Gifts .* Wish list · 4 things they’d love/);
  assert.equal(four.match(/data-door-extra=""/g)?.length, 1);
  assert.match(words(door(1)), /Wish list · 1 thing they’d love/);
  assert.doesNotMatch(door(0), /data-door-extra/, 'no open wish, no line');
  assert.equal(door(0), renderToStaticMarkup(React.createElement(WelcomeGifts, { href: '/maria-and-jose/pabuya', words: wedding })), 'a door with no wishes is exactly the shipped door');

  const solemn = { ...wedding, solemn: true };
  assert.doesNotMatch(door(4, solemn), /data-door-extra|they’d love/, '"things they’d love" on a solemn page');

  /* No door → no count, whatever was read. */
  const facts = { slug: 'maria-and-jose', seatingSurfaceEnabled: false, seatingPublished: false, pabuyaRouteEnabled: true, enabledEgiftCount: 1, pabuyaViewerAllowed: true };
  assert.equal(resolveGuestDoorways({ ...facts, openWishCount: 4 }).wishes, 4);
  assert.equal(resolveGuestDoorways({ ...facts }).wishes, 0);
  assert.equal(resolveGuestDoorways({ ...facts, enabledEgiftCount: 0, openWishCount: 4 }).wishes, 0, 'a wish count with no way to give');
  assert.equal(resolveGuestDoorways({ ...facts, pabuyaViewerAllowed: false, openWishCount: 4 }).wishes, 0);
  assert.equal(resolveGuestDoorways({ ...facts, pabuyaRouteEnabled: false, openWishCount: 4 }).wishes, 0);
});

test('6 · the page: above the ways to give, by the one-setting rule, in the picked look, with the page’s own cards', () => {
  const page = flat('app/[slug]/pabuya/page.tsx');
  const body = page.slice(page.indexOf('return ( <main'));
  const listAt = body.indexOf('<WishList');
  const waysAt = body.indexOf('<PabuyaCardList methods={cards} />');
  assert.ok(listAt > 0 && waysAt > listAt, 'the wish list is not above the ways to give');
  const wordsAt = body.indexOf('event.pabuya_message');
  assert.ok(wordsAt > 0 && wordsAt < listAt, 'the couple’s words come before the list');

  /* Shown by the Studio's own rule — and never drawn from a read that failed. */
  assert.match(
    page,
    /const wishes = wishRead\.read && wishListShownToGuests\(\{ giftsOn: event\.gifts_on, methods, wishCount: wishRead\.wishes\.length \}\) \? wishRead\.wishes : \[\];/,
  );
  assert.match(body, /\{wishes\.length > 0 \? \( <WishList/);
  assert.match(page, /fetchEgiftMethods\(admin, event\.event_id, \{ enabledOnly: true, \}\)/, 'the rule must be asked of the ENABLED ways');

  /* The picked E-Gifts look — the Invitation's gift door's — and no other source. */
  assert.match(page, /const wishShape = wishListShape\(partLookAttr\('gifts', fixedSceneStyleOf\(event\.style_preferences, 'gifts', 'rsvp', event\.event_type\)\)\);/);

  /* 🔒 The send sheet is handed `cards` (identifiers withheld from an unrecognised reader), never `methods`. */
  const mount = body.slice(listAt, body.indexOf('/>', body.indexOf('ways={', listAt) + 400) + 2);
  assert.match(mount, /<PabuyaCardList methods=\{cards\} idScope="wish-send-handle" \/>/);
  assert.doesNotMatch(body, /methods=\{methods\}/, 'a list of ways is drawn from the unwithheld rows');
  assert.match(mount, /\{identifiersWithheld \? \(/, 'the sheet does not say that something is withheld');

  /* The list itself never touches a method. */
  const wl = read('app/[slug]/pabuya/_components/wish-list.tsx');
  assert.doesNotMatch(wl, /egift|PabuyaCardList|qrUrl|handle\b/, 'the wish list reads payment details itself');
});

test('7 · the guest read takes the sum and the guest’s wish columns — never the couple’s full record', () => {
  const server = flat('lib/wish-list.server.ts');
  const guest = server.slice(server.indexOf('export async function readGuestWishList('));
  assert.ok(guest.length > 100, 'readGuestWishList is gone');
  assert.match(guest, /\.from\('event_wish_items'\) \.select\(WISH_GUEST_FIELDS\) \.eq\('event_id', eventId\)/);
  assert.match(guest, /\.from\('event_gift_records'\)\.select\(GIFT_SUM_FIELDS\)\.eq\('event_id', eventId\)/);
  assert.doesNotMatch(guest, /GIFT_RECORD_SELECT|WISH_ITEM_SELECT|giver_name|screenshot|message/, 'the guest path reads a giver’s record');
  assert.match(guest, /if \(wishRes\.error \|\| sumRes\.error \|\| !wishRes\.data \|\| !sumRes\.data\) return \{ read: false \};/);

  /* The Welcome door asks through the same reader, and only when the page would draw the list. */
  const loaders = flat('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /const wishRead = pabuyaRouteEnabled && enabledEgiftCount > 0 \? await readGuestWishList\(admin, eventId\) : null;/);
  assert.match(loaders, /openWishCount: wishRead\?\.read \? openWishCount\(wishRead\.wishes\) : 0,/);
});

test('8 · "I sent it" is drawn only when the page says who is reading', async () => {
  const wl = flat('app/[slug]/pabuya/_components/wish-list.tsx');
  /* The screenshot sentence and "I sent it" exist only when the next step is handed in. */
  assert.match(wl, /\{record \? ` Once you’ve sent it, show \$\{hostName\} your screenshot — that is how this wish fills up\.` : null\}/);
  assert.match(wl, /\{record \? \( <button type="button" data-wish-i-sent-it=""/, '"I sent it" is drawn without knowing who is reading');
  /* The step IS built since wish list 4/5: the page hands in who is reading. */
  const page = flat('app/[slug]/pabuya/page.tsx');
  const mount = page.slice(page.indexOf('<WishList'), page.indexOf('{cards.length > 0 ?'));
  assert.match(mount, /record=\{giftReader\} \/>/, 'the page no longer hands the list its reader');
  /* Closed, the list renders no sheet at all. */
  assert.doesNotMatch(await list('five'), /I sent it|screenshot/);
});
