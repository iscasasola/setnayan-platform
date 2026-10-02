/**
 * the-three-lists-show.test.ts — RENDER-LEVEL: each of the three lists on
 * "Categories & event types" is painted (renderToStaticMarkup) from the same
 * shapes the server page hands it, and the rows a person taps are in the HTML.
 *
 * Owner approval, DECISION_LOG 2026-10-02: one page, a top dropdown switching
 * Supplier categories · Event types · Religions; the list on the left with
 * search; one panel on the right. A list that silently drew nothing would
 * pass every source-shaped guard — this reads the pixels' words instead.
 *
 * SABOTAGE PERFORMED AND UNDONE: each list's row map was emptied in turn
 * (CategoriesList's group map, EventTypesList's rows, ReligionsList's rows);
 * the matching test went red each time.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import type { BackState } from './back';
import {
  categoryListRows,
  type Category,
  type EventType,
  type Group,
  type Religion,
  type Service,
  type SupplierRequest,
} from './model';

(globalThis as unknown as { React: unknown }).React = React;

const groups: Group[] = [
  { id: 'feast', label: 'Catering & cake', short: 'Catering', iconName: null },
  { id: 'booths', label: 'Booths, carts & bars', short: 'Booths & carts', iconName: null },
];

function cat(id: string, groupId: string, label: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    groupId,
    label,
    slug: id,
    iconName: null,
    photoRaw: null,
    photoUrl: null,
    eventTypes: null,
    hidden: false,
    sortOrder: 0,
    serviceCount: 1,
    faithCount: 0,
    refinementCount: 0,
    ...extra,
  };
}

const categories: Category[] = [
  cat('cake', 'feast', 'Cake', { eventTypes: ['wedding'] }),
  cat('catering', 'feast', 'Catering'),
  cat('food_cart', 'booths', 'Food Cart', { hidden: true }),
];

function svc(canonical: string, en: string, tileId: string | null, extra: Partial<Service> = {}): Service {
  return {
    canonical,
    en,
    tl: null,
    tileId,
    faith: null,
    ph: false,
    rental: false,
    tradition: false,
    hidden: false,
    dietary: null,
    secondaryTiles: [],
    eventTypes: null,
    schemaVersion: 1,
    sharedGroups: [],
    fields: [],
    words: [],
    askedFor: 0,
    ...extra,
  };
}

const services: Service[] = [
  svc('lechonero', 'Lechonero', 'catering'),
  svc('sorbetes_cart', 'Sorbetes Cart', 'food_cart', {
    words: [{ id: 1, phrase: 'sorbetero', live: false, source: 'collected' }],
  }),
  svc('orphan_service', 'Orphan service', null),
];

const requests: SupplierRequest[] = [
  {
    requestId: 'r1',
    proposedLabel: 'Sorbetero',
    proposedNote: null,
    supplierName: 'Mang Kanor’s Sorbetes',
    draft: {
      suggestedLabel: 'Sorbetes cart',
      suggestedTileId: 'food_cart',
      suggestedTileLabel: 'Food Cart',
      tileReason: null,
      verdict: 'existing',
      closestExisting: { canonical: 'sorbetes_cart', label: 'Sorbetes Cart' },
      nearMatches: [],
      draftedBy: 'lexical',
    },
  },
];

const eventTypes: EventType[] = [
  { key: 'wedding', label: 'Wedding', emoji: '💍', description: null, sortOrder: 1, status: 'active', enabled: true, onboardingHref: null, heroPhotoUrl: null },
  { key: 'birthday', label: 'Birthday', emoji: '🎂', description: null, sortOrder: 2, status: 'active', enabled: false, onboardingHref: null, heroPhotoUrl: null },
  { key: 'old_rite', label: 'Old rite', emoji: '🕯️', description: null, sortOrder: 3, status: 'retired', enabled: false, onboardingHref: null, heroPhotoUrl: null },
];

const religions: Religion[] = [
  { key: 'Catholic', label: 'Catholic', status: 'active', isCivil: false, sortOrder: 1, askedOn: null, ceremonyType: 'catholic', launch: { status: 'active', threshold: 20, vendorCount: 30, venueCount: 4, total: 34, ready: true } },
  { key: 'Methodist', label: 'Methodist', status: 'active', isCivil: false, sortOrder: 18, askedOn: ['wedding'], ceremonyType: null, launch: { status: 'coming_soon', threshold: 20, vendorCount: 0, venueCount: 0, total: 0, ready: false } },
];

const state = (over: Partial<BackState> = {}): BackState => ({ list: 'categories', open: '', q: '', show: '', ...over });

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

async function categoriesHtml(over: Partial<BackState> = {}) {
  const { CategoriesList } = await import('./list-pane');
  const s = state(over);
  return paint(
    React.createElement(CategoriesList, {
      state: s,
      groups: categoryListRows({ groups, categories, services, requests, q: s.q, show: s.show }),
      unfiled: services.filter((x) => !x.tileId),
      waiting: [{ service: services[1]!, word: services[1]!.words[0]! }],
      requests,
      eventLabel: { wedding: 'Wedding', birthday: 'Birthday' },
      failed: false,
    }),
  );
}

test('Supplier categories: every group and category is a row, each linking to its own panel', async () => {
  const html = await categoriesHtml();
  assert.match(html, /data-list="categories"/);
  for (const label of ['Catering &amp; cake', 'Booths, carts &amp; bars', 'Cake', 'Catering', 'Food Cart']) {
    assert.ok(html.includes(label), `the categories list does not show ${label}`);
  }
  assert.match(html, /href="\/admin\/categories\?open=c%3Acake"/, 'a category row does not open its panel');
  assert.match(html, /href="\/admin\/categories\?open=g%3Afeast"/, 'a group row does not open its panel');
  // Marks a person reads on the row itself.
  assert.match(html, /Wedding only/, 'an event-scoped category lost its pill');
  assert.match(html, /Hidden/, 'a hidden category lost its pill');
  // The supplier's request rides as a ghost row under its suggested category.
  assert.match(html, /“Sorbetero” from Mang Kanor’s Sorbetes/);
});

test('Supplier categories: the search finds a SERVICE and keeps its category around it', async () => {
  const html = await categoriesHtml({ q: 'lechon' });
  assert.ok(html.includes('Lechonero'), 'a matching service is not listed');
  assert.ok(html.includes('Catering'), 'the matching service lost its category');
  assert.ok(!html.includes('Food Cart'), 'a category that matches nothing is still listed');
});

test('Supplier categories: Show ▾ › Unfiled, Words waiting and Requests each draw their own rows', async () => {
  assert.match(await categoriesHtml({ show: 'unfiled' }), /data-list="unfiled"[\s\S]*Orphan service/);
  assert.match(await categoriesHtml({ show: 'words' }), /data-list="words"[\s\S]*“sorbetero” → Sorbetes Cart/);
  assert.match(await categoriesHtml({ show: 'requests' }), /data-list="requests"[\s\S]*“Sorbetero”/);
});

test('Event types: every type is a row with its status, and its share of the categories', async () => {
  const { EventTypesList } = await import('./list-pane');
  const html = await paint(
    React.createElement(EventTypesList, { state: state({ list: 'event-types' }), eventTypes, categories, failed: false }),
  );
  assert.match(html, /data-list="event-types"/);
  for (const label of ['Wedding', 'Birthday', 'Old rite']) assert.ok(html.includes(label), `no ${label} row`);
  assert.match(html, /Hidden from couples/, 'the merged status word is not on a hidden type');
  assert.match(html, /Retired/, 'the merged status word is not on a retired type');
  // Birthday: Cake is wedding-only, so 2 of 3 categories show for it.
  assert.match(html, /2 of 3/);
  assert.match(html, /href="\/admin\/categories\?list=event-types&amp;open=birthday"/);
});

test('Religions: every religion is a row, plus mixed-faith couples', async () => {
  const { ReligionsList } = await import('./list-pane');
  const html = await paint(
    React.createElement(ReligionsList, {
      state: state({ list: 'religions' }),
      religions,
      taggedCount: { Catholic: 3 },
      failed: false,
    }),
  );
  assert.match(html, /data-list="religions"/);
  assert.match(html, /Catholic[\s\S]*3 services · Live/);
  assert.match(html, /Methodist[\s\S]*0 services · Coming soon/);
  assert.match(html, /Mixed-faith couples/);
  assert.match(html, /href="\/admin\/categories\?list=religions&amp;open=Methodist"/);
});

test('a list whose read failed says so — it never draws as empty', async () => {
  const { EventTypesList, ReligionsList } = await import('./list-pane');
  const et = await paint(React.createElement(EventTypesList, { state: state({ list: 'event-types' }), eventTypes: [], categories: null, failed: true }));
  assert.match(et, /role="alert"[\s\S]*Couldn’t load the event types/);
  const rl = await paint(React.createElement(ReligionsList, { state: state({ list: 'religions' }), religions: [], taggedCount: null, failed: true }));
  assert.match(rl, /Couldn’t load the religions/);
});
