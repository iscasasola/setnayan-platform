/**
 * AW-12 (live, 14 Nov 2026) — "/dashboard global crash: undefined is not an object (evaluating [value])", five times in
 * three weeks. The stack sits in React's own Server Components loader (`requireModule`), in a shared chunk, at the same
 * offsets in every build: the server's payload named a component module this tab's bundle does not have — the cutover
 * moment of a deploy. The global error screen now reloads once for it (the stale-tab budget), as it does for the other
 * build-mismatch shapes. Real app bugs with a similar message must still crash honestly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMissingClientModuleError, isStaleBundleError } from './stale-bundle';

const typeError = (message: string, stack: string) => Object.assign(new TypeError(message), { stack });

/** The live Safari stack of 13 Nov (build b1bbbf8), chunk numbers restored from the 28 Oct copy. */
const LIVE_SAFARI = [
  's@https://www.setnayan.com/_next/static/chunks/5006-fc0bb8531d.js:1:56419',
  'H@https://www.setnayan.com/_next/static/chunks/5006-fc0bb8531d.js:1:59967',
  'S@https://www.setnayan.com/_next/static/chunks/5006-fc0bb8531d.js:1:57208',
  'lf@https://www.setnayan.com/_next/static/chunks/40799-42f77eb9.js:1:40725',
].join('\n');

test('the live cutover crash is a stale tab: reload once, never the crash card', () => {
  for (const m of [
    "undefined is not an object (evaluating 't.then')",
    "undefined is not an object (evaluating 't.__esModule')",
    "undefined is not an object (evaluating 't[e[2]]')",
  ]) {
    const e = typeError(m, `TypeError: ${m}\n${LIVE_SAFARI}`);
    assert.equal(isMissingClientModuleError(e), true, m);
    assert.equal(isStaleBundleError(e), true, `${m} — the global error screen reloads for it`);
  }
  const chrome = typeError(
    "Cannot read properties of undefined (reading '__esModule')",
    "TypeError: Cannot read properties of undefined (reading '__esModule')\n    at s (https://www.setnayan.com/_next/static/chunks/5006-3e0056a0.js:1:56419)\n    at H (https://www.setnayan.com/_next/static/chunks/5006-3e0056a0.js:1:59967)",
  );
  assert.equal(isMissingClientModuleError(chrome), true, 'the same failure in Chrome');
});

test('a real bug is never mistaken for it', () => {
  // The same words thrown from a ROUTE's own code (our component) — a real bug: the crash card, with its reference.
  const ours = typeError(
    "undefined is not an object (evaluating 't.then')",
    "TypeError\ns@https://www.setnayan.com/_next/static/chunks/app/dashboard/page-0123abcd.js:1:900\nlf@https://www.setnayan.com/_next/static/chunks/40799-42f77eb9.js:1:40725",
  );
  assert.equal(isMissingClientModuleError(ours), false, 'thrown in a route chunk');
  // Any OTHER property off undefined in a shared chunk is not the loader's read.
  const other = typeError("undefined is not an object (evaluating 'e.guests')", `TypeError\n${LIVE_SAFARI}`);
  assert.equal(isMissingClientModuleError(other), false, 'a different property');
  // Not a TypeError, or no stack: never.
  assert.equal(isMissingClientModuleError(Object.assign(new Error("undefined is not an object (evaluating 't.then')"), { stack: LIVE_SAFARI })), false);
  assert.equal(isMissingClientModuleError(typeError("undefined is not an object (evaluating 't.then')", '')), false);
});

test('the global error screen routes it through the stale-tab reload, once per session', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'global-error.tsx'), 'utf8');
  assert.match(src, /isStaleBundleError\(error\)\) \{\s*if \(reloadForStaleBundle\(window\.sessionStorage/);
});
