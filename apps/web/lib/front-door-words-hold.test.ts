/**
 * FINAL CHECK · the front door's words (25 Nov 2026), held where they were fixed.
 *
 * A1-047 / SW-COMM: the only commission line a person reads is "Hosts pay 0% commission." (brand.md claim 2).
 * A1-048 / A1-103 / SW-PROMISE: no price promises ("forever", "for good", "habambuhay", "always" free).
 * A1-027 / A1-108 / A1-152 / SW-WORDS: Logo Maker, never "Monogram maker"; E-Gifts, never "Pabuya".
 *
 * Known, owner to rule (NOT held here): /for-suppliers' approved drawing says "Free to start. Free to stay." and
 * "Free stays free."; /features' FaceBlock row says "Always free." (the corpus brief says it too); Home's
 * "Suppliers you can trust." is named by HOUSE_DESIGN_STANDARD H4 (and pinned by the-front-door-tells-the-truth).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { COUPLE_COMMISSION_PROMISE } from './commission-promise';

const FILES = [
  'app/(shell)/marketplace/page.tsx',
  'app/(shell)/suppliers/(index)/page.tsx',
  'app/(shell)/suppliers/_landing.tsx',
  'app/(shell)/about/page.tsx',
  'app/(shell)/tl/about/page.tsx',
  'app/(shell)/waitlist/page.tsx',
  'app/(shell)/creators/page.tsx',
  'app/(shell)/monogram/page.tsx',
  'app/(shell)/palogo/page.tsx',
  'app/(shell)/alaala/page.tsx',
  'app/(shell)/mood-board/page.tsx',
  'app/(hub)/page.tsx',
  'app/creators/_components/creator-story-sections.tsx',
  'app/creators/_components/creator-story-hero.tsx',
  'app/_components/frontdoor/front-door-landing.tsx',
  'app/_components/marketing/reskin-footer.tsx',
  'app/monogram/public-monogram-studio.tsx',
  'lib/monogram-studio/markup.ts',
  'lib/features-page.ts',
  'lib/feature-pages/suppliers-b.ts',
  'lib/studio-apps.ts',
];

const src = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('🔒 every "0% commission" a person reads is the ruled sentence', () => {
  for (const rel of FILES) {
    for (const m of src(rel).matchAll(/0% (?:supplier )?commission/g)) {
      const before = src(rel).slice(Math.max(0, (m.index ?? 0) - 10), m.index);
      assert.match(before, /Hosts pay $/, `${rel}: a bare "${m[0]}" (only "Hosts pay 0% commission.")`);
    }
    assert.doesNotMatch(src(rel), /No commission on your bookings/, `${rel}: commission variant`);
  }
});

test('🔒 no price promises on the fixed pages', () => {
  for (const rel of FILES) {
    assert.doesNotMatch(src(rel), /free[^.'"]{0,25}\bfor good\b|habambuhay|Free, forever|free for storytellers, forever|, forever'|, ever'|Free for storytellers, always/i, `${rel}: a price promise`);
  }
});

test('🔒 house words: Logo Maker and E-Gifts', () => {
  for (const rel of FILES) {
    assert.doesNotMatch(src(rel), /Monogram [Mm]aker|Monogram studio|Free Monogram|Pabuya e-gifts|\(Pabuya\)|your monogram/, `${rel}: a retired word`);
  }
});

test('the couple-facing commission promise opens with the ruled sentence (supplier-facing fee lines are not this)', () => {
  assert.match(COUPLE_COMMISSION_PROMISE, /^Hosts pay 0% commission\./);
});
