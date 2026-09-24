/**
 * event-hub-pro-on-the-services-step.test.ts — the third card.
 *
 * ⚖ Owner, 2026-09-25: *"so now on the onboarding also, there are 3 things they
 * can purchase Papic, Setnayan AI, Event Hub Pro."*
 *
 * What this pins, in the order a couple meets it:
 *   1. THE CARD — offered only where the type has an Event Hub AND the catalog
 *      priced it; built from the existing Pro offer sentence, never new copy.
 *   2. THE PIXELS — the card, its (i), its saving line (only when there is a
 *      saving), its tick and its line in the total, and NOTHING when it is null.
 *   3. THE BILL — the mint re-measures the type, the price and prior ownership,
 *      and never sells Pro twice.
 *   4. THE APPROVAL — the Pro item needs no hook, and does not raise a false
 *      "paid and never provisioned" alarm.
 *   5. THE STORE SHELL — the card rides on the same view the planner card rides
 *      on, and that view is never built in the App Store / Play Store shell.
 *
 * ⛔ NO LIVE PRICE IS WRITTEN HERE. The fixtures are shapes; the figure is the
 * catalog's (`platform_retail_catalog_v2` · COUPLE_WEBSITE_PRO).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { buildServicesStepView, type ServicesStepView } from './services-step-data';
import { hubProBillLine, hubProOffered, splitProOffer } from '../onboarding-hub-pro';
import { addOnHeroCopy } from '../add-ons-catalog';
import {
  EMPTY_SERVICES_SELECTION,
  setHubPro,
  type ServicesStepSelection,
} from '../onboarding-services-selection';

(globalThis as unknown as { React: unknown }).React = React;

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const strip = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const PRO_COPY = addOnHeroCopy('website-pro');

function view(
  hubPro: Parameters<typeof buildServicesStepView>[0]['hubPro'],
): ServicesStepView {
  return buildServicesStepView({
    eventWord: 'birthday',
    poolTiers: [],
    oneTiers: [],
    pricePhpByCode: new Map(),
    freePoolPoints: 50,
    freeOnePoints: 0,
    aiPricePhp: null,
    hubPro,
  });
}

// ── 1 · the card ───────────────────────────────────────────────────────────

test('the card is built from the EXISTING Pro offer sentence, not new copy', () => {
  const { headline, detail } = splitProOffer(PRO_COPY.blurb);
  assert.ok(headline.length > 0);
  assert.ok(detail && detail.length > 0, 'the offer sentence has a "— what it adds" half');
  // Both halves are the catalog's own words, re-joined.
  const body = PRO_COPY.blurb.replace(/\.$/, '');
  assert.ok(body.startsWith(headline.replace(/\.$/, '')), 'headline is the sentence’s first half');
  assert.ok(
    body.toLowerCase().endsWith(detail!.replace(/\.$/, '').toLowerCase()),
    'the (i) text is the sentence’s second half',
  );
  // It says Event Hub, never website.
  assert.doesNotMatch(`${headline} ${detail}`, /\bwebsite\b/i);
});

test('a blurb with no dash is shown whole, with nothing behind the (i)', () => {
  assert.deepEqual(splitProOffer('One upgrade.'), { headline: 'One upgrade.', detail: null });
});

test('the card renders on a type WITH an Event Hub and a live price', () => {
  const v = view({ websiteEnabled: true, pricePhp: 700, listPricePhp: 1_000, copy: PRO_COPY });
  assert.ok(v.hubPro);
  assert.equal(v.hubPro.pricePhp, 700);
  assert.equal(v.hubPro.listPricePhp, 1_000);
  assert.equal(v.hubPro.priceLabel, '₱700');
  assert.equal(v.hubPro.label, PRO_COPY.label);
});

test('⛔ NO card on a type with no Event Hub', () => {
  assert.equal(
    view({ websiteEnabled: false, pricePhp: 700, listPricePhp: 1_000, copy: PRO_COPY }).hubPro,
    null,
  );
});

test('⛔ NO card when the catalog cannot price it — never ₱0, never a remembered figure', () => {
  for (const pricePhp of [null, 0, -5, Number.NaN]) {
    assert.equal(
      view({ websiteEnabled: true, pricePhp, copy: PRO_COPY }).hubPro,
      null,
      `price ${String(pricePhp)} must not render a card`,
    );
  }
  assert.equal(hubProOffered({ websiteEnabled: true, pricePhp: undefined }), false);
});

test('⛔ NO card when there is no offer copy, and none when the input is absent', () => {
  assert.equal(view({ websiteEnabled: true, pricePhp: 700, copy: null }).hubPro, null);
  assert.equal(view(null).hubPro, null);
  assert.equal(view(undefined).hubPro, null);
});

test('⛔ no invented "was" price: no discount ⇒ list === price; bad data refused', () => {
  const none = view({ websiteEnabled: true, pricePhp: 700, copy: PRO_COPY }).hubPro!;
  assert.equal(none.listPricePhp, none.pricePhp);
  const below = view({ websiteEnabled: true, pricePhp: 700, listPricePhp: 500, copy: PRO_COPY })
    .hubPro!;
  assert.equal(below.listPricePhp, 700, 'a list price below the charge is not a discount');
});

test('the server prices Pro with the SAME maps the rungs use, gated on the website surface', () => {
  const server = strip(read('lib/onboarding/services-step-server.ts'));
  assert.match(server, /websiteEnabled: surfaceEnabled\(profile, 'website'\)/);
  assert.match(server, /pricePhp: pricePhpByCode\.get\(COUPLE_WEBSITE_PRO_SERVICE_KEY\)/);
  assert.match(server, /listPricePhp: listPricePhpByCode\.get\(COUPLE_WEBSITE_PRO_SERVICE_KEY\)/);
  assert.match(server, /addOnHeroCopy\('website-pro'\)/, 'the words are the existing Pro offer');
});

// ── 2 · the pixels ─────────────────────────────────────────────────────────

async function paint(v: ServicesStepView, selection?: ServicesStepSelection): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = (await import('../../app/onboarding/_shared/services-step')) as Record<string, unknown>;
  // A 'use client' module can land under `.default` when imported by tsx.
  const ServicesStep = (mod.ServicesStep ??
    (mod.default as Record<string, unknown> | undefined)?.ServicesStep) as React.ComponentType<
    Record<string, unknown>
  >;
  return renderToStaticMarkup(
    React.createElement(ServicesStep, {
      view: v,
      ...(selection ? { selection, onSelectionChange: () => {} } : {}),
    }),
  );
}

test('the card reaches the render: label, price, (i), and an OFF tick', async () => {
  const v = view({ websiteEnabled: true, pricePhp: 700, listPricePhp: 1_000, copy: PRO_COPY });
  const html = await paint(v, EMPTY_SERVICES_SELECTION);
  assert.match(html, new RegExp(PRO_COPY.label));
  assert.match(html, /₱700/);
  assert.match(html, /What Pro adds/, 'what it adds sits behind the house (i)');
  assert.match(html, /role="switch" aria-checked="false"[^>]*>[\s\S]*?Add Event Hub/);
  assert.match(html, /₱300 off while you/, 'the saving is stated when there is one');
  assert.match(html, /Not added/, 'the total names Pro on its own line');
});

test('ticked, the total carries Pro', async () => {
  const v = view({ websiteEnabled: true, pricePhp: 700, copy: PRO_COPY });
  const html = await paint(v, setHubPro(EMPTY_SERVICES_SELECTION, true));
  assert.match(html, /aria-checked="true"/);
  assert.match(html, /Added to your plan/);
  assert.match(html, /Your total today[\s\S]*?₱700/);
  assert.doesNotMatch(html, /off while you/, 'no discount in the data ⇒ no saving line');
});

test('⛔ a null card paints NOTHING of Pro — unpriced or no Event Hub', async () => {
  for (const hubPro of [
    { websiteEnabled: false, pricePhp: 700, copy: PRO_COPY },
    { websiteEnabled: true, pricePhp: null, copy: PRO_COPY },
  ]) {
    const html = await paint(view(hubPro), EMPTY_SERVICES_SELECTION);
    assert.doesNotMatch(html, new RegExp(PRO_COPY.label), 'the card must be absent');
    assert.doesNotMatch(html, /What Pro adds/);
  }
});

// ── 3 · the bill ───────────────────────────────────────────────────────────

test('the bill line: every "no" drops it, and an owner is NEVER billed twice', () => {
  const ok = { selected: true, websiteEnabled: true, alreadyOwned: false, unitPhp: 700 };
  assert.deepEqual(hubProBillLine(ok), { quantity: 1, unitPhp: 700 });
  assert.equal(hubProBillLine({ ...ok, selected: false }), null, 'not ticked');
  assert.equal(hubProBillLine({ ...ok, alreadyOwned: true }), null, 'already owns Pro');
  assert.equal(hubProBillLine({ ...ok, websiteEnabled: false }), null, 'no Event Hub');
  assert.equal(hubProBillLine({ ...ok, unitPhp: null }), null, 'catalog did not price it');
  assert.equal(hubProBillLine({ ...ok, unitPhp: 0 }), null, 'never billed at ₱0');
});

test('the mint bills COUPLE_WEBSITE_PRO from three server-side measurements', () => {
  const minter = strip(read('lib/onboarding-services-orders.ts'));
  const block = minter.slice(minter.indexOf('if (selection.hubPro)'));
  assert.ok(block.length > 0, 'the mint has no Event Hub Pro branch');
  const head = block.slice(0, 1200);
  assert.match(head, /eventHasEventHub\(admin, eventId\)/, 'the STORED type is re-read');
  assert.match(head, /eventAlreadyHasHubPro\(admin, eventId\)/, 'prior ownership is checked');
  assert.match(
    head,
    /priceOf\(admin, COUPLE_WEBSITE_PRO_SERVICE_KEY\)/,
    'priced by the same catalog rule as the card',
  );
  assert.match(head, /hubProBillLine\(\{ selected: true, websiteEnabled, alreadyOwned, unitPhp \}\)/);
  assert.match(head, /serviceCode: COUPLE_WEBSITE_PRO_SERVICE_KEY/, 'the line is the Pro SKU');

  // The two helpers, and the direction each fails in.
  const owned = minter.slice(minter.indexOf('async function eventAlreadyHasHubPro'));
  assert.match(owned.slice(0, 500), /eventOwnsCoupleWebsitePro\(admin, eventId\)/);
  assert.match(owned.slice(0, 500), /eventCoupleWebsiteProActive\(admin, eventId\)/);
  assert.match(owned.slice(0, 500), /catch \{\s*return true;/, 'an unread ownership is "owned"');
  const hub = minter.slice(minter.indexOf('async function eventHasEventHub'));
  assert.match(hub.slice(0, 700), /surfaceEnabled\(await resolveProfile\(type\), 'website'\)/);
  assert.match(hub.slice(0, 700), /catch \{\s*return false;/, 'an unread type is "no hub"');
});

test('every commit path carries hubPro through', () => {
  // The wedding and generic wizards send the selection OBJECT, so the new key
  // rides along; the simple page is a form and needs its own field.
  const names = read('app/onboarding/simple/_components/papic-step-field-names.ts');
  const fields = read('app/onboarding/simple/_components/papic-step-fields.tsx');
  const action = read('app/onboarding/simple/actions.ts');
  assert.match(names, /export const HUB_PRO_FIELD_SELECTED =/);
  assert.match(fields, /name=\{HUB_PRO_FIELD_SELECTED\} value=\{String\(selection\.hubPro\)\}/);
  assert.match(action, /hubPro: formData\.get\(HUB_PRO_FIELD_SELECTED\)/);
  for (const [file, fn] of [
    ['app/onboarding/[type]/_components/generic-onboarding.tsx', 'servicesSelection'],
    ['app/onboarding/wedding/_components/onboarding-shell.tsx', 'payload.servicesSelection = servicesSelection'],
  ] as const) {
    assert.ok(read(file).includes(fn), `${file} no longer sends the selection object`);
  }
});

// ── 4 · the approval ───────────────────────────────────────────────────────

test('approving a Pro basket raises no false "never provisioned" fault', () => {
  const activation = read('lib/sku-activation.ts');
  assert.match(
    activation,
    /const ORDER_GATED_BASKET_ITEMS: ReadonlySet<string> = new Set\(\[COUPLE_WEBSITE_PRO_SERVICE_KEY\]\);/,
  );
  const fan = activation.slice(activation.indexOf('async function activateOnboardingBasket'));
  assert.match(
    fan.slice(0, 1500),
    /if \(ORDER_GATED_BASKET_ITEMS\.has\(item\.serviceCode\)\) continue;/,
  );
  // …and it is SAFE to skip only because the Pro gate reads the basket itself.
  const ent = read('lib/entitlements.ts');
  const active = ent.slice(ent.indexOf('export async function eventSkuActive'));
  assert.match(active.slice(0, 2000), /basketGrantsSku\(/);
});

// ── 5 · the store shell ────────────────────────────────────────────────────

test('🔒 the Pro card follows the planner card’s store-shell rule exactly', () => {
  // The card has ONE source — `view.hubPro` — and the view has ONE producer,
  // `readServicesStepView`. Every mount asks for that view only outside the
  // App Store / Play Store shell, so neither card can reach it.
  const step = strip(read('app/onboarding/_shared/services-step.tsx'));
  assert.match(step, /const hubPro = view\.hubPro \?\? null;/);
  assert.equal((step.match(/view\.hubPro/g) ?? []).length, 1, 'Pro must come from the view only');

  const page = read('app/onboarding/wedding/page.tsx');
  assert.match(page, /onboardingServicesStepEnabled\(\) && !storeShell/);
  for (const f of ['app/onboarding/simple/page.tsx', 'app/onboarding/[type]/page.tsx']) {
    assert.match(
      read(f),
      /onboardingServicesStepEnabled\(\) && !\(await isStoreShellRequest\(\)\)/,
      f,
    );
  }
  // …and the wedding shell drops the whole screen in the shell besides.
  assert.match(
    read('app/onboarding/wedding/_components/onboarding-shell.tsx'),
    /STORE_SHELL_DROPPED_SCREENS: ReadonlySet<ScreenId> = new Set\(\[[^\]]*'services_step'/,
  );
});
