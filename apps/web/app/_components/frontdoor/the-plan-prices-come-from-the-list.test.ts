/**
 * the-plan-prices-come-from-the-list.test.ts — the front page's Event Plus and Event Pro cards print the price
 * list's figure, or none.
 *
 * Owner rule: every price comes from `platform_retail_catalog_v2`, which Admin edits — never typed into a page.
 * Event Pro is `COUPLE_WEBSITE_PRO` (`COUPLE_WEBSITE_PRO`, on sale today); Event Plus is `EVENT_PLUS`, put on sale by the
 * final price-sheet PR. Until a row is on sale — or when the read fails — that plan's row is NOT DRAWN: never a
 * figureless "per event" line (controller, 20 Nov). Plus appears on its own the day its row goes live.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PLAN_PRICE_CODES, planPricesFrom } from './front-door-landing';

const HERE = import.meta.dirname;

test('Event Pro is COUPLE_WEBSITE_PRO, Event Plus is EVENT_PLUS, Event Ultra is EVENT_ULTRA', () => {
  assert.deepEqual(PLAN_PRICE_CODES, { plus: 'EVENT_PLUS', pro: 'COUPLE_WEBSITE_PRO', ultra: 'EVENT_ULTRA' });
});

test('a row on sale gives its price; a missing, empty or zero row gives none — never a fallback figure', () => {
  assert.deepEqual(
    planPricesFrom([
      { service_code: 'COUPLE_WEBSITE_PRO', retail_price_php: 5690 },
      { service_code: 'EVENT_PLUS', retail_price_php: 2990 },
      { service_code: 'EVENT_ULTRA', retail_price_php: 9990 },
    ]),
    { plus: 2990, pro: 5690, ultra: 9990 },
  );
  assert.deepEqual(planPricesFrom([{ service_code: 'COUPLE_WEBSITE_PRO', retail_price_php: 5690 }]), { plus: null, pro: 5690, ultra: null });
  assert.deepEqual(planPricesFrom([]), { plus: null, pro: null, ultra: null });
  assert.deepEqual(
    planPricesFrom([
      { service_code: 'EVENT_PLUS', retail_price_php: 0 },
      { service_code: 'COUPLE_WEBSITE_PRO', retail_price_php: null },
      { service_code: 'EVENT_ULTRA', retail_price_php: 0 },
    ]),
    { plus: null, pro: null, ultra: null },
  );
});

test('the front page reads the catalogue and types no plan price', () => {
  const door = stripComments(readFileSync(path.join(HERE, 'front-door.tsx'), 'utf8'));
  // Lane J: one catalogue read now feeds the prices AND the included credits (`planCreditsFrom`).
  // `fetchV2CustomerCatalogRead` is the same read with its failure kept (final check A1-100).
  assert.match(door, /fetchV2CustomerCatalog(?:Read)?\(\)/, 'front-door.tsx no longer reads the catalogue');
  assert.match(door, /planPricesFrom\(catalog\)/, 'front-door.tsx no longer reads the plan prices from the catalogue');
  assert.match(door, /planCreditsFrom\(catalog\)/, 'front-door.tsx no longer reads the plan credits from the catalogue');
  const landing = stripComments(readFileSync(path.join(HERE, 'front-door-landing.tsx'), 'utf8'));
  assert.deepEqual(
    (landing.match(/₱[0-9][0-9,]*/g) ?? []).filter((p) => p !== '₱0'),
    [],
    'a peso figure is typed into the front page — read it from platform_retail_catalog_v2',
  );
  assert.match(landing, /<PlanPrice php=\{planPrices\.plus\}/);
  assert.match(landing, /<PlanPrice php=\{planPrices\.pro\}/);
});

test('a plan whose price could not be read is not drawn — never a figureless price line', async () => {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorLanding } = await import('./front-door-landing');
  const html = (plus: number | null, pro: number | null) =>
    renderToStaticMarkup(
      React.createElement(FrontDoorLanding, {
        planPrices: { plus, pro, ultra: null },
        planFacts: { plusCredits: null, proCredits: null, freePapic: null },
      }),
    );
  const failed = html(null, null);
  const rows = (h: string) => [...h.matchAll(/<span class="fl-pn">([^<]+)/g)].map((m) => m[1]);
  assert.deepEqual(rows(failed), ['Free'], 'a plan with no price read is still drawn');
  assert.doesNotMatch(failed, /class="fl-pp">per event</, 'a figureless "per event" price line is drawn');
  assert.match(failed, /See the Free plan/, 'the plan count does not match the rows drawn');
  const live = html(null, 5690);
  assert.deepEqual(rows(live), ['Free', 'Event Pro']);
  assert.match(live, /See the two plans/);
  assert.match(live, /₱5,690/);
});
