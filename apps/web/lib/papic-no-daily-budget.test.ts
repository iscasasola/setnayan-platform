/**
 * THE PAPIC PER-SEAT DAILY BUDGET STAYS RETIRED.
 *
 * Owner, 5 Nov 2026, on "Papic per-seat daily budget": *"retire. we do not have
 * papic seat anymore"* — confirming DECISION_LOG 2026-09-16 *"ONE POOL OF
 * CREDITS, SHARED BY EVERYBODY … no dedicated shots individually"*.
 *
 * The per-day meter was `papic_tier_config.points_per_day` counted against
 * `papic_seat_day_usage`. Its readers in SQL were dropped earlier
 * (20271234330879, 20271286935967); the last reader in the app was the upload
 * route, which used it to choose a "resets tomorrow" sentence. This guard keeps
 * all of it out of the app's code. (The tables still exist — dropping them is a
 * later cleanup, so the DB side is pinned in
 * tests/db/papic-no-daily-budget.db.test.ts.)
 *
 * What still refuses a capture — the camera's own credits and the event's ONE
 * shared pool — is untouched and is what that DB test exercises.
 *
 * Comments are stripped first: the code that removed the budget explains, in
 * prose, what it removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = process.cwd();

const BANNED: Array<[RegExp, string]> = [
  [/points_per_day/, 'reads the retired per-day budget column'],
  [/papic_seat_day_usage/, 'touches the retired per-day ledger'],
  [/dailyBudget/, 'carries a per-camera daily allowance flag'],
  [/daily_(?:photo|video)_quota/, 'knows the retired per-day refusal codes'],
  [/(?:refills?|resets?)\s+tomorrow/i, 'tells someone their shots come back tomorrow'],
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(?:ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('no app code reads, writes or mentions a per-day Papic budget', () => {
  const files = ['app', 'lib', 'components'].flatMap((d) => sourceFiles(join(WEB, d)));
  // A walk that found nothing would pass every check below.
  assert.ok(files.length > 500, `only ${files.length} source files found — run from apps/web`);

  const hits: string[] = [];
  for (const f of files) {
    const code = stripComments(readFileSync(f, 'utf8'));
    for (const [re, why] of BANNED) {
      if (re.test(code)) hits.push(`${relative(WEB, f)} ${why} (${re})`);
    }
  }
  assert.deepEqual(hits, [], `the retired per-seat daily budget is back:\n${hits.join('\n')}`);
});

test('the guard can see what it bans (not vacuous)', () => {
  const sample = stripComments(
    "const x = await admin.from('papic_tier_config').select('points_per_day'); // dailyBudget",
  );
  assert.match(sample, BANNED[0]![0]);
  // …and the comment half is gone, so prose about the retirement never trips it.
  assert.doesNotMatch(sample, BANNED[2]![0]);
});
