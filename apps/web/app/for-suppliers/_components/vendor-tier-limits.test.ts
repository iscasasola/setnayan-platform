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
import {
  FREE_PHOTOS,
  GROW_TIERS,
  VERIFIED_REACH,
  buyMoreLine,
  foldGroups,
  freeSpec,
  growLines,
  growSpec,
  helperLine,
  reachSentence,
  verifiedSpec,
} from './supplier-front-data';

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
  'Bookings a day': (n) => (!Number.isFinite(n) ? 'You set it' : n === 0 ? '—' : `${n}`),
  'Portfolio photos': (n) => (!Number.isFinite(n) ? 'Unlimited' : n === 0 ? '—' : `${n} free`),
  'Answering couples': (n) => (!Number.isFinite(n) ? 'No limit' : n === 0 ? '—' : `${n}`),
};

const FIELD: Record<string, keyof (typeof TIER_CAPS)['pro']> = {
  'Service reach': 'serviceRadiusKm',
  'Parent categories': 'parentCategories',
  'Service listings / category': 'servicesPerLeaf',
  'Team seats': 'agentAccounts',
  'Bookings a day': 'slotsPerDay',
  'Portfolio photos': 'portfolioPhotos',
  'Answering couples': 'inAppCustomersPerWeek',
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

/*
 * 2026-11-06: the limit rows this test read lived in `vendor-tier-deltas.tsx`, which was deleted with the old
 * /for-suppliers page. The approved page draws every cap through `supplier-front-data.ts` — a pure module — so the
 * check below reads what a person would actually see on it (the same property: no cap reaches the page as a raw
 * JavaScript value), and pins that the module never interpolates a cap without its formatter.
 */
test('the approved page routes EVERY cap it shows through a formatter', () => {
  const rendered: Array<[string, string]> = [
    ['freeSpec', freeSpec()],
    ['verifiedSpec', verifiedSpec()],
    ['reachSentence', reachSentence()],
    ['VERIFIED_REACH', VERIFIED_REACH],
    ['FREE_PHOTOS', FREE_PHOTOS],
    ['helperLine', helperLine() ?? ''],
    ['buyMoreLine', buyMoreLine(null)],
    ...GROW_TIERS.map((t) => [`growSpec(${t})`, growSpec(t)] as [string, string]),
    ...GROW_TIERS.flatMap((t) => growLines(t).map((l) => [`growLines(${t})`, `${l.text}${l.tail ?? ''}`] as [string, string])),
    ...foldGroups().flatMap((g) => g.lines.map((l) => [`fold · ${g.title}`, `${l.text} · ${l.pill}`] as [string, string])),
  ];
  assert.ok(rendered.length > 20, `only ${rendered.length} strings rendered — the module moved or emptied`);
  const leaks = rendered.filter(([, out]) => LEAKS.test(out)).map(([where, out]) => `${where} → "${out}"`);
  assert.deepEqual(leaks, [], `The page would print a JavaScript value:\n  ${leaks.join('\n  ')}`);

  // The rendered check covers today's caps; this covers tomorrow's. A cap may only reach a string through
  // reach() / countNoun() / formatCount(), each of which turns Infinity into words or a dash.
  const src = readFileSync(resolve(HERE, 'supplier-front-data.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const raw = src.match(/\$\{\s*(?:c|caps|TIER_CAPS(?:\[[^\]]+\])?)\.\w+\s*\}/g) ?? [];
  assert.deepEqual(raw, [], 'supplier-front-data.ts interpolates a cap directly — that is how "Infinity" reached the page');
  assert.match(src, /function reach\(km: number[^)]*\)[^{]*\{[^}]*Number\.isFinite\(km\)/, 'reach() no longer handles an infinite radius');
});
