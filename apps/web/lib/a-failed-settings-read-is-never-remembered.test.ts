/**
 * a-failed-settings-read-is-never-remembered.test.ts — A READ THAT FAILED INSIDE `unstable_cache` THROWS;
 * IT NEVER RETURNS A DEFAULT FOR THE DATA CACHE TO KEEP.
 *
 * The house rule is `lib/global-settings-cache.ts`: "A REFUSED READ IS NEVER REMEMBERED". The brand
 * icons and the loader look (`lib/brand-settings.ts`, `lib/loader-settings.ts`) predate it: on a failed
 * `platform_settings` read their cached loader RETURNED the defaults, so Next's data cache stored the
 * defaults for an hour (`revalidate: 3600`) — one database hiccup, and every page wore the gold
 * defaults and the stock loader until the next revalidation, indistinguishable from an admin choice.
 * Stability sweep 2026-10-15 (production's `platform_settings` faults).
 *
 * The property, read from the AST of each callback handed to `unstable_cache` in the files below:
 *   · a branch on the read's `error` ends in `throw`, never `return`;
 *   · no `catch` inside the callback swallows a failure into a returned value.
 * The fallback lives OUTSIDE the cache, for one request.
 *
 * SABOTAGE (2026-10-15): put `return FALLBACK;` back in brand-settings' `if (error)` → RED; wrap the
 * loader callback in `try { … } catch { return DEFAULT_LOADER_CONFIG }` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const WEB = join(__dirname, '..');
const HELD = ['lib/brand-settings.ts', 'lib/loader-settings.ts'];

function cachedCallbacks(file: string): ts.FunctionLikeDeclaration[] {
  const src = readFileSync(join(WEB, file), 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: ts.FunctionLikeDeclaration[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'unstable_cache') {
      const fn = n.arguments[0];
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) out.push(fn);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** The ways a failure inside the callback is turned into a remembered value. */
export function swallowedFailures(fn: ts.FunctionLikeDeclaration): string[] {
  const found: string[] = [];
  const endsInReturn = (s: ts.Statement): boolean => {
    if (ts.isReturnStatement(s)) return true;
    if (ts.isBlock(s)) return s.statements.some((x) => ts.isReturnStatement(x)) && !s.statements.some((x) => ts.isThrowStatement(x));
    return false;
  };
  const visit = (n: ts.Node): void => {
    if (n !== fn && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n))) return;
    if (ts.isIfStatement(n) && /\berror\b/.test(n.expression.getText()) && endsInReturn(n.thenStatement)) {
      found.push(`if (${n.expression.getText()}) returns a value`);
    }
    if (ts.isCatchClause(n) && !n.block.statements.some((x) => ts.isThrowStatement(x))) {
      found.push('a catch that does not rethrow');
    }
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return found;
}

test('the detector sees both shapes, and passes a callback that throws', () => {
  const parse = (code: string) => {
    const sf = ts.createSourceFile('x.ts', `unstable_cache(${code}, ['k'])`, ts.ScriptTarget.Latest, true);
    let fn: ts.FunctionLikeDeclaration | null = null;
    const v = (n: ts.Node): void => {
      if (!fn && ts.isArrowFunction(n)) fn = n;
      ts.forEachChild(n, v);
    };
    v(sf);
    return swallowedFailures(fn!);
  };
  assert.equal(parse(`async () => { const { data, error } = await q(); if (error) { log(error); return FB; } return data; }`).length, 1);
  assert.equal(parse(`async () => { try { return await q(); } catch { return FB; } }`).length, 1);
  assert.deepEqual(parse(`async () => { const { data, error } = await q(); if (error) { log(error); throw new Error('x'); } if (!data) return FB; return data; }`), []);
});

test('brand and loader settings never hand the data cache a default for a read that failed', () => {
  for (const file of HELD) {
    const fns = cachedCallbacks(file);
    assert.equal(fns.length, 1, `${file}: expected its one unstable_cache loader, found ${fns.length}`);
    assert.deepEqual(swallowedFailures(fns[0]!), [], `${file}: a failed read is remembered for an hour as if it were the admin's choice`);
  }
});
