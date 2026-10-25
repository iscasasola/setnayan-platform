/**
 * pricing-free-plus-addons.test.ts — /pricing is "Free here. Paid elsewhere. / Pay only for the upgrades you need."
 *
 * Owner 2026-10-25, verbatim: *"make sure they see that while Other websites pay for these services, we give it for
 * free. And only pay what you need to upgrade."* Approved prototype
 * `prototypes/pricing_free_plus_addons_2026-10-25/index.html` (corpus 20b2a55c, revision 4). Replaces the earlier
 * Free-vs-Pro table guard (#6908, same day). What this pins, each by the ACT on the comment-stripped page (or by
 * rendering the client pickers), never by a docblock mentioning it:
 *   1. The hero says the one message, word for word.
 *   2. FREE: five sourced "elsewhere" lines + the printables, every other-site figure read from
 *      `lib/pricing-elsewhere.ts` (never typed), "One place, instead of several tools" summing the two per-event prices,
 *      and the compact rest of the planner.
 *   3. NO COMPETITOR IS NAMED — no name or domain from the sources reaches the page or its pickers.
 *   4. WHAT YOU CAN ADD: Event Hub Pro from COUPLE_WEBSITE_PRO (both prices, the shared resolver) with ONE dropdown —
 *      Everything, or the eleven COUPLE_HUB_PART_* rows — then Papic credits · Live Watch · Patiktok · Music Maker ·
 *      Setnayan AI, each from its own row. Not one of our pesos is typed.
 *   5. Below, unchanged: the add-ons catalogue, the Papic estimator, "Everything you get for free".
 *
 * SABOTAGES (each run red, then restored — see the PR):
 *   · hero h1 back to "Plan for free."                                       → 1 RED
 *   · a "₱2,499" typed into the combo instead of ELSEWHERE.siteFull           → 2 RED
 *   · drop the Door check-in ElsewhereLine                                    → 2 RED
 *   · the word "Ceremo" in a tip                                              → 3 RED
 *   · Event Hub parts read from a typed price instead of the catalogue row    → 4 RED
 *   · the Setnayan AI picker's launch line drops the sign-up figure           → 4 RED
 *   · delete the <PapicEstimator>                                             → 5 RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { ELSEWHERE, ELSEWHERE_CHECKIN_PAID_PLAN } from '@/lib/pricing-elsewhere';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const code = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const pickers = stripComments(readFileSync(join(HERE, '_pricing-pickers.tsx'), 'utf8'));
/** The JSX between two section ids. */
const section = (id: string) => {
  const at = code.indexOf(`id="${id}"`);
  assert.ok(at > -1, `section #${id} is gone`);
  return code.slice(at, code.indexOf('</section>', at));
};

test('1 · the hero says the one message', () => {
  assert.match(code, /Free here\. Paid elsewhere\.\{' '\}\s*<span className="text-ink\/55">Pay only for the upgrades you need\.<\/span>/);
  assert.doesNotMatch(code, /Plan for free\.\{' '\}/, 'the old hero is back');
  assert.match(code, /href="#add" className="m-btn m-btn-ghost">\s*What you can add ↓/);
});

test('2 · FREE: five sourced "elsewhere" lines + printables, figures read from lib/pricing-elsewhere.ts', () => {
  const free = section('plans');
  const lines = [...free.matchAll(/<ElsewhereLine\s+n="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(lines, [
    'Unlimited guests & RSVPs',
    'The Event Hub your guests open',
    'Seat plan, with the 3D walkthrough',
    'Door check-in by QR',
    'Livestream from one camera',
    'Printables for your event',
  ]);
  // Every other-site figure is a read of ELSEWHERE — never a typed peso or count.
  assert.match(free, /\$\{elsewhereGuests\}/);
  assert.match(free, /\$\{elsewhereSiteAbout\}/);
  assert.match(free, /ELSEWHERE\.seatingTrialGuests\.value/);
  assert.match(free, /\$\{elsewhereLiveAbout\}/);
  assert.match(code, /aboutPhp\(ELSEWHERE\.siteFull\.value\)/);
  // One place, instead of several tools: the two per-event prices, summed by the module, "at least".
  assert.match(free, /One place, instead of several tools/);
  assert.match(free, /ELSEWHERE\.siteFull\.value/);
  assert.match(free, /ELSEWHERE\.livestreamPersonal\.value/);
  assert.match(free, /at least ₱\{formatPeso\(elsewhereOneEventPhp\(\)\)\}/);
  assert.equal((free.match(/elsewhere: 'extra'/g) ?? []).length, 2, 'seating and check-in are not shown as "extra"');
  assert.match(free, /And the rest of the planner/);
  // Not one peso figure is typed on the page except the ₱0 "here".
  const typed = (code.match(/₱[0-9](?:[0-9,]*[0-9])?/g) ?? []).filter((f) => f !== '₱0');
  assert.deepEqual(typed, [], `a peso figure is typed on /pricing: ${typed.join(', ')}`);
});

test('3 · no competitor is named — no name or domain from the sources reaches the page', () => {
  const sources = [...Object.values(ELSEWHERE).flatMap((f) => f.sources), ...ELSEWHERE_CHECKIN_PAID_PLAN.sources];
  const names = new Set(
    sources.map((u) => new URL(u).hostname.replace(/^www\./, '').split('.')[0]!.replace(/^use/, '')),
  );
  assert.ok(names.size >= 5, `expected the five source sites, got ${[...names].join(', ')}`);
  for (const n of names) {
    for (const [file, src] of [['page.tsx', code], ['_pricing-pickers.tsx', pickers]] as const) {
      assert.doesNotMatch(src, new RegExp(n, 'i'), `${file} names a competitor (${n})`);
    }
  }
});

test('4 · WHAT YOU CAN ADD: Event Hub Pro (Everything or the eleven parts) and five products, each from its own row', () => {
  const add = section('add');
  assert.match(add, /Pay only for the upgrades you need\./);
  // Event Hub Pro — COUPLE_WEBSITE_PRO, both prices through the shared resolver.
  assert.match(code, /const\s+proRow\s*=\s*customerSkus\.find\(\s*\(s\)\s*=>\s*s\.service_code\s*===\s*'COUPLE_WEBSITE_PRO'\s*\)/);
  assert.match(code, /resolveAiPrices\(\s*proRow\s*\)/);
  assert.match(add, /\{proSignupLabel\} while you set up your event<\/b>\s*\{' '\}— \{proRegularLabel\} after\./);
  assert.match(add, /<HubProWays[\s\S]*everythingLabel=\{`Everything · \$\{proRegularLabel\}`\}/);
  // The parts: every HUB_PARTS row priced from ITS catalogue row (is_active), the "from" the cheapest of them.
  assert.match(code, /HUB_PARTS\.map\(\(part\) => \{\s*const row = extraByCode\.get\(part\.sku\);/);
  assert.match(code, /\.in\('service_code', \[\.\.\.HUB_PART_SKUS, \.\.\.aiCodes\]\)/);
  assert.match(add, /₱\{formatPeso\(php\)\}/);
  // Five more products, in the prototype's order, each by its own code.
  const items = [...add.matchAll(/code="([A-Z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(items, ['COUPLE_WEBSITE_PRO', 'PAPIC_GUEST', 'LIVE_STUDIO', 'PATIKTOK_COMPILER', 'PAKANTA']);
  assert.match(add, /<AiTypeItem/);
  assert.match(code, /rowPrice\('LIVE_STUDIO'\)/);
  assert.match(code, /rowPrice\('PATIKTOK_COMPILER'\)/);
  assert.match(code, /rowPrice\('PAKANTA'\)/);
  assert.match(code, /papicPoolBuckets\[0\]!\.pricePhp/);
  assert.match(code, /AI_TIER_SKU\[band\]/);
  // Both dropdowns are the house PickMenu — a set of choices is a dropdown, never a pill row.
  assert.equal((pickers.match(/<PickMenu\b/g) ?? []).length, 2);
  assert.doesNotMatch(code, /<table\b|PLAN_TABLE/, 'the Free-vs-Pro table is back');
});

test('4 · the pickers render the figure picked, with its sign-up price beside the regular one', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AiTypeItem, HubProWays } = await import('./_pricing-pickers');
  const ai = renderToStaticMarkup(
    React.createElement(AiTypeItem, {
      name: 'Setnayan AI',
      tip: 'x',
      what: 'y',
      bill: 'one-time · until the event day',
      options: [
        { key: 'A', label: 'wedding', regular: 'R-A', signup: 'S-A' },
        { key: 'B', label: 'debut, corporate or gala', regular: 'R-B', signup: null },
      ],
    }),
  );
  assert.match(ai, /data-ai-php="">R-A</);
  assert.match(ai, /S-A while you set up your event<\/b> — R-A after\./);
  assert.match(ai, /For a wedding/);
  const hub = renderToStaticMarkup(
    React.createElement(HubProWays, {
      everythingLabel: 'Everything · E',
      partsLabel: 'Just the parts you need · from P',
      everything: React.createElement('p', null, 'ALL'),
      parts: React.createElement('p', null, 'PARTS'),
    }),
  );
  assert.match(hub, /Everything · E/);
  assert.match(hub, />ALL</);
  assert.doesNotMatch(hub, />PARTS</, 'both bodies drawn at once');
});

test('5 · below, unchanged: the add-ons catalogue, the Papic estimator, "Everything you get for free"', () => {
  assert.match(code, /<section id="addons"/);
  assert.match(code, /resolvedGroups\.map\(\(group\) =>/);
  assert.match(code, /<PapicEstimator rates=\{estimatorRates\} \/>/);
  assert.match(code, /<section id="free"/);
  assert.match(code, /Everything you get for free\./);
  assert.doesNotMatch(code, /Provisional pending/i);
});
