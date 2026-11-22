/**
 * 🪦 PATIKTOK AND MUSIC MAKER STAY RETIRED.
 *
 * Owner, 2026-11-20, verbatim: *"Retire Patiktok and Music Maker ( we do not want to serve this anymore)"*.
 * The list is `lib/retired-products.ts`; this fails the moment either product becomes BUYABLE again or is
 * DESCRIBED on a public surface again (the front door, the site description, the homepage JSON-LD, /features,
 * /help, llms.txt, the sitemap, the in-app service cards and menus, the App Store product list).
 *
 * Event Ultra no longer includes Patiktok (owner 2026-11-20, *"Keep ₱9,990"*: Ultra loses it, keeps its price) —
 * neither in its copy nor in its read-side GRANT (`EVENT_ULTRA_GRANTS`, `SKU_OWNERSHIP_ALIASES` and the two
 * gifted-Ultra SQL functions). Onboarding and the planning wizard no longer offer either.
 *
 * Run: `pnpm test:unit` (from apps/web).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  RETIRED_ADD_ON_KEYS,
  RETIRED_FEATURE_SLUGS,
  RETIRED_PRODUCT_CODES,
  RETIRED_PRODUCT_NAMES,
  RETIRED_PUBLIC_PATHS,
  isRetiredAddOn,
} from './retired-products';
import { stripComments } from './strip-comments';
import { ADD_ONS } from './add-ons-catalog';
import { addOnSellableNow } from './add-on-event-scope';
import { buildOurServices } from './our-services';
import { FEATURE_PAGES } from './feature-pages';
import { IAP_PRODUCTS } from './iap/products';
import { ALL_HELP_ARTICLES } from './help';
import { renderLlmsTxt, LINKED_ROUTES } from './llms-txt';
import { INPUT_FOR_GUARDS } from './llms-txt-guard-input';
import { EVENT_ULTRA_GRANTS } from './event-ultra';
import { SKU_OWNERSHIP_ALIASES } from './entitlements';
import { WIZARD_TASKS_PAID, WIZARD_TASKS_DIY } from './wizard';
import { INAPP_TO_SERVICE_CODE, OUT_ANCHORS } from '../app/onboarding/wedding/_components/onboarding-pricing';
import { ADD_ONS as FRONT_DOOR_ADD_ONS, ULTRA_PEEK, ultraMore } from '../app/_components/frontdoor/front-door-landing-data';

const WEB = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const NAME_RE = new RegExp(`\\b(${RETIRED_PRODUCT_NAMES.join('|')})\\b`, 'i');

/* ── 1 · NOT BUYABLE ──────────────────────────────────────────────────────── */

test('a migration retires both codes in the retail catalogue (is_active FALSE + retired_at, never DELETE)', () => {
  const dir = resolve(WEB, '../../supabase/migrations');
  const hits = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .filter(
      (sql) =>
        /UPDATE\s+public\.platform_retail_catalog_v2\s+SET\s+is_active\s*=\s*FALSE[\s\S]*?retired_at[\s\S]*?WHERE\s+service_code\s+IN\s*\(\s*'PATIKTOK_COMPILER'\s*,\s*'PAKANTA'\s*\)/i.test(
          sql,
        ),
    );
  assert.ok(hits.length > 0, 'no migration retires PATIKTOK_COMPILER and PAKANTA');
  for (const sql of hits) {
    assert.ok(!/DELETE\s+FROM\s+public\.platform_retail_catalog_v2/i.test(sql), 'a retirement never deletes the row');
  }
});

test('no App Store product sells a retired product', () => {
  const selling = IAP_PRODUCTS.filter((p) => RETIRED_PRODUCT_CODES.has(p.serviceKey)).map((p) => p.productId);
  assert.deepEqual(selling, [], `retired products on sale in the app: ${selling.join(', ')}`);
});

test('every add-on entry for a retired product is not sellable, in any phase', () => {
  const entries = ADD_ONS.filter((a) => isRetiredAddOn(a));
  assert.ok(entries.length >= 2, 'the catalogue no longer carries the retired entries — check isRetiredAddOn');
  for (const e of entries) {
    assert.equal(addOnSellableNow(e, 'plan'), false, `${e.key} is sellable before the event`);
    assert.equal(addOnSellableNow(e, 'after'), false, `${e.key} is sellable after the event`);
  }
});

test('the service cards and More menu draw no retired product for an event that does not have it', () => {
  const cards = buildOurServices({
    eventId: 'S89E-TEST',
    catalogue: ADD_ONS,
    owned: { active: new Set(), pending: new Set() },
    prices: new Map([...RETIRED_PRODUCT_CODES].map((c) => [c, '₱1'])),
    offered: () => true,
    sellableNow: (e) => addOnSellableNow(e, 'plan'),
    aiSellable: true,
    papicOwnedBy: [],
    refusesPath: () => false,
  });
  const retired = cards.filter((c) => c.key === 'patiktok' || c.key === 'music-maker').map((c) => c.key);
  assert.deepEqual(retired, [], `cards still drawn for: ${retired.join(', ')}`);
});

test('an event that already HAS a retired product keeps its card (nobody loses what they have)', () => {
  const cards = buildOurServices({
    eventId: 'S89E-TEST',
    catalogue: ADD_ONS,
    owned: { active: new Set(RETIRED_PRODUCT_CODES), pending: new Set() },
    prices: new Map(),
    offered: () => true,
    sellableNow: (e) => addOnSellableNow(e, 'plan'),
    aiSellable: true,
    papicOwnedBy: [],
    refusesPath: () => false,
  });
  const kept = cards.filter((c) => c.key === 'patiktok' || c.key === 'music-maker').map((c) => c.state);
  assert.deepEqual(kept, ['added', 'added']);
});

test('the in-app pages of a retired product send a non-owner away', () => {
  for (const rel of [
    'app/dashboard/[eventId]/studio/patiktok/page.tsx',
    'app/dashboard/[eventId]/studio/patiktok/booth/page.tsx',
    'app/dashboard/[eventId]/studio/patiktok/[templateId]/page.tsx',
    'app/dashboard/[eventId]/studio/pakanta/page.tsx',
  ]) {
    assert.match(stripComments(read(rel)), /redirectUnlessEventKeepsRetired\(eventId, '(PATIKTOK_COMPILER|PAKANTA)'\)/, rel);
  }
  assert.match(stripComments(read('app/dashboard/[eventId]/studio/about/[addon]/page.tsx')), /isRetiredAddOn\(entry\)/);
  assert.match(stripComments(read('lib/studio-rail.ts')), /RETIRED_ADD_ON_KEYS\.has\(a\.key\)/);
});

/* ── 2 · NOT DESCRIBED IN PUBLIC ──────────────────────────────────────────── */

test('the public pages /patiktok and /pakanta redirect, and the sitemap does not list them', () => {
  for (const p of RETIRED_PUBLIC_PATHS) {
    const src = stripComments(read(`app/(shell)${p}/page.tsx`));
    assert.match(src, /redirect\('\/features'\)/, `${p} renders instead of redirecting`);
    assert.ok(!NAME_RE.test(src), `${p} still names the product`);
  }
  const sitemap = stripComments(read('app/sitemap-static.xml/route.ts'));
  for (const p of RETIRED_PUBLIC_PATHS) assert.ok(!sitemap.includes(`'${p}'`), `sitemap lists ${p}`);
});

test('/features has no page for a retired product, and no page links one', () => {
  for (const f of FEATURE_PAGES) {
    assert.ok(!RETIRED_FEATURE_SLUGS.has(f.slug), `/features/${f.slug} is still a page`);
    for (const w of f.worksWith) assert.ok(!RETIRED_FEATURE_SLUGS.has(w.slug), `${f.slug} works-with ${w.slug}`);
  }
  for (const rel of ['app/(shell)/features/[slug]/page.tsx', 'app/(shell)/tl/features/[slug]/page.tsx']) {
    assert.match(stripComments(read(rel)), /RETIRED_FEATURE_SLUGS\.has\(slug\)\) permanentRedirect/, rel);
  }
  const rows = stripComments(read('lib/features-page.ts'))
    .split('\n')
    // The EXCLUDED register (rows deliberately NOT on the page, with why) may say it was retired.
    .filter((l) => NAME_RE.test(l) && !/— retired 2026-11-20/.test(l));
  assert.deepEqual(rows, [], 'lib/features-page.ts still lists a retired product');
  const how = stripComments(read('app/features/_sections/_HowItWorks.tsx'));
  assert.ok(!NAME_RE.test(how), 'the /features "how it works" add-on list names a retired product');
});

test('/pricing prices no retired product, even before the catalogue row is retired', async () => {
  const { ourPricesFrom } = await import('../app/(shell)/pricing/_pricing-reads');
  const rows = [...RETIRED_PRODUCT_CODES].map(
    (service_code) => ({ service_code, retail_price_php: 2490, billing_period: 'per_day' }) as unknown as Parameters<typeof ourPricesFrom>[0][number],
  );
  const prices = ourPricesFrom(rows, []);
  assert.equal(prices.patiktok, null);
  assert.equal(prices.musicMaker, null);
});

test('the Event Ultra plan copy never lists Patiktok (front door, plan offer, /pricing)', () => {
  assert.ok(!NAME_RE.test(ultraMore({ plusCredits: 1, proCredits: 1, ultraCredits: 1, freePapic: 1 } as never).join(' ')));
  assert.ok(!NAME_RE.test(ULTRA_PEEK.join(' ')));
  const pricing = stripComments(read('app/(shell)/pricing/page.tsx'));
  const ultraTip = pricing.match(/name="Event Ultra"\s*\n\s*tip=\{`([^`]*)`/)?.[1];
  assert.ok(ultraTip, 'the /pricing Event Ultra tip moved — update this guard');
  assert.ok(!NAME_RE.test(ultraTip), `/pricing Event Ultra tip: ${ultraTip}`);
});

test('the front door add-on tiles never name or link a retired product', () => {
  for (const t of FRONT_DOOR_ADD_ONS) {
    assert.ok(!NAME_RE.test(t.title) && !NAME_RE.test(t.line), `front door tile "${t.title}"`);
    assert.ok(![...RETIRED_FEATURE_SLUGS].some((s) => t.href === `/features/${s}`), `front door tile → ${t.href}`);
  }
});

test('the site description and the homepage structured data never name a retired product', () => {
  const layout = stripComments(read('app/layout.tsx'));
  const desc = layout.match(/const SITE_DESCRIPTION =\s*\n?\s*'([^']*)'/)?.[1];
  assert.ok(desc, 'SITE_DESCRIPTION not found — update this guard to where it moved');
  assert.ok(!NAME_RE.test(desc), `SITE_DESCRIPTION names a retired product: ${desc}`);
  const jsonLdLines = layout.split('\n').filter((l) => /description:/.test(l) && NAME_RE.test(l));
  assert.deepEqual(jsonLdLines, [], 'a layout JSON-LD description names a retired product');
  const home = stripComments(read('app/page.tsx'));
  assert.ok(!NAME_RE.test(home), 'app/page.tsx (homepage JSON-LD) names a retired product');
  const manifest = JSON.parse(read('public/manifest.json')) as { description?: string; name?: string };
  assert.ok(manifest.description, 'public/manifest.json has no description — update this guard');
  assert.ok(!NAME_RE.test(manifest.description), `the installed-app description names a retired product: ${manifest.description}`);
});

test('/help describes no retired product', () => {
  assert.ok(ALL_HELP_ARTICLES.length > 50 && ALL_HELP_ARTICLES[0]!.article.body.length > 0, 'premise: the help list is read');
  const hits = ALL_HELP_ARTICLES.filter(
    ({ article: a, topic: t }) => NAME_RE.test(a.title) || NAME_RE.test(a.body) || NAME_RE.test(t.label),
  ).map(({ article: a }) => a.slug);
  assert.deepEqual(hits, [], `help articles naming a retired product: ${hits.join(', ')}`);
});

test('llms.txt neither describes nor links a retired product', () => {
  const body = renderLlmsTxt(INPUT_FOR_GUARDS);
  const lines = body.split('\n').filter((l) => NAME_RE.test(l));
  assert.deepEqual(lines, [], `llms.txt lines naming a retired product:\n${lines.join('\n')}`);
  for (const p of RETIRED_PUBLIC_PATHS) assert.ok(!(LINKED_ROUTES as readonly string[]).includes(p), `llms.txt links ${p}`);
  for (const s of RETIRED_FEATURE_SLUGS) assert.ok(!body.includes(`/features/${s}`), `llms.txt links /features/${s}`);
});

test('the retired add-on keys are the catalogue keys of the retired codes', () => {
  for (const k of RETIRED_ADD_ON_KEYS) {
    const e = ADD_ONS.find((a) => a.key === k);
    assert.ok(e && e.serviceKey && RETIRED_PRODUCT_CODES.has(e.serviceKey), `${k} → ${e?.serviceKey}`);
  }
});

/* ── 3 · NOT GIVEN AWAY, NOT OFFERED ON THE WAY IN ───────────────────────── */

test('Event Ultra no longer confers a retired product — app grants, ownership aliases and the SQL readers', () => {
  for (const code of RETIRED_PRODUCT_CODES) {
    assert.ok(!EVENT_ULTRA_GRANTS.includes(code), `EVENT_ULTRA_GRANTS still grants ${code}`);
    assert.ok(!(SKU_OWNERSHIP_ALIASES[code] ?? []).includes('EVENT_ULTRA'), `an Ultra order still confers ${code}`);
  }
  // The definition in force is the LATEST migration that (re)defines each gifted-access reader.
  const dir = resolve(WEB, '../../supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const fn of ['event_has_comp_for_sku', 'event_comp_active_skus']) {
    const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`);
    const last = files.filter((f) => re.test(readFileSync(join(dir, f), 'utf8'))).at(-1);
    assert.ok(last, `no migration defines ${fn}`);
    const sql = readFileSync(join(dir, last!), 'utf8').replace(/--[^\n]*/g, '');
    const body = sql.slice(sql.search(re));
    const def = body.slice(0, body.indexOf('$$;', body.indexOf('$$') + 2));
    for (const code of RETIRED_PRODUCT_CODES) assert.ok(!def.includes(`'${code}'`), `${last}: ${fn} still names ${code}`);
  }
});

test('onboarding never offers, prices or recommends a retired product', () => {
  for (const key of RETIRED_ADD_ON_KEYS) {
    assert.ok(!(key in INAPP_TO_SERVICE_CODE), `onboarding still prices "${key}" (INAPP_TO_SERVICE_CODE)`);
    assert.ok(!(key in OUT_ANCHORS), `onboarding still draws a "you save" anchor for "${key}"`);
  }
  for (const code of RETIRED_PRODUCT_CODES) {
    assert.ok(!Object.values(INAPP_TO_SERVICE_CODE).includes(code), `onboarding still maps a key to ${code}`);
  }
  const shell = stripComments(read('app/onboarding/wedding/_components/onboarding-shell.tsx'));
  for (const key of RETIRED_ADD_ON_KEYS) {
    assert.ok(!new RegExp(`'${key}'|\\b${key}:`).test(shell), `onboarding-shell.tsx still names "${key}" (INAPP_KEYS / REC_PRIORITY / a supplier rec / its copy)`);
  }
  assert.ok(!NAME_RE.test(shell), 'onboarding-shell.tsx still names a retired product');
});

test('the planning wizard has no task for a retired product', () => {
  const tasks = [...WIZARD_TASKS_PAID, ...WIZARD_TASKS_DIY];
  assert.ok(tasks.length > 20, 'premise: the wizard lists are read');
  const hits = tasks.filter((t) => RETIRED_ADD_ON_KEYS.has(t.id) || NAME_RE.test(t.title) || NAME_RE.test(t.whyItMatters ?? ''));
  assert.deepEqual(hits.map((t) => t.id), [], 'wizard tasks for a retired product');
});
