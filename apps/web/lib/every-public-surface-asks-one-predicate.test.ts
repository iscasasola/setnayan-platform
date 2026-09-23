/**
 * every-public-surface-asks-one-predicate.test.ts
 *
 * One rule for "is this shop publicly findable", read everywhere — or it is not
 * a rule, it is a coincidence that several places currently agree.
 *
 * ─── WHAT THIS CATCHES, AND WHY IT COULD NOT BE CAUGHT BEFORE ────────────
 * A caller writing `.eq('public_visibility', 'verified')` by hand gets the SAME
 * ANSWER as the shared predicate today. Nothing fails. Nothing can fail — the
 * answers are identical. It only becomes a hole when the rule learns a second
 * condition, and then it fails SILENTLY: a shop gone from search, still
 * reachable by link, with no error anywhere.
 *
 * The owner asked for exactly such a second condition on 2026-09-23 — a supplier
 * who owes a settled booking fee should disappear from every public find-me
 * surface. So the cost of these hand-spelled filters stops being hypothetical
 * the day that ships.
 *
 * ─── IT EXECUTES THE RULE ────────────────────────────────────────────────
 * `visibilityCallerVerdict` is pure and lives beside this file. This test RUNS
 * it over the real tree rather than re-implementing a regex inline, so the rule
 * can be unit-tested on its own and cannot drift from what the guard enforces.
 *
 * ─── THE BASELINE IS AN ADMISSION, NOT AN APPROVAL ───────────────────────
 * 16 files spelled the filter themselves when this guard was written, and they
 * are listed in `visibility-callers.baseline.txt`. **They have not been
 * reviewed one by one.** Several are certainly CORRECT to spell their own
 * filter — the admin console legitimately lists hidden shops, the fraud runner
 * and the Ugat map count every row whatever its state. Others may be public
 * surfaces that simply forgot, exactly as `showcase-db.ts` had.
 *
 * 🔑 So this guard's job is to stop the number GROWING, not to claim the
 * existing 16 are fine. A new caller must ask the predicate, or a human must
 * add it to the baseline WITH A REASON — which is the moment somebody actually
 * thinks about it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { visibilityCallerVerdict, parseBaseline } from './visibility-caller-rule';

const WEB = join(import.meta.dirname, '..');
const BASELINE = join(WEB, 'lib', 'visibility-callers.baseline.txt');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Every non-test source file, classified by the pure rule. */
function scan(): { asks: string[]; spells: string[] } {
  const asks: string[] = [];
  const spells: string[] = [];
  for (const dir of ['app', 'lib']) {
    for (const file of walk(join(WEB, dir))) {
      const rel = relative(WEB, file);
      // 🪤 THE RULE MODULE MATCHES ITSELF. It carries the filter pattern as a
      // string literal, so scanning it convicts the very file that defines the
      // rule. Excluded by path, not by weakening the pattern — a looser pattern
      // to dodge one self-match would stop catching the real callers.
      if (rel === 'lib/visibility-caller-rule.ts') continue;
      const verdict = visibilityCallerVerdict(readFileSync(file, 'utf8'));
      if (verdict === 'not-a-caller') continue;
      (verdict === 'asks' ? asks : spells).push(rel);
    }
  }
  return { asks: asks.sort(), spells: spells.sort() };
}

test('the pure rule tells the three cases apart', () => {
  // 🔑 EXECUTED, not grepped for. If this rule is wrong, the whole guard is
  // decoration — so it is tested on its own before it is trusted on the tree.
  assert.equal(visibilityCallerVerdict('const x = 1;'), 'not-a-caller');
  assert.equal(
    visibilityCallerVerdict(`.select('public_visibility, business_name')`),
    'not-a-caller',
    'merely SELECTING the column is not deciding with it',
  );
  assert.equal(
    visibilityCallerVerdict(`// public_visibility is the listing gate`),
    'not-a-caller',
    'prose mentioning the column was convicted — a phrasing ban in disguise',
  );
  assert.equal(
    visibilityCallerVerdict(`.eq('public_visibility', 'verified')`),
    'spells-it-itself',
  );
  assert.equal(
    visibilityCallerVerdict(`.in('public_visibility', SOME_CONST)`),
    'spells-it-itself',
    'a non-literal filter still decides without the predicate',
  );
  assert.equal(
    visibilityCallerVerdict(
      `import { PUBLIC_SURFACE_VISIBILITIES } from '@/lib/vendor-visibility';\n.in('public_visibility', PUBLIC_SURFACE_VISIBILITIES)`,
    ),
    'asks',
  );
  assert.equal(
    visibilityCallerVerdict(`or('public_visibility.neq.verified')`),
    'spells-it-itself',
    'the or() string form decides too',
  );
});

test('the baseline parses to something, and to the right something', () => {
  /*
    🔴 A BASELINE THAT PARSES TO THE EMPTY SET IS A GUARD THAT CHECKS NOTHING,
    and it would look exactly like a clean run. The floor is asserted before the
    comparison below is allowed to mean anything.
  */
  const known = parseBaseline(readFileSync(BASELINE, 'utf8'));
  assert.ok(
    known.length >= 10,
    `the baseline parsed to ${known.length} entries — it is meant to hold the inherited callers, so this is a parse failure, not progress`,
  );
  for (const p of known) {
    assert.match(p, /^(app|lib)\//, `baseline entry is not a source path: ${p}`);
  }
});

test('no NEW caller spells the visibility rule itself', () => {
  const { spells } = scan();
  const known = new Set(parseBaseline(readFileSync(BASELINE, 'utf8')));
  const added = spells.filter((p) => !known.has(p));

  assert.deepEqual(
    added,
    [],
    'These files filter on `public_visibility` without importing the one predicate ' +
      '(`@/lib/vendor-visibility`). They give the right answer today and will keep ' +
      'giving the OLD answer the day the rule gains a condition — silently, with ' +
      'nothing failing.\n' +
      'Either import the predicate, or add the path to ' +
      'lib/visibility-callers.baseline.txt WITH A REASON it is legitimately its own ' +
      `question:\n  ${added.join('\n  ')}`,
  );
});

test('the three surfaces fixed in this change do ask', () => {
  /*
    The point of the PR, pinned by name. `showcase-db.ts` is the one that was a
    LIVE DEFECT rather than a latent one: it filtered on nothing at all, so a
    shop set to `hidden` kept a clickable credit on Real Stories.
  */
  const { asks } = scan();
  for (const p of [
    'lib/showcase-db.ts',
    'app/sitemap-vendors.xml/route.ts',
    'app/(shell)/explore/compare/page.tsx',
  ]) {
    assert.ok(asks.includes(p), `${p} stopped asking the shared predicate`);
  }
});

test('the baseline does not name a file that already asks', () => {
  /*
    Housekeeping with teeth: once a baselined file is fixed, its line must go, or
    the baseline slowly becomes a list of things that USED to be wrong and the
    next reader cannot tell which entries still mean anything.
  */
  const { asks } = scan();
  const known = parseBaseline(readFileSync(BASELINE, 'utf8'));
  const stale = known.filter((p) => asks.includes(p));
  assert.deepEqual(stale, [], `these baseline entries now ask the predicate — delete them:\n  ${stale.join('\n  ')}`);
});
