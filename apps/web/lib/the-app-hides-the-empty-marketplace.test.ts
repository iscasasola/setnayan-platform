/**
 * Inside the iPhone/Android app an empty marketplace is hidden; the web says so.
 *
 * Owner, DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED"
 * (2): Home / Explore / Suppliers shelves that would read "No supplier has
 * opened a shop yet" are hidden in the app until shops exist; the web is
 * unchanged (`an-empty-shop-shelf-says-so.test.ts` keeps the web's line).
 *
 * PROPERTIES:
 *   · Every source file that PRINTS an empty-marketplace sentence — found by a
 *     grep for the sentence family, so a fourth page is caught unlisted — asks
 *     `hidesEmptyShelfInApp`, feeds it the request's store-shell answer, and
 *     the sentence sits behind that answer.
 *   · The rule is a MEASURED zero: one live shop shows the shelf again; a
 *     failed read (null) is not "empty" and keeps its "couldn't load" line.
 *
 * SABOTAGE (2026-10-19, run once each): the explore line un-gated (`emptyLineHidden
 * ? null` removed) → RED; `count === 0` → `(count ?? 0) <= 1` → RED; the front
 * door stops passing `storeShell={await isStoreShellRequest()}` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { hidesEmptyShelfInApp } from './empty-marketplace';

const WEB = join(__dirname, '..');

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, p));
    }
  };
  walk(join(WEB, root));
  return out;
}

const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The empty-marketplace sentence family, as printed to a person. */
const EMPTY_SENTENCE = /opened a shop yet|verified suppliers to compare — none has yet/;

// /dev/* labs are not served in production and are not part of the app.
const printers = sourceFiles('app').filter((f) => !f.startsWith('app/dev/') && EMPTY_SENTENCE.test(code(f)));

test('the empty-marketplace sentences are found by grep', () => {
  // 2026-10-19: the front door Shops shelf, /explore, /suppliers.
  assert.ok(printers.length >= 3, `expected ≥ 3 pages printing the empty-marketplace line, found: ${printers.join(', ')}`);
});

test('every page that says "no shops yet" hides it inside the app', () => {
  for (const f of printers) {
    const src = code(f);
    assert.match(src, /from '@\/lib\/empty-marketplace'/, `${f} prints the empty-marketplace line without asking hidesEmptyShelfInApp`);
    const sentenceAt = src.search(EMPTY_SENTENCE);

    // The redirect form (/suppliers): the gate runs before anything renders.
    const redirectGate = src.search(/if \(hidesEmptyShelfInApp\(await isStoreShellRequest\(\), [^)]+\)\) redirect\(/);
    if (redirectGate >= 0) {
      assert.ok(redirectGate < sentenceAt, `${f}: the app redirect must come before the line it replaces`);
      continue;
    }

    // The hide form: a flag computed by hidesEmptyShelfInApp gates the sentence.
    const flags = [
      ...src.matchAll(/(?:const\s+(\w+)\s*=|(\w+)=\{)\s*hidesEmptyShelfInApp\(/g),
    ].map((m) => m[1] ?? m[2]);
    assert.ok(flags.length > 0, `${f}: hidesEmptyShelfInApp is imported but its answer is never kept`);
    const gated = flags.some((flag) => {
      const at = src.lastIndexOf(`{${flag} ? null : (`, sentenceAt);
      return at >= 0 && sentenceAt - at < 4000;
    });
    assert.ok(gated, `${f}: the empty-marketplace line is not inside a \`{flag ? null : (\` branch fed by hidesEmptyShelfInApp`);

    // …and the store-shell answer reaching the helper is the REQUEST's.
    const fedHere = /hidesEmptyShelfInApp\(await isStoreShellRequest\(\),/.test(src);
    const fedByProp = /hidesEmptyShelfInApp\(storeShell,/.test(src);
    assert.ok(fedHere || fedByProp, `${f}: hidesEmptyShelfInApp must be fed isStoreShellRequest() (directly or as the storeShell prop)`);
  }
});

test('a component fed by a storeShell prop is mounted with the request answer', () => {
  const feed = code('app/_components/frontdoor/front-door-feed.tsx');
  assert.match(feed, /hidesEmptyShelfInApp\(storeShell, liveShopCount\)/);
  const door = code('app/_components/frontdoor/front-door.tsx');
  assert.match(door, /<FrontDoorFeed[\s\S]{0,200}storeShell=\{await isStoreShellRequest\(\)\}/,
    'front-door.tsx must pass the request store-shell answer to FrontDoorFeed');
});

test('the rule is a measured zero — one shop brings the shelf back, a failed read is not empty', () => {
  assert.equal(hidesEmptyShelfInApp(true, 0), true, 'app + no shops → hidden');
  assert.equal(hidesEmptyShelfInApp(true, 1), false, 'app + the first live shop → the shelf shows again');
  assert.equal(hidesEmptyShelfInApp(true, 12), false);
  assert.equal(hidesEmptyShelfInApp(true, null), false, 'a failed read keeps its own "couldn’t load" line');
  assert.equal(hidesEmptyShelfInApp(false, 0), false, 'the web keeps saying "none yet"');
});
