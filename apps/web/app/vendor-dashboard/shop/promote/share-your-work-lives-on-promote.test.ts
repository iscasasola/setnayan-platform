/**
 * GUARD — 📣 SHARE YOUR WORK LIVES ON SHOP › PROMOTE, ONCE (owner 2026-11-06, verbatim: *"Use fable to decide. Find the
 * best location for each. Make the pages live there and not jump to another menu."* — DECISION_LOG "ONE HOME FOR EVERY
 * PROMOTE TOOL", row 4: real stories + recaps with their Facebook / Pinterest / share / copy / story-card buttons;
 * `/real-stories` and `/recaps` forward to `/shop/promote#share`; out of Settings › More tools).
 *
 *   1. Promote draws the section once, with its own read, read beside the gifts (no extra round trip).
 *   2. The section REUSES the shipped buttons on the same addresses — never a redraw.
 *   3. The two old routes only forward to `#share`.
 *   4. No other door: not the shelves / More tools, not the Services specialist tools, not the Shop tab's activeMatch.
 *   5. The read is honest: ONE pool read for both lists; a refused read is `null` and is SAID; the Solo gate on recaps
 *      stays.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { shopToolShelves } from '../shop-tool-shelves';
import { SPECIALIST_TOOLS } from '@/lib/vendor-service-tools';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

// THE ONE BUILD (C4, A3 W5): Promote's sections are ONE body, mounted by the page and by Shop's Promote sheet.
const PROMOTE = read('vendor-dashboard/shop/promote/_components/promote-body.tsx');
const VIEW = read('vendor-dashboard/shop/promote/_components/share-your-work.tsx');
const DATA = read('vendor-dashboard/shop/promote/_components/share-your-work-data.ts');
const OLD = ['/vendor-dashboard/real-stories', '/vendor-dashboard/recaps'];

test('1 · Promote draws Share your work once, with its own read, beside the gifts', () => {
  assert.match(PROMOTE, /import \{ ShareYourWork \} from '\.\/share-your-work'/);
  assert.equal([...PROMOTE.matchAll(/<ShareYourWork\b/g)].length, 1);
  assert.match(PROMOTE, /const sharePromise = withPromote \? loadShareYourWork\(supabase, profile\.vendor_profile_id\) : Promise\.resolve\(null\);/);
  assert.match(PROMOTE, /await Promise\.all\(\[giftsPromise, sharePromise, memberPromise\]\)/, 'the share read adds a round trip after the gifts');
  // Row order (the ruling): QR codes · prints · gifts · share your work — share comes after gifts.
  assert.ok(PROMOTE.indexOf('<ShareYourWork') > PROMOTE.indexOf('<ShopGiftsSection'), 'Share your work is not after Your gifts');
  assert.match(VIEW, /<section id="share"/, 'the #share anchor the old routes forward to is missing');
});

test('2 · the section reuses the shipped share + story-card buttons on the same addresses', () => {
  assert.match(VIEW, /import \{ ShareButtons \} from '@\/app\/realstories\/_components\/share-buttons';/);
  assert.match(VIEW, /import \{ SaveStoryCardButton \} from '@\/app\/\[slug\]\/recap\/_components\/save-story-card-button';/);
  assert.match(VIEW, /\/api\/og\/realstory-slug\/\$\{s\.slug\}/);
  assert.match(VIEW, /\/api\/og\/recap\/\$\{r\.slug\}/);
  assert.match(VIEW, /storyCardUrl=\{`\$\{ogImage\}\?format=story`\}/);
  assert.equal([...VIEW.matchAll(/<ShareButtons\b/g)].length, 1, 'one row drawing for both lists');
  assert.doesNotMatch(VIEW, /Edit in |↗/, 'a go-edit-elsewhere link');
});

test('3 · the old routes only forward to #share', () => {
  for (const r of ['vendor-dashboard/real-stories/page.tsx', 'vendor-dashboard/recaps/page.tsx']) {
    const src = read(r);
    assert.match(src, /redirect\('\/vendor-dashboard\/shop\/promote#share'\)/, `${r} does not forward`);
    assert.doesNotMatch(src, /fetchVendorPoolBookings|ShareButtons|createClient/, `${r} still draws or reads`);
  }
});

test('4 · no other door: shelves / More tools, Services specialist tools, the Shop tab', () => {
  const shelves = shopToolShelves(true, true).flatMap((g) => g.tools.map((t) => t.href));
  for (const h of OLD) assert.ok(!shelves.includes(h), `${h} is still on the shop shelves (Settings › More tools)`);
  for (const t of SPECIALIST_TOOLS) assert.ok(!OLD.includes(t.href), `${t.key} still opens ${t.href}`);
  const nav = read('vendor-dashboard/_components/vendor-bottom-nav.tsx');
  for (const h of OLD) assert.ok(!nav.includes(`'${h}'`), `${h} still lights the Shop tab`);
});

test('5 · one pool read for both lists; a refused read is said; recaps keep their Solo gate', () => {
  assert.equal([...DATA.matchAll(/fetchVendorPoolBookings\(/g)].length, 1, 'the pool is read more than once');
  assert.match(DATA, /if \(eventIds === null\) return \{ stories: null, recaps: null, recapsGated \};/);
  assert.match(DATA, /loadVendorFeaturedStories\(eventIds\)\.catch\([\s\S]{0,160}return null;/);
  assert.match(DATA, /loadVendorRecaps\(eventIds\)\.catch\([\s\S]{0,160}return null;/);
  assert.match(DATA, /isVendorFeatureGateEnabled\(\)[\s\S]{0,120}!canUseSoloBusinessTools\(tier\)/, 'the Solo gate on recaps is gone');
  // The view says a refusal in words, never "none".
  assert.match(VIEW, /stories === null \? \([\s\S]{0,120}role="alert"/);
  assert.match(VIEW, /recaps === null \? \([\s\S]{0,120}role="alert"/);
  assert.match(VIEW, /if \(rows === null\) return 'Couldn’t load/);
});
