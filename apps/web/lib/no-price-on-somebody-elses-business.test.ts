/**
 * A PUBLIC PAGE OF OURS DOES NOT PRICE SOMEBODY ELSE'S BUSINESS.
 *
 * ── 🔴 WHAT SHIPPED, AND FOR SIX DAYS ─────────────────────────────────────
 * `/papic` told visitors what Papic "would otherwise cost" them, priced against
 * **₱8,000 for a photographer producing 400 photos in four hours**. The owner
 * withdrew his own figure on 2026-09-15 — *"we have papic credits and 1 credit
 * = 1 photo. i do not think 8000 costs 400 photos"* — and asked for it gone.
 *
 * 🔑 THE DIRECTION OF THE ERROR IS WHY IT COULD NOT BE SOFTENED. ₱8,000 of
 * photographer almost certainly delivers far MORE than 400 photographs, so the
 * comparison **understated a competitor and flattered us**, in public, with no
 * source. An unsourced claim that cuts in our own favour is worse than one that
 * does not, and a gentler invented number would reproduce it with better
 * manners.
 *
 * 🔑 AND IT WAS ALREADY FLAGGED. The session that built it typed the figure as
 * a MARKET ASSUMPTION and said in its PR description that no `DECISION_LOG` row
 * backed it. **Nobody read the PR.** That is the durable lesson and the reason
 * this file exists: a flag in a description is not a mechanism. Only something
 * that can fail is.
 *
 * ── WHAT THIS ASSERTS, AND WHY IT IS THE CLAIM AND NOT THE CONSTANT ────────
 * Pinning `COMPARISON_PHOTOGRAPHER_DAY_RATE_PHP` by name would pass the moment
 * somebody re-typed `8_000` under a different one. So the check is on the
 * SHAPE OF THE CLAIM in public copy: a third party's price, or a third party's
 * output, stated as fact.
 *
 * ⛔ IT DOES NOT FORBID PRICING OURSELVES. Our own SKUs, credits and packs are
 * ours to state and are read live from `platform_retail_catalog_v2`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

/** The public marketing surfaces this rule governs. */
const PUBLIC_COPY_ROOTS = ['app/(shell)/papic'] as const;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (/\.(tsx?|mdx?)$/.test(name) && !name.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * Claims about a THIRD PARTY's price or output. Each is the shape of the
 * sentence, not a particular number — re-typing the figure under a new name
 * still trips it.
 */
const FORBIDDEN: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /would otherwise cost/i, why: 'tells a visitor what someone else would charge them' },
  { re: /photographer[^.!?]{0,80}₱/i, why: "puts a peso figure on a photographer's work" },
  { re: /₱[^.!?]{0,80}photographer/i, why: "puts a peso figure on a photographer's work" },
  { re: /photographer[^.!?]{0,80}\b\d{1,3}[,_]?\d{3}\b/i, why: "states a photographer's rate as a number" },
  { re: /photographer[^.!?]{0,80}\b\d{2,4}\s*(photos|shots|images)/i, why: "states how much work a photographer produces" },
  { re: /\b\d{2,4}\s*(photos|shots|images)[^.!?]{0,80}photographer/i, why: "states how much work a photographer produces" },
];

test('the guard is not vacuous — it is reading real files', () => {
  const files = PUBLIC_COPY_ROOTS.flatMap((r) => filesUnder(join(process.cwd(), r)));
  assert.ok(files.length >= 3, `only found ${files.length} public copy files — the scan is pointing at nothing`);
  const total = files.reduce((n, f) => n + readFileSync(f, 'utf8').length, 0);
  assert.ok(total > 5000, 'the files scanned are suspiciously small');
});

test('🔴 no public page states a competitor’s price or output', () => {
  const offences: string[] = [];
  for (const root of PUBLIC_COPY_ROOTS) {
    for (const file of filesUnder(join(process.cwd(), root))) {
      /* Comments stripped: the page's own docblock EXPLAINS the removed claim
         and quotes the old figure on purpose. Prose about why a claim is gone
         must never be mistaken for the claim. */
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const { re, why } of FORBIDDEN) {
        const m = src.match(re);
        if (m) offences.push(`${file.split('/apps/web/')[1] ?? file}: ${why} — "${m[0].trim().slice(0, 70)}"`);
      }
    }
  }
  assert.deepEqual(
    offences,
    [],
    'a public page prices somebody else\'s business:\n  ' + offences.join('\n  ') +
      '\n\nThere is no sourced figure for a competitor. Remove the claim rather than softening the number — ' +
      'a gentler invention is the same defect with better manners (owner, 2026-09-15: "remove it").',
  );
});

test('our OWN prices are still allowed to be stated', () => {
  /* The rule must not have quietly banned pricing ourselves — that would be a
     guard that goes red for correct code, which is worse than none. */
  const ours = 'Papic One is ₱499 and includes 100 credits.';
  const tripped = FORBIDDEN.filter(({ re }) => re.test(ours));
  assert.deepEqual(tripped.map((t) => t.why), [], 'the rule blocks us from stating our own price');
});
