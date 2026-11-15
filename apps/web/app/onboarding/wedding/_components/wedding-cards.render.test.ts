/**
 * The approved wedding cards actually RENDER, in the frame, with the owner's
 * words and the right defaults — executed (server render), not read as source.
 * Run from apps/web:  npx tsx --test app/onboarding/wedding/_components/wedding-cards.render.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
      pickSelf: () => {},
      n: 3,
      total: 10,
      activeFaiths: null,
      budgetBands: BUDGET_BANDS_FALLBACK,
      searchVenues: async () => [],
    }),
  );

test('every wedding card renders in the shared frame with "n of N"', async () => {
  for (const card of WEDDING_CARD_IDS) {
    const html = await render(card);
    assert.match(html, new RegExp(`data-setup-card="${card}"`), card);
    assert.match(html, /3 of 10/, card);
    // F-W2-08 (walk 14 Nov): said once, on the first card — never under every step; F-W2-07: never "Steps of 10".
    if (card === 'w_names') assert.match(html, /You can change this anytime/, card);
    else assert.doesNotMatch(html, /You can change this anytime/, card);
    assert.doesNotMatch(html, /Steps of 10/, card);
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
  // F-W2-09 (walk 14 Nov): the SHUT pill carries the peso amount for those guests.
  assert.match(b, /<span class="min-w-0 truncate">Classic · about ₱[\d,]+<\/span>/);
});

test('a kind pick shows its row; the budget follows the estimate', async () => {
  assert.match((await render('w_kind', { kind: 'civil', faith: [] })), /Civil wedding/);
  assert.match((await render('w_budget', { pax: 200, budgetBand: 'essentials' })), /Essentials/);
});

test('the estimate buttons stop at both ends', async () => {
  assert.match((await render('w_pax', { pax: 10 })), /<button[^>]*disabled=""[^>]*aria-label="Fewer guests"/);
  assert.match((await render('w_pax', { pax: 500 })), /<button[^>]*disabled=""[^>]*aria-label="More guests"/);
});

test('🔑 names: "Which one is you?" comes first — no name rows until it is answered', async () => {
  const before = await render('w_names', { role: null, brideFirstName: 'Maria', groomFirstName: 'Juan' });
  assert.match(before, /Which one is you\?/);
  assert.match(before, /data-wedding-self/);
  assert.match(before, />Pick one</);
  assert.ok(!/data-wedding-name-row/.test(before), 'no name row is drawn before the pick');
  // an old draft's helper has not answered it either
  assert.ok(!/data-wedding-name-row/.test(await render('w_names', { role: 'helper' })));
});

test('🔑 names: your row carries the name tokens; the partner’s row is empty with autofill off', async () => {
  for (const side of ['bride', 'groom'] as const) {
    const partner = side === 'bride' ? 'groom' : 'bride';
    const own = side === 'bride' ? { brideFirstName: 'Ice', brideLastName: 'Casasola' } : { groomFirstName: 'Ice', groomLastName: 'Casasola' };
    const html = await render('w_names', { role: side, ...own });
    // Each name is a `TypedRow boxed` (the one Field template): at rest its words sit in the pill; the open field (with
    // its autocomplete token) is drawn on a tap, so the token is pinned at the source below.
    const rows = (s: string) =>
      [...html.matchAll(new RegExp(`<div[^>]*data-wedding-name-row="${s}"[\\s\\S]*?data-form-row-words=""[^>]*>([^<]*)<`, 'g'))].map((m) => [m[0], m[1] ?? ''] as const); // a row with no words reads as empty, never undefined
    const mine = rows(side);
    const theirs = rows(partner);
    assert.equal(mine.length, 2, side);
    assert.equal(theirs.length, 2, side);
    assert.match(mine[0]![0], /data-wedding-own-row=""/, `${side}: your row is marked yours`);
    assert.equal(mine[0]![1], 'Ice');
    assert.equal(mine[1]![1], 'Casasola');
    for (const t of theirs) {
      assert.doesNotMatch(t[0], /data-wedding-own-row/, `${side}: the partner's row is not yours`);
      assert.ok(!/Ice|Casasola/.test(t[1]), `${side}: the partner's row is not prefilled`);
    }
    assert.match(html, new RegExp(`${side === 'bride' ? 'Bride' : 'Groom'} · you`));
  }
});

test('🔑 names: the open field offers the phone’s saved name on your row only — autofill off on the partner’s', () => {
  const cards = readFileSync(join(process.cwd(), 'app/onboarding/wedding/_components/wedding-cards.tsx'), 'utf8');
  assert.match(cards, /autoComplete=\{rowSide === side \? token : 'off'\}/);
  assert.match(cards, /'brideFirstName', true, 'given-name'\)/);
  assert.match(cards, /'brideLastName', false, 'family-name'\)/);
  assert.match(cards, /'groomFirstName', true, 'given-name'\)/);
  assert.match(cards, /'groomLastName', false, 'family-name'\)/);
});

test('F-W2-04 · a fresh names card shows no red "Required" before a letter is typed', async () => {
  const html = await render('w_names', { role: 'bride', brideFirstName: '', groomFirstName: '' });
  assert.match(html, /data-wedding-name-row="bride"/, 'the name rows did not open');
  assert.doesNotMatch(html, /data-form-row-required/, '"Required" is shown before the couple has typed');
});
