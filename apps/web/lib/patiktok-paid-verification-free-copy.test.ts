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

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('Patiktok is paid on /features — no free half, no "free" in its copy', () => {
  const p = DAY_MEMORIES_FEATURES.find((f) => f.slug === 'patiktok');
  assert.ok(p, 'the Patiktok feature entry moved');
  assert.equal(p.price.kind, 'paid', 'Patiktok must be priced as paid (per day), not free / free-plus');
  // `assert.equal` above already narrowed `kind` to 'paid', so `codes` is readable here.
  assert.deepEqual([...p.price.codes], ['PATIKTOK_COMPILER']);
  const words = JSON.stringify([p.description, p.answer, p.steps, p.faq, p.line]);
  assert.doesNotMatch(words, /\bfree\b|\blibre/i, 'Patiktok copy on /features still implies a free part');
});

test('Patiktok on /pricing reads its per-day price from the row', () => {
  const src = code('app/(shell)/pricing/page.tsx');
  assert.match(src, /rowPrice\(\s*'PATIKTOK_COMPILER'\s*\)/, '/pricing no longer reads the Patiktok row');
  assert.match(src, /formatBillingPeriodSuffix\(\s*patiktokRow\?\.billing_period\s*\)/, 'the "/ day" no longer comes from the row');
  assert.doesNotMatch(src, /free to make/i, '/pricing sells Patiktok as free to make');
});

test('supplier verification is free for good — never "during launch"', () => {
  for (const f of ['lib/help.ts', 'lib/llms-txt.ts', 'app/_components/home/HomeOverlays.tsx', 'app/(shell)/pricing/page.tsx']) {
    const src = code(f);
    const hit = src.match(/(?:verif|free)[^.\n]{0,60}\b(?:during launch|while we launch|at launch)\b/i);
    assert.equal(hit, null, `${f} still says verification is free only for the launch: ${hit?.[0]}`);
  }
});
