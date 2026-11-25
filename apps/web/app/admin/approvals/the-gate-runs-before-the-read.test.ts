/**
 * A8·C-3 (final check 25 Nov) — approvals and escalations ask for an admin BEFORE any service-role
 * read. Both used to read the row with createAdminClient() first and check the area afterwards,
 * so a non-admin call reached the database with RLS bypassed. Read from the source, comment-stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function body(file: string, fn: string): string {
  const src = strip(readFileSync(resolve(here, file), 'utf8'));
  const start = src.indexOf(`function ${fn}(`);
  assert.ok(start >= 0, `${fn} not found in ${file}`);
  return src.slice(start, start + 1500);
}

for (const [file, fn, gate] of [
  ['actions.ts', 'requireDeciderFor', /await requireAdmin\(\)/],
  ['escalation-ops.server.ts', 'resolveEscalationOp', /await requireAdminAction\(\)/],
] as const) {
  test(`${fn}: the admin gate comes before createAdminClient()`, () => {
    const b = body(file, fn);
    const g = b.search(gate);
    const c = b.indexOf('createAdminClient()');
    assert.ok(g >= 0, `${fn} must call the admin gate`);
    assert.ok(c > g, `${fn} reads with the service role before the gate`);
  });
}
