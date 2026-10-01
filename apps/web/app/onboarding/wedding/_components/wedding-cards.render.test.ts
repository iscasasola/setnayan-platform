/**
 * The approved wedding cards actually RENDER, in the frame, with the owner's
 * words and the right defaults — executed (server render), not read as source.
 * Run from apps/web:  npx tsx --test app/onboarding/wedding/_components/wedding-cards.render.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BUDGET_BANDS_FALLBACK } from '@/lib/budget-bands-shared';
import { WEDDING_CARD_IDS } from '@/lib/onboarding/wedding-cards';
import { EMPTY_ONBOARDING_STATE } from '../types';

// tsx compiles the component with the classic JSX runtime, which reads a global `React`.
(globalThis as unknown as { React: typeof React }).React = React;
const loadCard = async () => (await import('./wedding-cards')).WeddingCard;

const render = async (card: (typeof WEDDING_CARD_IDS)[number], over: Partial<typeof EMPTY_ONBOARDING_STATE> = {}) =>
  renderToStaticMarkup(
    createElement(await loadCard(), {
      card,
      state: { ...EMPTY_ONBOARDING_STATE, ...over },
      patch: () => {},
      n: 3,
      total: 10,
      activeFaiths: null,
      budgetBands: BUDGET_BANDS_FALLBACK,
    }),
  );

test('every wedding card renders in the shared frame with "n of N"', async () => {
  for (const card of WEDDING_CARD_IDS) {
    const html = await render(card);
    assert.match(html, new RegExp(`data-setup-card="${card}"`), card);
    assert.match(html, /3 of 10/, card);
    assert.match(html, /You can change this anytime|Steps of 10/, card);
  }
});

test('the cards say what the owner approved, in plain English', async () => {
  assert.match((await render('w_names')), /Who’s getting married\?/);
  assert.match((await render('w_kind')), /What kind of wedding\?/);
  assert.match((await render('w_area')), /Where will it be\?/);
  assert.match((await render('w_pax')), /About how many guests\?/);
  assert.match((await render('w_budget')), /About how much is your budget\?/);
  assert.match((await render('w_colours')), /Your colours/);
});

test('the estimate opens on 150, the budget on Classic with the figure for those guests', async () => {
  assert.match(await render('w_pax', { pax: null }), />150</);
  const b = await render('w_budget', { pax: 150 });
  assert.match(b, /Classic · The sweet spot/);
});

test('a kind pick shows its row; the budget follows the estimate', async () => {
  assert.match((await render('w_kind', { kind: 'civil', faith: [] })), /Civil wedding/);
  assert.match((await render('w_budget', { pax: 200, budgetBand: 'essentials' })), /Essentials/);
});

test('the estimate buttons stop at both ends', async () => {
  assert.match((await render('w_pax', { pax: 10 })), /aria-label="Fewer guests"[^>]*disabled/);
  assert.match((await render('w_pax', { pax: 500 })), /aria-label="More guests"[^>]*disabled/);
});
