/**
 * ❓ QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT HOSTS ONLY.
 *
 * Owner 2026-11-04, verbatim "Yes, every supplier" (DECISION_LOG row of the same name). The feature shipped for the
 * host/MC only, and the gate was not in the schema — it was in the APP: `findBookedHost` (the `host_mc` tile) chose
 * whose questions a couple saw, the answers were read only inside the host's Script tab, and the starting questions
 * were the emcee's. This file holds the widening down, so a later edit cannot quietly narrow it back to hosts:
 *
 *   1. the starting sets follow the shop's TRADE (taxonomy tile keys), never ask what the app already knows;
 *   2. the couple's answering card is NOT host-gated;
 *   3. a supplier with no Script tab still reads the answers on the customer card;
 *   4. the chat ＋ has the row, open at every stage, in its own group, alone there;
 *   5. every supplier has a doorway to write their set;
 *   6. the news is in-app only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GENERIC_STARTERS,
  STARTERS_BY_TILE,
  STARTER_QUESTIONS,
  startersForTiles,
} from './emcee-questions';
import { TOOLS_COUPLES_SEE } from '@/app/vendor-dashboard/shop/shop-tool-shelves';
import {
  THREAD_TOOL_GROUPS,
  VENDOR_THREAD_PANELS,
  VENDOR_THREAD_TOOLS,
  vendorThreadToolRows,
} from './vendor-thread-tools';
import { supplierQuestionsHref } from './supplier-questions-href';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
/** Source with comments removed — a gate named in a comment explaining its removal must not count. */
const code = (rel: string) => stripComments(read(rel));

// ── 1 · the starting sets ──────────────────────────────────────────────────

test('the host keeps the emcee set; named trades get their own; anything else gets the generic set', () => {
  assert.deepEqual(startersForTiles(['host_mc']), [...STARTER_QUESTIONS]);
  for (const tile of ['coordinator', 'stylist_decorator', 'catering', 'photo_video']) {
    const set = startersForTiles([tile]);
    assert.ok(set.length >= 3, `${tile} has a short set`);
    assert.notDeepEqual(set, [...GENERIC_STARTERS], `${tile} must not fall back to generic`);
  }
  assert.deepEqual(startersForTiles(['mobile_bar']), [...GENERIC_STARTERS]);
  assert.deepEqual(startersForTiles([]), [...GENERIC_STARTERS]);
  assert.deepEqual(startersForTiles([null, undefined]), [...GENERIC_STARTERS]);
});

test('a shop in two trades gets both sets, in its own order, without repeats', () => {
  const both = startersForTiles(['catering', 'photo_video', 'catering']);
  assert.equal(both.length, STARTERS_BY_TILE.catering!.length + STARTERS_BY_TILE.photo_video!.length);
  assert.equal(both[0]!.prompt, STARTERS_BY_TILE.catering![0]!.prompt);
});

test('no starting question asks what the app already knows — venue, date, headcount', () => {
  for (const set of [...Object.values(STARTERS_BY_TILE), GENERIC_STARTERS]) {
    for (const s of set) {
      assert.doesNotMatch(s.prompt, /\bvenue\b|\bdate\b|how many guests|headcount|guest count/i, s.prompt);
    }
  }
});

test('the starting set is keyed by the LIVE taxonomy, not a copy of it', () => {
  const helper = code('lib/supplier-question-starters.server.ts');
  assert.match(helper, /getTaxonomy\(\)/, 'the shop’s services must resolve to tiles through getTaxonomy()');
  assert.match(helper, /tax\.map\[/);
  // The page that authors the set uses it.
  assert.match(code('app/vendor-dashboard/activities/page.tsx'), /starters=\{await startersForShopServices\(profile\.services\)\}/);
});

// ── 2 · the couple's answering card is not host-gated ──────────────────────

test('the couple’s answering card asks no host question', () => {
  const card = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/supplier-questions-card.tsx');
  assert.doesNotMatch(card, /findBookedHost|HOST_TILE|host_mc|stage_script/, 'the card must not narrow back to hosts');
  assert.match(card, /event_question_requests/, 'a supplier who SENT their set is answered before a booking');
  assert.match(card, /standing !== 'booked'/, 'a booked supplier is answered without sending');
  const page = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(page, /const supplierQuestionsSection = ev\.marketplace_vendor_id \?/, 'mounted for every Setnayan supplier');
  // Flag off: the long page draws the section. Flag on: the picked supplier's Forms page draws the SAME card, composed
  // with the forms card so its one empty line shows only when both are empty (11 Nov 2026), and says so when the
  // supplier is not on Setnayan (`?? (…)`) rather than drawing an empty page.
  assert.equal((page.match(/\{supplierQuestionsSection\}/g) ?? []).length, 1, 'the long page (flag off) lost the questions');
  assert.match(page, /const formsPage = ev\.marketplace_vendor_id \? \(\s*<SupplierQuestionsCard\b/, 'the Forms page does not draw the questions card');
  assert.match(page, /\{formsPage \?\? \(/, 'the Forms page is blank for a supplier not on Setnayan');
});

test('the answer action writes only THIS supplier’s questions, and asks the helper gate', () => {
  const action = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/question-answers-actions.ts');
  assert.match(action, /theirs\.has\(questionId\)/);
  assert.match(action, /limitedHelperRefusal\(eventId, 'vendors'\)/);
  assert.doesNotMatch(action, /redirect\(/, 'a save never resets the screen');
});

// ── 3 · every supplier reads the answers on the customer card ──────────────

test('a supplier with no Script tab reads the couple’s answers on Details', () => {
  const page = code('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /const coupleAnswersNode =\s*!showScript && feeUnlocked \?/);
  assert.match(page, /\{overviewNode\}\s*\{coupleAnswersNode\}/, 'flag-on Details tab');
  assert.match(page, /tab === 'overview' \? coupleAnswersNode : null/, 'flag-off overview');
  // The host's Script tab draws the SAME renderer.
  assert.match(code('app/vendor-dashboard/clients/[eventId]/_components/script-tab.tsx'), /import \{ TheyToldYou \} from '\.\/couple-answers'/);
});

// ── 4 · the chat ＋ row ─────────────────────────────────────────────────────

test('the ＋ sheet has "Questions for the couple", alone in "Their event · for your service"', () => {
  const tool = VENDOR_THREAD_TOOLS.find((t) => t.key === 'questions-for-couple');
  assert.ok(tool, 'the row exists');
  assert.equal(tool.label, 'Questions for the couple');
  assert.equal(tool.line, 'Your question set · they answer in their event');
  assert.equal(tool.group, 'event');
  assert.equal(THREAD_TOOL_GROUPS.find((g) => g.key === 'event')?.label, 'Their event · for your service');
  // Only the one approved row lives in that group.
  assert.deepEqual(VENDOR_THREAD_TOOLS.filter((t) => t.group === 'event').map((t) => t.key), ['questions-for-couple']);
  // Prototype order: Money · Plan · Their event · Talk & files · Just you.
  assert.deepEqual(THREAD_TOOL_GROUPS.map((g) => g.key), ['money', 'plan', 'event', 'talk', 'you']);
  // It opens a panel the page mounts.
  assert.ok(VENDOR_THREAD_PANELS.some((p) => p.id === 'questions-for-couple'));
  assert.match(code('app/vendor-dashboard/messages/[threadId]/page.tsx'), /'questions-for-couple': \(\s*<QuestionsSendPanel/);
});

test('the row is shut — never hidden — until they book you, then open', () => {
  // DECISION_LOG 2026-11-04: the set is sent "into a booked event".
  const before = vendorThreadToolRows({ hasAgreement: false, askOpen: false, paymentsToConfirm: 0, guestCountChanges: 0 });
  const shut = before.find((r) => r.tool.key === 'questions-for-couple');
  assert.ok(shut, 'listed before a booking (hide nothing)');
  assert.deepEqual(shut.shut, { reason: 'Opens once they book you' });
  const after = vendorThreadToolRows({ hasAgreement: true, askOpen: false, paymentsToConfirm: 0, guestCountChanges: 0 });
  assert.equal(after.find((r) => r.tool.key === 'questions-for-couple')?.shut, null);
});

test('the send records the ask, posts a line as the supplier, and tells the hosts in the app', () => {
  const action = code('app/vendor-dashboard/messages/[threadId]/questions-actions.ts');
  assert.match(action, /from\('event_question_requests'\)\s*\.upsert/);
  assert.match(action, /type: 'supplier_questions_sent'/);
  assert.match(action, /\.select\('event_id'\)/, 'a refused ask must not read as sent');
  assert.doesNotMatch(action, /redirect\(/, 'a save never resets the screen');
});

test('the notice lands where the couple answers — their room for that supplier, else the conversation', () => {
  assert.equal(
    supplierQuestionsHref('e1', 'v1', 't1'),
    // The questions live on the picked supplier's Forms page (moved off Details, Supplier Build 3 · Lane A).
    '/dashboard/e1/vendors/v1/workspace?tab=forms#supplier-questions',
  );
  assert.equal(supplierQuestionsHref('e1', null, 't1'), '/dashboard/e1/messages/t1');
});

// ── 5 · a doorway for every trade ──────────────────────────────────────────

test('every shop has a doorway to write its questions', () => {
  // TOOLS_COUPLES_SEE is drawn for every shop, with no category condition.
  assert.ok(TOOLS_COUPLES_SEE.some((t) => t.href === '/vendor-dashboard/activities#questions'));
  assert.match(read('app/vendor-dashboard/activities/questions-section.tsx'), /id="questions"/);
});

// ── 6 · in-app only ────────────────────────────────────────────────────────

test('the news is in-app only — no new emails without the owner’s word', () => {
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('const EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('const EMAIL_ENABLED_TYPES')));
  assert.ok(allow.length > 0);
  assert.doesNotMatch(allow, /'supplier_questions_sent'/);
  const mig = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations', '20271315529466_notification_type_supplier_questions_sent.sql'),
    'utf8',
  );
  assert.match(mig, /ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'supplier_questions_sent'/);
});
