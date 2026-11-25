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
  const editPage = src(`${SLOT}/[serviceId]/page.tsx`);
  assert.match(editPage, /import CardMakerPage from '\.\.\/\.\.\/\.\.\/services\/\[serviceId\]\/page';/, 'a second card page body');
  assert.match(editPage, /if \(!isServiceCardId\(serviceId\)\) return <LoadWhole \/>;\s*return <CardMakerPage \{\.\.\.props\} \/>;/);
  const route = src('app/_components/rise/rise-route.tsx');
  assert.match(route, /<ShopDoorScreen page title=\{title\}/, 'the dialog is not the one door screen');
  assert.match(route, /if \(st\?\.\[LAYER_MARK\]\) window\.history\.go\(-2\);\s*else router\.back\(\);/);
});

test('B8 · only the maker rises: the services pages beside it load as their own (controller 25 Nov)', () => {
  // Only `new` (picker + maker) and a card id rise; requests, requests/[id] and their-work are never intercepted.
  const slot = join(web, SLOT);
  const dirs = readdirSync(slot).filter((d) => statSync(join(slot, d)).isDirectory()).sort();
  assert.deepEqual(dirs, ['[serviceId]', 'new'], `a services page other than the maker rises: ${dirs.join(', ')}`);
  // The card folder matches any name: a non-card one draws no layer and loads whole.
  const layout = src(`${SLOT}/[serviceId]/layout.tsx`);
  assert.match(layout, /if \(!isServiceCardId\(serviceId\)\) return <>\{children\}<\/>;/, 'a services page beside the maker is drawn in the layer');
  assert.ok(layout.indexOf('isServiceCardId(serviceId)') < layout.indexOf('<RiseRoute'), 'the layer is drawn before the id is checked');
  assert.match(src('app/_components/load-whole.tsx'), /window\.location\.replace\(window\.location\.href\)/);
  // One id rule: the maker's own loader asks the same question.
  assert.match(src('lib/service-card-maker.server.ts'), /if \(!isServiceCardId\(serviceId\)\) return null;/);
  for (const real of ['requests', 'their-work']) {
    assert.ok(statSync(join(web, 'app/vendor-dashboard/services', real)).isDirectory(), `${real} is gone from services — the check reads nothing`);
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
  const ro = row.slice(row.indexOf(') : asRead ? ('), row.indexOf(') : boxed && !long ? ('));
  assert.ok(ro.length > 50, 'the read-only form is gone');
  assert.match(ro, /className=\{`min-w-0 truncate /, 'the words are not cut at their end');
  assert.doesNotMatch(ro, /<Pencil|<button|PillWords/, 'a read-only name can still be pressed or moves');
  assert.match(src('app/vendor-dashboard/services/_components/card-photo-gallery.tsx'), /maxFiles=\{locked \? n : limit\}/);
  // EVERY field of a booked card (Description, Video link, the price and payment editors…): the form sets read-only once.
  const form = maker.slice(maker.indexOf('id={CARD_FORM_ID}'), maker.indexOf('</form>', maker.indexOf('id={CARD_FORM_ID}')));
  assert.match(form, /<FormRowsReadOnly\.Provider value=\{editLocked\}>/, 'the booked card’s rows still draw pencils');
  assert.ok(form.indexOf('</FormRowsReadOnly.Provider>') > form.indexOf('<FormRowsReadOnly.Provider'), 'the read-only form does not wrap the rows');
  // Name is drawn in the form; Description and Video link are AboutRows, which the form mounts — both inside the provider.
  const inside = form.slice(form.indexOf('<FormRowsReadOnly.Provider'), form.indexOf('</FormRowsReadOnly.Provider>'));
  assert.match(inside, /data-maker-row="name"/, 'the Name row sits outside the read-only rows');
  assert.match(inside, /<AboutRows\b/, 'Description and Video link sit outside the read-only rows');
  const about = maker.slice(maker.indexOf('function AboutRows'));
  assert.match(about.slice(0, about.indexOf('\n}\n')), /data-maker-row="description"[\s\S]*<TypedRow[\s\S]*data-maker-row="video-link"[\s\S]*<TypedRow/, 'Description / Video link are no longer the TypedRows inside AboutRows');
  // Every TypedRow honours it: no pencil, no field opens (by a tap or by the screen's ask).
  assert.match(row, /const asRead = readOnly \|\| lockedByForm;/);
  assert.match(row, /if \(mode !== 'shut' \|\| asRead\) return;/, 'a read-only row still opens on a tap');
  assert.match(row, /asked\.current = openAsk;\s*if \(asRead\) return;/, 'a read-only row still opens when the screen asks');
  const ro2 = row.slice(row.indexOf(') : asRead && long ? ('), row.indexOf(') : boxed && !long ? ('));
  assert.doesNotMatch(ro2, /<Pencil|<button|PillWords/, 'a read-only description can still be pressed');
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
