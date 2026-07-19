/**
 * Vendor deep-search — Lite (keyless) mode + helpers (node:test via tsx).
 *
 * Covers the deterministic, no-AI path (owner 2026-07-03): URL normalization,
 * title/description/price extraction, and the runLiteDeepSearch orchestration
 * (including that it never throws for a dead site and that runDeepSearchOrLite
 * picks Lite when ANTHROPIC_API_KEY is absent).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSiteUrl,
  extractTitle,
  extractMetaDescription,
  extractPesoSignals,
  stripTags,
  runLiteDeepSearch,
  runDeepSearchOrLite,
  buildDeepSearchChatPrompt,
  buildVendorStudyPrompt,
  parseDossierText,
  DEEP_SEARCH_LITE_MODEL,
  type DeepSearchInputs,
} from './vendor-deep-search';

const BASE_INPUTS: DeepSearchInputs = {
  business_name: 'Aurora Blooms',
  website: null,
  social_url: null,
  location_city: 'Cebu City',
  claimed_services: ['florist'],
};

test('normalizeSiteUrl adds scheme, rejects junk', () => {
  assert.equal(normalizeSiteUrl('aurorablooms.ph'), 'https://aurorablooms.ph/');
  assert.equal(normalizeSiteUrl('http://x.com/path'), 'http://x.com/path');
  assert.equal(normalizeSiteUrl('  https://y.com  '), 'https://y.com/');
  assert.equal(normalizeSiteUrl(''), null);
  assert.equal(normalizeSiteUrl(null), null);
  assert.equal(normalizeSiteUrl('not a url'), null); // has a space, no dot host
  assert.equal(normalizeSiteUrl('localhost'), null); // no dot
  assert.equal(normalizeSiteUrl('javascript:alert(1)'), null); // non-http scheme
});

test('extractTitle / extractMetaDescription', () => {
  const html =
    '<html><head><title>  Aurora &amp; Co — Florist </title>' +
    '<meta name="description" content="Wedding florals in Cebu"></head><body>x</body></html>';
  assert.equal(extractTitle(html), 'Aurora & Co — Florist');
  assert.equal(extractMetaDescription(html), 'Wedding florals in Cebu');
  // og:description + reversed attribute order
  const og = '<meta content="OG desc" property="og:description">';
  assert.equal(extractMetaDescription(og), 'OG desc');
  assert.equal(extractTitle('<body>no title</body>'), '');
});

test('stripTags removes script/style and tags', () => {
  const out = stripTags('<style>.a{}</style><p>Hi</p><script>bad()</script>');
  assert.ok(out.includes('Hi'));
  assert.ok(!out.includes('bad()'));
  assert.ok(!out.includes('.a{}'));
});

test('extractPesoSignals finds ₱, PHP, ranges; dedupes; caps', () => {
  const text =
    'Packages from ₱25,000. Premium ₱45,000.00. Budget PHP 10,000 to 15,000. ' +
    'Again ₱25,000 (dup). Coordination Php 8,500.';
  const sigs = extractPesoSignals(text);
  const prices = sigs.map((s) => s.price.toLowerCase().replace(/\s/g, ''));
  assert.ok(prices.some((p) => p.includes('25,000')));
  assert.ok(prices.some((p) => p.includes('45,000')));
  assert.ok(prices.some((p) => p.includes('8,500')));
  // ₱25,000 appears twice but must be deduped
  assert.equal(prices.filter((p) => p === '₱25,000').length, 1);
  // labels carry surrounding context
  assert.ok(sigs.every((s) => typeof s.label === 'string' && s.label.length > 0));
  // decoded ₱ entity is recognized
  const ent = extractPesoSignals('Rate &#8369;12,000 flat');
  assert.ok(ent.some((s) => s.price.includes('12,000')));
});

test('runLiteDeepSearch: no website + no social → honest empty dossier, no throw', async () => {
  const d = await runLiteDeepSearch(BASE_INPUTS);
  assert.equal(d.category_match, 'unknown');
  assert.equal(d.confidence, 'low');
  assert.deepEqual(d.detected_services, []);
  assert.deepEqual(d.price_signals, []);
  assert.equal(d.web_presence.length, 0);
  assert.ok(d.business_summary.startsWith('Lite result (no AI)'));
});

test('runLiteDeepSearch: social only adds a presence row', async () => {
  const d = await runLiteDeepSearch({ ...BASE_INPUTS, social_url: 'https://facebook.com/aurora' });
  assert.equal(d.web_presence.length, 1);
  assert.equal(d.web_presence[0]?.platform, 'Social');
});

test('runLiteDeepSearch: fetches website, extracts prices + title (mocked fetch)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      '<html><head><title>Aurora Blooms</title>' +
        '<meta name="description" content="Cebu florist"></head>' +
        '<body>Bridal bouquet ₱7,500. Full setup ₱60,000.</body></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )) as typeof fetch;
  try {
    const d = await runLiteDeepSearch({ ...BASE_INPUTS, website: 'aurorablooms.ph' });
    const site = d.web_presence[0];
    assert.ok(site);
    assert.equal(site.platform, 'Website');
    assert.equal(site.url, 'https://aurorablooms.ph/');
    assert.ok(d.price_signals.some((p) => p.price.includes('7,500')));
    assert.ok(d.price_signals.some((p) => p.price.includes('60,000')));
    assert.ok(d.price_signals.every((p) => p.source_url === 'https://aurorablooms.ph/'));
    assert.ok(d.business_summary.includes('Aurora Blooms'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runLiteDeepSearch: dead website → presence row says it could not be read, no throw', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('ENOTFOUND');
  }) as typeof fetch;
  try {
    const d = await runLiteDeepSearch({ ...BASE_INPUTS, website: 'dead.example' });
    const site = d.web_presence[0];
    assert.ok(site);
    assert.equal(site.platform, 'Website');
    assert.ok((site.note ?? '').toLowerCase().includes('could not fetch'));
    assert.deepEqual(d.price_signals, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runDeepSearchOrLite: no API key → Lite mode + lite model marker', async () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const { dossier, model } = await runDeepSearchOrLite(BASE_INPUTS);
    assert.equal(model, DEEP_SEARCH_LITE_MODEL);
    assert.equal(dossier.confidence, 'low');
  } finally {
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
  }
});

test('buildDeepSearchChatPrompt bakes in the vendor, ad links, and JSON schema', () => {
  const prompt = buildDeepSearchChatPrompt({
    business_name: 'Aurora Blooms',
    website: 'https://aurorablooms.ph',
    social_url: 'https://facebook.com/aurora',
    location_city: 'Cebu City',
    claimed_services: ['florist', 'styling'],
  });
  assert.ok(prompt.includes('Aurora Blooms'));
  assert.ok(prompt.includes('https://aurorablooms.ph'));
  assert.ok(prompt.includes('florist, styling'));
  assert.ok(prompt.includes('Cebu City'));
  // ad-transparency links included for the free "search their ads" path
  assert.ok(prompt.includes('facebook.com/ads/library'));
  assert.ok(prompt.includes('adstransparency.google.com'));
  // ends with the exact JSON schema so the chat's reply parses back
  assert.ok(prompt.includes('"business_summary"'));
  assert.ok(prompt.includes('```json'));
});

test('buildDeepSearchChatPrompt output round-trips through parseDossierText', () => {
  // Simulate the AI chat answering the prompt with a schema-shaped reply.
  const reply = [
    'Here is what I found.',
    '```json',
    JSON.stringify({
      business_summary: 'A Cebu wedding florist.',
      detected_services: ['florist'],
      price_signals: [{ label: 'Bridal bouquet', price: '₱7,500', source_url: 'https://x.ph' }],
      web_presence: [{ platform: 'Website', url: 'https://x.ph', note: 'live' }],
      ads_findings: null,
      consistency_flags: [],
      category_match: 'match',
      confidence: 'high',
    }),
    '```',
  ].join('\n');
  const dossier = parseDossierText(reply);
  assert.ok(dossier);
  assert.equal(dossier.business_summary, 'A Cebu wedding florist.');
  assert.equal(dossier.category_match, 'match');
  assert.equal(dossier.price_signals[0]?.price, '₱7,500');
});

test('buildDeepSearchChatPrompt handles a bare vendor with no links', () => {
  const prompt = buildDeepSearchChatPrompt({
    business_name: '',
    website: null,
    social_url: null,
    location_city: null,
    claimed_services: [],
  });
  assert.ok(prompt.includes('(none given)'));
  assert.ok(prompt.includes('(none listed)'));
  assert.ok(prompt.includes('```json')); // schema still present
});

test('buildVendorStudyPrompt is a fit-brief + interview prompt (no JSON schema)', () => {
  const prompt = buildVendorStudyPrompt({
    business_name: 'Aurora Blooms',
    website: 'https://aurorablooms.ph',
    social_url: 'https://facebook.com/aurora',
    location_city: 'Cebu City',
    claimed_services: ['florist'],
  });
  assert.ok(prompt.includes('Aurora Blooms'));
  assert.ok(prompt.includes('https://aurorablooms.ph'));
  // it's a fit-assessment + interview-prep brief, not a stored dossier
  assert.ok(/FIT VERDICT/i.test(prompt));
  assert.ok(/INTERVIEW QUESTIONS/i.test(prompt));
  assert.ok(/CONCERNS|RED FLAGS/i.test(prompt));
  // ad-transparency links still included for the free "search their ads" path
  assert.ok(prompt.includes('facebook.com/ads/library'));
  // deliberately NOT a JSON-schema prompt (it's read, not parsed back)
  assert.ok(!prompt.includes('```json'));
});
