/**
 * EVERY PUBLIC APPEARANCE OF A DEMO SHOP OR A DEMO EVENT SAYS "(DEMO ONLY)".
 *
 * Owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS", verbatim: *"these demo events, and demo suppliers will show
 * on with the rest of suppliers and events, but has a marking of (DEMO ONLY)."* That ruling made demo shops
 * (`vendor_profiles.is_demo`) and demo events (`events.is_sample`) PUBLIC — so the marker is load-bearing: on the day
 * the marketplace holds no real shop (measured 2026-11-06: 0 live real shops), the demo shops ARE the shelf, and an
 * unmarked one reads as a real supplier a couple can book.
 *
 * 🔑 ANCHORED PER SURFACE, NEVER A FILE-LEVEL WORD MATCH. For each surface this pins (a) the import of the ONE marker
 * (`app/_components/sample-marker.tsx`, or its plain label `demo-only-label.ts` where React cannot render) and (b) the
 * JSX that draws it, gated on that surface's own `is_demo` / `is_sample` reading — and prints the count it found. A file
 * that imports the marker but stops drawing it, or draws it ungated, goes red.
 *
 * SABOTAGE (each turns this red): delete `{isDemoVendor ? <DemoOnlyMarker /> : null}` from the shop page · drop
 * `isDemo: c.isDemo` from the explore page's service card · drop `is_demo` from the front page's `SHOP_COLUMNS` ·
 * change `DEMO_ONLY_LABEL` · put "Sample shop" back on any surface.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from '@/lib/strip-comments';
import { DEMO_ONLY_LABEL } from './demo-only-label';
import { DemoOnlyMarker, SampleMarker, DEMO_ONLY_LABEL as REEXPORTED } from './sample-marker';

// The components use the automatic JSX runtime under Next; under tsx they compile to `React.createElement` — the same
// shim `info-tip.test.ts` uses.
(globalThis as unknown as { React: unknown }).React = React;

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

const MARKER_IMPORT = /import \{[^}]*\b(DemoOnlyMarker|SampleMarker)\b[^}]*\} from '@\/app\/_components\/sample-marker';/;
const LABEL_IMPORT = /import \{[^}]*\bDEMO_ONLY_LABEL\b[^}]*\} from '@\/app\/_components\/(demo-only-label|sample-marker)';/;

type Surface = {
  name: string;
  file: string;
  /** How the marker reaches the file. */
  imports: RegExp;
  /** Each must match at least once: the gated draw, and whatever feeds the gate its demo fact. */
  draws: RegExp[];
};

const SURFACES: Surface[] = [
  {
    name: 'shop page (/v/[slug] and the bare /{slug})',
    file: 'app/v/[slug]/page.tsx',
    imports: MARKER_IMPORT,
    draws: [/const isDemoVendor = vendor\.is_demo === true;/, /\{isDemoVendor \? <DemoOnlyMarker \/> : null\}/],
  },
  {
    name: 'shop page title (link previews)',
    file: 'app/v/[slug]/page.tsx',
    imports: LABEL_IMPORT,
    draws: [/const isDemoShop = vendor\.is_demo === true;/, /isDemoShop \? ` \$\{DEMO_ONLY_LABEL\}` : ''/],
  },
  {
    name: 'explore vendor card',
    file: 'app/(shell)/explore/_components/vendor-card.tsx',
    imports: MARKER_IMPORT,
    draws: [/const isDemoCard = vendor\.is_demo === true;/, /\{isDemoCard \? <DemoOnlyMarker \/> : null\}/],
  },
  {
    name: 'explore page marks every demo row (not only in demo mode)',
    file: 'app/(shell)/explore/_lib/marketplace-view.tsx', // 2026-11-12: the marketplace pipeline moved from explore/page.tsx to _lib/marketplace-view.tsx (shared with Discover)
    imports: /import \{ fetchDemoVendorIds \} from '@\/lib\/demo-vendors';/,
    draws: [/if \(demoVendorIds\.length > 0\) \{\s*const demoIdSet = new Set\(demoVendorIds\);/, /row\.is_demo = true;/],
  },
  {
    name: 'service card (the marketplace body)',
    file: 'app/_components/service-card-view.tsx',
    imports: MARKER_IMPORT,
    draws: [/\{shop\.isDemo === true \? <DemoOnlyMarker \/> : null\}/],
  },
  {
    name: 'service card — the explore page hands each card its shop\'s demo fact',
    file: 'app/(shell)/explore/_lib/marketplace-view.tsx', // 2026-11-12: the marketplace pipeline moved from explore/page.tsx to _lib/marketplace-view.tsx (shared with Discover)
    imports: /import \{ fetchMarketplaceServiceCards \} from '@\/lib\/marketplace-service-cards';/,
    draws: [/isDemo: c\.isDemo,/],
  },
  {
    name: 'service card — the read carries is_demo',
    file: 'lib/marketplace-service-cards.ts',
    imports: /export type MarketplaceServiceCard = \{/,
    draws: [/vendor_profiles!inner\([^)]*\bis_demo\b[^)]*\)/, /isDemo: vp\.is_demo === true,/],
  },
  {
    name: 'explore folder preview cards',
    file: 'app/(shell)/explore/_components/folder-vendors-section.tsx',
    imports: MARKER_IMPORT,
    draws: [/isDemo=\{demoIdSet\.has\(vendor\.vendor_profile_id\)\}/, /\{isDemo \? <SampleMarker \/> : null\}/],
  },
  {
    name: 'explore folder preview — the page hands the demo ids in',
    file: 'app/(shell)/explore/_lib/marketplace-view.tsx', // 2026-11-12: the marketplace pipeline moved from explore/page.tsx to _lib/marketplace-view.tsx (shared with Discover)
    imports: /FolderVendorsSection/,
    draws: [/demoVendorIds=\{catalogDemoVendorIds\}/],
  },
  {
    name: 'compare table',
    file: 'app/(shell)/explore/compare/page.tsx',
    imports: MARKER_IMPORT,
    draws: [/\{row\.is_demo === true \? \(\s*<div className="mt-1">\s*<DemoOnlyMarker \/>/],
  },
  {
    name: 'front page shops shelf',
    file: 'app/_components/frontdoor/front-door-feed.tsx',
    imports: MARKER_IMPORT,
    draws: [/\{s\.isDemo \? <SampleMarker \/> : null\}/],
  },
  {
    // 🃏 Since 10 Nov the search hit IS the shelf's card (`ShopCard`, which draws the marker — the entry above), not a
    // copy of it: the results must keep drawing that card for every shop hit.
    name: 'front page shop search results',
    file: 'app/_components/frontdoor/front-door-results.tsx',
    imports: /import \{ ShopCard \} from '\.\/front-door-feed';/,
    draws: [/return <ShopCard s=\{s\} href=\{withShopArrival\(s\.href, \{ src: SHOP_ARRIVAL_SRC\.search \}\)\} \/>;/],
  },
  {
    name: 'front page — each shop carries its demo fact',
    file: 'app/_components/frontdoor/data.ts',
    imports: /export type FrontDoorShop = \{/,
    draws: [/isDemo: row\.is_demo === true,/],
  },
  {
    name: 'front page — the shelf read selects is_demo',
    file: 'lib/home-public-reads-core.ts',
    imports: /const SHOP_COLUMNS =/,
    draws: [/const SHOP_COLUMNS =\s*'[^']*\bis_demo\b[^']*';/],
  },
  {
    name: 'share image (OG) — route',
    file: 'app/api/og/v/[slug]/route.tsx',
    imports: LABEL_IMPORT,
    draws: [/demoLabel: vendor\.is_demo === true \? DEMO_ONLY_LABEL : null,/],
  },
  {
    name: 'share image (OG) — the card prints it',
    file: 'lib/social/vendor-card.tsx',
    imports: /demoLabel\?: string \| null;/,
    draws: [/demoLabel \? `A SETNAYAN SHOP · \$\{demoLabel\}` : 'A SETNAYAN SHOP'/, /eyebrowRow\(input\.demoLabel\)/],
  },
  {
    name: "the shop's own page card (supplier dashboard › Website)",
    file: 'app/vendor-dashboard/website/_components/page-parts.tsx',
    imports: MARKER_IMPORT,
    draws: [/\{d\.isDemo \? <DemoOnlyMarker align="end" \/> : null\}/],
  },
  {
    name: "a shop's check-a-date page (/v/[slug]/dates)",
    file: 'app/v/[slug]/dates/_components/check-a-date-calendar.tsx',
    imports: MARKER_IMPORT,
    draws: [/\{shop\.isDemo \? <DemoOnlyMarker \/> : null\}/],
  },
  {
    name: 'demo event page (/{slug})',
    file: 'app/[slug]/page.tsx',
    imports: MARKER_IMPORT,
    draws: [/liveEvent\.is_sample === true && triedTheme === null/, /<DemoOnlyMarker kind="event" align="center" \/>/, /\{demoEventMarker\}/],
  },
  {
    name: 'demo event story (/realstories/[slug])',
    file: 'app/realstories/[slug]/page.tsx',
    imports: MARKER_IMPORT,
    draws: [/\{wedding\.isSample \? <DemoOnlyMarker kind="event" align="end" \/> : null\}/],
  },
  {
    name: 'demo event story card (/realstories gallery)',
    file: 'app/realstories/_components/gallery.tsx',
    imports: LABEL_IMPORT,
    draws: [/\{item\.isSample \? \([\s\S]{0,400}?\{DEMO_ONLY_LABEL\}/],
  },
];

test('the marker says the owner\'s words, exactly, from one place', () => {
  assert.equal(DEMO_ONLY_LABEL, '(DEMO ONLY)');
  assert.equal(REEXPORTED, DEMO_ONLY_LABEL, 'the component and the plain label are the same words');
  const shop = renderToStaticMarkup(React.createElement(DemoOnlyMarker));
  assert.ok(shop.includes('(DEMO ONLY)'), shop);
  assert.ok(shop.includes('About this demo shop'), 'the ⓘ names what it explains');
  const event = renderToStaticMarkup(React.createElement(DemoOnlyMarker, { kind: 'event' }));
  assert.ok(event.includes('(DEMO ONLY)') && event.includes('About this demo event'), event);
  const bare = renderToStaticMarkup(React.createElement(SampleMarker));
  assert.match(bare, /^<span class="[^"]+">\(DEMO ONLY\)<\/span>$/, 'the bare chip, for a card that is one link');
});

for (const s of SURFACES) {
  test(`🧪 ${s.name} wears "(DEMO ONLY)"`, () => {
    const src = read(s.file);
    assert.match(src, s.imports, `${s.file}: the marker is not imported`);
    for (const draw of s.draws) {
      const n = (src.match(new RegExp(draw.source, 'g')) ?? []).length;
      console.log(`  ${s.name} · ${draw.source.slice(0, 60)}… → ${n}`);
      assert.ok(n >= 1, `${s.file}: the gated draw is gone — ${draw}`);
    }
  });
}

test('no public surface still says "Sample shop", "Synthetic supplier" or "Sample showcase"', () => {
  const files = [...new Set(SURFACES.map((s) => s.file)), 'app/_components/sample-marker.tsx'];
  for (const f of files) {
    const src = read(f);
    for (const word of ['Sample shop', 'Synthetic supplier', 'Sample showcase', 'visible only to admins']) {
      assert.ok(!src.includes(word), `${f} still prints "${word}" — the owner's later words are "(DEMO ONLY)"`);
    }
  }
});

test('demo shops and demo events stay out of the sitemaps — public is not indexed', () => {
  assert.match(read('app/sitemap-vendors.xml/route.ts'), /\.or\('is_demo\.is\.null,is_demo\.eq\.false'\)/);
  assert.match(read('app/sitemap-weddings.xml/route.ts'), /showcases\.filter\(\(s\) => !s\.isSample\)/);
  assert.match(read('app/v/[slug]/page.tsx'), /\.\.\.\(isDemoShop \? \{ robots: \{ index: false, follow: false \} \} : \{\}\)/);
});

// 🔢 A listing may show demo shops; a CLAIM built from a count may not (owner 2026-11-06: "demo numbers never count in
// real totals"). SABOTAGE: rank explore badges over `visible` again, or feed the heading `liveShopCount` → RED.
test('demo shops never move a real number on the public pages that list them', () => {
  const explore = read('app/(shell)/explore/_lib/marketplace-view.tsx'); // 2026-11-12: the marketplace pipeline moved from explore/page.tsx to _lib/marketplace-view.tsx (shared with Discover)
  assert.match(explore, /const realShopCount = isLandingView \? await countRealShops\(admin\) : null;/);
  assert.equal((explore.match(/\(realShopCount \?\? 0\) >= TRENDING_MIN_LIVE_SHOPS/g) ?? []).length, 2, '"Trending shops" counts real shops');
  assert.doesNotMatch(explore, /\(liveShopCount \?\? 0\) >= TRENDING_MIN_LIVE_SHOPS/);
  assert.match(explore, /badgesFor\(visible\.filter\(\(v\) => v\.is_demo !== true\)\)/, 'real cards are ranked among real cards');
  assert.match(explore, /badgesFor\(visible\.filter\(\(v\) => v\.is_demo === true\)\)/, 'demo cards among demo cards');
  assert.match(read('lib/home-public-reads-core.ts'), /\.match\(REAL_SHOP_GATE\)/, 'the front page reads a real count');
  assert.match(read('app/_components/frontdoor/front-door-feed.tsx'), /liveShops: realShopCount \?\? 0,/, 'the front page heading counts real shops');
});
