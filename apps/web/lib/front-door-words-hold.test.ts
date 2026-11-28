/**
 * FINAL CHECK · the front door's words (25 Nov 2026), held where they were fixed.
 *
 * A1-047 / SW-COMM, owner 28 Nov 2026: hosts own the event, so no host page says "0% commission" in any form; the
 * commission and booking fee are explained on supplier pages and in /terms only.
 * A1-048 / A1-103 / SW-PROMISE: no price promises ("forever", "for good", "habambuhay", "always" free).
 * A1-027 / A1-108 / A1-152 / SW-WORDS: Logo Maker, never "Monogram maker"; E-Gifts, never "Pabuya".
 *
 * Owner ruled 27 Nov 2026 ("yes to all"): "Free to start" and "Free to stay" leave every marketing line
 * (held by lib/no-free-to-start-in-marketing.test.ts).
 * L9 section P (27 Nov): /for-suppliers' "Free to stay" and "Free stays free" and Home's "Suppliers you can trust." were
 * ruled out by the owner and are held below.
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

test('🔒 no fixed page tells hosts "0% commission" (owner 28 Nov)', () => {
  for (const rel of FILES) {
    assert.doesNotMatch(src(rel), /0% (?:supplier |booking )?commission|zero commission/i, `${rel}: a host is told "0% commission"`);
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

test('the couple-facing promise says who they pay, with no commission figure (owner 28 Nov)', () => {
  assert.match(COUPLE_COMMISSION_PROMISE, /^You pay your suppliers directly/);
  assert.doesNotMatch(COUPLE_COMMISSION_PROMISE, /commission/i);
});

/** L9 section P (27 Nov 2026), held where it was fixed. */
const L9_FIXED = [
  'app/for-suppliers/_components/supplier-front-page.tsx',
  'app/(shell)/for-suppliers/page.tsx',
  'lib/features-page.ts',
  'lib/llms-txt.ts',
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

test('🔒 L9 P1: Event Plus is never said to carry Setnayan AI on the home page (it comes with Event Pro and Event Ultra)', () => {
  assert.doesNotMatch(src('app/_components/frontdoor/front-door-landing.tsx'), /one="Setnayan AI and Papic credits/);
  assert.match(src('app/_components/frontdoor/front-door-landing.tsx'), /one="The whole Event Hub and Papic credits for your event\."/);
});

test('🔒 L9 P9 · P24 · P25: /terms says who pays what; /about names no "cut"; the Free supplier plan is not "No fee"', () => {
  assert.match(src('app/(shell)/terms/page.tsx'), /Setnayan does not hold those funds\.\s+Suppliers pay Setnayan a booking fee under the supplier terms\./);
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
