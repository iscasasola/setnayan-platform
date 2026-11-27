/**
 * FINAL CHECK · the front door's words (25 Nov 2026), held where they were fixed.
 *
 * A1-047 / SW-COMM: the only commission line a person reads is "Hosts pay 0% commission." (brand.md claim 2).
 * A1-048 / A1-103 / SW-PROMISE: no price promises ("forever", "for good", "habambuhay", "always" free).
 * A1-027 / A1-108 / A1-152 / SW-WORDS: Logo Maker, never "Monogram maker"; E-Gifts, never "Pabuya".
 *
 * Known, owner to rule (NOT held here): /for-suppliers' approved drawing says "Free to start. Free to stay." and
 * "Free stays free."; /features' FaceBlock row says "Always free." (the corpus brief says it too). Home's
 * "Suppliers you can trust." became "Suppliers, checked and reviewed." (L9 P13, 27 Nov) and is held below.
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
  'app/(shell)/palogo/page.tsx',
  // L9 section P (27 Nov): the host pages whose commission line was fixed.
  'app/(shell)/pricing/page.tsx',
  'app/(shell)/our-story/page.tsx',
  'app/(shell)/terms/page.tsx',
  'app/(shell)/for-coordinators/page.tsx',
  'app/(shell)/alaala/page.tsx',
  'app/(shell)/mood-board/page.tsx',
  'app/(hub)/page.tsx',
  'app/layout.tsx',
  'app/creators/_components/creator-story-sections.tsx',
  'app/creators/_components/creator-story-hero.tsx',
  'app/_components/frontdoor/front-door-landing.tsx',
  'app/_components/marketing/reskin-footer.tsx',
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

/**
 * L9 section P (27 Nov 2026), held where it was fixed. Not every FILES entry is here: /for-suppliers and /features
 * (`supplier-front-page.tsx`, `lib/features-page.ts`) were in another open PR (#8423) when this was written.
 */
const L9_FIXED = [
  'app/_components/frontdoor/front-door-landing.tsx',
  'app/(shell)/pricing/page.tsx',
  'app/(shell)/for-coordinators/page.tsx',
  'app/(shell)/about/page.tsx',
  'app/(shell)/tl/about/page.tsx',
  'app/(shell)/our-story/page.tsx',
  'lib/help/topics-existing.ts',
  'lib/help/supplier-1.ts',
];

test('🔒 L9 P4 · P5 · P15: no "stays free", "no end date" or "nothing expires" promise (brand.md claim 3)', () => {
  for (const rel of L9_FIXED) {
    assert.doesNotMatch(src(rel), /stays free|free stays free|free to stay|no end date|nothing expires/i, `${rel}: a price promise`);
  }
});

test('🔒 L9 P13 · P14 · P19: no "trusted" promise and no rank claim on the fixed pages (brand.md claims 10 · 11)', () => {
  for (const rel of L9_FIXED) {
    assert.doesNotMatch(src(rel), /Suppliers you can trust\.|best place|What is the best/i, `${rel}: a promise or a rank claim`);
  }
});

test('🔒 L9 P2: Setnayan AI is never sold on its own — /pricing has no AI row and the help says Event Pro and Event Ultra', () => {
  assert.doesNotMatch(src('app/(shell)/pricing/page.tsx'), /name="Setnayan AI"/);
  const help = src('lib/help/topics-existing.ts');
  assert.doesNotMatch(help, /Setnayan AI[^.—;]{0,120}\bor on its own\b|Setnayan AI[^.—;]{0,120}\bsold on its own\b/, 'the help sells Setnayan AI on its own');
  assert.match(help, /Setnayan AI comes with Event Pro and Event Ultra/);
});

test('🔒 L9 P9 · P24 · P25: /terms says who pays what; /about names no "cut"; the Free supplier plan is not "No fee"', () => {
  assert.match(src('app/(shell)/terms/page.tsx'), /Setnayan does not hold those funds\. Hosts pay 0% commission\.\s+Suppliers pay Setnayan a booking fee under the supplier terms\./);
  for (const rel of ['app/(shell)/about/page.tsx', 'app/(shell)/tl/about/page.tsx']) {
    assert.doesNotMatch(src(rel), /take a cut|takes a cut|ng cut/i, `${rel}: the "keep 100%" half-truth`);
  }
  assert.doesNotMatch(src('app/(shell)/pricing/page.tsx'), /booking fee|'No fee'/i, '/pricing (a hosts\' page) names the supplier fee');
});

test('🔒 L9 P29 · P30: /monogram redirects to /palogo and the help slugs say supplier', () => {
  const cfg = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
  assert.match(cfg, /\{ source: '\/monogram', destination: '\/palogo', permanent: true \}/);
  for (const slug of ['verified-filipino-wedding-vendors-no-commission', 'sign-up-as-vendor', 'track-vendor', 'start-thread-with-vendor']) {
    assert.ok(!src('lib/help/topics-existing.ts').includes(`slug: '${slug}'`), `${slug}: a "vendor" slug is back`);
    assert.match(cfg, new RegExp(`source: '/help/${slug}'`), `${slug}: the old address has no redirect`);
  }
});
