/**
 * features-tagging.test.ts — ONE guard that walks every /features route, in
 * both languages, for the search + AI-search tags (DECISION_LOG 2026-10-01
 * "EVERY FEATURE PAGE, ARTICLE AND THE PAGES INSIDE THEM CARRY FULL SEARCH +
 * AI-SEARCH TAGGING").
 *
 * It does not render pages — it calls the SAME functions the pages call
 * (`lib/feature-pages/seo.ts`), for every slug × locale, and reads the
 * renderer's source for what only markup can show (one H1, H2/H3, alt text,
 * answer-first). Then it checks the three places a crawler finds the pages:
 * the sitemap, llms.txt and robots.
 *
 * Sabotage-checked once each, 2026-10-01 (see the PR): duplicate a title →
 * RED; drop the tl hreflang → RED; drop a slug from the sitemap → RED; add a
 * second <h1 to the renderer → RED; disallow /features for ClaudeBot → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  FEATURE_PAGES,
  FEATURE_SLUGS,
  FEATURES_LASTMOD,
  ECOSYSTEM_CHAINS,
  featurePaths,
  type FeatureLocale,
} from '@/lib/feature-pages';
import { featureJsonLd, featureMetadata, featuresHubItemList, SITE_URL } from '@/lib/feature-pages/seo';
import { resolveFeaturePrice, type CatalogueRow } from '@/lib/feature-pages/price';
import { renderLlmsTxt, llmsFeaturePages } from '@/lib/llms-txt';
import { INPUT_FOR_GUARDS } from '@/lib/llms-txt-guard-input';
import { KNOWN_PUBLIC_ROUTES } from '@/lib/seo/health-checks';
import { GET as sitemapFeatures } from '../sitemap-features.xml/route';
import robots from '../robots';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const WEB = join(APP, '..');
const LOCALES: readonly FeatureLocale[] = ['en', 'tl'];

const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** One active row per code a feature names — so every paid page resolves an Offer. */
const ROWS: CatalogueRow[] = FEATURE_PAGES.flatMap((f) =>
  f.price.kind === 'free'
    ? []
    : f.price.codes.map((c, i) => ({
        catalogue: f.price.kind === 'free' ? 'retail' : f.price.catalogue,
        code: c,
        php: 100 + i,
        period: null,
        active: true,
      })),
);

type Graph = { '@graph': Array<Record<string, unknown>> };
const node = (g: Graph, type: string) => g['@graph'].find((n) => n['@type'] === type);

test('the registry holds every slug once, and nothing else', () => {
  const slugs = FEATURE_PAGES.map((f) => f.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'a slug is listed twice');
  assert.deepEqual(
    [...FEATURE_SLUGS].filter((s) => !slugs.includes(s)),
    [],
    'FEATURE_SLUGS names a page the registry does not write — remove the slug or write the page',
  );
});

test('every title and description is unique, plain-length, in both languages', () => {
  const titles = new Map<string, string>();
  const descs = new Map<string, string>();
  const bad: string[] = [];
  for (const f of FEATURE_PAGES) {
    for (const l of LOCALES) {
      const m = featureMetadata(f, l);
      const at = `${f.slug}/${l}`;
      if (titles.has(m.title)) bad.push(`${at}: title duplicates ${titles.get(m.title)}`);
      titles.set(m.title, at);
      if (descs.has(m.description)) bad.push(`${at}: description duplicates ${descs.get(m.description)}`);
      descs.set(m.description, at);
      if (m.title.length > 60) bad.push(`${at}: title is ${m.title.length} chars (max 60)`);
      if (/·\s*Setnayan$/.test(m.title)) bad.push(`${at}: title carries the brand — the layout appends it`);
      if (m.description.length < 70 || m.description.length > 160)
        bad.push(`${at}: description is ${m.description.length} chars (70–160)`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('every page has a canonical, an en ↔ tl hreflang pair and x-default', () => {
  const bad: string[] = [];
  for (const f of FEATURE_PAGES) {
    const p = featurePaths(f.slug);
    for (const l of LOCALES) {
      const a = featureMetadata(f, l).alternates;
      const own = `${SITE_URL}${l === 'tl' ? p.tl : p.en}`;
      if (a.canonical !== own) bad.push(`${f.slug}/${l}: canonical ${a.canonical}`);
      if (a.languages['en-PH'] !== `${SITE_URL}${p.en}`) bad.push(`${f.slug}/${l}: en-PH`);
      if (a.languages['tl-PH'] !== `${SITE_URL}${p.tl}`) bad.push(`${f.slug}/${l}: tl-PH`);
      if (a.languages['x-default'] !== `${SITE_URL}${p.en}`) bad.push(`${f.slug}/${l}: x-default`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('every page has an Open Graph + Twitter card with a real image', () => {
  const bad: string[] = [];
  for (const f of FEATURE_PAGES) {
    for (const l of LOCALES) {
      const m = featureMetadata(f, l);
      const img = m.openGraph.images[0];
      if (!img?.url || !img.alt) bad.push(`${f.slug}/${l}: og image or alt missing`);
      else if (!existsSync(join(WEB, 'public', img.url.replace(SITE_URL, '')))) bad.push(`${f.slug}/${l}: ${img.url} not on disk`);
      if (m.twitter.card !== 'summary_large_image' || m.twitter.images[0] !== img?.url)
        bad.push(`${f.slug}/${l}: twitter card does not carry the same image`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('every page carries the full JSON-LD graph, built from what the page shows', () => {
  const bad: string[] = [];
  for (const f of FEATURE_PAGES) {
    for (const l of LOCALES) {
      const at = `${f.slug}/${l}`;
      const g = featureJsonLd(f, l, resolveFeaturePrice(f.price, ROWS)) as Graph;
      for (const t of ['Organization', 'WebPage', 'BreadcrumbList', 'SoftwareApplication', 'FAQPage', 'HowTo']) {
        if (!node(g, t)) bad.push(`${at}: no ${t}`);
      }
      const app = node(g, 'SoftwareApplication');
      if (!app?.offers) bad.push(`${at}: SoftwareApplication has no Offer though the catalogue priced it`);
      const faq = node(g, 'FAQPage') as { mainEntity?: unknown[] } | undefined;
      if (faq?.mainEntity?.length !== f.faq[l].length) bad.push(`${at}: FAQPage ≠ the page's FAQ`);
      const how = node(g, 'HowTo') as { step?: unknown[] } | undefined;
      if (how?.step?.length !== 3) bad.push(`${at}: HowTo is not the 3 steps`);
      const crumbs = node(g, 'BreadcrumbList') as { itemListElement?: unknown[] } | undefined;
      if (crumbs?.itemListElement?.length !== 3) bad.push(`${at}: breadcrumb is not Home › Features › page`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}`);
});

test('an unreadable catalogue emits NO Offer — never a guessed price', () => {
  // MUTATION: make featureOffer return a ₱0 Offer for 'unknown' → this fails.
  const paid = FEATURE_PAGES.find((f) => f.price.kind === 'paid');
  assert.ok(paid, 'the registry has no paid feature to test against');
  const g = featureJsonLd(paid, 'en', resolveFeaturePrice(paid.price, null)) as Graph;
  assert.equal(node(g, 'SoftwareApplication')?.offers, undefined);
});

test('the page has one H1, H2 sections, H3 questions, alt text, and opens with the answer', () => {
  const src = code('app/features/_feature-page.tsx');
  assert.equal((src.match(/<h1\b/g) ?? []).length, 1, 'exactly one <h1> on a feature page');
  assert.ok((src.match(/<h2\b/g) ?? []).length >= 5, 'the sections are H2s');
  assert.match(src, /<h3\b[^>]*>\{x\.q\}/, 'each question is an H3');
  for (const img of src.match(/<Image\b[^>]*?\/>/gs) ?? []) {
    assert.match(img, /\balt=\{/, `an <Image> with no alt: ${img.slice(0, 80)}`);
  }
  // Answer-first: the answer paragraph comes before the first H2.
  assert.ok(src.indexOf('f.answer[locale]') > 0, 'the answer paragraph is rendered');
  assert.ok(src.indexOf('f.answer[locale]') < src.indexOf('<h2'), 'the answer must come before any section');
  for (const f of FEATURE_PAGES) {
    for (const l of LOCALES) {
      const words = f.answer[l].split(/\s+/).length;
      assert.ok(words >= 12 && words <= 90, `${f.slug}/${l}: answer is ${words} words (12–90)`);
    }
  }
});

test('the hub has one H1 and lists every feature page in its structured data', () => {
  const hub = ['_Hero', '_FeatureGroups', '_Ecosystem', '_WhySetnayan', '_HowItWorks', '_FinalCTA']
    .map((s) => code(`app/features/_sections/${s}.tsx`))
    .join('\n');
  assert.equal((hub.match(/<h1\b/g) ?? []).length, 1, 'the hub has exactly one <h1>');
  for (const l of LOCALES) {
    const list = featuresHubItemList(l) as { itemListElement: unknown[] };
    assert.equal(list.itemListElement.length, FEATURE_PAGES.length);
  }
  assert.match(code('app/features/_PageBody.tsx'), /featuresHubItemList\(locale\)/);
});

test('the ecosystem map only links pages that exist', () => {
  for (const c of ECOSYSTEM_CHAINS) {
    for (const s of c.slugs) {
      assert.ok(FEATURE_PAGES.some((f) => f.slug === s), `the map links ${s}, which has no page`);
    }
  }
});

test('both routes exist, in the shell, with no loading boundary (notFound must 404)', () => {
  for (const rel of ['app/(shell)/features/[slug]', 'app/(shell)/tl/features/[slug]']) {
    assert.ok(existsSync(join(WEB, rel, 'page.tsx')), `${rel}/page.tsx missing`);
    assert.ok(!existsSync(join(WEB, rel, 'loading.tsx')), `${rel} must not stream — it calls notFound()`);
    assert.match(code(`${rel}/page.tsx`), /notFound\(\)/);
  }
});

test('sitemap-features.xml lists every page in both languages, with lastmod and hreflang', async () => {
  const xml = await sitemapFeatures().text();
  for (const f of FEATURE_PAGES) {
    const p = featurePaths(f.slug);
    for (const path of [p.en, p.tl]) {
      assert.ok(xml.includes(`<loc>https://www.setnayan.com${path}</loc>`) || xml.includes(`${path}</loc>`), `sitemap is missing ${path}`);
    }
    assert.ok(xml.includes(`hreflang="tl-PH" href="`) && xml.includes(p.tl), `no tl alternate for ${f.slug}`);
  }
  assert.equal((xml.match(/<lastmod>/g) ?? []).length, FEATURE_PAGES.length * 2);
  assert.ok(xml.includes(`<lastmod>${FEATURES_LASTMOD}</lastmod>`));
  assert.match(code('app/sitemap.xml/route.ts'), /'sitemap-features\.xml'/, 'the sitemap index must list it');
});

test('llms.txt lists the feature pages — and never an unlisted product', () => {
  const body = renderLlmsTxt(INPUT_FOR_GUARDS);
  const listed = llmsFeaturePages();
  assert.ok(listed.length >= FEATURE_PAGES.length - 3, 'llms.txt dropped more than the unlisted pages');
  for (const p of listed) {
    assert.ok(body.includes(`https://www.setnayan.com${p.path}`), `llms.txt does not link ${p.path}`);
  }
  assert.equal(/patiktok/i.test(body), false, 'Patiktok is unlisted until proven (owner 2026-09-27)');
});

test('the SEO audit knows every feature page is public', () => {
  for (const f of FEATURE_PAGES) {
    const p = featurePaths(f.slug);
    assert.ok(KNOWN_PUBLIC_ROUTES.has(p.en) && KNOWN_PUBLIC_ROUTES.has(p.tl), `${f.slug} not in KNOWN_PUBLIC_ROUTES`);
  }
});

test('robots: answer engines may read /features; the AI-training block is unchanged', () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const forAgent = (ua: string) => rules.find((x) => x.userAgent === ua);
  for (const ua of ['ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot']) {
    const rule = forAgent(ua);
    assert.ok(rule, `${ua} has no rule`);
    const allow = ([] as string[]).concat(rule.allow ?? []);
    const disallow = ([] as string[]).concat(rule.disallow ?? []);
    assert.ok(allow.includes('/'), `${ua} must be allowed the site root (which covers /features)`);
    assert.ok(!disallow.some((d) => '/features/papic'.startsWith(d) || '/tl/features'.startsWith(d)), `${ua} is blocked from /features`);
  }
  for (const ua of ['GPTBot', 'Google-Extended', 'Applebot-Extended', 'Amazonbot', 'cohere-ai', 'Bytespider', 'Diffbot']) {
    const disallow = ([] as string[]).concat(forAgent(ua)?.disallow ?? []);
    assert.ok(disallow.includes('/'), `${ua} must stay blocked from training on the site`);
  }
});
