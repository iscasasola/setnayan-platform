/**
 * the-accent-word-reads-on-the-navy.test.ts — 🌙 every supplier word painted in the accent reads its WORD token.
 *
 * On the supplier navy dark the main button's blue (#2272E6) is 3.46:1 as a word, so `supplier-look.css` sets
 * `--sn-accent-word` / `--color-mulberry-word` (#7DB1FF) and the Tailwind text utilities read them first
 * (`the-navy-is-readable.test.ts`). A hand-written `color: rgb(var(--sn-accent))` in a module or a style object skips
 * that and draws the unreadable blue: four did (Clients pin + "Add", Performance's "draft" link and legend), found in
 * the #7997 review, 21 Nov 2026. Fills, borders and backgrounds are not words and stay on the accent itself.
 *
 * SABOTAGE (run once, went red): put `color: rgb(var(--sn-accent));` back into clients-search.module.css → 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROOT = join(process.cwd(), 'app/vendor-dashboard');
/** `color:` (not background-color / border-color / fill) straight onto the accent, with no word token in front. */
const BARE_WORD = /(^|[^-\w])color\s*:\s*['"`]?rgb\(var\(--(sn-accent|color-mulberry)\)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('no supplier word paints the bare accent — it reads the navy word token first', () => {
  const files = walk(ROOT);
  assert.ok(files.length > 50, 'the supplier dashboard was not found — re-point this guard');
  const bad: string[] = [];
  for (const f of files) {
    stripComments(readFileSync(f, 'utf8'))
      .split('\n')
      .forEach((line, i) => {
        if (BARE_WORD.test(line)) bad.push(`${relative(process.cwd(), f)}:${i + 1}`);
      });
  }
  assert.deepEqual(bad, [], 'write rgb(var(--sn-accent-word, var(--sn-accent))) or rgb(var(--color-mulberry-word, var(--color-mulberry)))');
});

test('the four fixed in review read the word token', () => {
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
  assert.match(read('customers/_components/customers-pin.tsx'), /color: 'rgb\(var\(--sn-accent-word, var\(--sn-accent\)\)\)'/);
  assert.match(read('customers/_components/clients-search.module.css'), /color: rgb\(var\(--sn-accent-word, var\(--sn-accent\)\)\)/);
  const growing = read('performance/_components/analytics-growing.css');
  assert.equal(growing.match(/color: rgb\(var\(--color-mulberry-word, var\(--color-mulberry\)\)\)/g)?.length, 2);
});
