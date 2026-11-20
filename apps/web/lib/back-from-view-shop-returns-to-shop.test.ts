/**
 * 🔒↩ BACK FROM "VIEW SHOP" RETURNS TO SHOP — and the shop's About reads as the app's own text (owner 21 Nov 2026).
 *
 *   1 · `viewShopSrc` carries "came from Shop" (`src=page`, `from=/vendor-dashboard/shop`), and the shop page's back
 *       rule turns that into Back → /vendor-dashboard/shop (so "Open in browser" in a new tab goes back to Shop too).
 *   2 · `viewShopFrame` only answers for OUR marked frame: not a top-level tab, not an unmarked frame, not a frame whose
 *       `frameElement` the browser refuses (cross-origin).
 *   3 · Wiring: the frame and "Open in browser" both use `viewShopSrc`; the frame listens for `VIEW_SHOP_CLOSE`; both
 *       of the shop page's Back slots are wrapped in `FramedBackCloses`, which stops the press before it navigates.
 *   4 · About (owner: the large italic serif *"feels lost from the design"*): the real page and the sample page draw it
 *       in the app's type scale — no `font-serif`, no `italic`, no `text-[…]` size.
 *
 * Source pins read with comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { arrivalParams, shopTopBack } from './shop-back';
import { VIEW_SHOP_FRAME_ATTR, VIEW_SHOP_FROM, viewShopFrame, viewShopSrc } from './view-shop-frame';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the View shop address carries Shop, and Back reads it as Shop', () => {
  const src = viewShopSrc('/setnaprod');
  const u = new URL(src, 'https://www.setnayan.com');
  assert.equal(u.pathname, '/setnaprod');
  const arrival = arrivalParams(Object.fromEntries(u.searchParams));
  assert.equal(arrival.from, VIEW_SHOP_FROM);
  const back = shopTopBack({ src: arrival.src, eventId: null, q: arrival.q, from: arrival.from }, true);
  assert.equal(back.href, '/vendor-dashboard/shop');
  assert.notEqual(back.label, 'Home');
});

test('2 · only our marked frame counts', () => {
  const frameEl = (marked: boolean) => ({ hasAttribute: (a: string) => marked && a === VIEW_SHOP_FRAME_ATTR }) as unknown as Element;
  const win = (top: boolean, el: Element | null) => {
    const w = { frameElement: el } as unknown as Window & { self: unknown; top: unknown };
    w.self = w;
    w.top = top ? w : {};
    return w as unknown as Window;
  };
  assert.equal(viewShopFrame(win(true, null)), null, 'a normal tab is not framed');
  assert.equal(viewShopFrame(win(false, frameEl(false))), null, 'an unmarked frame is not ours');
  assert.equal(viewShopFrame(win(false, null)), null, 'a cross-origin parent hides frameElement');
  const ours = frameEl(true);
  assert.equal(viewShopFrame(win(false, ours)), ours);
  const throwing = { get self() { return this; }, get top() { return {}; }, get frameElement(): Element { throw new Error('SecurityError'); } };
  assert.equal(viewShopFrame(throwing as unknown as Window), null);
});

test('3 · the frame, Open in browser and both Back slots are wired', () => {
  const cover = read('app/vendor-dashboard/shop/_components/shop-cover.tsx');
  const screen = cover.slice(cover.indexOf('function ViewShopScreen'));
  assert.match(screen, /const src = viewShopSrc\(path\)/);
  assert.match(screen, /<a href=\{src\}[^>]*target="_blank"/, 'Open in browser must carry the arrival');
  assert.match(screen, /<iframe ref=\{frame\} src=\{src\}[^>]*data-view-shop-frame=""/, 'the frame must carry the arrival and its marker');
  assert.match(screen, /addEventListener\(VIEW_SHOP_CLOSE/, 'the frame must close on the page’s Back');

  const page = read('app/v/[slug]/page.tsx');
  const bar = page.slice(page.indexOf('<ShopTopBar'), page.indexOf('shopName={displayLabel}', page.indexOf('<ShopTopBar')));
  assert.equal((bar.match(/<FramedBackCloses>\s*<BackButton/g) ?? []).length, 2, 'both Back slots (pill and compact) must close the frame');

  const closer = read('app/v/[slug]/_components/framed-back-closes.tsx');
  assert.match(closer, /onClickCapture/);
  assert.match(closer, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);/, 'the press must stop before ReturnInPlace and the link');
});

test('4 · About reads in the app’s type, on both pages', () => {
  for (const rel of ['app/v/[slug]/page.tsx', 'app/v/[slug]/_components/sample-shop-page.tsx']) {
    const src = read(rel);
    const at = src.indexOf('data-shop-about-text=""');
    assert.ok(at > 0, `${rel}: the About paragraph lost its marker`);
    const tag = src.slice(src.lastIndexOf('<p', at), src.indexOf('>', at) + 1);
    assert.match(tag, /text-sn-xl/, `${rel}: About must use the type scale`);
    assert.doesNotMatch(tag, /font-serif|italic|text-\[/, `${rel}: About must not be the large italic serif`);
  }
});
