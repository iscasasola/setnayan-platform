/**
 * SUP-65 · ONE PLANNED FIGURE PER CATEGORY, ON EVERY PAGE THAT PRINTS ONE.
 *
 * `/budget`'s ledger has a Planned column. The Merkado's category rails now
 * print a Planned figure too. Two screens, one fact — so they must come from
 * one rule (`resolvePlanned` + `suggestedPlanByBucket` in `lib/budget-ledger.ts`),
 * or the same wedding reads ₱120,000 for catering on one and ₱95,000 on the
 * other. (The vendors page ALSO holds `budgetByPlanGroup`, which folds in the
 * band estimate for ranking; printing that would be the second answer.)
 *
 * The rule is EXECUTED here; the pages are then pinned to calling it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { resolvePlanned } from '@/lib/budget-ledger';
import { buildPlanBudgetModel } from '@/lib/vendors-plan-budget';

const here = dirname(fileURLToPath(import.meta.url));
const VENDORS_PAGE = resolve(here, '../app/dashboard/[eventId]/vendors/page.tsx');
const ACCORDION = resolve(
  here,
  '../app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx',
);
const src = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('saved wins, the suggestion is the fallback, and zero is not a plan', () => {
  const saved = new Map<string, number | null>([['catering', 120_000], ['flowers', 0]]);
  const suggested = new Map<string, number | null>([
    ['catering', 95_000],
    ['flowers', 40_000],
    ['cake', 0],
  ]);
  assert.deepEqual(resolvePlanned('catering', saved, suggested), {
    plannedPhp: 120_000,
    plannedSource: 'saved',
  });
  // A saved ₱0 is a defaulted column, not a decision — the suggestion shows.
  assert.deepEqual(resolvePlanned('flowers', saved, suggested), {
    plannedPhp: 40_000,
    plannedSource: 'suggested',
  });
  assert.equal(resolvePlanned('cake', saved, suggested), null, 'a ₱0 plan was printable');
  assert.equal(resolvePlanned('lights', saved, suggested), null);
});

test('the model carries the planned figure to its category, and nothing without one', () => {
  const base = {
    vendorRows: [],
    estimatedBudgetCentavos: null,
    daysUntilWedding: null,
    ceremonyType: null,
    venueSetting: null,
  };
  const withPlan = buildPlanBudgetModel({
    ...base,
    plannedByGroup: new Map([['catering', { plannedPhp: 120_000, plannedSource: 'saved' as const }]]),
  });
  const children = withPlan.folders.flatMap((f) => f.children);
  const catering = children.find((c) => c.groupId === 'catering');
  assert.ok(catering, 'fixture assumes a `catering` plan group exists');
  assert.deepEqual(catering.planned, { php: 120_000, source: 'saved' });
  assert.ok(
    children.filter((c) => c.groupId !== 'catering').every((c) => c.planned === null),
    'a category with no plan was given one',
  );

  const without = buildPlanBudgetModel(base);
  assert.ok(without.folders.flatMap((f) => f.children).every((c) => c.planned === null));
});

test('the vendors page builds the rails’ figure through resolvePlanned, not the ranking map', () => {
  const s = src(VENDORS_PAGE);
  assert.ok(/\bresolvePlanned\(/.test(s), 'vendors page no longer calls resolvePlanned');
  assert.ok(/\bsuggestedPlanByBucket\(\{/.test(s), 'vendors page no longer calls suggestedPlanByBucket');
  assert.ok(
    /\bisWedding:\s*isWeddingPlan\b/.test(s),
    'the wedding gate is not passed — a debut would be shown a wedding plan',
  );
  assert.ok(
    /buildPlanBudgetModel\(\{[\s\S]*?\bplannedByGroup\b[\s\S]*?\}\);/.test(s),
    'plannedByGroup is not handed to the model — the rails would print nothing',
  );
  assert.ok(
    !/plannedByGroup\.set\([^)]*budgetByPlanGroup/.test(s),
    'the rails are fed from the ranking map, which folds in the band estimate',
  );
});

test('the rail renders the figure and says which plan it is', () => {
  const s = src(ACCORDION);
  const mounts = s.match(/\{child\.planned \? \(/g) ?? [];
  assert.equal(mounts.length, 2, `expected the head figure and the body sentence, found ${mounts.length}`);
  assert.ok(/child\.planned\.source === 'saved'/.test(s), 'the rail no longer distinguishes saved from suggested');
});
