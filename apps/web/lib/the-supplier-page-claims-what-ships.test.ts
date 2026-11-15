/**
 * the-supplier-page-claims-what-ships.test.ts — /for-suppliers says only what
 * the app does (controller's true-claims sweep, CLOUD_BOARD 5 Nov).
 *
 *   · No in-app video & audio calls — calls left chat on 2026-10-28.
 *   · Verification is the required papers (`REQUIRED_DOC_COUNT`) plus a short
 *     video call with an admin — never a "12-doc check".
 *   · Contracts are an uploaded PDF on record — never e-signed in the app.
 *   · The logo on the couple's 3D seat plan opens from SOLO, with the 3D Booth
 *     add-on (`lib/vendor-3d-booth-event-pricing.ts`: "only paid vendors
 *     (solo, pro and enterprise)") — not from Pro.
 *
 * SABOTAGE (run 2026-11-04): restore the calls card → RED; restore "12-doc" →
 * RED; restore the e-sign row → RED; move the 3D row back to Pro → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { REQUIRED_DOC_COUNT } from './vendor-verification';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE_FILES = [
  'app/_components/home/vendor-benefits.ts',
  // The approved page of 2026-11-06 — what /for-suppliers draws now (the old
  // vendor-grow-* / vendor-tier-* sections it replaced were deleted).
  'app/for-suppliers/_components/supplier-front-page.tsx',
  'app/for-suppliers/_components/supplier-front-client.tsx',
  'app/for-suppliers/_components/supplier-front-data.ts',
];

test('the supplier page promises no in-app calls, no 12-doc check and no e-signing', () => {
  for (const rel of PAGE_FILES) {
    const src = code(rel);
    assert.doesNotMatch(src, /(video|audio)\s*(&|and|&amp;)\s*(video|audio)\s+calls?/i, `${rel} promises in-app calls`);
    assert.doesNotMatch(src, /\b12[- ]doc|\btwelve[- ]doc/i, `${rel} says "12-doc check"`);
    assert.doesNotMatch(src, /\be-?sign/i, `${rel} promises e-signing — contracts are an uploaded PDF`);
  }
});

test('verification reads the required-papers count, and says the video call', () => {
  const verified = VENDOR_TIER_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.items)).find(
    (i) => i.n === 'Verified badge, free',
  );
  assert.ok(verified, 'anti-vacuity: the Verified badge row is gone');
  assert.ok(REQUIRED_DOC_COUNT > 0, 'anti-vacuity: no required papers counted');
  assert.match(verified.b, new RegExp(`\\b${REQUIRED_DOC_COUNT} required papers\\b`));
  assert.match(verified.b, /video call/);
  assert.match(code('app/_components/home/vendor-benefits.ts'), /\$\{formatCount\(REQUIRED_DOC_COUNT\)\} required papers/, 'the count is typed, not read');
});

test('the 3D seat-plan logo opens from Supplier Plus, with the 3D Booth add-on', () => {
  const tiersWith3d = VENDOR_TIER_SECTIONS.filter((s) =>
    s.groups.some((g) => g.items.some((i) => /3D seat plan/.test(i.n))),
  ).map((s) => s.tier);
  assert.deepEqual(tiersWith3d, ['solo'], `the 3D seat-plan logo is listed under ${tiersWith3d.join(', ') || 'no plan'}`);
  const row = VENDOR_TIER_SECTIONS.find((s) => s.tier === 'solo')!
    .groups.flatMap((g) => g.items)
    .find((i) => /3D seat plan/.test(i.n))!;
  assert.match(row.b, /3D Booth add-on/, 'the row must say it is the 3D Booth add-on');
});
