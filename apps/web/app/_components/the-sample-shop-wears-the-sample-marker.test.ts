/**
 * A DEMO SHOP WEARS THE SAMPLE EVENT'S OWN CHIP (owner, 6 Nov 2026: *"They are demo shops. The only real shop is the
 * wedding planner."*, then *"builds don't look like what was designed"*) — and, by the owner's LATER ruling the same day
 * (DECISION_LOG "DEMO SHOPS + DEMO EVENTS"), the chip says **"(DEMO ONLY)"**, not "Sample shop". This guard is #7333's,
 * retargeted to those words; `demo-shops-wear-the-marker.test.ts` holds every other public surface.
 *
 *   1. The marker is the sample event's chip, moved — not redrawn: its class is the exact string `realstories/[slug]`
 *      drew for "Sample showcase", and that page now draws it through the same component.
 *   2. The chip renders ONLY for a shop marked `is_demo` — on its page (`/v/[slug]`) and on its marketplace card
 *      (`VendorCard`) — and an unflagged shop's markup is unchanged.
 *   3. The ⓘ says the owner's words.
 *   4. The admin's "Demo shop" switch writes the EXISTING `is_demo` (no second column), saves in place (never
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
import { DEMO_ONLY_LABEL, DEMO_SHOP_ABOUT, DemoOnlyMarker, SAMPLE_MARKER_CLASS, SampleMarker } from './sample-marker';

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
  assert.match(story, /\{wedding\.isSample \? <DemoOnlyMarker kind="event" align="end" \/> : null\}/);
  assert.ok(!story.includes(SAMPLE_EVENT_CHIP), 'realstories/[slug] draws its own copy of the chip again');
  assert.equal(
    renderToStaticMarkup(createElement(SampleMarker)),
    `<span class="${SAMPLE_EVENT_CHIP}">(DEMO ONLY)</span>`,
  );
});

test('"(DEMO ONLY)" is that chip, as the label of its ⓘ, with the owner\'s words', () => {
  assert.equal(DEMO_ONLY_LABEL, '(DEMO ONLY)');
  const html = renderToStaticMarkup(createElement(DemoOnlyMarker));
  assert.ok(html.includes(`<span class="${SAMPLE_EVENT_CHIP}">(DEMO ONLY)</span>`), html);
  assert.ok(html.includes('aria-label="About this demo shop"'), 'the ⓘ is missing');
  assert.ok(html.includes(DEMO_SHOP_ABOUT.replace(/'/g, '&#x27;')), 'the ⓘ does not carry the words');
});

test('the shop page shows it only for a shop marked is_demo, outside the flagship branch', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /const isDemoVendor = vendor\.is_demo === true;/);
  const uses = [...page.matchAll(/<DemoOnlyMarker\b[^>]*\/>/g)];
  assert.equal(uses.length, 1, 'the shop page draws "(DEMO ONLY)" exactly once');
  assert.match(page, /\{isDemoVendor \? <DemoOnlyMarker \/> : null\}/);
  // After the name block's `cinematicHero ? null : (…)` closes, so the flagship's card says it too.
  const at = page.indexOf('{isDemoVendor ? <DemoOnlyMarker /> : null}');
  const cinematic = page.lastIndexOf('{cinematicHero ? null : (', at);
  assert.ok(cinematic > 0 && page.slice(cinematic, at).includes(')}'), 'the marker moved inside the cinematic-only branch');
});

test('the marketplace card shows it only for a demo shop, and its own amber Demo pill is gone', () => {
  const card = read('app/(shell)/explore/_components/vendor-card.tsx');
  assert.match(card, /const isDemoCard = vendor\.is_demo === true;/);
  assert.match(card, /\{isDemoCard \? <DemoOnlyMarker \/> : null\}/);
  assert.ok(!/>\s*Demo\s*</.test(card), 'the old "Demo" pill is back');
  assert.ok(!card.includes('ring-warn-200'), 'the old amber demo ring is back');
});

/**
 * The ONE place "Sample shop" is the owner's word again — owner, 13 Nov 2026, on the plan-card previews:
 * *"make it sample shop instead of demo only"*. That drawing is an illustration on the supplier front page, not a
 * demo SHOP row, so the "(DEMO ONLY)" ruling above (which governs `is_demo` shops) does not reach it. Exempted by
 * exact path, and pinned below so it cannot drift either way.
 */
const SAMPLE_DRAWING = join('app', 'v', '[slug]', '_components', 'sample-shop-page.tsx');

test('the plan-card sample drawing says "Sample shop" and never the demo chip (owner 13 Nov 2026)', () => {
  const src = read(SAMPLE_DRAWING);
  assert.match(src, /<SampleMarker>Sample shop<\/SampleMarker>/, 'the sample drawing lost its "Sample shop" chip');
  assert.ok(!/DemoOnlyMarker|DEMO_ONLY_LABEL/.test(src), 'the sample drawing wears the demo-shop chip again');
});

test('the retired "Sample shop" marker is drawn nowhere (the owner\'s later words replaced it)', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const rel = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        walk(rel);
      } else if (rel !== SAMPLE_DRAWING && /\.tsx$/.test(e.name) && /<SampleShopMarker\b|>\s*Sample shop\s*</.test(read(rel))) hits.push(rel);
    }
  };
  walk('app');
  assert.deepEqual(hits, [], 'a surface still says "Sample shop"');
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
  assert.match(sw, /<SwitchRow\b[\s\S]*?name="Demo shop"/);
  assert.match(sw, /fd\.set\('op', 'sample_shop'\)/);
  assert.match(sw, /fd\.set\('sample', next \? 'on' : 'off'\)/);
  assert.match(sw, /catch \{\s*setOn\(was\);/, 'a failed save does not put the switch back');

  const page = read('app/admin/vendors/[vendorProfileId]/page.tsx');
  assert.match(page, /<SampleShopSwitch shopId=\{shopId\} initial=\{shop\.is_demo === true\} \/>/);
});
