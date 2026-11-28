/**
 * patiktok-paid-verification-free-copy.test.ts — two owner price rulings
 * (2026-10-25), held on every public page that states them.
 *
 *   1. Patiktok — owner, verbatim: "Patiktok has a per day amount." No public
 *      page may sell it as free (no "make it free", "watch it free", free-plus).
 *      The figure is the PATIKTOK_COMPILER row (`per_day`), never typed.
 *   2. Supplier verification — owner, verbatim: "Free forever." No public page
 *      may say it is free only "during launch" / "while we launch".
 *
 * Scans comment-STRIPPED source, so the docblocks recording the old wording can
 * never trip it — and can never satisfy it either.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { DAY_MEMORIES_FEATURES } from './feature-pages/day-memories';
import { PUBLIC_HELP_SOURCES } from '@/lib/help-sources.test-helper';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// 🪦 2026-11-20: Patiktok is RETIRED (owner: "Retire Patiktok and Music Maker ( we do not want to serve this
// anymore)") — it has no /features entry to price at all. The rule that it stays gone is
// lib/retired-products-stay-retired.test.ts; this slot now only proves the entry did not come back.
test('Patiktok has no /features entry — retired, so it is neither free nor paid there', () => {
  assert.equal(DAY_MEMORIES_FEATURES.find((f) => (f.slug as string) === 'patiktok'), undefined, 'the retired Patiktok feature entry is back');
});

test('Patiktok is not on /pricing at all — its row and its read were deleted (L9 P27, 27 Nov)', () => {
  const reads = code('app/(shell)/pricing/_pricing-reads.ts');
  assert.doesNotMatch(reads, /PATIKTOK_COMPILER|patiktok/i, '/pricing reads the retired Patiktok row again');
  const src = code('app/(shell)/pricing/page.tsx');
  assert.doesNotMatch(src, /Patiktok|prices\.patiktok/, '/pricing draws a Patiktok row again');
});

test('supplier verification is free for good — never "during launch"', () => {
  for (const f of [...PUBLIC_HELP_SOURCES, 'lib/llms-txt.ts', 'app/_components/home/HomeOverlays.tsx', 'app/(shell)/pricing/page.tsx']) {
    const src = code(f);
    const hit = src.match(/(?:verif|free)[^.\n]{0,60}\b(?:during launch|while we launch|at launch)\b/i);
    assert.equal(hit, null, `${f} still says verification is free only for the launch: ${hit?.[0]}`);
  }
});
