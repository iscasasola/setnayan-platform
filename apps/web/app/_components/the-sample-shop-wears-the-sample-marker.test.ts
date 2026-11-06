/**
 * A DEMO SHOP SAYS "SAMPLE SHOP" — IN THE SAMPLE EVENT'S OWN CHIP (owner, 6 Nov 2026: *"They are demo shops. The only
 * real shop is the wedding planner."*, then *"builds don't look like what was designed"*).
 *
 *   1. The marker is the sample event's chip, moved — not redrawn: its class is the exact string `realstories/[slug]`
 *      drew for "Sample showcase", and that page now draws it through the same component.
 *   2. The chip renders ONLY for a shop marked `is_demo` — on its page (`/v/[slug]`) and on its marketplace card
 *      (`VendorCard`) — and an unflagged shop's markup is unchanged.
 *   3. The ⓘ says the owner's words.
 *   4. The admin's "Sample shop" switch writes the EXISTING `is_demo` (no second column), saves in place (never
 *      redirects), posts an explicit on/off, and rides the one card dispatcher (no new Vercel route).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from '@/lib/strip-comments';
import { SAMPLE_MARKER_CLASS, SAMPLE_SHOP_ABOUT, SampleMarker, SampleShopMarker } from './sample-marker';

// tsx compiles JSX to `React.createElement` (classic runtime) — the components need `React` in scope.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The chip `app/realstories/[slug]/page.tsx` drew for the sample event before it moved into the shared component. */
const SAMPLE_EVENT_CHIP =
  'rounded-full border border-ink/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/55';

test('the marker is the sample event chip, unchanged, and the sample event draws it through the same component', () => {
  assert.equal(SAMPLE_MARKER_CLASS, SAMPLE_EVENT_CHIP);
  const story = read('app/realstories/[slug]/page.tsx');
  assert.match(story, /\{wedding\.isSample \? <SampleMarker>Sample showcase<\/SampleMarker> : null\}/);
  assert.ok(!story.includes(SAMPLE_EVENT_CHIP), 'realstories/[slug] draws its own copy of the chip again');
  assert.equal(
    renderToStaticMarkup(createElement(SampleMarker, null, 'Sample showcase')),
    `<span class="${SAMPLE_EVENT_CHIP}">Sample showcase</span>`,
  );
});

test('"Sample shop" is that chip, as the label of its ⓘ, with the owner\'s words', () => {
  assert.equal(SAMPLE_SHOP_ABOUT, 'A sample to show how a shop looks on Setnayan. Its photos are illustrations.');
  const html = renderToStaticMarkup(createElement(SampleShopMarker));
  assert.ok(html.includes(`<span class="${SAMPLE_EVENT_CHIP}">Sample shop</span>`), html);
  assert.ok(html.includes('aria-label="About Sample shop"'), 'the ⓘ is missing');
  assert.ok(html.includes(SAMPLE_SHOP_ABOUT), 'the ⓘ does not carry the words');
});

test('the shop page shows it only for a shop marked is_demo, outside the flagship branch', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /const isDemoVendor = vendor\.is_demo === true;/);
  const uses = [...page.matchAll(/<SampleShopMarker\b[^>]*\/>/g)];
  assert.equal(uses.length, 1, 'the shop page draws "Sample shop" exactly once');
  assert.match(page, /\{isDemoVendor \? <SampleShopMarker \/> : null\}/);
  // After the name block's `cinematicHero ? null : (…)` closes, so the flagship's card says it too.
  const at = page.indexOf('{isDemoVendor ? <SampleShopMarker /> : null}');
  const cinematic = page.lastIndexOf('{cinematicHero ? null : (', at);
  assert.ok(cinematic > 0 && page.slice(cinematic, at).includes(')}'), 'the marker moved inside the cinematic-only branch');
});

test('the marketplace card shows it only for a demo shop, and its own amber Demo pill is gone', () => {
  const card = read('app/(shell)/explore/_components/vendor-card.tsx');
  assert.match(card, /const isDemoCard = vendor\.is_demo === true;/);
  assert.match(card, /\{isDemoCard \? <SampleShopMarker \/> : null\}/);
  assert.ok(!/>\s*Demo\s*</.test(card), 'the old "Demo" pill is back');
  assert.ok(!card.includes('ring-warn-200'), 'the old amber demo ring is back');
});

test('no other surface draws "Sample shop" (page and card only)', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const rel = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        walk(rel);
      } else if (/\.tsx$/.test(e.name) && read(rel).includes('<SampleShopMarker')) hits.push(rel);
    }
  };
  walk('app');
  assert.deepEqual(hits.sort(), [
    'app/(shell)/explore/_components/vendor-card.tsx',
    'app/dev/shop-page-lab/page.tsx',
    'app/v/[slug]/page.tsx',
  ]);
});

test('the admin switch writes is_demo in place, on/off, through the one dispatcher', () => {
  const actions = read('app/admin/vendors/[vendorProfileId]/card-actions.ts');
  assert.match(actions, /if \(op === 'sample_shop'\) return setSampleShop\(formData\);/);
  const at = actions.indexOf('async function setSampleShop(');
  const fn = actions.slice(at, actions.indexOf('\nexport async function ', at));
  assert.ok(at > 0 && fn.length > 0);
  assert.ok(fn.indexOf('await requireAdminAction()') > 0, 'no admin gate');
  assert.ok(fn.indexOf('await requireAdminAction()') < fn.indexOf('formData.get('), 'reads the form before the gate');
  assert.match(fn, /if \(raw !== 'on' && raw !== 'off'\) throw/);
  assert.match(fn, /\.update\(\{ is_demo: next \}\)/);
  assert.match(fn, /\.eq\('is_demo', was\)/, 'not guarded on the value it read');
  assert.match(fn, /from\('admin_audit_log'\)\.insert\(/);
  assert.ok(!/\bback(?:WithError)?\(|redirect\(/.test(fn), 'the switch redirects — a save must not reset the screen');

  const sw = read('app/admin/vendors/[vendorProfileId]/_components/sample-shop-switch.tsx');
  assert.match(sw, /<SwitchRow\b[\s\S]*?name="Sample shop"/);
  assert.match(sw, /fd\.set\('op', 'sample_shop'\)/);
  assert.match(sw, /fd\.set\('sample', next \? 'on' : 'off'\)/);
  assert.match(sw, /catch \{\s*setOn\(was\);/, 'a failed save does not put the switch back');

  const page = read('app/admin/vendors/[vendorProfileId]/page.tsx');
  assert.match(page, /<SampleShopSwitch shopId=\{shopId\} initial=\{shop\.is_demo === true\} \/>/);
});
