/**
 * the-marketplace-can-disclose-paid-placement.test.ts
 *
 * ── The finding (register SUP-74 / EX-7) ───────────────────────────────────
 * The public marketplace's first sort key is `ad_rank`, and production defines
 * it from `vendor_active_ads.tier` — sponsored → 2, boosted → 1, else 0. It is
 * purchased position, not a neutral score.
 *
 * 🔑 AND THE TIER IS DROPPED BETWEEN THE SORT AND THE RENDER. `ad_rank` is
 * selected to ORDER BY; `ad_tier` is selected nowhere and reaches no card.
 * Measured 2026-09-22: zero occurrences of `ad_tier`/`adTier` in any
 * marketplace card component. **A card could not disclose paid placement even
 * if it wanted to.**
 *
 * ── What this guard asserts, and what it honestly cannot ───────────────────
 * It holds the DECISION — the vocabulary, when it applies, and that silence is
 * the answer only for an unpaid card. That part is pure and executed.
 *
 * ⚠ IT DOES NOT ASSERT A VISIBLE LABEL, because no label exists yet and this
 * session could not verify a rendered one. The last test records the gap
 * precisely so the next person closes it rather than rediscovering it — and it
 * is written to FAIL THE DAY someone adds the label without wiring the tier,
 * which is the half-fix this shape invites.
 *
 * ⚖ Nothing is undisclosed today: `vendor_active_ads` holds 0 rows and both
 * live shops have `ad_rank = 0`. The work is worth doing before the first
 * advertiser, not after.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';
import { paidPlacementLabel, isPaidPlacement, DISCLOSURE_COLUMNS } from './paid-placement-disclosure';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

test('a purchased position gets a word; an organic one gets silence', () => {
  assert.equal(paidPlacementLabel('sponsored'), 'Sponsored');
  assert.equal(paidPlacementLabel('boosted'), 'Promoted');

  // Silence for anything that did not pay. Labelling an organic result as paid
  // misleads in the opposite direction and is equally untrue.
  for (const v of [null, undefined, '', 'free', 'SPONSORED', 'sponsored ']) {
    assert.equal(paidPlacementLabel(v as string | null), null, `must not label: ${JSON.stringify(v)}`);
  }
  assert.equal(isPaidPlacement('boosted'), true);
  assert.equal(isPaidPlacement(null), false);
});

test('the sort key is purchased, which is why the label is owed', () => {
  // If the marketplace ever stops sorting by ad_rank, this whole obligation
  // changes shape — so the guard states the premise it depends on.
  const sorters = ['lib/vendor-counts.ts', 'app/(shell)/explore/_components/folder-vendors-section.tsx'];
  const usingAdRank = sorters.filter((rel) =>
    stripComments(readFileSync(join(WEB, rel), 'utf8')).includes('ad_rank'),
  );
  console.log(`[paid-placement] ${usingAdRank.length}/${sorters.length} marketplace read paths use ad_rank`);
  assert.ok(
    usingAdRank.length > 0,
    'no marketplace read path mentions ad_rank any more. If purchased position was removed, this ' +
      'module and its obligation should go with it — delete deliberately, do not let it rot.',
  );
});

/**
 * ⚠ THE OPEN HALF, pinned so it cannot be half-closed.
 *
 * Today no card receives `ad_tier`, so no card can disclose. The moment someone
 * adds a visible label they must ALSO carry the tier into the read — otherwise
 * the label renders from nothing and silently never appears, which is worse
 * than no label at all because it looks done.
 */
test('a label may not be added without the fact that justifies it', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const cards: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (SKIP.has(e)) continue;
      const abs = join(dir, e);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/\.tsx$/.test(abs) && !abs.includes('.test.')) cards.push(abs);
    }
  };
  walk(join(WEB, 'app'));

  const labellers: string[] = [];
  for (const abs of cards) {
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (!/paidPlacementLabel|>\s*Sponsored\s*<|>\s*Promoted\s*</.test(code)) continue;

    // ⚠ A DISCLOSURE MAY BE BACKED BY ANY PAID-PLACEMENT FACT, not only the
    // marketplace's. The first version of this required `ad_tier` and so
    // convicted two innocent files: the journal spotlight surfaces, which label
    // "Sponsored" correctly from their OWN flag, `is_sponsored`. They are a
    // different paid-placement system and they already disclose — which is good
    // evidence that the marketplace is the outlier, not the rule.
    //
    // The property is "do not render a disclosure you cannot compute", so any
    // justifying fact counts.
    const JUSTIFIED = /ad_tier|adTier|is_sponsored|isSponsored/;
    if (!JUSTIFIED.test(code)) labellers.push(abs.slice(WEB.length + 1));
  }

  console.log(
    `[paid-placement] ${labellers.length} component(s) show a disclosure without the tier · ` +
      `columns a read must carry: ${DISCLOSURE_COLUMNS.join(', ')}`,
  );
  assert.deepEqual(
    labellers,
    [],
    'A component renders a paid-placement disclosure but never receives `ad_tier`, so the label ' +
      'can only ever be absent. Carry the tier through the read (DISCLOSURE_COLUMNS) in the same ' +
      'change that adds the label.\n  ' + labellers.join('\n  '),
  );
});
