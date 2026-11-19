/**
 * 🔒 THE WRAP-UP IS ONE CARD (Today v3 part 3 — owner 19 Nov 2026, drawing V3 · 1; DECISION_LOG 2026-11-19 "TODAY v3
 * RULED AS A WHOLE": *"All shares but only Ultra shows"* · *"only on couple's"* · *"nothing will be removed"*).
 *
 *   1 · IN PLACE: the finished event's row opens the wrap-up inside the same card, its three steps in order; no row
 *       rises as a screen, and an event with nothing to check keeps v2's quick "I delivered";
 *   2 · ONE TAP, NO NEW ROUTE: Confirm posts the shipped files dispatcher (op `wrapup`), which shares, tags, records,
 *       and ends with the shipped `vendorMarkServiceComplete` — and a share failure marks nothing;
 *   3 · EVERY PLAN SHARES, ONLY ULTRA SHOWS: below Ultra the card says the 🔒 Problem → Solution; the story re-reads
 *       the plan and leaves out a Hide;
 *   4 · AN UNREAD READ NEVER DRAWS "NO PHOTOS": a refused files / reviews / plan read gives `null` → the quick row;
 *   5 · THE COUPLE'S WORDS ARE THE SHIPPED ONES: "Approve all" and "Hide", never "Accept".
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-19): `vendorMarkServiceComplete` called before the share (red: 2)
 *   · the 🔒 block removed (red: 3) · `return null` on a refused review read changed to `[]` facts (red: 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const CARD = read('today-wrap-up.tsx');
const V2 = read('today-v2.tsx');
const ACTION = read('../../_actions/event-files-actions.ts');
const READ = read('../../../lib/today-wrap-up.server.ts');
const STORY = read('../../../lib/story-suppliers.server.ts');
const COUPLE = read('../../dashboard/[eventId]/vendors/[vendorId]/workspace/_components/couple-story-shares-card.tsx');

test('1 · the wrap-up opens in the same card, three steps in order; nothing to check keeps the quick row', () => {
  assert.match(V2, /return w && wrapUpApplies\(w\) \? <TodayWrapUpBody facts=\{w\} \/> : <MarkCompleteBody card=\{card\} markServiceComplete=\{vendorMarkServiceComplete\} \/>;/);
  const a = CARD.indexOf('data-today-wrap-photos');
  const b = CARD.indexOf('data-today-wrap-reviews');
  const c = CARD.indexOf('data-today-wrap-confirm');
  assert.ok(a > 0 && b > a && c > b, 'the steps are not Photos → Reviews → Confirm');
  assert.doesNotMatch(CARD, /<Sheet\b|SupplierOpenRow|createPortal/, 'the wrap-up rises over Today');
  assert.match(CARD, /useState<string\[\]>\(all\)/, 'the photos are not all ticked by default');
  assert.match(CARD, /const \[starred, setStarred\] = useState<string\[\]>\(\[\]\)/, 'Inspiration is starred by default');
});

test('2 · one tap on the shipped dispatcher; a failed share marks nothing', () => {
  assert.match(CARD, /<input type="hidden" name="op" value="wrapup" \/>/);
  const op = ACTION.slice(ACTION.indexOf("if (op === 'wrapup')"));
  const share = op.indexOf("from('event_supplier_story_shares')");
  const mark = op.indexOf('await vendorMarkServiceComplete(complete)');
  assert.ok(share > 0 && mark > share, 'the service is marked delivered before the photos are shared');
  assert.equal(op.slice(0, share).indexOf('vendorMarkServiceComplete'), -1, 'the service is marked delivered before the photos are shared');
  assert.match(op.slice(share, mark), /Nothing was marked/);
});

test('3 · every plan shares; only Ultra shows', () => {
  assert.match(CARD, /facts\.ultra \? \([\s\S]*?\) : \([\s\S]*?data-today-wrap-lock=""[\s\S]*?Problem\.[\s\S]*?Solution\./, 'below Ultra the card lost its Problem → Solution');
  assert.match(STORY, /r\.tier_state === 'enterprise'/, 'the story stopped re-reading the plan');
  assert.match(STORY, /\.neq\('couple_decision', 'hidden'\)/, 'a hidden photo still shows in the story');
});

test('4 · an unread read never draws "no photos"', () => {
  assert.match(READ, /if \(args\.guestReviews\.state === 'refused' \|\| args\.ultra === null\) return null;/);
  assert.match(READ, /if \(files\.status !== 'ok'\) return null;/);
});

test('5 · the couple’s words are the shipped ones', () => {
  assert.match(COUPLE, />\s*Approve all\s*</);
  assert.match(COUPLE, /Hide some ▾/);
  assert.doesNotMatch(COUPLE, /\bAccept\b/, '"Accept" is back — the shipped words are "Approve all" and "Hide"');
});
