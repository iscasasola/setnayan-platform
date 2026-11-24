/**
 * 🔒 THE PUBLIC LINES MATCH THE OWNER'S RULINGS (controller, 24 Nov 2026: "make it true" — every public line must match
 * the specs corpus DECISION_LOG). A read-only audit of main 7247a56b9 and live setnayan.com found six kinds of line that
 * said something the rulings no longer do; each is held here so it cannot drift back.
 *
 *   a · REAL STORIES IS RETIRED (DECISION_LOG 2026-11-16 "THE BLOG AND REAL STORIES ARE RETIRED" · "RETIRED ADDRESSES
 *       FORWARD"): no /features row, no feature page, and /features/real-stories forwards to Discover like /realstories.
 *   b · GUEST CAMERA-ROLL UPLOADS ARE LIVE (14 Nov rulings on #7607; lib/papic-phone-uploads.ts): the saved AI answer
 *       says so, as the help article does ("Yes, if the couple allows it"), and no longer claims there is none.
 *   c · NO TYPED CATEGORY COUNT: "all 192 categories" and "200+ supplier sub-categories" are COUNTED from the live
 *       taxonomy (lib/category-count.ts); with no live read, no number is said.
 *   d · NO UNBACKED PROMISE: "keep 100%" is false while suppliers pay the booking fee; the Creators page's "Free
 *       forever" has no row behind it ("Free to publish" does — the 16 Jul creator verdict). The Store's "Free forever"
 *       IS ruled (2026-11-23 "APP STORE FREE LIST — APPROVED") and stays, citing it.
 *   e · "NOTHING RENEWS BY ITSELF" IS TRUE ON THE WEB, NOT FOR AN APPLE PLAN: every plan line asks ONE source
 *       (lib/plan-renewal-words.ts) with the request's Apple gate (`getIapGate().iap`, which carries
 *       NEXT_PUBLIC_APPLE_IAP_ENABLED); /llms.txt adds the Apple sentence when the switch is on.
 *   f · THE JOURNAL MOVED INTO ARTICLES (DECISION_LOG 2026-11-17): a reader never sees "Setnayan Journal".
 *
 * KEPT on purpose (owner-ruled, not touched): "No. 1 Supplier of the Year"; "Always free" for FaceBlock; "kept for
 * life" for Memories; the Patiktok / Music Maker stubs; /blog → /articles; sample peso figures in demo cards.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-24): "all 192 categories" typed back into front-door-results (red: c)
 *   · `JOURNAL_BYLINE` set back to 'Setnayan Journal' (red: f) · the `/features/real-stories` rows dropped from
 *   RETIRED_TREES (red: a).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { FEATURE_ROWS, EXCLUDED } from '@/lib/features-page';
import { FEATURE_PAGES } from '@/lib/feature-pages';
import { legacyRedirectTarget } from '@/lib/legacy-redirects';
import { DISCOVER_HREF } from '@/lib/discover-href';
import { aiAnswers } from '@/lib/seo/ai-answers';
import { fallbackSnapshot } from '@/lib/taxonomy-snapshot';
import { allCategoriesWords, liveCategoryCount, liveSubCategoryCount } from '@/lib/category-count';
import { renderLlmsTxt, subCategoriesPhrase } from '@/lib/llms-txt';
import { INPUT_FOR_GUARDS } from '@/lib/llms-txt-guard-input';
import { APPLE_PLANS_RENEW_SENTENCE, NOTHING_RENEWS, planRenewal } from '@/lib/plan-renewal-words';
import { planPickLine } from '@/lib/vendor-plan-rows';
import { JOURNAL_BYLINE } from '@/lib/journal-move';
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('a · Real Stories is retired: no /features row, no feature page, and its page forwards to Discover', () => {
  for (const r of Object.values(FEATURE_ROWS)) assert.doesNotMatch(r.name, /Real Stories/i, '/features lists Real Stories again');
  assert.ok(EXCLUDED.some(([row]) => row === 'A46'), 'A46 (Real Stories) is neither a row nor excluded with its reason');
  assert.equal(FEATURE_PAGES.some((f) => (f.slug as string) === 'real-stories'), false, '/features/real-stories is a page again');
  for (const path of ['/features/real-stories', '/tl/features/real-stories', '/features/real-stories/']) {
    assert.equal(legacyRedirectTarget(path), DISCOVER_HREF, `${path} does not forward to Discover like /realstories`);
  }
  assert.equal(legacyRedirectTarget('/features/real-stories', '?utm_source=fb'), `${DISCOVER_HREF}&utm_source=fb`, 'a shared link loses its query');
  assert.equal(legacyRedirectTarget('/features/real-stories-and-more'), null, 'a different page was swallowed');
});

test('b · the saved AI answer says guests CAN add from their camera roll, as the help article does', () => {
  const a = aiAnswers({ bookingFee: null }).find((x) => x.id === 'guest-photos-free');
  assert.ok(a, 'the guest-photos answer is gone — re-point this guard');
  assert.match(a.answer, /camera roll/i, 'the answer is silent on camera-roll uploads, which are live');
  assert.match(a.answer, /if the couple allows it/i, 'the answer drops the couple’s switch the help article names');
  assert.doesNotMatch(code('lib/seo/ai-answers.ts'), /no (?:free )?(?:plain )?camera-roll upload/i, 'the "no camera-roll upload" claim is back');
  assert.match(code('lib/help/topics-existing.ts'), /share photos from your camera roll/, 'the help article this agrees with moved');
});

test('c · no category count is typed — it is counted from the live tree, or not said', () => {
  for (const rel of ['app/_components/frontdoor/front-door-results.tsx', 'lib/llms-txt.ts']) {
    const s = code(rel);
    assert.doesNotMatch(s, /\ball \d+ categories\b/i, `${rel} types a category count`);
    assert.doesNotMatch(s, /\b\d+\+? supplier sub-categories\b/i, `${rel} types a sub-category count`);
  }
  assert.match(code('app/_components/frontdoor/front-door-results.tsx'), /allCategoriesWords\(taxonomy \? liveCategoryCount\(taxonomy\) : null\)/);
  assert.match(code('app/llms.txt/route.ts'), /subCategoryCount: liveSubCategoryCount\(taxonomy\)/);
  // The code fallback is NOT a live count: no number.
  const fb = fallbackSnapshot();
  assert.equal(liveCategoryCount(fb), null);
  assert.equal(liveSubCategoryCount(fb), null);
  assert.equal(allCategoriesWords(null), 'every category');
  // A live read is counted, hidden ones left out.
  const live = { ...fb, source: 'db' as const, hiddenCategories: { [fb.tileOrder[0]!]: true as const } };
  const shown = fb.tileOrder.filter((t) => !live.hiddenCategories[t] && !live.hiddenCategories[fb.tileParent[t] ?? '']).length;
  assert.equal(liveCategoryCount(live), shown);
  assert.equal(allCategoriesWords(shown), `all ${shown} categories`);
  // /llms.txt: the count when read, no number when not.
  assert.match(renderLlmsTxt({ ...INPUT_FOR_GUARDS, subCategoryCount: 367 }), /Its 367 supplier sub-categories include Filipino entries/);
  assert.doesNotMatch(renderLlmsTxt(INPUT_FOR_GUARDS), /\d\+? supplier sub-categories/);
  assert.equal(subCategoriesPhrase(null), 'Its supplier sub-categories');
});

test('d · no "keep 100%", no unbacked "Free forever"; the ruled Store line stays and cites its row', () => {
  for (const rel of ['app/_components/home/HomeOverlays.tsx', 'app/_components/home/vendor-benefits.ts']) {
    assert.doesNotMatch(code(rel), /keep 100\s?%/i, `${rel} says suppliers keep 100% — they pay the booking fee`);
  }
  for (const s of VENDOR_TIER_SECTIONS) assert.doesNotMatch(s.tagline, /100\s?%/, `${s.name} promises 100%`);
  assert.doesNotMatch(code('app/(shell)/creators/page.tsx'), /free forever/i, 'the Creators page promises "Free forever" — no row backs it');
  assert.match(code('app/(shell)/creators/page.tsx'), /Free to publish/);
  const store = readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'), 'utf8');
  assert.match(store, /APP STORE FREE LIST — APPROVED[\s\S]{0,200}title="Free forever"/, 'the Store’s "Free forever" lost its ruling');
});

test('e · "Nothing renews by itself" comes from ONE source and follows the Apple switch in the app', () => {
  assert.equal(planRenewal(false).title, NOTHING_RENEWS);
  assert.equal(planRenewal(false).renews, false);
  const apple = planRenewal(true);
  assert.equal(apple.renews, true);
  assert.doesNotMatch(`${apple.title} ${apple.inline} ${apple.howToStop('8 Dec 2026')}`, /nothing renews/i, 'an Apple plan claims it does not renew');
  assert.match(apple.howToStop('8 Dec 2026'), /Settings › Apple ID/);
  assert.match(planPickLine('pro', 'free', '8 Dec 2026'), /^Nothing renews by itself/);
  assert.doesNotMatch(planPickLine('pro', 'free', '8 Dec 2026', true), /nothing renews/i);
  // No in-app plan surface types the words; each asks the one source with the request's Apple gate.
  for (const rel of [
    'app/vendor-dashboard/subscription/_components/plan-rows.tsx',
    'app/vendor-dashboard/subscription/_components/plan-sheet.tsx',
    'app/vendor-dashboard/subscription/_components/plan-screen.tsx',
    'lib/vendor-plan-rows.ts',
    'lib/feature-pages/suppliers-b.ts',
    'lib/help/supplier-1.ts',
    'lib/llms-txt.ts',
  ]) {
    assert.doesNotMatch(code(rel), /['"`][^'"`]*nothing renews by itself/i, `${rel} types "nothing renews by itself" instead of asking lib/plan-renewal-words.ts`);
  }
  const screen = code('app/vendor-dashboard/subscription/_components/plan-screen.tsx');
  assert.match(screen, /const iapGate = await getIapGate\(\);/);
  assert.match(screen, /appleSells=\{appleSells\}[\s\S]*appleSells=\{appleSells\}/, 'the plan sheet or the plan rows do not get the Apple gate');
  // /llms.txt: the web line as before; the Apple sentence only while the switch is on.
  assert.match(renderLlmsTxt(INPUT_FOR_GUARDS), /Nothing renews by itself: a reminder comes by email/);
  assert.doesNotMatch(renderLlmsTxt(INPUT_FOR_GUARDS), /Apple subscription/);
  assert.ok(renderLlmsTxt({ ...INPUT_FOR_GUARDS, appleIapOn: true }).includes(APPLE_PLANS_RENEW_SENTENCE));
  assert.match(code('app/llms.txt/route.ts'), /appleIapOn: isAppleIapEnabled\(\)/);
});

test('f · readers never see "Setnayan Journal" — the Journal moved into Articles', () => {
  assert.equal(JOURNAL_BYLINE, 'Setnayan');
  assert.doesNotMatch(code('app/(shell)/articles/(list)/page.tsx'), /Setnayan Journal/, 'the /articles description names the Journal');
  assert.doesNotMatch(renderLlmsTxt(INPUT_FOR_GUARDS), /Setnayan Journal/, '/llms.txt names the Journal');
  assert.doesNotMatch(code('lib/llms-txt.ts'), /Setnayan Journal/);
});
