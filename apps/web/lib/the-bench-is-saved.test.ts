/**
 * ⚖ Owner tracker d20 (2026-10-02, first-timer test fix 16): **"bench" → "Save" /
 * "Saved"** wherever a couple reads it — "Save" on a supplier row, "Saved" for the
 * list of what they kept.
 *
 * 🔑 THE PROPERTY: no word a person reads says "bench". The identifiers stay on
 * purpose — `lib/bench-*.ts`, `bench-vendor-actions.tsx`, the `.bench-search` class,
 * `benchHref` — they are not words on a screen (`retired-names-scan.ts` judges each
 * occurrence by its AST position). Nothing needs the allowlist today, so it is empty:
 * the next row to be added must say WHY "bench" is right where it is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { RetiredName } from './retired-names-scan';
import { allowlistProblems, scanSource, scanTree, type WordAllow } from './retired-word-guard';

const NAMES: readonly RetiredName[] = [{ was: 'bench', now: 'Saved', pattern: 'bench(?:es)?' }];
const ALLOW: readonly WordAllow[] = [];

test('the scanner flags "bench" where a person reads it', () => {
  const visible = [
    ['a.tsx', `export const A = () => <span>On your bench</span>;`],
    ['b.ts', `export const t = 'Save to bench';`],
    ['c.ts', `export const t = { blurb: 'The bench — every service you are considering.' };`],
    ['d.tsx', `export const D = () => <a aria-label="Back to the bench" />;`],
    ['e.ts', `export const t = { label: 'Bench' };`],
  ] as const;
  for (const [f, s] of visible) assert.ok(scanSource(f, s, NAMES).length >= 1, `missed a visible word in: ${s}`);
});

test('the scanner leaves identifiers, routes, class names, CSS comments and benchmarks alone', () => {
  const code = [
    `import { x } from '@/lib/bench-sort';`,
    `export const r = '/dashboard/x/bench-card';`,
    `export const c = () => <div className="bench-search bench-mkt" />;`,
    `// the bench is in a comment`,
    `export const k = { benchHref: '/x' };`,
    `export const css = '.slcat .bench-search{display:flex} /* the bench search */';`,
    `export const b = 'Benchmarks for your category';`,
    `export const log = () => console.warn('bench read refused');`,
  ];
  for (const s of code) assert.deepEqual(scanSource('x.tsx', s, NAMES), [], `flagged code as copy: ${s}`);
});

test('no screen a couple reads says "bench"', () => {
  const r = scanTree(NAMES, ALLOW, new Set(['lib/the-bench-is-saved.test.ts']));
  console.log(`[bench] ${r.scanned} files · ${r.findings.length} findings`);
  assert.ok(r.scanned > 1000, `walked only ${r.scanned} files — the walk is broken`);
  assert.deepEqual(
    r.findings,
    [],
    'Say "Save" / "Saved", never "bench" (owner d20). Change the WORD, never the identifier:\n  ' + r.findings.join('\n  '),
  );
});

test('the allowlist is real, reasoned and still needed', () => {
  assert.deepEqual(allowlistProblems(ALLOW, scanTree(NAMES, ALLOW).used), []);
});
