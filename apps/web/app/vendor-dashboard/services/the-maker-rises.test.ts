/**
 * GUARD — THE CARD MAKER RISES OVER SHOP · A BOOKED CARD READS AS LOCKED · SHORT SHOP DOORS ARE HALF SHEETS
 * (final check lane B 2; drawing `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html`
 * § B7 · B8 · B10, approved by the owner 25 Nov. B11's layout is held by `shop/the-shop-is-layout-a-on-a-computer.test.ts`.)
 *
 *   B8  A tap on "＋ Create service card" or a card row draws the real page inside ONE layer over Shop (`@rise/(.)services`),
 *       the large centred dialog from 701; the picker and the maker share one layer; an edit is headed by the card's
 *       name; the ‹ links hide only inside the layer; every static sibling the dynamic folder would swallow is named.
 *   B7  A booked card: the name is plain words from its start (no pencil), and the gallery draws no add tile.
 *   B10 Logo · Cover photo · Storage open the shared Sheet (half on a phone); Promote and Share still rise.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));
const SLOT = 'app/vendor-dashboard/@rise/(.)services';

test('B8 · the maker rises: picker + maker share one dialog layer, an edit is headed by its card', () => {
  const made = src(`${SLOT}/new/layout.tsx`);
  assert.match(made, /<RiseRoute page kind="stack" title="New service" data="service-maker-new">/);
  assert.equal(src(`${SLOT}/new/page.tsx`).trim(), `export { default } from '../../../services/new/page';`);
  assert.equal(src(`${SLOT}/new/[category]/page.tsx`).trim(), `export { default } from '../../../../services/new/[category]/page';`);
  const edit = src(`${SLOT}/[serviceId]/layout.tsx`);
  assert.match(edit, /<RiseRoute page kind="stack" title=\{name\} data="service-maker-edit">/);
  assert.match(edit, /\|\| 'Your service'/, 'a refused name read heads it with a made-up name');
  assert.equal(src(`${SLOT}/[serviceId]/page.tsx`).trim(), `export { default } from '../../../services/[serviceId]/page';`);
  const route = src('app/_components/rise/rise-route.tsx');
  assert.match(route, /<ShopDoorScreen page title=\{title\}/, 'the dialog is not the one door screen');
  assert.match(route, /if \(st\?\.\[LAYER_MARK\]\) window\.history\.go\(-2\);\s*else router\.back\(\);/);
});

test('B8 · every static sibling under services is named, so the card folder never swallows it', () => {
  const real = join(web, 'app/vendor-dashboard/services');
  const statics = readdirSync(real).filter((d) => statSync(join(real, d)).isDirectory() && !d.startsWith('_') && !d.startsWith('['));
  assert.ok(statics.length >= 3, 'the scan reads nothing');
  for (const d of statics) {
    const slot = join(web, SLOT, d);
    let has = false;
    try {
      has = statSync(slot).isDirectory();
    } catch {
      has = false;
    }
    assert.ok(has, `/vendor-dashboard/services/${d} would be drawn as a card (no (.)services/${d} in the rise slot)`);
  }
});

test('B8 · the ‹ links hide only inside the layer; a hard load keeps them', () => {
  for (const f of [
    'app/vendor-dashboard/services/new/page.tsx',
    'app/vendor-dashboard/services/[serviceId]/page.tsx',
    'app/vendor-dashboard/services/new/[category]/page.tsx',
  ]) {
    const s = src(f);
    const i = s.indexOf('<HideWhenRisen>');
    assert.ok(i > 0, `${f}: the back link is not wrapped`);
    const inside = s.slice(i, s.indexOf('</HideWhenRisen>'));
    assert.match(inside, /<ChevronLeft|<ArrowLeft/, `${f}: the wrapper holds no back link`);
  }
  assert.match(src('app/_components/rise/rise-route.tsx'), /return useContext\(InRiseRoute\) \? null : <>\{children\}<\/>;/);
});

test('B7 · a booked card: the name reads from its start with no pencil; no add tile', () => {
  const maker = src('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(maker, /pillAttrs=\{\{ 'data-maker-name': '' \}\}\s*readOnly=\{editLocked\}/);
  assert.match(maker, /<CardPhotoGallery\s+vendorProfileId=\{vendorProfileId\}\s+locked=\{editLocked\}/);
  const row = src('app/_components/form-row.tsx');
  const ro = row.slice(row.indexOf(') : readOnly ? ('), row.indexOf(') : boxed && !long ? ('));
  assert.ok(ro.length > 50, 'the read-only form is gone');
  assert.match(ro, /className=\{`min-w-0 truncate /, 'the words are not cut at their end');
  assert.doesNotMatch(ro, /<Pencil|<button|PillWords/, 'a read-only name can still be pressed or moves');
  assert.match(src('app/vendor-dashboard/services/_components/card-photo-gallery.tsx'), /maxFiles=\{locked \? n : limit\}/);
});

test('B10 · Logo, Cover photo and Storage are the shared Sheet; the other doors still rise', () => {
  const cover = src('app/vendor-dashboard/shop/_components/shop-cover.tsx');
  for (const id of ['storage', 'logo', 'cover']) {
    assert.match(cover, new RegExp(`<ParamSheet open=\\{sheet === '${id}'\\}[^\\n]*data="${id}" half />`), `${id} still rises full screen on a phone`);
  }
  assert.match(cover, /<ShopDoorScreen title=\{title\} onClose=\{onClose\} data=\{`shop-\$\{data\}`\} half=\{half\}>/);
  const door = src('app/vendor-dashboard/_components/shop-door-screen.tsx');
  assert.ok(door.indexOf('if (props.half) return <ShopDoorPanel {...props} />;') > 0, 'a short door does not open the Sheet');
  assert.ok(
    door.indexOf('if (props.half) return <ShopDoorPanel {...props} />;') < door.indexOf('if (!panel && !wasPanel) return <RiseScreen {...props} />;'),
    'a short door rises before it can be a Sheet',
  );
  assert.match(door, /if \(half\) return;\s*if \(!mql\.matches\) setOpen\(false\);/, 'narrowing shuts a short door');
});
