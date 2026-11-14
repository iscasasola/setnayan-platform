/**
 * 💰 F-W2-29 (Controller walkthrough, 2026-11-13): inside the app NO Event Plus was offered anywhere, though /pricing
 * offers it, and no Papic credits were shown with the plans. The plan screen (this page) now offers Free · Event Plus ·
 * Event Pro, each price and its included credits READ from the catalogue through the front door's own helpers.
 *
 * Executed, not grepped: the real component is rendered with figures handed in, and must show exactly those — and
 * nothing at all where a row did not read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanOffer, UltraOffer, proCreditsLine, type PlanOfferFacts } from './_components/plan-offer';
import { planCreditsFrom, planPricesFrom, PLAN_PRICE_CODES } from '@/lib/event-plans';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));

const facts = (over: Partial<PlanOfferFacts> = {}): PlanOfferFacts => ({
  plusPhp: 1234,
  plusCredits: 4321,
  proCredits: 8765,
  freePapic: null,
  plus: 'buy',
  ultraPhp: 5678,
  ultraCredits: 3456,
  ultra: 'buy',
  paidTowardAPlan: false,
  ...over,
});
const drawUltra = (f: PlanOfferFacts) =>
  renderToStaticMarkup(
    React.createElement(UltraOffer, { facts: f, ultraDrawer: (php: number) => React.createElement('button', { 'data-buy-ultra': php }, 'buy') }),
  );
const draw = (f: PlanOfferFacts, proHeld = false) =>
  renderToStaticMarkup(
    React.createElement(PlanOffer, { facts: f, proHeld, plusDrawer: (php: number) => React.createElement('button', { 'data-buy-plus': php }, 'buy') }),
  );

test('Free and Event Plus are offered, with the price and credits the catalogue handed in', () => {
  const html = draw(facts());
  assert.match(html, /data-event-plan="free"/);
  assert.match(html, /data-event-plan="plus"/);
  assert.match(html, /₱1,234/, 'the Plus price read from the row');
  assert.match(html, /4,321 Papic credits/, 'the Plus credits read from the row');
  assert.match(html, /data-buy-plus="1234"/, 'the buy button charges the catalogue price');
  assert.match(html, /Your plan/, 'a couple holding nothing is on Free');
  assert.equal(proCreditsLine(8765), '8,765 Papic credits included.');
});

test('an unread row names no price and no count — never a remembered one', () => {
  const html = draw(facts({ plusPhp: null, plusCredits: null }));
  assert.doesNotMatch(html, /data-event-plan="plus"/, 'Plus not on sale → not drawn');
  assert.doesNotMatch(html, /₱/);
  assert.equal(proCreditsLine(null), null);
  const noCredits = draw(facts({ plusCredits: null }));
  assert.doesNotMatch(noCredits, /Papic credits —/);
});

test('Event Pro includes everything in Plus — once Pro is held, Plus is not sold', () => {
  assert.doesNotMatch(draw(facts(), true), /data-event-plan="plus"/);
  assert.match(draw(facts({ plus: 'yours' })), /Yours/);
  assert.match(draw(facts({ plus: 'review' })), /Payment under review/);
  assert.doesNotMatch(draw(facts({ plus: 'yours' })), /data-buy-plus/);
});

test('💎 Event Ultra (#7601) is offered with its catalogue price and credits; Plus/Pro events are told they pay the difference', () => {
  const html = drawUltra(facts());
  assert.match(html, /data-event-plan="ultra"/);
  assert.match(html, /₱5,678/);
  assert.match(html, /3,456 Papic credits/);
  assert.match(html, /data-buy-ultra="5678"/, 'the drawer is handed the row price; its server quote asks only the difference');
  assert.doesNotMatch(html, /data-ultra-pays-the-difference/);
  assert.match(drawUltra(facts({ paidTowardAPlan: true })), /data-ultra-pays-the-difference/);
  assert.equal(drawUltra(facts({ ultraPhp: null })), '', 'not on sale / unread → no card, no figure');
  assert.match(drawUltra(facts({ ultra: 'yours' })), /Yours/);
  assert.doesNotMatch(draw(facts({ ultra: 'yours' })), /data-event-plan="plus"/, 'Ultra holds everything in Plus');
  assert.doesNotMatch(draw(facts({ ultra: 'yours' })), /Your plan/);
});

test('the page reads its plans through the front door’s helpers, from the customer catalogue', () => {
  const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.match(page, /fetchV2CustomerCatalog\(\)/);
  assert.match(page, /planPricesFrom\(catalog\)/);
  assert.match(page, /planCreditsFrom\(catalog\)/);
  assert.deepEqual(PLAN_PRICE_CODES, { plus: 'EVENT_PLUS', pro: 'COUPLE_WEBSITE_PRO', ultra: 'EVENT_ULTRA' });
  const rows = [
    { service_code: 'EVENT_PLUS', retail_price_php: 10, included_papic_credits: 20 },
    { service_code: 'COUPLE_WEBSITE_PRO', retail_price_php: 30, included_papic_credits: 40 },
    { service_code: 'EVENT_ULTRA', retail_price_php: 50, included_papic_credits: 60 },
  ];
  assert.deepEqual(planPricesFrom(rows), { plus: 10, pro: 30, ultra: 50 });
  assert.deepEqual(planCreditsFrom(rows), { plusCredits: 20, proCredits: 40, ultraCredits: 60 });
});
