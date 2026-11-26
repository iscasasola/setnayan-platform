/**
 * A8·C-11: every admin-log action the code writes reads as plain words — no
 * "vendor", no code punctuation, no table name — and the log prints no table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../strip-comments';
import { adminLogActionWords } from './admin-log-words';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every `action: '…'` literal written in app/ and lib/. */
function everyActionKey(): string[] {
  const keys = new Set<string>();
  for (const f of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('admin_audit_log')) continue;
    for (const m of src.matchAll(/action: '([a-z_.:]+)'/g)) if (m[1]) keys.add(m[1]);
  }
  return [...keys];
}

test('known keys read as plain words', () => {
  assert.equal(adminLogActionWords('vendor_tier_set'), 'Supplier tier set');
  assert.equal(adminLogActionWords('taxonomy.set_hidden'), 'Catalogue set hidden');
  assert.equal(adminLogActionWords('approval_request_created'), 'Approval request created');
  assert.equal(adminLogActionWords('approval_executed'), 'Request executed');
  assert.equal(adminLogActionWords(''), 'Admin action');
});

test('every action the code writes reads with no "vendor", no code punctuation and no table name', () => {
  const keys = everyActionKey();
  assert.ok(keys.length > 50, `expected the audit actions to be found, saw ${keys.length}`);
  for (const k of keys) {
    const w = adminLogActionWords(k);
    assert.doesNotMatch(w, /vendor/i, `${k} → ${w}`);
    assert.doesNotMatch(w, /[_.:]/, `${k} → ${w}`);
    assert.doesNotMatch(w, /\b(vendor_profiles|service_categories|canonical_service_taxonomy|admin_audit_log)\b/, `${k} → ${w}`);
  }
});

test('the admin log prints the words and never the table', () => {
  const page = stripComments(readFileSync(join(WEB, 'app/admin/admin-log/page.tsx'), 'utf8'));
  assert.match(page, /adminLogActionWords\(r\.action\)/);
  assert.doesNotMatch(page, /\$\{r\.target_table\}/);
  assert.doesNotMatch(page, /function actionWords\(/);
});
