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
import { inclusionsUntouched, linesToAdd, parseTemplateText, readTemplateRows, startingInclusions, templateLines, templateToText, toIncludedTemplates } from './included-templates';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// ── 🌱 A NEW CARD OPENS WITH ITS SERVICE'S BASICS (owner, 18 Nov: "auto uploaded at the beginning") ─────────────
// Sabotage (18 Nov): drop the `!t.isProposal` filter → "a draft is never pre-filled" red; drop `initial === null`
// from the maker's seed → "only a NEW card" red (count 1 → 0).

test('a new card starts with the first approved template’s lines, choices as one words line', () => {
  const cat = { id: 'c', name: 'Catering basics', isProposal: false, rows: readTemplateRows([
    { name: 'Type', kind: 'choice', options: ['Buffet', 'Plated'], basis: 'per_pax' },
    { name: 'Tables and chairs', kind: 'plain', basis: 'none' },
    { name: 'tables and chairs', kind: 'plain', basis: 'none' },
  ]) };
  const second = { id: 'd', name: 'Plated basics', isProposal: false, rows: readTemplateRows([{ name: 'Plated dinner', kind: 'plain', basis: 'none' }]) };
  assert.deepEqual(startingInclusions([cat, second]), [{ label: 'Type: Buffet or Plated' }, { label: 'Tables and chairs' }]);
});

test('a draft is never pre-filled, and a refused or absent read pre-fills nothing', () => {
  const draft = { id: 'p', name: 'Draft basics', isProposal: true, rows: readTemplateRows([{ name: 'Staff', kind: 'plain', basis: 'none' }]) };
  assert.deepEqual(startingInclusions([draft]), []);
  assert.deepEqual(startingInclusions(null), []);
  assert.deepEqual(startingInclusions(undefined), []);
  assert.deepEqual(startingInclusions([]), []);
});

test('only a NEW card is pre-filled — never one being edited or started from another card', () => {
  const src = readFileSync(resolve(__dirname, '../app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8');
  const seed = src.match(/const \[startLines\] = useState\(\(\) => \(initial === null && !isEdit \? startingInclusions\(library\?\.includedTemplates\) : \[\]\)\);/g) ?? [];
  assert.equal(seed.length, 1, 'the seed is guarded by initial === null && !isEdit');
  const use = src.match(/<InclusionsEditor key=\{inclSeed\.key\} initial=\{initial\?\.inclusions \?\? inclSeed\.lines\}/g) ?? [];
  assert.equal(use.length, 1, 'a card started from another keeps its own lines; only a fresh one takes the basics');
});

// ── 🌱 THE BARE ADD DOOR (owner, 18 Nov: "pre-fill the bare Add door too") ───────────────────────────────────────
// Sabotage (18 Nov): make `inclusionsUntouched` always true → "a typed or swiped list is never written over" red;
// drop `inclusionsUntouched(` from the maker's door effect → "the door only refills an untouched list" red (1 → 0);
// return [] instead of null on a refused read → "a refused read is said" red.

test('a list is untouched only while it is empty or exactly the last pre-fill', () => {
  const seed = ['Type: Buffet or Plated', 'Tables and chairs'];
  assert.equal(inclusionsUntouched([], seed), true);
  assert.equal(inclusionsUntouched(['  ', ''], seed), true, 'blank rows are nothing typed');
  assert.equal(inclusionsUntouched(['Type: Buffet or Plated', 'Tables and chairs'], seed), true);
});

test('a typed or swiped list is never written over', () => {
  const seed = ['Type: Buffet or Plated', 'Tables and chairs'];
  assert.equal(inclusionsUntouched(['Type: Buffet or Plated'], seed), false, 'one line swiped away');
  assert.equal(inclusionsUntouched(['Type: Buffet or Plated', 'Tables and chairs', 'Lechon'], seed), false, 'one added');
  assert.equal(inclusionsUntouched(['Tables and chairs', 'Type: Buffet or Plated'], seed), false, 'reordered');
  assert.equal(inclusionsUntouched(['Sound system'], []), false, 'typed before any pre-fill');
});

test('stored rows map to templates in the read’s order; a broken one is left out', () => {
  const out = toIncludedTemplates([
    { template_id: 'a', name: 'Catering basics', rows: [{ name: 'Staff', kind: 'plain', basis: 'none' }], is_proposal: false },
    { template_id: 'b', name: 'Broken', rows: [{ kind: 'plain' }], is_proposal: false },
    { template_id: 'c', name: 'Draft', rows: [{ name: 'Tent', kind: 'plain', basis: 'none' }], is_proposal: true },
  ]);
  assert.deepEqual(out.map((t) => [t.id, t.isProposal]), [['a', false], ['c', true]]);
});

test('the door only refills an untouched list, and a refused read is said', () => {
  const src = readFileSync(resolve(__dirname, '../app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8');
  assert.equal((src.match(/const bareDoor = initial === null && !isEdit && library === undefined;/g) ?? []).length, 1, 'only a NEW card with no library');
  assert.equal((src.match(/if \(!inclusionsUntouched\(typed, lastSeedLabels\.current\)\) return;/g) ?? []).length, 1, 'never over typed lines');
  assert.equal((src.match(/if \(read !== doorRead\.current\) return;/g) ?? []).length, 1, 'a late answer for an earlier pick is dropped');
  const read = readFileSync(resolve(__dirname, './included-templates-read.ts'), 'utf8');
  assert.equal((read.match(/if \(error\) \{[^}]*return null;/gs) ?? []).length, 1, 'a refused read is null, never []');
});
