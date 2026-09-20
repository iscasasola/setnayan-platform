/**
 * Regenerate `lib/security/money-formatter.baseline.txt` from the live tree.
 *
 *     pnpm money-formatter:baseline        # print what the scan finds
 *     pnpm money-formatter:baseline --write
 *
 * ⚠ REGENERATING IS NOT THE FIX. The baseline is a RATCHET: the guard
 * (`lib/security/money-formatter-scan.test.ts`) fails on any collision or
 * undeclared rounder that is not already listed, and its size is pinned. Running
 * this with `--write` to make a red run green is how a guard stops guarding —
 * the remedy for a new row is to consolidate into `lib/php.ts` and re-export the
 * name, or to write the `@rounds-to-the-peso` reason. Use `--write` when a row
 * has been PAID DOWN and the file should shrink.
 *
 * It prints the prose header back out verbatim, so the reasons written into the
 * committed file survive a regeneration.
 */
import fs from 'node:fs';
import {
  BASELINE_PATH,
  baselineKeys,
  scanMoneyFormatters,
} from '../lib/security/money-formatter-scan';

const write = process.argv.includes('--write');
const result = scanMoneyFormatters();
const keys = baselineKeys(result);

const existing = fs.existsSync(BASELINE_PATH) ? fs.readFileSync(BASELINE_PATH, 'utf8') : '';
const prose = existing
  .split('\n')
  .filter((l) => l.trim().length === 0 || l.trimStart().startsWith('#'))
  .join('\n');

const committed = existing
  .split('\n')
  .map((l) => l.replace(/\r$/, ''))
  .filter((l) => l.trim().length > 0 && !l.trimStart().startsWith('#'));

console.log(
  `money-formatter scan: ${result.filesScanned} files · ${result.helpers.length} helpers · ` +
    `${result.collisions.length} collisions · ${result.undeclaredRounders.length} undeclared rounders`,
);
for (const k of keys) console.log(`  ${committed.includes(k) ? ' ' : '+'} ${k.replace(/\t/g, ' → ')}`);
for (const k of committed) {
  if (!keys.includes(k)) console.log(`  - ${k.replace(/\t/g, ' → ')}  (fixed — safe to drop)`);
}

if (!write) {
  console.log('\n(dry run — pass --write to rewrite the file)');
  process.exit(0);
}

if (keys.length > committed.length) {
  console.error(
    `\nREFUSING TO GROW THE BASELINE: ${keys.length} rows found, ${committed.length} committed.\n` +
      'Fix the new row instead — see lib/php.ts. If you genuinely must widen it, edit\n' +
      'the file by hand and say why in the prose header, where a reviewer will read it.',
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, `${prose.replace(/\n+$/, '')}\n${keys.join('\n')}\n`, 'utf8');
console.log(`\nwrote ${keys.length} rows to ${BASELINE_PATH}`);
