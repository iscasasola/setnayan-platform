/**
 * 🖋 A CUSTOM PROPERTY NEVER NAMES ITSELF IN ITS OWN VALUE — not even as a fallback.
 *
 * `--x: var(--y, var(--x))` reads like "use --y, else whatever --x already was". It is not: a custom property that
 * depends on itself is a CYCLE, and the browser makes the property INVALID on that element. Nothing throws. Text
 * usually still reads (it inherits a `color` from somewhere), so the fault is silent — but every other use of the
 * property on that element and under it loses its declaration. (Chromium only reaches the cycle when the first name
 * is unset — which is exactly why it hides: it works wherever the first name happens to be pinned.)
 *
 * Measured 2026-10-10 (Chromium) on `.sn-editorial .pahina-plate`, which shadowed `--color-ink` that way from
 * 2026-09-25. WHERE the browser reached the self-naming fallback — wherever nothing pinned `--color-ink-on-plate`,
 * which was the Maker lab's guest pages — the plate's border and its printed inner frame computed to `none`,
 * `text-ink/80` drew at full strength and `border-ink/15` drew a full-ink line. Real guest pages pin the plate's ink,
 * so the fallback was never reached there and they were fine (the live sample event measured `solid` / `solid` the
 * same day): a latent fault, one unpinned surface away from every plate. The fix gives the page's ink a second name
 * on the element that sets it (`--color-ink-page` on `.sn-editorial`) and falls back to THAT.
 *
 * This guard reads the property, not a phrasing: any declaration, any name, any file under `app/` that ends `.css`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const APP = join(__dirname, '..', 'app');

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) cssFiles(p, out);
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}

/** Every `--name: value;` in a sheet whose value contains `var(--name` — with the comments taken out first. */
export function selfNamingDeclarations(css: string): string[] {
  const bare = stripComments(css);
  const hits: string[] = [];
  const decl = /(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]*)/g;
  for (let m = decl.exec(bare); m; m = decl.exec(bare)) {
    const name = m[2]!;
    const value = m[3]!;
    if (new RegExp(`var\\(\\s*${name}(?![A-Za-z0-9_-])`).test(value)) {
      const line = bare.slice(0, m.index).split('\n').length;
      hits.push(`${name} (line ${line}): ${value.trim().slice(0, 80)}`);
    }
  }
  return hits;
}

test('the sweep can see the fault it is for', () => {
  assert.deepEqual(selfNamingDeclarations('.a { --color-ink: var(--color-ink-on-plate, var(--color-ink)); }').length, 1);
  assert.deepEqual(selfNamingDeclarations('.a { --x: var( --x ); }').length, 1);
  /* …and is not fooled by a longer name, a comment, or an honest second name. */
  assert.deepEqual(selfNamingDeclarations('.a { --color-ink: var(--color-ink-on-plate, var(--color-ink-page)); }'), []);
  assert.deepEqual(selfNamingDeclarations('.a { /* --x: var(--x) */ --x: 1; }'), []);
});

test('no stylesheet declares a custom property in terms of itself', () => {
  const files = cssFiles(APP);
  assert.ok(files.length > 0, 'the sweep found no stylesheet — a guard over zero files guards nothing');
  const found = files.flatMap((f) => selfNamingDeclarations(readFileSync(f, 'utf8')).map((h) => `${f.slice(APP.length + 1)} · ${h}`));
  assert.deepEqual(found, [], 'a custom property that names itself is a cycle: the browser makes it invalid on that element. Give the outer value a second name on the element that sets it, and fall back to that.');
});

test('a plate falls back to the page’s ink under its second name, and the scope carries that name', () => {
  const css = readFileSync(join(APP, 'globals.css'), 'utf8');
  assert.equal((css.match(/--color-ink: var\(--color-ink-on-plate, var\(--color-ink-page\)\);/g) ?? []).length, 2, 'the plate and the reply card both shadow the ink');
  assert.match(css, /\.sn-editorial \{[^}]*--color-ink-page: var\(--color-ink\);/, 'the scope no longer gives the page’s ink its second name — a plate with no pinned ink would have none');
});
