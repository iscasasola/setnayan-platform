/**
 * a-maker-save-lands-in-place.test.ts — ⚡ A SAVE POSTED FROM THE MAKER IS
 * SHOWN IN PLACE, AND A DRAFT SAVE NEVER RUNS ON INTO THE LIVE WRITE.
 *
 * Owner, 2026-09-29: *"we also want to make sure 100% that there is no slow
 * response on the maker"*. Measured: a Maker form's action ending in
 * `redirect(return_to)` remounted the whole Maker — twice — even to the address
 * the couple was already on. Every Maker write now lands through
 * `landAfterWrite` (`lib/maker-land.server.ts`), which from the Maker
 * revalidates and RETURNS.
 *
 * That turns a safety property the compiler used to hold into one it cannot:
 * `redirect` is `never`, so code after `await saveWidgetToDraft(…)` was
 * unreachable; a helper that RETURNS lets it run, and a draft save would go on
 * to write the LIVE page (and guests would see it before Apply). So this walks
 * the source with the TypeScript parser and holds, as properties:
 *
 *   1. the LANDING functions are found, not listed: `landAfterWrite`, and any
 *      function whose body returns a call to a landing function — to a fixed
 *      point, across files (`draftEventsAndReturn` in lib, used by six actions);
 *   2. EVERY call to a landing function is the operand of a `return`
 *      (`return f(…)` or `return await f(…)`) — nothing can follow it;
 *   3. `landAfterWrite` revalidates only the one page it lands on, and only
 *      when the form came from the Maker; everywhere else it redirects.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { stripComments } from './strip-comments';

const WEB = path.resolve(__dirname, '..');

function walkDir(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Every server-side file that could land a write: actions, and lib files that name a lander. */
const FILES = [...walkDir(path.join(WEB, 'app')), ...walkDir(path.join(WEB, 'lib'))].filter((f) => {
  const src = fs.readFileSync(f, 'utf8');
  return /^\s*['"]use server['"]/.test(src) || /import 'server-only'/.test(src);
});
const parsed = FILES.map((f) => ({ f, sf: ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true) }));

const walk = (n: ts.Node, fn: (x: ts.Node) => void) => {
  fn(n);
  ts.forEachChild(n, (c) => walk(c, fn));
};
const calleeOf = (c: ts.CallExpression) => (ts.isIdentifier(c.expression) ? c.expression.text : null);

/** The function declaration (or const arrow) a node belongs to, by name. */
function enclosingName(n: ts.Node): string | null {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) {
      return p.parent.name.text;
    }
  }
  return null;
}

/** Is this call `return f(…)` / `return await f(…)`? */
function isReturned(call: ts.CallExpression): boolean {
  let p: ts.Node = call.parent;
  if (ts.isAwaitExpression(p)) p = p.parent;
  if (ts.isParenthesizedExpression(p)) p = p.parent;
  return ts.isReturnStatement(p);
}

function landers(): Set<string> {
  const set = new Set(['landAfterWrite']);
  for (let grew = true; grew; ) {
    grew = false;
    for (const { sf } of parsed) {
      walk(sf, (n) => {
        if (!ts.isCallExpression(n)) return;
        const name = calleeOf(n);
        if (!name || !set.has(name) || !isReturned(n)) return;
        const owner = enclosingName(n);
        if (owner && !set.has(owner)) {
          set.add(owner);
          grew = true;
        }
      });
    }
  }
  return set;
}

const LANDERS = landers();

test('the landing functions are found in the code, not listed by hand', () => {
  // Each of these is a draft or panel door the Maker posts to — if one stops
  // being found, the scan is not reading the actions any more.
  for (const name of ['finishDraftSave', 'saveWidgetToDraft', 'saveCanvasToDraft', 'draftEventsAndReturn', 'draftBackdrop', 'draftHero']) {
    assert.ok(LANDERS.has(name), `${name} no longer lands through landAfterWrite`);
  }
});

test('every call to a landing function is returned — nothing runs after a save lands', () => {
  const bad: string[] = [];
  let calls = 0;
  for (const { f, sf } of parsed) {
    walk(sf, (n) => {
      if (!ts.isCallExpression(n)) return;
      const name = calleeOf(n);
      if (!name || !LANDERS.has(name)) return;
      calls += 1;
      if (!isReturned(n)) {
        bad.push(`${path.relative(WEB, f)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${name}(…)`);
      }
    });
  }
  assert.ok(calls >= 30, `only ${calls} landing calls found — the scan is not reading the actions`);
  assert.deepEqual(
    bad,
    [],
    `These landing calls are not returned. From the Maker they RETURN, so the code after them runs — a draft save would write the LIVE page. Write \`return ${'f'}(…)\`:\n  ${bad.join('\n  ')}`,
  );
});

test('landAfterWrite: from the Maker it revalidates the page it lands on and returns; anywhere else it redirects', () => {
  const src = stripComments(fs.readFileSync(path.join(WEB, 'lib/maker-land.server.ts'), 'utf8'));
  const body = src.slice(src.indexOf('export function landAfterWrite('), src.indexOf('export function makerStays('));
  assert.match(body, /if \(makerStays\(formData\)\) \{[\s\S]*revalidatePath\(to\.split\('\?'\)\[0\]!\);\s*return;\s*\}\s*redirect\(resolveReturnTo\(formData, fallback, suffix\)\);/);
  assert.equal((body.match(/revalidatePath\(/g) ?? []).length, 1, 'one page, once');
  assert.doesNotMatch(body, /'layout'/, 'never a whole layout');
  const stays = src.slice(src.indexOf('export function makerStays('));
  assert.match(stays, /MAKER_STAY_FIELD\) !== '1'\) return false/);
  assert.match(stays, /isSafeInternalPath\(raw\)/, 'only a safe internal address');
  assert.match(stays, /\\\/launch\(\?:\\\?\|\$\)/, 'only the Maker’s own address');
});
