/**
 * GUARD — OPEN A SHOP IS ONE LAYER (final check B1 · B2 · B3; drawing
 * `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html` § B1–B3, approved by the owner 25 Nov).
 *
 *   1. The layer is mounted ONCE, by the route's layout, so it stays up while the steps change: the shipped
 *      `ShopDoorScreen` — RiseScreen on a phone, the centred form dialog (`Sheet` `page`) from the desktop line.
 *   2. No step draws a page shell of its own: no `<main>`, no desktop brand strip, no in-body title that repeats the
 *      head. The SETNAYAN line stays above the bars (owner 25 Nov: keep the 21 Oct rule).
 *   3. Each step names the head; a step after the shop opened (logo, invite) sends ✕ where its own buttons go.
 *   4. The logo step wears the supplier look: its bars are the supplier accent, never the warm orange.
 *   5. The invite step's Later and Done sit in the layer's bar at its foot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

const LAYOUT = 'app/open-shop/layout.tsx';
const LAYER = 'app/open-shop/_components/open-shop-layer.tsx';
const WIZARD = 'app/open-shop/_components/open-shop-wizard.tsx';
const CLAIM = 'app/open-shop/_components/claim-door.tsx';
const LOGO = 'app/open-shop/logo/_components/add-your-logo.tsx';
const INVITE = 'app/open-shop/invite/page.tsx';

test('1 · one layer, mounted by the layout: the shipped door screen, the centred dialog from the desktop line', () => {
  assert.match(src(LAYOUT), /return <OpenShopLayer>\{children\}<\/OpenShopLayer>;/);
  const layer = src(LAYER);
  assert.match(layer, /<ShopDoorScreen\s+at="lg"\s+page\s+fill\s+kind="stack"/, 'not the one door screen, as drawn');
  assert.doesNotMatch(layer, /<RiseScreen\b|<Sheet\b/, 'a second way to draw the layer');
  const door = src('app/vendor-dashboard/_components/shop-door-screen.tsx');
  assert.match(door, /export const SHOP_DOOR_DESKTOP_QUERY = `\(min-width: \$\{BREAKPOINTS\.lg\}px\)`;/);
  assert.match(door, /\n\s+page=\{page\}\n/, 'the panel ignores `page`');
});

test('2 · no step draws its own page shell; the SETNAYAN line stays above the bars', () => {
  for (const f of [WIZARD, CLAIM, LOGO, INVITE]) {
    const s = src(f);
    assert.doesNotMatch(s, /<main\b/, `${f} still draws a page of its own`);
    assert.doesNotMatch(s, /className="hidden h-\[60px\] items-center gap-4 border-b/, `${f} still draws the desktop brand strip`);
    assert.match(s, /<FirstRunBrand\b/, `${f} lost the SETNAYAN line (owner 25 Nov: keep it)`);
  }
  const wiz = src(WIZARD);
  assert.doesNotMatch(wiz, /\{title\}\s*<\/h1>/, 'the wizard repeats the head’s title in its body');
  assert.doesNotMatch(src(LOGO), /<h1\b/, 'the logo step repeats the head’s title');
  assert.doesNotMatch(src(INVITE), /<h1\b/, 'the invite step repeats the head’s title');
  // The claim door keeps its own label over its title (controller P1, 21 Nov): the head names the layer instead.
  assert.match(src(CLAIM), /useOpenShopHead\(\{ title: OPEN_YOUR_SHOP_HEAD\[0\], line: null \}\);/);
});

test('3 · each step names the head; after the shop opened, ✕ goes where its own buttons go', () => {
  const wiz = src(WIZARD);
  assert.match(wiz, /useOpenShopHead\(\{\s*title,\s*line,/);
  assert.ok(wiz.indexOf('useOpenShopHead(') < wiz.indexOf('if (sentTo && !hardLoading)'), 'the head hook sits after an early return');
  assert.match(src(LOGO), /useOpenShopHead\(\{ title: hasSaved \? 'Your logo' : 'Add your logo', line: `\$\{shopName\} is open\.`, leaveTo: doneHref \}\);/);
  assert.match(src(INVITE), /<OpenShopHeadMark title=\{title\} line=\{line\} leaveTo=\{done\} \/>/);
  const layer = src(LAYER);
  assert.match(layer, /if \(head\.leaveTo\) router\.replace\(head\.leaveTo\);/);
  assert.match(layer, /else router\.replace\(HOME\);/, 'a direct visit has nowhere to go back to');
});

test('4 · the logo step wears the supplier look', () => {
  const logo = src(LOGO);
  assert.match(logo, /data-open-shop-logo="" data-supplier-look=""/);
  assert.doesNotMatch(logo, /var\(--m-orange-deep\)/, 'the warm step bars are back');
  assert.match(logo, /background: 'rgb\(var\(--color-mulberry\)\)'/);
});

test('5 · the invite step’s Later and Done sit in the layer’s bar', () => {
  const invite = src(INVITE);
  const bar = invite.slice(invite.indexOf('data-open-shop-bar=""'));
  assert.ok(bar.length > 0, 'no bar at the foot');
  assert.match(bar, /label="Later" href=\{done\}/);
  assert.match(bar, /label="Done" href=\{done\}/);
});
