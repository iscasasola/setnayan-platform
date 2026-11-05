/**
 * no-enterprise-plan-name.test.ts — no person reads the plan name "Enterprise".
 *
 * ⚖ OWNER 2026-10-23 (DECISION_LOG, corpus aedbf233): the supplier plans are **Solo · Pro · Ultra**. The top plan's
 * internal key stays `enterprise` (the `tier_state` enum value, `isTierAtLeast(…, 'enterprise')`, every SKU id such as
 * `enterprise_vendor_monthly`) — only the WORDS a person sees moved.
 *
 * 🔑 THE PROPERTY, NOT A PHRASING: the capitalised word `Enterprise` — standing alone as a word — appears in no
 * shipped source once its comments are removed. Code identifiers are untouched by construction: `isEnterprise`,
 * `userOwnsActiveEnterpriseVendor`, `enterprise_vendor_monthly`, `'enterprise'` never match `\bEnterprise\b` with a
 * capital E and a word boundary on both sides. So any hit is a string or JSX text — something a person reads.
 *
 * Comments are removed with the repo's ONE string-aware stripper (`lib/strip-comments.ts`), so a note that explains
 * the rename ("was Enterprise") is never convicted. Test files are not shipped and are skipped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { TIER_LABEL } from './vendor-tier-caps';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['app', 'lib'];
const WORD = /\bEnterprise\b/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
}

function offences(): string[] {
  const files: string[] = [];
  for (const d of SCAN) walk(join(ROOT, d), files);
  const hits: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!WORD.test(src)) continue; // cheap pre-filter
    const lines = stripComments(src).split('\n');
    lines.forEach((line, i) => {
      if (WORD.test(line)) hits.push(`${relative(ROOT, f)}:${i + 1}  ${line.trim().slice(0, 140)}`);
    });
  }
  return hits;
}

test('the top plan is called Ultra wherever a person reads it', () => {
  assert.equal(TIER_LABEL.enterprise, 'Ultra');
  const hits = offences();
  assert.deepEqual(
    hits,
    [],
    `"Enterprise" is still shown as a plan name (owner 2026-10-23: Solo · Pro · Ultra):\n  ${hits.join('\n  ')}`,
  );
});

test('the scan has teeth — it convicts a string and spares a comment and an identifier', () => {
  const sample = [
    "const a = 'Pick Enterprise';",
    '// was Enterprise',
    '/* Enterprise */',
    'const isEnterprise = true;',
    "const sku = 'enterprise_vendor_monthly';",
  ].join('\n');
  const found = stripComments(sample)
    .split('\n')
    .filter((l) => WORD.test(l));
  assert.deepEqual(found, ["const a = 'Pick Enterprise';"]);
});
