/**
 * every-probe-says-when-it-failed.test.ts
 *
 * A soft-probe that swallows in silence is a failure the supplier is shown as
 * emptiness and nobody can find afterwards. This asserts there are none left in
 * My Shop, and that a thirteenth cannot be added quietly.
 *
 * ─── IT EXECUTES THE RULE ───────────────────────────────────────────────────
 * `probeSites` is pure and lives beside this file. It is unit-tested on its own
 * fixtures FIRST — a guard whose rule is wrong is decoration — and only then
 * run over the real tree.
 *
 * ─── WHY NOT "NO CATCH WITHOUT A LOG" EVERYWHERE ────────────────────────────
 * Scoped to the files the audit measured. A repo-wide version would convict
 * hundreds of legitimate catches on day one, be baselined wholesale, and assert
 * nothing — which is how a guard gets switched off.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { probeSites, silentProbes } from './probe-logging-rule';

const WEB = join(import.meta.dirname, '..');

/** The files this rule covers. Adding one is a deliberate act. */
const WATCHED = [
  'app/vendor-dashboard/shop/page.tsx',
  'app/vendor-dashboard/shop/_components/website-editor.tsx',
];

test('the rule tells a logged probe from a silent one', () => {
  assert.deepEqual(silentProbes('const x = 1;'), [], 'no try/catch, nothing to say');

  assert.deepEqual(
    silentProbes(['try {', '  await load();', '} catch {', '  value = null;', '}'].join('\n')),
    [3],
    'a bare swallow is the whole point of this guard',
  );

  assert.deepEqual(
    silentProbes(
      ['try {', '  await load();', '} catch (e) {', '  logQueryError("X", e);', '  value = null;', '}'].join('\n'),
    ),
    [],
    'logging in the catch body counts',
  );

  assert.deepEqual(
    silentProbes(
      ['try {', '  if (error) logQueryError("X", error);', '} catch {', '  value = null;', '}'].join('\n'),
    ),
    [],
    'a probe that already logged the error object inside the try has left its trail',
  );

  // 🔑 THE ONE THAT MATTERS. Every file here discusses logQueryError in prose.
  assert.deepEqual(
    silentProbes(
      ['try {', '  await load();', '  // TODO: logQueryError here one day', '} catch {', '  value = null;', '}'].join('\n'),
    ),
    [4],
    'a COMMENT naming the logger must not count as logging — that is the whole reason comments are stripped',
  );
});

test('the rule finds every probe, not just the silent ones', () => {
  // A count, not a set: if `probeSites` silently stopped matching a form, the
  // silent list would shrink to [] and read as a clean page.
  const src = readFileSync(join(WEB, WATCHED[0]), 'utf8');
  assert.ok(
    probeSites(src).length >= 10,
    `found only ${probeSites(src).length} probes in ${WATCHED[0]} — the rule has stopped matching, which would look exactly like a fixed page`,
  );
});

test('no probe in My Shop swallows without leaving a trail', () => {
  const offenders: string[] = [];
  for (const rel of WATCHED) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    for (const line of silentProbes(src)) offenders.push(`${rel}:${line}`);
  }

  assert.deepEqual(
    offenders,
    [],
    'These catches degrade to an empty value and record nothing, so the failure ' +
      'renders as "you have nothing" and leaves no trail anywhere.\n' +
      'Call `logQueryError(<call site>, err, { … })` before the fallback — and if ' +
      'the supplier can SEE the result, render <CouldNotLoad /> too: a log line ' +
      'never changed a pixel.\n  ' +
      offenders.join('\n  '),
  );
});
