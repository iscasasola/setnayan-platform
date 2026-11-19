/**
 * an-unverified-shop-shows-no-review-anywhere.test.ts — review of #7915 (19 Nov 2026).
 *
 * RULED (DECISION_LOG 10 + 15 Nov): a shop Setnayan has not checked yet shows no rating and no reviews. The v16 S6
 * build gated the rating chip and the Reviews section, and left three doors open: the pinned review card, the
 * services' record rating, and the JSON-LD aggregateRating a crawler reads. And the "not verified" exclusion for a
 * DEMO shop and a TEAM PREVIEW (sample content; the team's own look) was made at the band only — every other marking
 * and gate forgot it. It is now made once, in `isVerifiedShop`. Source scan, comments stripped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, '..', 'app', 'v', '[slug]', 'page.tsx'), 'utf8'));

test('the pinned review card is behind the gate', () => {
  const draws = PAGE.match(/\{[^{}\n]*\? \(\s*<PinnedReviewCard\b/g) ?? [];
  assert.equal(draws.length, 1, 'the pinned review is drawn once, behind a condition');
  assert.match(draws[0]!, /^\{isVerifiedShop && pinnedLead && pinnedLeadQuote \? \(/, `ungated: ${draws[0]}`);
});

test('the services never carry a record rating for an unverified shop — every place it is handed over', () => {
  const calls = PAGE.match(/[^\n]*cardRecordRatingFromTrusted\(trustedReviewStats\)[^\n]*/g) ?? [];
  assert.ok(calls.length >= 2, 'the record rating is still handed to the services and to photos by service');
  for (const c of calls) assert.match(c, /isVerifiedShop \? cardRecordRatingFromTrusted\(trustedReviewStats\) : null/, `ungated: ${c.trim()}`);
});

test('a crawler reads no aggregateRating the page does not show', () => {
  const at = PAGE.indexOf('vendorJsonLd.aggregateRating = {');
  assert.ok(at > 0);
  const cond = PAGE.slice(PAGE.lastIndexOf('if (', at), at);
  // The REAL paper state — not the content gate, which a demo shop and a team preview also pass — and never a demo shop.
  assert.match(cond, /^if \(\s*vendor\.verification_state === 'verified' &&\s*!renewing &&\s*!isDemoVendor &&/, 'the JSON-LD rating is emitted for an unverified or a demo shop');
  assert.doesNotMatch(cond, /isVerifiedShop/, 'the JSON-LD rating reads the content gate');
  assert.equal((PAGE.match(/aggregateRating\s*=/g) ?? []).length, 1, 'a second, ungated aggregateRating');
});

test('a demo shop and a team preview keep the full page: the exclusion is made once, in the gate itself', () => {
  assert.match(PAGE, /const isVerifiedShop = \(vendor\.verification_state === 'verified' && !renewing\) \|\| isDemoVendor \|\| teamPreview !== null;/);
  // Every "not verified" marking reads the ONE gate — none asks `verification_state` on its own and forgets the demo.
  for (const mark of ['data-shop-not-verified-band=""', 'data-shop-not-verified-slot=""', 'data-shop-footer-not-verified=""', 'data-shop-what-verified-adds=""', 'data-shop-held-services=""']) {
    const at = PAGE.indexOf(mark);
    assert.ok(at > 0, `${mark} left the page`);
    const before = PAGE.slice(Math.max(0, at - 260), at);
    assert.match(before, /\{!?isVerifiedShop\b[^{}]*$/, `${mark} is not behind isVerifiedShop`);
    assert.doesNotMatch(before.slice(before.lastIndexOf('{')), /verification_state/, `${mark} asks verification_state itself`);
  }
  assert.match(PAGE, /marker=\{isVerifiedShop \? undefined : <NotYetVerifiedTag \/>\}/);
  assert.match(PAGE, /notVerified=\{!isVerifiedShop\}/);
  assert.match(PAGE, /\{isVerifiedShop \? null : \(\s*<NotYetVerifiedTag>\{NOT_YET_VERIFIED_PHOTOS_NOTE\}/);
  // The held-services READ is behind it too: a demo shop asks for no count.
  assert.match(PAGE, /if \(!isVerifiedShop\) \{\s*const \{ count, error: heldError \}/);
  // The blue check is NOT lifted by the exclusion: Verified is still read from the paper state.
  // Papers renewal §4 (#7875): the paper state is "verified AND its papers have not lapsed" — still never the gate.
  assert.match(PAGE, /\{vendor\.verification_state === 'verified' && !renewing \? \(/);
});

test('"Setnayan Verified" is a claim: the side card reads the paper state, never the content gate', () => {
  // An unverified demo shop, or a pending shop in team preview, passes `isVerifiedShop` — and must not wear the line.
  const lines = PAGE.match(/verifiedLine=\{[^\n]*/g) ?? [];
  assert.equal(lines.length, 1, 'the side card is handed its Verified line once');
  assert.match(lines[0]!, /^verifiedLine=\{vendor\.verification_state === 'verified' && !renewing \? sideCardVerifiedLine\(/, `the line reads: ${lines[0]}`);
  assert.doesNotMatch(lines[0]!, /isVerifiedShop/);
});
