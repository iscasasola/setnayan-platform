/**
 * every-fold-reveals-on-open.test.ts — APP-WIDE (owner 2026-11-04, "Yes, app-wide"): every section a user opens glides
 * its head to the pin line when it runs past the bottom. ONE implementation (`reveal-on-open.ts` + `reveal-engine.ts`),
 * reached through the shared `Fold`, `useRevealOnOpen`, or — for native `<details>` — one listener in the root layout.
 *
 * A NEW hand-rolled expand/collapse (a press carrying `aria-expanded` that is not a menu — no `aria-haspopup`) that does
 * not use the shared piece FAILS here. The ones that predate the rule are listed, each with a reason, in
 * `every-fold-reveals-on-open.baseline.txt`; the list may only shrink. Run with `REGEN=1` to rewrite it (and review it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const BASELINE = join(__dirname, 'every-fold-reveals-on-open.baseline.txt');

/** Uses the shared piece: the hook, the shared Fold, or the vendor `Collapsible` (which calls the hook). */
const SHARED = /useRevealOnOpen|from '@\/app\/_components\/fold'|from '\.\/fold'|_components\/collapsible'|from '\.\/collapsible'/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(p);
  }
}

export function handRolled(): string[] {
  const files: string[] = [];
  for (const d of ['app', 'components', 'lib']) walk(join(WEB, d), files);
  return files
    .filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /aria-expanded/.test(src) && !/aria-haspopup/.test(src) && !SHARED.test(src);
    })
    .map((f) => relative(WEB, f))
    .sort();
}

const baseline = () =>
  readFileSync(BASELINE, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

test('the shared pieces all reveal through the ONE implementation', () => {
  const fold = read('app/_components/fold.tsx');
  assert.match(fold, /const intend = useRevealOnOpen\(open, \(\) => \(\{ head: box\.current \}\)\);/, 'the shared Fold no longer reveals on open');
  assert.match(fold, /onClickCapture=\{pressed\}/, "the Fold's head press no longer marks the open as the user's");
  assert.match(fold, /const pressed = [\s\S]*?hasAttribute\('data-fold-head'\) : t\.closest\('\[data-fold-title\]'\)\) intend\(\);/, 'only the head or the title may mark the open');
  assert.doesNotMatch(fold, /setOpenRef\.current\(true\);\s*\n\s*intend/, 'a #hash open must never count as a user open');
  assert.match(read('app/vendor-dashboard/_components/collapsible.tsx'), /useRevealOnOpen\(open, .*\{ cause: 'gesture' \}\)/);
  assert.match(read('app/vendor-dashboard/_components/feature-accordion.tsx'), /useRevealOnOpen\(isOpen,/);
  assert.match(read('app/layout.tsx'), /<RevealDetailsOnOpen \/>/, 'native <details> lost the reveal');
  // ⚡ The hook is in every page's first load (the Maker's included): it carries the press and the lazy call, and the
  // engine + its DOM side load on the first open — never a static import of either.
  const hook = read('app/_components/reveal-on-open.ts');
  assert.match(hook, /import\('\.\/reveal-dom'\)/, 'the reveal no longer loads on the first open');
  assert.doesNotMatch(hook, /^import[^\n]*(reveal-engine|reveal-dom|pin-line|keyboard-ride)/m, 'the engine rides the first load again');
  assert.match(hook, /'touchstart', 'wheel', 'pointerdown', 'keydown'/, 'input while the engine loads no longer cancels the glide');
  const dom = read('app/_components/reveal-dom.ts');
  assert.match(dom, /from '\.\/reveal-engine'/);
  assert.match(dom, /joinPinLine\(\)/, 'the pin line must be fresh while it reveals');
  assert.match(dom, /'touchstart', 'wheel', 'pointerdown', 'keydown'/, 'input no longer cancels the glide');
});

test('no NEW hand-rolled expand/collapse — use the shared Fold or useRevealOnOpen', () => {
  const now = handRolled();
  if (process.env.REGEN) {
    writeFileSync(BASELINE, `${readFileSync(BASELINE, 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n')}\n${now.join('\n')}\n`);
    return;
  }
  const known = new Set(baseline());
  const fresh = now.filter((f) => !known.has(f));
  assert.deepEqual(
    fresh,
    [],
    `A new expand/collapse does not use the shared piece (owner 2026-11-04, app-wide reveal-on-open). Use the shared \`Fold\` (app/_components/fold.tsx), or call \`useRevealOnOpen\` from app/_components/reveal-on-open.ts. A menu says \`aria-haspopup\`.`,
  );
  const gone = [...known].filter((f) => !now.includes(f));
  assert.deepEqual(gone, [], 'These no longer hand-roll a fold — delete their baseline lines (the list only shrinks).');
});
