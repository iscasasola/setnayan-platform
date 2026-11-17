/**
 * card-maker-part-2.test.ts — the pure halves of Card Maker HYBRID part 2 (DECISION_LOG 2026-11-17):
 *   💳 a saved pay plan round-trips through the stored shape, and the save reads exactly one intent from the form;
 *   📋 a Setnayan template adds words only — no price ever gets in, a line is never added twice;
 *   📝 a video link is https only; the description and link are read only when the screen drew them.
 *
 * Sabotage (2026-11-17): drop the PRICE_WORDS check → "₱500" test red; let `linesToAdd` skip the dedupe → the
 * "not twice" test red; treat an empty `pay_plan_scope` as "this" → the "All N cards by default" test red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPlanName, planItemsFromRows, planItemsToDrafts, planScopeQuestion, readPlanIntent, samePlanRows } from './vendor-pay-plans';
import { linesToAdd, parseTemplateText, readTemplateRows, templateLines, templateToText } from './included-templates';
import { cleanVideoUrl, readCardAbout, videoSiteName } from './card-about';
import type { ParsedScheduleRow } from './service-card-save-parts';

const ROWS: ParsedScheduleRow[] = [
  {
    seq: 0,
    label: 'Reservation fee',
    amount_kind: 'percent',
    percent_bps: 3000,
    amount_centavos: null,
    due_anchor: 'on_lock',
    due_offset_days: 0,
    cancellation_terms: 'Holds your date.',
    downpayment_non_refundable: true,
    refund_window_days: 7,
    no_show_forfeit: true,
  },
  {
    seq: 1,
    label: 'Second payment',
    amount_kind: 'fixed',
    percent_bps: null,
    amount_centavos: 2_000_000,
    due_anchor: 'before_event',
    due_offset_days: 60,
    cancellation_terms: 'smuggled',
    downpayment_non_refundable: true,
    refund_window_days: 3,
    no_show_forfeit: true,
  },
];

const form = (entries: [string, string][]) => {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
};
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

// ── 💳 pay plans ────────────────────────────────────────────────────────────

test('a plan round-trips: card rows → stored items → editor drafts, the no-show terms on the first payment only', () => {
  const items = planItemsFromRows(ROWS);
  assert.equal(items.length, 2);
  assert.equal('seq' in (items[0] as object), false, 'array order is the seq');
  assert.equal(items[1]!.cancellation_terms, null, 'a later payment never carries the terms');
  assert.equal(items[1]!.no_show_forfeit, false);
  const drafts = planItemsToDrafts(JSON.parse(JSON.stringify(items)));
  assert.ok(drafts);
  assert.deepEqual(
    drafts.map((d) => [d.seq, d.label, d.amount_kind, d.percent, d.amount_php, d.due_anchor, d.due_offset_days]),
    [
      [0, 'Reservation fee', 'percent', 30, null, 'on_lock', 0],
      [1, 'Second payment', 'fixed', null, 20000, 'before_event', 60],
    ],
  );
  assert.equal(drafts[0]!.cancellation_terms, 'Holds your date.');
  assert.equal(samePlanRows(drafts, planItemsToDrafts(items)!), true);
  assert.equal(samePlanRows(drafts, [{ ...drafts[0]!, percent: 25 }, drafts[1]!]), false, 'a changed amount is a changed plan');
});

test('a stored plan that does not hold together is unreadable as a whole, never shown with a payment missing', () => {
  assert.equal(planItemsToDrafts([{ label: 'Fee', amount_kind: 'percent' }]), null);
  assert.equal(planItemsToDrafts([{ label: '', amount_kind: 'fixed', amount_centavos: 100 }]), null);
  assert.equal(planItemsToDrafts([]), null);
  assert.equal(planItemsToDrafts('nope'), null);
});

test('a plan name is trimmed and capped', () => {
  assert.equal(cleanPlanName('  My   3-step plan '), 'My 3-step plan');
  assert.equal(cleanPlanName('   '), null);
  assert.equal(cleanPlanName('x'.repeat(61)), null);
  assert.equal(planScopeQuestion(4), 'Change it on all 4 cards, or just this one?');
});

test('the save reads ONE plan intent from the form', () => {
  assert.equal(readPlanIntent(form([])), null, 'a screen that did not draw the plan leaves it alone');
  assert.deepEqual(readPlanIntent(form([['pay_plan_present', '1'], ['pay_plan_id', '']])), { kind: 'own' });
  assert.deepEqual(
    readPlanIntent(form([['pay_plan_present', '1'], ['pay_plan_save_name', ' My plan '], ['pay_plan_apply_to', A], ['pay_plan_apply_to', A], ['pay_plan_apply_to', 'junk']])),
    { kind: 'save', name: 'My plan', applyTo: [A] },
  );
  assert.deepEqual(readPlanIntent(form([['pay_plan_present', '1'], ['pay_plan_id', B], ['pay_plan_apply_to', A]])), { kind: 'follow', planId: B, applyTo: [A] });
  assert.deepEqual(
    readPlanIntent(form([['pay_plan_present', '1'], ['pay_plan_id', B], ['pay_plan_edited', '1'], ['pay_plan_scope', '']])),
    { kind: 'all', planId: B, applyTo: [] },
    'All N cards is what the question shows picked',
  );
  assert.deepEqual(readPlanIntent(form([['pay_plan_present', '1'], ['pay_plan_id', B], ['pay_plan_edited', '1'], ['pay_plan_scope', 'this']])), { kind: 'detach' });
  assert.equal(readPlanIntent(form([['pay_plan_present', '1'], ['pay_plan_id', 'not-a-uuid']]))?.kind, 'error');
  assert.equal(readPlanIntent(form([['pay_plan_present', '1'], ['pay_plan_save_name', 'x'.repeat(80)]]))?.kind, 'error');
});

// ── 📋 Setnayan's starting What's included ─────────────────────────────────

test('the admin box reads one row per line — plain, a choice, how a choice would add — and back', () => {
  const p = parseTemplateText('Type: Buffet / Plated | per pax\nFood tasting | tasting\n\nTables and chairs');
  assert.ok(p.ok);
  assert.deepEqual(p.rows, [
    { name: 'Type', kind: 'choice', options: ['Buffet', 'Plated'], basis: 'per_pax' },
    { name: 'Food tasting', kind: 'plain', basis: 'tasting' },
    { name: 'Tables and chairs', kind: 'plain', basis: 'none' },
  ]);
  assert.equal(templateToText(p.rows), 'Type: Buffet / Plated | per pax\nFood tasting | tasting\nTables and chairs');
});

test('an included row never carries a price', () => {
  for (const line of ['Lechon ₱500', 'Lechon 500 pesos', 'Lechon | PHP', 'Lechon P500']) {
    const p = parseTemplateText(line);
    assert.equal(p.ok, false, line);
  }
  assert.equal(parseTemplateText('Type: Buffet').ok, false, 'a choice needs two or more');
  assert.equal(parseTemplateText('Staff | hourly').ok, false, 'an unknown basis is said');
  assert.equal(parseTemplateText('').ok, false);
});

test('loading a template adds its words under what is typed, never twice', () => {
  const rows = readTemplateRows([
    { name: 'Type', kind: 'choice', options: ['Buffet', 'Plated'], basis: 'per_pax' },
    { name: 'Tables and chairs', kind: 'plain', basis: 'none' },
    { name: 'Venue use', kind: 'choice', options: ['Half day', 'Full day', 'Overnight'], basis: 'flat' },
    { name: '', kind: 'plain' },
    { name: 'Odd', kind: 'choice', options: ['Only one'] },
  ]);
  assert.equal(rows.length, 3, 'a row that does not hold together is dropped, never invented');
  const lines = templateLines(rows);
  assert.deepEqual(lines, ['Type: Buffet or Plated', 'Tables and chairs', 'Venue use: Half day, Full day or Overnight']);
  assert.deepEqual(linesToAdd(['tables AND chairs', 'Lights'], lines), ['Type: Buffet or Plated', 'Venue use: Half day, Full day or Overnight']);
});

// ── 📝 description + video link ─────────────────────────────────────────────

test('a video link is https only', () => {
  assert.equal(cleanVideoUrl('youtu.be/abc'), 'https://youtu.be/abc');
  assert.equal(cleanVideoUrl('https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc');
  assert.equal(cleanVideoUrl('http://youtu.be/abc'), null);
  assert.equal(cleanVideoUrl('javascript:alert(1)'), null);
  assert.equal(cleanVideoUrl('not a link'), null);
  assert.equal(videoSiteName('https://www.youtube.com/watch?v=abc'), 'youtube.com');
});

test('the description and link are read only when the screen drew them', () => {
  assert.deepEqual(readCardAbout(form([['description', 'x']])), { present: false });
  assert.deepEqual(readCardAbout(form([['about_present', '1'], ['description', '  A lakeside garden. '], ['video_url', '']])), {
    present: true,
    ok: true,
    about: { description: 'A lakeside garden.', video_url: null },
  });
  const bad = readCardAbout(form([['about_present', '1'], ['description', ''], ['video_url', 'ftp://x.y']]));
  assert.equal(bad.present && !bad.ok, true);
  const long = readCardAbout(form([['about_present', '1'], ['description', 'x'.repeat(1001)]]));
  assert.equal(long.present && !long.ok, true);
});
