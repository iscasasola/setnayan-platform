/**
 * SUP-40 · COPYING A SERVICE CARD ALSO COPIES ITS ★ OPTIONS.
 *
 * "Start from one of your cards" used to carry everything the supplier authored
 * EXCEPT the "What couples get" lines, because the one-service package holding
 * them had no link back to its card. Migration 20271159436100 (2026-08-24) added
 * that link (`vendor_packages.vendor_service_id`) and the maker has stamped it
 * on every card since, but nothing read it for a copy. The maker kept telling
 * suppliers their options "don't come across yet".
 *
 * What must hold:
 *   1. the copy finds the package through the LINK only — owner-scoped, never
 *      guessed by name or category, and never one of two;
 *   2. a failed read is reported as a failed read, never as "no options";
 *   3. the copied lines carry NO id of the source's (re-keyed), keep their
 *      follow-up structure, and sit under the new card's category;
 *   4. the step actually starts with them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { rekeyCopiedItems } from '@/lib/service-customization-draft';
import type { DraftItem } from '@/lib/package-authoring';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

// A source package as `loadPackageDraft` returns it: refs are DATABASE ids.
const SOURCE: DraftItem[] = [
  {
    ref: '11111111-aaaa-4aaa-8aaa-000000000001',
    service_description: 'Band size',
    canonical_service: 'live_band',
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options: [
      { ref: '22222222-bbbb-4bbb-8bbb-000000000001', label: '5-piece', price_delta_centavos: 0, is_default: true, is_available: true },
      { ref: '22222222-bbbb-4bbb-8bbb-000000000002', label: '8-piece', price_delta_centavos: 1_500_000, is_default: false, is_available: true },
    ],
    parentRef: null,
    pickMin: null,
    pickMax: null,
    maxExtraHours: null,
  },
  {
    ref: '11111111-aaaa-4aaa-8aaa-000000000002',
    service_description: 'Horn section',
    canonical_service: 'live_band',
    is_default_included: false,
    is_required: false,
    replacement_value_centavos: 500_000,
    options: [],
    // A follow-up: shown only once "8-piece" is picked.
    parentRef: {
      itemRef: '11111111-aaaa-4aaa-8aaa-000000000001',
      optionRef: '22222222-bbbb-4bbb-8bbb-000000000002',
    },
    pickMin: null,
    pickMax: null,
    maxExtraHours: null,
  },
];

test('3 · re-keyed: no source id survives, structure and content do', () => {
  const before = JSON.stringify(SOURCE);
  const out = rekeyCopiedItems(SOURCE, 'host_mc');
  assert.equal(JSON.stringify(SOURCE), before, 'the source draft must not be mutated');

  const serialized = JSON.stringify(out);
  for (const id of ['11111111-aaaa', '22222222-bbbb']) {
    assert.ok(!serialized.includes(id), `a source id (${id}…) survived into the copy`);
  }
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((i) => i.service_description), ['Band size', 'Horn section']);
  assert.deepEqual(out[0]!.options.map((o) => [o.label, o.price_delta_centavos, o.is_default]), [
    ['5-piece', 0, true],
    ['8-piece', 1_500_000, false],
  ]);
  // The follow-up still points at "8-piece" on "Band size" — through the NEW refs.
  assert.deepEqual(out[1]!.parentRef, { itemRef: out[0]!.ref, optionRef: out[0]!.options[1]!.ref });
  // Every line lands under the route's category.
  assert.ok(out.every((i) => i.canonical_service === 'host_mc'));
  // Refs are unique across the whole draft (the parser refuses duplicates).
  const refs = [...out.map((i) => i.ref), ...out.flatMap((i) => i.options.map((o) => o.ref))];
  assert.equal(new Set(refs).size, refs.length);
});

test('3 · an orphaned follow-up stays visibly orphaned, never flattened', () => {
  const orphan = rekeyCopiedItems([SOURCE[1]!], 'live_band');
  assert.notEqual(orphan[0]!.parentRef, null, 'flattening makes a pick-only line show to every couple');
  assert.equal(orphan[0]!.parentRef!.itemRef, '');
});

test('1 + 2 · the package is found through the link, owner-scoped, and never guessed', () => {
  const copy = read('lib/vendor-card-copy.ts');
  const fn = copy.slice(copy.indexOf('async function copyCardOptions('));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 2);
  assert.ok(body.length > 200, 'copyCardOptions not found — every assertion below would be vacuous');

  assert.match(
    body,
    /\.from\('vendor_packages'\)\s*\.select\('package_id'\)\s*\.eq\('vendor_service_id', sourceServiceId\)\s*\.eq\('vendor_profile_id', vendorProfileId\)/,
    'the package must be read through the LINK and the owner, in one chain',
  );
  // No second way in: not by name, not by category.
  assert.ok(!/package_name|primary_canonical_service|ilike/.test(body), 'the package is being guessed');
  // Exactly one or none — two is ambiguous and neither is picked.
  assert.match(body, /if \(rows\.length !== 1\) return \{ status: 'none_linked' \};/);
  // A failed read is its own outcome, at both reads.
  assert.match(body, /if \(error\) return \{ status: 'unreadable' \};/);
  assert.match(body, /read\.reason === 'read_failed' \? \{ status: 'unreadable' \}/);
  // Read through the ONE shipped loader, then re-keyed.
  assert.match(body, /loadPackageDraft\(supabase, vendorProfileId,/);
  assert.match(body, /rekeyCopiedItems\(items,/);
  // And it is actually wired into what the page returns.
  assert.match(copy, /copyCardOptions\(supabase, vendorProfileId, sourceServiceId, category\)/);
});

test('4 · the step starts with the copied lines, and only a real copy seeds it', () => {
  const step = read('app/vendor-dashboard/services/_components/customization-step.tsx');
  assert.match(step, /useState<DraftItem\[\]>\(initialItems \?\? \[\]\)/);
  const canvas = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  const mounts = canvas.match(/<CustomizationStep\b/g) ?? [];
  assert.equal(mounts.length, 1, `the maker mounts CustomizationStep ${mounts.length} times`);
  assert.match(
    canvas,
    /initialItems=\{\s*initial\?\.customization\.status === 'copied'\s*\?\s*initial\.customization\.items\s*:\s*undefined\s*\}/,
  );
});
