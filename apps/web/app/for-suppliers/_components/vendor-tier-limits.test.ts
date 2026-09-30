/**
 * vendor-tier-limits.test.ts — no vendor-facing cap may render as a JavaScript
 * value.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * `/vendors` shipped this line to the public, on the Enterprise card:
 *
 *     Service listings / category   5 → Infinity
 *
 * `TIER_CAPS.enterprise.servicesPerLeaf` is the JavaScript value `Infinity`, and
 * three of the seven limit rows interpolated the cap directly — `${c.servicesPerLeaf}`.
 * `String(Infinity)` is a perfectly good string, so nothing threw, nothing logged,
 * typecheck was clean, and the word reached a page whose whole job is to sell a
 * plan. The four rows that DID handle it are what hid how easy the other three
 * were to miss.
 *
 * 🔑 THE FIX IS ONE FORMATTER, NOT SEVEN CORRECT AUTHORS — and this is the test
 * for the formatter's OUTPUT, over every real cap in the table, rather than for
 * its existence.
 *
 * ⚠ IT ASSERTS ON THE RENDERED STRINGS, NOT ON THE SOURCE. A guard that greps
 * for `Number.isFinite` would pass the moment someone adds an eighth row that
 * forgets to call the formatter. This one walks every tier × every limit and
 * looks at what a person would actually read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TIER_CAPS, type VendorTier } from '@/lib/vendor-tier-caps';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The formatter and the row table are module-private to the component (it is a
 * 'use client' file that cannot be imported into a node test without React), so
 * this test re-derives the rendered value from the SAME caps using the same
 * rules, and separately pins that the component still routes every row through
 * one formatter. Either half alone would be a half-guard.
 */
const RENDER: Record<string, (n: number) => string> = {
  'Service reach': (n) => (!Number.isFinite(n) ? 'Nationwide' : n === 0 ? '—' : `${n} km`),
  'Parent categories': (n) => (!Number.isFinite(n) ? 'All' : n === 0 ? '—' : `${n}`),
  'Service listings / category': (n) => (!Number.isFinite(n) ? 'Unlimited' : n === 0 ? '—' : `${n}`),
  'Team seats': (n) => (!Number.isFinite(n) ? 'Unlimited' : n === 0 ? '—' : `${n}`),
  'Bookable slots / day': (n) => (!Number.isFinite(n) ? 'Unlimited' : n === 0 ? '—' : `${n}`),
  'Portfolio photos': (n) => (!Number.isFinite(n) ? 'Unlimited' : n === 0 ? '—' : `${n}`),
  'Answer matched couples / week': (n) => (!Number.isFinite(n) ? 'Unlimited' : n === 0 ? '—' : `${n}`),
};

const FIELD: Record<string, keyof (typeof TIER_CAPS)['pro']> = {
  'Service reach': 'serviceRadiusKm',
  'Parent categories': 'parentCategories',
  'Service listings / category': 'servicesPerLeaf',
  'Team seats': 'agentAccounts',
  'Bookable slots / day': 'slotsPerDay',
  'Portfolio photos': 'portfolioPhotos',
  'Answer matched couples / week': 'inAppCustomersPerWeek',
};

const SHOWN: VendorTier[] = ['verified', 'solo', 'pro', 'enterprise'];

/** Anything that betrays a raw JS value having reached the page. */
const LEAKS = /Infinity|NaN|undefined|null|\[object|e\+\d/i;

test('no tier limit renders a raw JavaScript value to a vendor', () => {
  const offences: string[] = [];
  for (const tier of SHOWN) {
    for (const [label, render] of Object.entries(RENDER)) {
      const raw = TIER_CAPS[tier][FIELD[label]!] as unknown as number;
      const out = render(raw);
      if (LEAKS.test(out)) offences.push(`${tier} · ${label} → "${out}" (raw: ${String(raw)})`);
    }
  }
  assert.deepEqual(
    offences,
    [],
    `A vendor tier card would print a JavaScript value:\n  ` +
      offences.join('\n  ') +
      `\n\nThis is what shipped: Enterprise read "5 → Infinity" on the live page. ` +
      `String(Infinity) is a valid string, so nothing throws and nothing logs.`,
  );
});

test('every limit that CAN be infinite is actually exercised here', () => {
  // 🪤 The test above passes trivially if no cap in the table is infinite — which
  // would make it decoration the day someone "simplifies" TIER_CAPS. Assert the
  // dangerous input really occurs, so this guard is known to have teeth.
  const infinite = SHOWN.flatMap((t) =>
    Object.entries(FIELD)
      .filter(([, f]) => !Number.isFinite(TIER_CAPS[t][f] as unknown as number))
      .map(([label]) => `${t}·${label}`),
  );
  assert.ok(
    infinite.length >= 3,
    `only ${infinite.length} infinite caps found (${infinite.join(', ')}) — if TIER_CAPS ` +
      `no longer contains infinities this guard is no longer testing anything, and the ` +
      `formatter it protects should be re-justified rather than silently trusted`,
  );
});

test('the component routes EVERY limit row through the one formatter', () => {
  // The rendered-value test above proves the RULES are right; this proves the
  // component still obeys them. Testing the primitive is not testing the caller.
  const src = readFileSync(resolve(HERE, 'vendor-tier-deltas.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const block = src.slice(src.indexOf('const LIMITS'), src.indexOf('function movedLimits'));
  assert.ok(block.length > 100, 'the LIMITS table moved or was renamed');

  const rows = [...block.matchAll(/of:\s*\(c\)\s*=>\s*([^\n]+)/g)].map((m) => m[1] ?? '');
  assert.equal(rows.length, Object.keys(RENDER).length, 'row count drifted from this test');
  const unrouted = rows.filter((r) => !/\bcap\(/.test(r));
  assert.deepEqual(
    unrouted,
    [],
    `A limit row interpolates its cap directly instead of calling cap():\n  ` +
      unrouted.join('\n  ') +
      `\n\nThat is exactly how "Infinity" reached the public page.`,
  );
});
