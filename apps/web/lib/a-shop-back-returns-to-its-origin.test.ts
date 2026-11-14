/**
 * 🔙 SB (W1 SHOP-01/03/04, owner ask) — the shop page's Back returns to where the person came from.
 *   · a search hit carries its words (`q`), so Back is `/?q=<words>` — never a bare "/" that drops the search;
 *   · every door into a shop from another page of ours carries that page (`src=page&from=`), so Back returns there;
 *   · "Home" (signed in) / "Discover" (signed out) is only the COLD open — nothing of ours behind it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { arrivalParams, safeFromPath, shopBackDoor, shopTopBack, SHOP_ARRIVAL_SRC, withShopArrival } from './shop-back';
import { stripComments } from './strip-comments';

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

test('a search hit returns to its results, words and all', () => {
  const href = withShopArrival('/v/liwanag', { src: SHOP_ARRIVAL_SRC.search, q: 'lights and sound' });
  assert.equal(href, '/v/liwanag?src=search&q=lights+and+sound');
  const a = arrivalParams({ src: 'search', q: 'lights and sound' });
  assert.deepEqual(shopBackDoor({ src: a.src, eventId: null, q: a.q }), { href: '/?q=lights%20and%20sound', label: 'Back to results', back: true });
  // No words → Discover, as before; never a bare "/" labelled as the results.
  assert.equal(shopBackDoor({ src: 'search', eventId: null }).href, '/');
});

test('a door from another page of ours carries that page, checked', () => {
  const href = withShopArrival('/v/liwanag', { src: SHOP_ARRIVAL_SRC.page, from: '/u/ana-reyes' });
  assert.equal(href, '/v/liwanag?src=page&from=%2Fu%2Fana-reyes');
  const a = arrivalParams({ src: 'page', from: '/u/ana-reyes' });
  assert.deepEqual(shopBackDoor({ src: a.src, eventId: null, from: a.from }), { href: '/u/ana-reyes', label: 'Back', back: true });
  assert.deepEqual(shopTopBack({ src: 'page', eventId: null, from: '/u/ana-reyes' }, true), { href: '/u/ana-reyes', label: 'Back' });
  // Never another site, never a loop back into a shop.
  for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', '/v/other-shop', 'x'.repeat(5)]) {
    assert.equal(safeFromPath(bad), null, bad);
  }
});

test('Home / Discover only on a cold open', () => {
  assert.deepEqual(shopTopBack({ src: null, eventId: null }, true).label, 'Home');
  assert.deepEqual(shopTopBack({ src: null, eventId: null }, false).label, 'Discover');
  assert.notEqual(shopTopBack({ src: 'page', eventId: null, from: '/dashboard/abc' }, true).label, 'Home');
});

test('the eight doors that sent no origin now send one', () => {
  const doors: Array<[string, RegExp]> = [
    ['app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx', /<ShopLink\s+href=\{`\/v\/\$\{vendorProfileSlug\}#reviews`\}/],
    ['app/dashboard/[eventId]/_components/day-of-mode/get-help-card.tsx', /<ShopLink\s+href=\{href\}/],
    ['app/[slug]/_components/hub-suppliers-made-this-day.tsx', /<ShopLink href=\{`\/v\/\$\{v\.businessSlug\}`\}/],
    ['app/_components/plan3d/booth-vendor-card.tsx', /<ShopLink\s+href=\{`\/v\/\$\{vendor\.slug\}`\}/],
    ['app/dashboard/[eventId]/studio/mood-board/_components/gallery-picker.tsx', /<ShopLink\s+href=\{`\/v\/\$\{asset\.shopSlug\}`\}/],
    ['app/dashboard/(account)/library/_components/saved-vendor-card.tsx', /<Link href=\{`\/v\/\$\{vendor\.businessSlug\}\?src=favorites`\} className="block">/],
    ['app/u/[userSlug]/page.tsx', /<ShopLink href=\{`\/v\/\$\{v\.slug\}`\} className="uprof-inf-card">/],
    ['app/dashboard/(account)/creator/page.tsx', /<ShopLink href=\{`\/v\/\$\{o\.vendorSlug\}`\}/],
  ];
  for (const [f, re] of doors) {
    const src = code(f);
    assert.match(src, re, `${f}: the door into the shop sends no origin again`);
    // A plain <Link>/<a> with a bare shop address (no origin) — `ShopLink` takes the same literal address on purpose,
    // so the route map still sees the door.
    assert.doesNotMatch(src, /<(?:Link|a)\s+href=\{`\/v\/\$\{[\w.]+\}`\}/, `${f}: a bare /v/<slug> link is back`);
  }
  // The shop page reads both new halves of the arrival.
  assert.match(code('app/v/[slug]/page.tsx'), /q: arrivalParams\(search\)\.q, from: arrivalParams\(search\)\.from \}/);
});
