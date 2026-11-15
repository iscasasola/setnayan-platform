/**
 * Score every page against the approved design template sheet and (optionally) LOWER the baseline.
 *
 *     pnpm --filter @setnayan/web template-score            # print area totals + the worst pages
 *     pnpm --filter @setnayan/web template-score --write    # lower `lib/template-score.baseline.json`
 *
 * ⚠ `--write` ONLY LOWERS. An entry becomes min(baseline, now); a page that reaches 0 or is deleted is
 * dropped; a page missing from the baseline is never added. A page whose score went UP is fixed in the
 * page, not here. The ratchet is held by `lib/template-score-ratchet.test.ts`; the method is in
 * `lib/template-score.ts`.
 */
import fs from 'node:fs';

import {
  TEMPLATE_BASELINE_PATH,
  areaTotals,
  lowerBaseline,
  readTemplateBaseline,
  scoreAllPages,
} from '../lib/template-score';

const rows = scoreAllPages();
const totals = areaTotals(rows);
console.log('area       pages  breaking  score');
let all = 0;
for (const [area, t] of Object.entries(totals)) {
  all += t.score;
  console.log(`${area.padEnd(10)} ${String(t.pages).padStart(5)}  ${String(t.breaking).padStart(8)}  ${String(t.score).padStart(5)}`);
}
console.log(`${'total'.padEnd(10)} ${String(rows.length).padStart(5)}  ${' '.repeat(8)}  ${String(all).padStart(5)}`);

if (process.argv.includes('--top')) {
  for (const r of [...rows].sort((a, b) => b.score - a.score).slice(0, 25)) {
    console.log(`  ${String(r.score).padStart(4)}  ${r.page}  ${JSON.stringify(r.counts)}`);
  }
}

if (process.argv.includes('--write')) {
  const next = lowerBaseline(readTemplateBaseline(), rows);
  fs.writeFileSync(TEMPLATE_BASELINE_PATH, `${JSON.stringify(next, null, 1)}\n`);
  console.log(`lowered ${TEMPLATE_BASELINE_PATH} (${Object.keys(next).length} pages)`);
}
