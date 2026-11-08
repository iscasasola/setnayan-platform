/**
 * 💬 AUTO-REPLY LIVES IN CLIENTS ⚙ (THE ONE BUILD, 8 Nov 2026 · spec §9 #6).
 *
 * It answers a client's first message, so it moved to the Clients ⚙ sheet — the SHIPPED `AutoReplySection`, mounted
 * unchanged, still behind its own switch. Under `customers/` it is imported exactly ONCE (one editor, one place), by
 * the ⚙ body that is drawn only when the ⚙ is open (so a Clients visit never pays its read).
 *
 * SABOTAGE (done once, 8 Nov): a second import in `customers/page.tsx` → RED; dropping the
 * `vendorAutoReplyEnabled()` gate → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

test('AutoReplySection is imported exactly once under customers/, by the ⚙ body, behind its switch', () => {
  const importers = walk(HERE)
    .filter((f) => /\bimport \{[^}]*\bAutoReplySection\b[^}]*\} from /.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(HERE, f));
  assert.deepEqual(importers, ['_components/customers-settings-body.tsx']);
  const body = stripComments(readFileSync(join(HERE, '_components/customers-settings-body.tsx'), 'utf8'));
  assert.match(body, /from '\.\.\/\.\.\/shop\/_components\/autoreply-section';/, 'the SHIPPED section, not a copy');
  assert.equal((body.match(/<AutoReplySection\b/g) ?? []).length, 1);
  assert.match(
    body,
    /\{vendorAutoReplyEnabled\(\) \? \([\s\S]*?<AutoReplySection vendorProfileId=\{vendorProfileId\} \/>[\s\S]*?\) : null\}/,
    'still behind its own switch — zero reads when it is off',
  );
  // The ⚙ body is drawn only when the ⚙ is open.
  const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  for (const m of page.matchAll(/<CustomersSettingsBody\b/g)) {
    const before = page.slice(Math.max(0, (m.index ?? 0) - 60), m.index);
    assert.match(before, /search\.gear === '1' \? $/, 'the ⚙ body (and its auto-reply read) must load only when the ⚙ is open');
  }
});
