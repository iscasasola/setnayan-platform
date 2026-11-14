/**
 * 🗃 THE PHRASE BANK SIMULATOR (ASK-BRAIN, owner 14 Nov 2026: *"simulate all the possible text i will place and to
 * produce the most accurate output"*).
 *
 *   1. The committed bank (`ask-phrase-bank.generated.ts`) is exactly what `buildPhraseBank()` builds today — a menu
 *      item, a job or a keyword-table row that changes lands in the PR as readable lines (`pnpm admin:phrases`).
 *   2. EVERY phrase is run through the SHIPPED box (`rankPalette`, the function the palette calls) and the first row it
 *      would open is compared with the phrase's expected place. Top-1 accuracy is held to a MEASURED floor and every
 *      miss is printed, so a drop names the phrases it broke.
 *
 * Measured 14 Nov 2026 on this bank: the box as it was (the ranker alone) put the right place first for 64.7 % of
 * phrases; with the keyword table, job phrasing and page names it is 100 %. The floor is the measured value, not a
 * hope — raise it when the box gets better, never lower it to go green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_JOBS } from './admin-jobs.generated';
import { ADMIN_ROUTES } from './admin-routes.generated';
import { ASK_PHRASE_BANK } from './ask-phrase-bank.generated';
import { buildPhraseBank, samePlace, type BankEntry } from './ask-phrase-bank';
import { rankPalette } from './palette-rank';
import { buildDestinations } from '@/app/admin/_components/admin-destinations';

const ALL = buildDestinations();

/** The share of phrases whose first row must open the expected place. Measured 14 Nov 2026: 1.0. */
const ACCURACY_FLOOR = 0.995;
/** The bank must stay comprehensive — a generator that quietly stops producing is a pass over nothing. */
const MIN_BANK_SIZE = 1500;

function firstPlace(phrase: string): string {
  return rankPalette(ALL, phrase, ADMIN_JOBS, ADMIN_ROUTES).firstHref ?? '';
}

test('the committed bank is exactly what the generator builds (run: pnpm --filter @setnayan/web admin:phrases)', () => {
  const fresh = buildPhraseBank(ALL, ADMIN_JOBS, ADMIN_ROUTES);
  assert.deepEqual(
    ASK_PHRASE_BANK.map((e) => `${e.from} · ${e.phrase} → ${e.expect}`),
    fresh.map((e) => `${e.from} · ${e.phrase} → ${e.expect}`),
    'the phrase bank drifted from the box — regenerate it and read the diff',
  );
});

test('the bank is comprehensive: every source contributes, and it is not a handful', () => {
  assert.ok(ASK_PHRASE_BANK.length >= MIN_BANK_SIZE, `only ${ASK_PHRASE_BANK.length} phrases`);
  for (const from of ['page', 'job', 'keyword', 'typo'] as const) {
    assert.ok(ASK_PHRASE_BANK.some((e) => e.from === from), `no ${from} phrases — a source stopped contributing`);
  }
  // Taglish is in it, not only English.
  for (const w of ['gawa', 'palitan', 'hanapin', 'tanggalin', 'presyo']) {
    assert.ok(ASK_PHRASE_BANK.some((e) => e.phrase.split(' ').includes(w)), `no phrase uses "${w}"`);
  }
});

test('the box opens the expected place first for (at least) the measured share of the bank — misses printed', () => {
  const misses: string[] = [];
  for (const e of ASK_PHRASE_BANK as readonly BankEntry[]) {
    const got = firstPlace(e.phrase);
    if (!samePlace(got, e.expect, ADMIN_ROUTES)) misses.push(`${e.from} · "${e.phrase}" → ${got || '(nothing)'} — want ${e.expect}`);
  }
  const accuracy = 1 - misses.length / ASK_PHRASE_BANK.length;
  if (misses.length) console.log(`ask-phrase-bank misses (${misses.length}):\n${misses.join('\n')}`);
  assert.ok(
    accuracy >= ACCURACY_FLOOR,
    `top-1 accuracy ${(accuracy * 100).toFixed(1)}% fell below the floor ${(ACCURACY_FLOOR * 100).toFixed(1)}% — ${misses.length} misses above`,
  );
});

test('samePlace reads the screen, not the spelling of its address', () => {
  assert.ok(samePlace('/admin/pricing?tab=pricing#sku-live-studio', '/admin/pricing?tab=pricing', ADMIN_ROUTES));
  assert.ok(!samePlace('/admin/pricing?tab=pricing', '/admin/pricing?tab=price-bands', ADMIN_ROUTES));
  assert.ok(!samePlace('/admin/payments', '/admin/pricing?tab=pricing', ADMIN_ROUTES));
});
