/**
 * shop-back.test.ts — A SHOP PAGE'S "BACK" GOES WHERE THE PERSON CAME FROM, ON EVERY SCREEN IT OPENS.
 *
 * Owner, 7 Nov 2026, verbatim: *"there are links on the supplier website that is incorrect. example. back to
 * suppliers? it went to a wrong shell … i tapped setnaprod then pressed inquire. then pressing back to suppliers led
 * to this."* — `/explore`, from a shop he opened on Discover. The foot of Inquire was a fixed `href="/explore"`.
 *
 * What it holds:
 *   1. THE RULE (`shopBackDoor`): Discover → `/`, the marketplace → `/explore`, a saved supplier → Saved suppliers,
 *      an event (checked) → that event's Suppliers; an explicit origin beats the event; no arrival → a door that does
 *      NOT say "Back". No arrival other than `explore` ever lands on `/explore` under a "Back" label.
 *   2. THE ROUND TRIP: every screen the shop opens (Check a date, the reviews pager, the event picker, the waitlist,
 *      the booth) carries the arrival on and back, so the door at the end is the same door as at the start.
 *   3. THE WIRING, read from source: the shop page draws the foot from `shopBackDoor`, the sub-screens use
 *      `withShopArrival`, the doors in say where they are, and Share never sends where YOU came from.
 *
 *   4. THE TOP-LEFT ‹ (2026-11-12, DECISION_LOG "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"; owner: "when we
 *      enter a shop, event or anything, we should be able to go back to home"): the shop page draws the shipped
 *      `BackButton` in its header, before the page's content, for everyone, returning in place; its address is the
 *      arrival's own door (`shopTopBack` agrees with `shopBackDoor`), cold it is Discover signed out and Home signed
 *      in; and the foot door is drawn only cold ("The low button stays for cold arrivals") — never two "Back"s.
 *
 * Sabotage (each must fail): put `<Link href="/explore" …>Back to suppliers` back on the shop page; return
 * `/explore` for `discover`; make "See the shop" on Check a date a bare `/v/${…}`; drop `withShopArrival` from the
 * Discover shelf's ShopCard. 2026-11-12: drop the header `<BackButton … inPlace />`; make `shopTopBack`'s cold
 * signed-out fallback `/explore`; draw the foot door with an arrival too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { pageHome } from '@/lib/page-home';
import {
  SHOP_ARRIVAL_SRC,
  arrivalParams,
  shareableShopUrl,
  shopBackDoor,
  shopHrefForEvent,
  shopTopBack,
  withShopArrival,
} from '@/lib/shop-back';

import { WEB } from '@/lib/design-rules-scan';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EVENT = 'c0ffee00-0000-4000-8000-000000000001';

/* ── 1 · the rule ─────────────────────────────────────────────────────────────────────────────────────── */

const CASES: ReadonlyArray<[string, { src: string | null; eventId: string | null }, string, boolean]> = [
  ['Discover shelf', { src: 'discover', eventId: null }, '/', true],
  ['Discover search', { src: 'search', eventId: null }, '/', true],
  ['the marketplace', { src: 'explore', eventId: null }, '/explore', true],
  ['a saved supplier', { src: 'favorites', eventId: null }, '/dashboard?seg=memories&tab=vendors', true],
  ["an event's Suppliers", { src: null, eventId: EVENT }, `/dashboard/${EVENT}/vendors`, true],
  ['the marketplace, then an event picked', { src: 'explore', eventId: EVENT }, '/explore', true],
  ['Discover, then an event picked', { src: 'discover', eventId: EVENT }, '/', true],
  ['a Journal credit (no back of its own)', { src: 'editorial', eventId: null }, '/explore', false],
  ['a shared link', { src: null, eventId: null }, '/explore', false],
];

for (const [who, arrival, href, back] of CASES) {
  test(`from ${who} → ${href}${back ? '' : ' (not called "Back")'}`, () => {
    const door = shopBackDoor(arrival);
    assert.equal(door.href, href);
    assert.equal(door.back, back);
    assert.equal(/^Back\b/.test(door.label), back, `"${door.label}" must say Back only when it goes back`);
  });
}

test('"Back" never lands on /explore unless the visit came from /explore', () => {
  for (const s of [null, ...Object.values(SHOP_ARRIVAL_SRC), 'editorial', 'nonsense']) {
    for (const eventId of [null, EVENT]) {
      const door = shopBackDoor({ src: s, eventId });
      if (door.back && door.href === '/explore') assert.equal(s, 'explore', `src=${s} event=${eventId}`);
    }
  }
});

test('the map says the shop page works its back out per visit, in this module', () => {
  assert.deepEqual(pageHome('/v/[slug]'), { kind: 'none', reason: 'computed', by: 'lib/shop-back.ts' });
  // Its sub-screens go back to the shop page itself.
  for (const r of ['/v/[slug]/dates', '/v/[slug]/booth', '/v/[slug]/guest-review']) {
    const h = pageHome(r);
    assert.ok(h.kind === 'home' && h.home === '/v/[slug]', r);
  }
});

/* ── 2 · the round trip ─────────────────────────────────────────────────────────────────────────────── */

test('every screen the shop opens carries the arrival there and back', () => {
  for (const [, arrival] of CASES) {
    const before = shopBackDoor(arrival);
    const out = [
      withShopArrival('/v/setnaprod/dates', arrival),
      withShopArrival('/setnaprod?reviewsPage=2#reviews', arrival),
      withShopArrival('/v/setnaprod/booth', arrival),
      withShopArrival('/setnaprod', arrival, { wl: 'joined' }),
    ];
    for (const href of out) {
      const q = new URLSearchParams(href.split('#')[0]!.split('?')[1] ?? '');
      const raw = arrivalParams({ src: q.get('src') ?? undefined, event: q.get('event') ?? undefined });
      // The shop page re-checks the event on arrival; here the event is one of the viewer's own.
      const after = shopBackDoor({ src: raw.src, eventId: raw.event });
      assert.deepEqual(after, before, href);
    }
  }
  assert.equal(withShopArrival('/x?reviewsPage=2#reviews', { src: 'discover' }), '/x?reviewsPage=2&src=discover#reviews');
  assert.equal(shopHrefForEvent('setnaprod', EVENT, '#reviews'), `/v/setnaprod?event=${EVENT}#reviews`);
});

test('Share sends the shop page, never where this visitor came from', () => {
  assert.equal(
    shareableShopUrl(`https://www.setnayan.com/setnaprod?src=discover&event=${EVENT}&service=S89X-1#get-in-touch`),
    'https://www.setnayan.com/setnaprod?service=S89X-1#get-in-touch',
  );
});

/* ── 3 · the wiring ─────────────────────────────────────────────────────────────────────────────────── */

test('the shop page draws its back door from shopBackDoor — no fixed /explore "Back"', () => {
  const page = src('app/v/[slug]/page.tsx');
  assert.ok(!/<Link[^>]*href="\/explore"[^>]*>\s*Back to/.test(page), 'a fixed /explore "Back to suppliers" is back');
  assert.match(page, /shopBackDoor\(shopArrival\)/);
  assert.match(page, /<Link href=\{shopBack\.href\}[^>]*>\s*\{shopBack\.label\}/);
  // Every way out that comes back to the shop carries the arrival.
  assert.match(page, /CheckADateLink\s+href=\{withShopArrival\(/);
  assert.match(page, /moreHref=\{withShopArrival\(/);
  // 13 Nov 2026: the foot "which celebration" picker left with the inline composer; the choice is asked inside the
  // pop-up and "Add to your event", neither of which navigates — so there is no picked-row link left to carry it.
  assert.match(page, /name="src" value=\{shopArrival\.src\}/, 'the waitlist form carries the arrival');
  // Only an event the page CHECKED may be "where you came from" — never the events[0] fallback.
  assert.match(page, /arrivalEventId = chosen\?\.event_id \?\? null;/);
});

test('Check a date, the booth and the waitlist send you back onto the shop with the arrival', () => {
  const cal = src('app/v/[slug]/dates/_components/check-a-date-calendar.tsx');
  assert.ok(!/href=\{`\/v\/\$\{encodeURIComponent\(shop\.slug\)\}`\}/.test(cal), '"See the shop" dropped the arrival');
  assert.equal((cal.match(/label="See the shop" href=\{shopHref\}/g) ?? []).length, 2);
  assert.match(src('app/v/[slug]/dates/page.tsx'), /withShopArrival\(`\/v\/\$\{encodeURIComponent\(slug\)\}`, arrival\)/);
  assert.match(src('app/v/[slug]/booth/page.tsx'), /withShopArrival\(`\/v\/\$\{slug\}`/);
  const wl = src('app/v/[slug]/waitlist-actions.ts');
  assert.ok(!/redirect\(`\$\{backTo\}\?wl=/.test(wl), 'a waitlist redirect dropped the arrival');
  assert.match(wl, /withShopArrival\(backTo, arrival/);
});

test('the doors into a shop say where they are', () => {
  assert.match(src('app/_components/frontdoor/front-door-feed.tsx'), /withShopArrival\(s\.href, \{ src: SHOP_ARRIVAL_SRC\.discover \}\)/);
  assert.match(src('app/_components/frontdoor/front-door-results.tsx'), /withShopArrival\(s\.href, \{ src: SHOP_ARRIVAL_SRC\.search, q: query \}\)/);
  assert.match(src('app/(shell)/explore/_components/vendor-card.tsx'), /\?src=explore/);
  for (const rel of [
    'app/dashboard/[eventId]/vendors/categories/page.tsx',
    'app/dashboard/[eventId]/vendors/packages/[bookingId]/page.tsx',
    'app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx',
    'app/dashboard/[eventId]/vendors/[vendorId]/review/_components/review-thanks.tsx',
  ]) {
    const s = src(rel);
    assert.match(s, /shopHrefForEvent\(/, rel);
    assert.ok(!/[`'"]\/v\/\$\{/.test(s), `${rel} opens a shop without its event`);
  }
});

test('Share uses the shareable address', () => {
  assert.match(src('app/v/[slug]/_components/share-button.tsx'), /shareableShopUrl\(window\.location\.href\)/);
});

/* ── 4 · the top-left ‹ (2026-11-12, "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED") ──────────────────────────────── */

test('‹ cold: Discover for someone signed out, Home for someone signed in', () => {
  assert.deepEqual(shopTopBack({ src: null, eventId: null }, false), { href: '/', label: 'Discover' });
  assert.deepEqual(shopTopBack({ src: null, eventId: null }, true), { href: '/dashboard?hub=1', label: 'Home' });
  // A tag with no back of its own is a cold arrival too.
  assert.deepEqual(shopTopBack({ src: 'editorial', eventId: null }, false), { href: '/', label: 'Discover' });
});

test('‹ with an arrival goes to the SAME place as the arrival’s own door, named as a place', () => {
  for (const [who, arrival, , back] of CASES) {
    if (!back) continue;
    for (const signedIn of [false, true]) {
      const top = shopTopBack(arrival, signedIn);
      assert.equal(top.href, shopBackDoor(arrival).href, `${who}: the top ‹ and the arrival's door disagree`);
      assert.ok(!/^Back\b/.test(top.label) && /^[A-Z]/.test(top.label), `${who}: "${top.label}" is not a place's name`);
    }
  }
  assert.equal(shopTopBack({ src: 'discover', eventId: null }, false).label, 'Discover');
  assert.equal(shopTopBack({ src: 'explore', eventId: null }, true).label, 'Suppliers');
  assert.equal(shopTopBack({ src: 'favorites', eventId: null }, true).label, 'Saved suppliers');
});

test('the shop page draws the shipped BackButton at the top left, returning in place, before its content', () => {
  const page = src('app/v/[slug]/page.tsx');
  assert.match(page, /from '@\/app\/_components\/back-button'/);
  assert.match(page, /const shopTop = shopTopBack\(shopArrival, viewerSignedIn\)/);
  const btn = page.search(/<BackButton href=\{shopTop\.href\} label=\{shopTop\.label\}[^>]*\binPlace\b[^>]*\/>/);
  assert.ok(btn > -1, 'the top-left ‹ is gone (or no longer returns in place)');
  const header = page.indexOf('<header className="border-b border-ink/5">');
  const wordmark = page.indexOf('<Wordmark size={22} />');
  const article = page.indexOf('<article');
  assert.ok(header > -1 && header < btn, 'the ‹ left the page header');
  assert.ok(btn < wordmark, 'the ‹ is not at the top LEFT (it sits after the wordmark)');
  assert.ok(btn < article, 'the ‹ is not before the page content');
  assert.equal((page.match(/<BackButton\b/g) ?? []).length, 1, 'one back button on the shop page, not two');
});

test('the foot door is drawn only for a cold arrival — never a second "Back"', () => {
  const page = src('app/v/[slug]/page.tsx');
  assert.match(
    page,
    /\{!shopBack\.back \? \(\s*<Link href=\{shopBack\.href\}[^>]*data-shop-back="cold"[^>]*>\s*\{shopBack\.label\}\s*<\/Link>\s*\) : null\}/,
    'the foot door is drawn with an arrival too — two backs on one page',
  );
});
