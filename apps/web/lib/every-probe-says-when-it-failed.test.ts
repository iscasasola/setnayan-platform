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
import { probeSites, silentProbes, silentPromiseHandlers } from './probe-logging-rule';

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

  // 🪤 THE SHAPE THAT ONCE SLIPPED THROUGH. A single-line try/catch defeated the
  // indentation scan this rule used to do: the "catch body" ran on to the
  // enclosing function's closing brace, and any logger down there counted as
  // this probe's. It went green while a silent probe sat in the file.
  assert.deepEqual(
    silentProbes(['let v = null;', 'try { v = await load(); } catch { v = null; }', 'logQueryError("elsewhere", e);'].join('\n')),
    [2],
    'a one-line try/catch must not borrow a logger from further down the file',
  );

  // The same shape, legitimately logging on its own line.
  assert.deepEqual(
    silentProbes(['try { v = await load(); } catch { logQueryError("X", e); v = null; }'].join('\n')),
    [],
    'a one-line catch that really does log is not a finding',
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


test('the rule sees the PROMISE family too, not just try/catch', () => {
  /*
    🔑 THE FIRST VERSION OF THIS GUARD DID NOT. It matched `} catch {` only, and
    reported My Shop clean while TWELVE `.catch(() => [])` / `.then(ok, () => 0)`
    handlers sat in the same file swallowing the supplier's own statistics.
  */
  assert.deepEqual(silentPromiseHandlers('load().catch(() => [])'), [1]);
  assert.deepEqual(
    silentPromiseHandlers('load().catch((e) => { logQueryError("X", e); return []; })'),
    [],
    'a .catch that logs is not a finding',
  );
  assert.deepEqual(
    silentPromiseHandlers('q.then((r) => r.count ?? 0, () => 0)'),
    [1],
    'the SECOND argument to .then is a rejection handler and this one says nothing',
  );
  assert.deepEqual(
    silentPromiseHandlers('p.then((r) => r.length)'),
    [],
    'a one-argument .then handles no failure, so it is not a silent handler',
  );
  assert.deepEqual(
    silentPromiseHandlers('p.then((r) => f(a, b), () => { logQueryError("X"); return 0; })'),
    [],
    'a comma INSIDE the success arm must not be read as the argument separator',
  );
});

test('the guard is measured against the tree it was written for', () => {
  /*
    🔴 A ZERO IS ONLY WORTH SOMETHING IF THE RULE CAN FIND ONE. Both families are
    asserted to be empty in the watched files above — this pins that the rule
    still MATCHES, by running it over the pre-fix source committed alongside as a
    fixture would be ideal; short of that, the unit fixtures above are the floor.

    ⚠ WHAT THIS GUARD CANNOT SEE, stated so a clean run does not imply it was
    checked: `.then((r) => r.count ?? 0)` on a supabase builder NEVER REJECTS.
    The failure arrives through the success path as a null that `?? 0` turns into
    a confident zero, and there is no handler to inspect. That family is closed
    by using `SoftReadLog.count` / `.rpcNumber`, which read `error`, not by this
    rule. A guard that quietly implies otherwise is worse than no guard.
  */
  const src = readFileSync(join(WEB, WATCHED[0]), 'utf8');
  assert.ok(probeSites(src).length >= 10, 'try/catch matching has stopped working');
  assert.ok(
    // \b on BOTH sides: a bare /SoftReadLog/ also matches `SoftReadLogX`, so a
    // sabotage that renamed the import sailed through this very assertion.
    /\bSoftReadLog\b/.test(src),
    'My Shop no longer uses SoftReadLog — the supabase-count family it closes is ' +
      'invisible to this rule, so dropping it would remove the only thing checking ' +
      'that family while this guard still reported green',
  );
});

test('no probe in My Shop swallows without leaving a trail', () => {
  const offenders: string[] = [];
  for (const rel of WATCHED) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    for (const line of silentProbes(src)) offenders.push(`${rel}:${line} (try/catch)`);
    for (const line of silentPromiseHandlers(src)) offenders.push(`${rel}:${line} (promise handler)`);
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
