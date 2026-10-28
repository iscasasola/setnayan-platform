/**
 * Regenerate `lib/design-rules.baseline.json` from the live tree.
 *
 *     pnpm --filter @setnayan/web design-rules:baseline          # print what the scan finds
 *     pnpm --filter @setnayan/web design-rules:baseline --write
 *
 * ⚠ REGENERATING IS NOT THE FIX. The baseline is a RATCHET held by `lib/every-back-goes-home.test.ts`: a
 * new wrong back link, a new ad-hoc back, or a higher raw-colour / raw-<select> count fails. The remedy is
 * `<BackButton route=…>`, a colour token, `PickMenu`. Use `--write` when rows have been PAID DOWN and the
 * file should shrink.
 */
import fs from 'node:fs';

import { BASELINE_PATH, currentBaseline, mapProblems } from '../lib/design-rules-findings';

const problems = mapProblems();
if (problems.length) {
  console.error(`lib/page-home.ts has ${problems.length} problem(s) — fix the map first:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
const b = currentBaseline();
const text = `${JSON.stringify(b, null, 1)}\n`;
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, n) => a + n, 0);
console.log(
  `wrongBacks ${b.wrongBacks.length} · adHocBacks ${Object.keys(b.adHocBacks).length} files / ${sum(b.adHocBacks)} links · hex ${Object.keys(b.hex).length} files / ${sum(b.hex)} · palette ${Object.keys(b.palette).length} / ${sum(b.palette)} · select ${Object.keys(b.select).length} / ${sum(b.select)}`,
);
if (process.argv.includes('--write')) {
  fs.writeFileSync(BASELINE_PATH, text);
  console.log(`wrote ${BASELINE_PATH}`);
} else if (process.argv.includes('--print')) {
  process.stdout.write(text);
}
