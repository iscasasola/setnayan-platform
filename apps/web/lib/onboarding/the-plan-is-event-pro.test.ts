/**
 * the-plan-is-event-pro.test.ts — the couple side calls the plan "Event Pro".
 *
 * The plan was renamed on 8 Nov 2026 (owner): the old three-word name became
 * "Event Pro". The couple side — the dashboard, the guest page, onboarding —
 * was swept on that rename, and this guard keeps the old name from coming back
 * in any code a couple can see.
 *
 *   SCOPE  app/dashboard/** · app/[slug]/** · app/onboarding/** · lib/onboarding/**
 *   RULE   no .ts / .tsx file there spells the old name, once comments are
 *          stripped (`lib/strip-comments.ts` — prose ABOUT the old name in a
 *          docblock is history, not copy).
 *   KEYS   the SKU code (`COUPLE_WEBSITE_PRO`), identifiers and test ids are
 *          keys and are NOT renamed; none of them contains the spaced name, so
 *          this guard never sees them.
 *
 * The old name is assembled from parts below, so this file never spells it.
 *
 * If this goes red: say "Event Pro" in the copy. If the words come from a module
 * outside these folders, import that module's constant instead of retyping its
 * words — retyped copy is what this guard exists to catch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const SCOPE = ['app/dashboard', 'app/[slug]', 'app/onboarding', 'lib/onboarding'];
const OLD_NAME = ['Event', 'Hub', 'Pro'].join(' ');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Every line (1-based) whose CODE — comments stripped — names the old plan. */
function oldNameLines(source: string): number[] {
  const hits: number[] = [];
  stripComments(source)
    .split('\n')
    .forEach((line, i) => {
      if (line.includes(OLD_NAME)) hits.push(i + 1);
    });
  return hits;
}

test('the scanner sees the old name in copy and ignores it in a comment (self-proof)', () => {
  assert.deepEqual(oldNameLines(`const a = 'Unlock ${OLD_NAME}';`), [1], 'a string was missed');
  assert.deepEqual(oldNameLines(`<p>\n  Go ${OLD_NAME}\n</p>`), [2], 'JSX text was missed');
  assert.deepEqual(oldNameLines(`// ${OLD_NAME} was the old name\n/* ${OLD_NAME} */ const b = 1;`), [], 'a comment was flagged');
  assert.deepEqual(oldNameLines(`const c = 'Event Pro';`), [], 'the new name was flagged');
});

test('the scope is real — every folder exists and holds source', () => {
  for (const dir of SCOPE) {
    const files = walk(join(WEB, dir));
    assert.ok(files.length > 0, `${dir} has no .ts/.tsx files — the guard would pass on nothing`);
  }
});

test('no couple-side code says the old plan name — it is "Event Pro"', () => {
  const offenders: string[] = [];
  for (const dir of SCOPE) {
    for (const file of walk(join(WEB, dir))) {
      for (const line of oldNameLines(readFileSync(file, 'utf8'))) {
        offenders.push(`${relative(WEB, file)}:${line}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `the old plan name is back — say "Event Pro":\n  ${offenders.join('\n  ')}`);
});
