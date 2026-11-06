/**
 * GUARD — 💬 REVIEWS ARE READ AND ANSWERED ON SHOP › PAGE › REVIEWS AND STORIES (owner 2026-11-06, verbatim: *"Use fable
 * to decide. Find the best location for each. Make the pages live there and not jump to another menu."* — DECISION_LOG
 * "ONE HOME FOR EVERY PROMOTE TOOL": Page › Reviews and stories = read + reply to reviews in place; `/reviews` forwards
 * there).
 *
 *   1. The fold draws the reply list in place — no "Reply to a review" row that jumps away.
 *   2. The list is the LIFTED card: the one public reply (`postVendorReply`), the read-only posted reply, Flag as fake —
 *      and the reply box keeps `id="reply_<id>"`, so a link to one review lands on it.
 *   3. ONE read feeds the pin picker and the list; a refused read is said, never "no reviews".
 *   4. A reply refreshes the page it was written on (and the desk, when written there).
 *   5. `/vendor-dashboard/reviews` only forwards; every door that pointed at it now points at Page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { shopToolShelves } from '../shop/shop-tool-shelves';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PARTS = read('app/vendor-dashboard/website/_components/page-parts.tsx');
const LIST = read('app/vendor-dashboard/website/_components/review-replies.tsx');
const PAGE = read('app/vendor-dashboard/website/page.tsx');
const DATA = read('app/vendor-dashboard/website/page-data.ts');
const ACTIONS = read('app/vendor-dashboard/reviews/actions.ts');

test('1 · the Reviews and stories fold draws the replies in place — no row that jumps away', () => {
  const at = PARTS.indexOf('anchor="reviews"');
  const fold = PARTS.slice(at, PARTS.indexOf('</Fold>', at));
  assert.ok(at > 0, 'the Reviews and stories fold is gone');
  assert.match(fold, /\{reviewsBody\}/, 'the reply list is not in the fold');
  assert.doesNotMatch(fold, /vendor-dashboard\/reviews|Reply to a review/, 'the go-elsewhere row is back');
  assert.match(PAGE, /reviewsBody=\{<ReviewReplies reviews=\{d\.replyRows\}/);
  assert.doesNotMatch(PARTS + LIST, /Edit in |↗/);
});

test('2 · the lifted card: one public reply, the posted reply read-only, Flag as fake, the reply_<id> box', () => {
  assert.match(LIST, /import \{ postVendorReply, submitFlagAsFake \} from '\.\.\/\.\.\/reviews\/actions';/);
  assert.match(LIST, /<form action=\{postVendorReply\}/);
  assert.match(LIST, /<form action=\{submitFlagAsFake\}/);
  assert.match(LIST, /maxLength=\{VENDOR_REPLY_MAX_CHARS\}/);
  assert.match(LIST, /id=\{`reply_\$\{reviewId\}`\}/, 'a link to one review no longer lands on its box');
  assert.match(LIST, /review\.vendor_reply \? <ExistingReplySection/, 'a posted reply is offered a second form');
  assert.match(LIST, /can’t be edited once posted/);
  // Waiting reviews first.
  assert.match(LIST, /const ordered = \[\.\.\.waiting, \.\.\.reviews\.filter\(\(r\) => !!r\.vendor_reply\)\];/);
  // A deep link to one review opens the fold through its own anchor, then reaches the box.
  assert.match(PARTS, /\/\^#reply_\[\\w-\]\+\$\/\.test\(hash\)[\s\S]{0,120}replaceState\(null, '', '#reviews'\)[\s\S]{0,120}new HashChangeEvent\('hashchange'\)/);
});

test('3 · one read for the pin picker and the list; a refused read is said', () => {
  assert.equal([...DATA.matchAll(/fetchReviewsForVendorWithCouple\(/g)].length, 1, 'the reviews are read twice');
  assert.match(DATA, /const options = rows\.slice\(0, 20\)/, 'the pin picker no longer takes the first 20');
  assert.match(DATA, /replyRows: reviews\?\.rows \?\? null,/);
  assert.match(LIST, /if \(reviews === null\) \{[\s\S]{0,120}role="alert"/, 'a refused read reads as "no reviews"');
  assert.match(LIST, /capped \? <p/, 'the cap is not said');
});

test('4 · a reply refreshes the page it was written on', () => {
  const reply = ACTIONS.slice(ACTIONS.indexOf('export async function postVendorReply'), ACTIONS.indexOf('export async function submitFlagAsFake'));
  assert.match(reply, /revalidatePath\('\/vendor-dashboard\/website'\)/);
  assert.match(reply, /if \(answeredOnTheDesk\) revalidatePath\('\/vendor-dashboard'\)/);
  const flag = ACTIONS.slice(ACTIONS.indexOf('export async function submitFlagAsFake'));
  assert.match(flag, /revalidatePath\('\/vendor-dashboard\/website'\)/);
});

test('5 · /reviews only forwards; every door points at Page', () => {
  const fwd = read('app/vendor-dashboard/reviews/page.tsx');
  assert.match(fwd, /redirect\('\/vendor-dashboard\/website#reviews'\)/);
  assert.doesNotMatch(fwd, /fetchReviews|createClient|<form/);
  for (const f of [
    'app/vendor-dashboard/_components/overview-sections.tsx',
    'app/vendor-dashboard/_components/supplier-today-first-screen.tsx',
    'app/dashboard/[eventId]/vendors/[vendorId]/review/actions.ts',
    'lib/vendor-growth-recs.ts',
    'app/vendor-dashboard/_components/vendor-bottom-nav.tsx',
  ]) {
    assert.doesNotMatch(read(f), /\/vendor-dashboard\/reviews\b/, `${f} still points at the forwarding stub`);
  }
  const shelves = shopToolShelves(true, true).flatMap((g) => g.tools.map((t) => t.href));
  assert.ok(!shelves.includes('/vendor-dashboard/reviews'), 'Reviews is still on the shelves (Settings › More tools)');
});
