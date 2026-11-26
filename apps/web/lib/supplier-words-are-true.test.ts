/**
 * supplier-words-are-true.test.ts — area 5's words and doors say what is true (final check 25 Nov 2026, batch 3).
 *
 * A5-G1-06 the trust line once · A5-G3-07 "That request is gone." reaches the list · A5-G4-06 "Name your shop first"
 * lands on the name · A5-G2-12 one "no shop" landing · A5-G2-10 plain, backed Attributes words · B5-25 no "No services
 * yet" to a shop with services · A5-X-05 no typed peso figure in the voice preview · B5-10 no ₱0 standing for "not yet"
 * in the bundle maker · B5-09 no raw gift code as a name · A5-G3-12 Their work says "every event" · B5-07 no tracking tag
 * in a shown address · B5-20 only a shop without a price is asked to set one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shownAddress } from '@/lib/shop-address';
import { SHOP_NAME_SETUP_HREF } from '@/lib/supplier-qr-codes';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

test('a shown address drops the scheme, www and every tracking tag (B5-07)', () => {
  assert.equal(shownAddress('https://setnayan.com/liwanagphotoandfilm?src=own&via=link'), 'setnayan.com/liwanagphotoandfilm');
  assert.equal(shownAddress('https://www.setnayan.com/shop/dates?src=own#x'), 'setnayan.com/shop/dates');
  assert.equal(shownAddress('not a url?src=own'), 'not a url');
});

test('one shownAddress: the Shop hero and My QRs read the same helper (B5-07)', () => {
  for (const f of ['app/vendor-dashboard/shop/_components/shop-cover.tsx', 'app/vendor-dashboard/shop/qrs/[code]/page.tsx']) {
    const s = src(f);
    assert.match(s, /import \{ shownAddress \} from '@\/lib\/shop-address';/, f);
    assert.doesNotMatch(s, /function shownAddress/, `${f} keeps a second copy`);
  }
  assert.doesNotMatch(src('app/vendor-dashboard/shop/_components/shop-cover.tsx'), /shareUrl\.replace\(/);
});

test('"Name your shop first" lands on the name, never back on the Shop tab (A5-G4-06)', () => {
  assert.equal(SHOP_NAME_SETUP_HREF, '/vendor-dashboard/profile#name');
  for (const f of [
    'app/vendor-dashboard/shop/qrs/page.tsx',
    'app/vendor-dashboard/shop/promote/_components/promote-body.tsx',
    'app/vendor-dashboard/invite/page.tsx',
  ]) {
    const s = src(f);
    assert.doesNotMatch(s, /setupHref="\/vendor-dashboard\/shop"/, f);
    assert.match(s, /setupHref=\{SHOP_NAME_SETUP_HREF\}/, f);
  }
});

test('the trust line once, the gone request said, one no-shop landing (A5-G1-06, A5-G3-07, A5-G2-12)', () => {
  assert.match(src('app/open-shop/invite/page.tsx'), /\{url \? null : \(/);
  assert.match(src('app/vendor-dashboard/services/requests/actions.ts'), /\?gone=1/);
  assert.match(src('app/vendor-dashboard/services/requests/page.tsx'), /gone=\{sp\.gone === '1'\}/);
  assert.match(src('app/vendor-dashboard/services/requests/_components/your-requests-view.tsx'), /That request is gone\./);
  for (const f of ['app/vendor-dashboard/activities/page.tsx', 'app/vendor-dashboard/lines/page.tsx']) {
    assert.doesNotMatch(src(f), /redirect\('\/vendor-dashboard\/verify'\)/, f);
  }
});

test('Attributes, Their work and the voice preview say only what is true (A5-G2-10, B5-25, A5-G3-12, A5-X-05)', () => {
  const attr = src('app/vendor-dashboard/attributes/_components/attributes-view.tsx');
  assert.doesNotMatch(attr, /attribute payload/);
  assert.doesNotMatch(attr, /marketplace ranking/);
  assert.doesNotMatch(attr, /No services yet/);
  assert.doesNotMatch(src('app/vendor-dashboard/services/their-work/page.tsx'), /this card was booked for/);
  const voice = src('app/vendor-dashboard/shop/_components/voice-match-card.tsx');
  const preview = voice.slice(voice.indexOf('const PREVIEW_ANSWER'), voice.indexOf('const LANGUAGE_LABEL'));
  assert.doesNotMatch(preview, /₱\s?\d/, 'no typed peso figure in the preview');
});

test('the bundle maker never shows ₱0 for "not yet" (B5-10)', () => {
  const ed = src('app/vendor-dashboard/packages/_components/package-editor.tsx');
  assert.doesNotMatch(ed, /php\(0\)/);
  assert.doesNotMatch(ed, /above ₱0 and below \{php\(sums\.cardsTotalPhp\)\}\.<\/p>/, 'the bound shows only once the cards are picked');
  assert.match(ed, /const ready = sums\.lines\.length >= 2;/);
});

test('a held gift is never named by its code; the price card asks only a shop without a price (B5-09, B5-20)', () => {
  const gifts = src('app/vendor-dashboard/shop/promote/_components/shop-gifts-section.tsx');
  assert.doesNotMatch(gifts, /title: code, kind: 'papic'/);
  const growing = src('app/vendor-dashboard/performance/_components/analytics-growing.tsx');
  assert.match(growing, /view\.price\.emptyWhy === 'no_data'/);
  assert.match(src('app/vendor-dashboard/performance/_components/growth-view.ts'), /emptyWhy: p && p\.status === 'no_own_price'/);
});
