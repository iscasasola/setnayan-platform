/**
 * the-quote-walks-five-steps.test.ts — the builder draws exactly the five
 * steps `lib/quote-stages.ts` names, in that order, each once, each ending in
 * the next — and folds a step by HIDING it, never by unmounting its controls.
 *
 * ⚖ OWNER, 2026-09-22: *"create evident separation for different brain
 * processes … build a clean continuity."* The rule is executed in
 * `lib/quote-stages.test.ts`; this pins the mounts.
 *
 * 🔑 EVERY COUNT IS AN EXACT NUMBER AT A TAG BOUNDARY. A guard that finds *a*
 * step finds nothing; five steps drawn six times would pass a substring grep.
 *
 * 🛡 Sabotages watched red: a sixth `<QuoteStage>`; two steps swapped; the
 * folded body unmounted (`{isCur ? children : null}`) instead of hidden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QUOTE_STAGES } from '../../lib/quote-stages';

const maker = readFileSync(join(__dirname, 'proposal-maker.tsx'), 'utf8');
const count = (re: RegExp) => (maker.match(re) ?? []).length;

test('exactly five steps, opened and closed in pairs', () => {
  assert.equal(count(/<QuoteStage \{\.\.\.stageProps\('[a-z]+'\)\}>/g), 5);
  assert.equal(count(/<\/QuoteStage>/g), 5);
});

test('the five steps are the five the rule names, once each, in the rule\'s order', () => {
  const found = [...maker.matchAll(/<QuoteStage \{\.\.\.stageProps\('([a-z]+)'\)\}>/g)].map((m) => m[1]);
  assert.deepEqual(found, QUOTE_STAGES.map((s) => s.id));
});

test('each step holds the block the owner put in it', () => {
  const body = (id: string) => {
    const from = maker.indexOf(`<QuoteStage {...stageProps('${id}')}>`);
    const to = maker.indexOf('</QuoteStage>', from);
    return maker.slice(from, to);
  };
  assert.match(body('know'), /Header — seeded pax\/hours/);
  assert.match(body('offer'), /data-testid="quote-card-picker"/);
  assert.match(body('offer'), /Bundle picker/);
  assert.match(body('price'), /Line items/);
  assert.match(body('price'), /Crew meal & transportation/);
  assert.match(body('price'), /testId="papic-quote-notice"/);
  assert.match(body('terms'), /Payment schedule — self-balancing/);
  assert.match(body('terms'), /Accepted payment methods/);
  assert.match(body('terms'), /Note to the couple/);
  assert.match(body('send'), /<SubmitButton/);
  assert.doesNotMatch(body('terms'), /<SubmitButton/, 'Send lives on the last step only');
});

test('a folded step HIDES its body — inputs stay mounted, every existing mount guard keeps its count', () => {
  const block = maker.slice(maker.indexOf('function QuoteStage('), maker.indexOf('/* ── Component'));
  assert.match(block, /<div hidden=\{!isCur\}/);
  assert.doesNotMatch(block, /isCur \? children : null/);
});

test('every step but the last ends in a Next that names the following step; the strip is mounted once', () => {
  const block = maker.slice(maker.indexOf('function QuoteStage('), maker.indexOf('/* ── Component'));
  assert.match(block, /Next · \{QUOTE_STAGES\.find\(\(d\) => d\.id === nextStage\(id\)\)\?\.title\}/);
  assert.match(block, /onNext && def\.lead \?/, 'no Next on a step without a lead (the last)');
  assert.equal(count(/data-testid="quote-step-strip"/g), 1);
  assert.match(maker, /useState<QuoteStageId>\(\(\) => openingStage\(\{ revision: revision != null \}\)\)/, 'an update opens at the price');
});
