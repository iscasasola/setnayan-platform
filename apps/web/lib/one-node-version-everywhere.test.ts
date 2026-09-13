/**
 * ONE NODE MAJOR, DECLARED IN ONE PLACE AND AGREED EVERYWHERE.
 *
 * ── WHY THIS EXISTS — measured 2026-09-07 ──────────────────────────────────
 * Four consecutive production builds died on Vercel with
 *
 *     FATAL ERROR: Ineffective mark-compacts near heap limit
 *     Allocation failed - JavaScript heap out of memory     … exited (137)
 *
 * and every one of those PRs merged green, because CI's own `production build`
 * job PASSED on the same commits (#5287: 7m38s, PASS). Production served a
 * four-day-old deployment for hours with nothing red in front of anybody.
 *
 * The two builds were not the same build. CI pins `node-version: 22`; the
 * Vercel project resolved to **24.x**, because the repo's `engines.node` said
 * `">=22.0.0"` and Vercel takes the newest supported major that satisfies the
 * range. Different V8, different heap high-water mark — so the CI build could
 * pass at a ceiling the Vercel build blew through.
 *
 * 🔑 A RANGE IS NOT A PIN. `">=22.0.0"` reads like "we target 22" and MEANS
 * "whatever is newest". It was the only line in the repo that let production
 * run a major nothing was tested on, and it was invisible: `.nvmrc` said 22,
 * every one of the workflow pins said 22, the owner's own machine ran 22.
 *
 * This test makes the disagreement fail here instead of in production. It does
 * NOT know what Vercel is configured with — nothing in a repo can — but it
 * pins the one input Vercel actually reads from the repo, and holds the local
 * and CI declarations to the same major.
 *
 * ⚠ TO MOVE NODE MAJORS: change `.nvmrc`, root `package.json` engines, and the
 * `node-version:` pins in the workflows TOGETHER, in one PR. Changing any one
 * alone is the state this test exists to refuse.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

function majorOf(spec: string): string | null {
  const m = /(\d+)/.exec(spec.trim());
  return m ? m[1]! : null;
}

test('the repo declares a PINNED Node major, not an open-ended range', () => {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    engines?: { node?: string };
  };
  const node = pkg.engines?.node;
  assert.ok(node, 'root package.json declares no engines.node');
  assert.ok(
    !/[><^~*]|\|\||\s-\s/.test(node!),
    `engines.node is the range "${node}". Vercel resolves a range to the NEWEST ` +
      `supported major, so production ran Node 24 while CI, .nvmrc and every ` +
      `workflow pin said 22 — and CI's build passed on the exact commits Vercel ` +
      `OOM'd on. Pin the major (e.g. "22.x").`,
  );
});

test('.nvmrc, engines.node and every workflow pin name the SAME major', () => {
  const nvmrc = majorOf(readFileSync(join(REPO, '.nvmrc'), 'utf8'));
  assert.ok(nvmrc, '.nvmrc names no version');

  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    engines?: { node?: string };
  };
  const engines = majorOf(pkg.engines?.node ?? '');
  assert.equal(
    engines,
    nvmrc,
    `engines.node major (${engines}) disagrees with .nvmrc (${nvmrc})`,
  );

  // Every `node-version:` in every workflow, quoted or bare.
  const wfDir = join(REPO, '.github', 'workflows');
  const seen: Array<{ file: string; major: string }> = [];
  for (const f of readdirSync(wfDir).filter((n) => n.endsWith('.yml') || n.endsWith('.yaml'))) {
    const text = readFileSync(join(wfDir, f), 'utf8');
    for (const m of text.matchAll(/node-version:\s*['"]?([0-9][^'"\s]*)['"]?/g)) {
      const major = majorOf(m[1]!);
      if (major) seen.push({ file: f, major });
    }
  }
  assert.ok(seen.length > 0, 'no node-version pin found in any workflow — re-point this guard');
  const wrong = seen.filter((s) => s.major !== nvmrc);
  assert.deepEqual(
    wrong,
    [],
    `these workflow pins disagree with .nvmrc (${nvmrc}): ` +
      wrong.map((w) => `${w.file}=${w.major}`).join(', '),
  );
});
