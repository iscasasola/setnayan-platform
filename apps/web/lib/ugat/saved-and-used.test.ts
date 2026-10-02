/**
 * saved-and-used.test.ts — the SAVED-AND-USED check (Root map part 2, slice 3).
 *
 * Both sides: a dropped field and an unread form input ARE findings, a saved
 * one is not; a column nothing reads IS a finding, one a row property, a
 * filter or the database's own SQL reads is not; a sanitiser that keeps only
 * known keys and feeds a write IS flagged, one that only cleans a value is not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { droppedFieldFindings, neverReadFindings } from './root-map-checks';
import { scanReaders, scanSanitizers } from './scan-readers';
import type { UgatFieldsMap } from './fields';

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ugat-readers-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

const MAP: UgatFieldsMap = {
  version: 1,
  screens: [{ id: '/x', reads: [], writes: ['t.a', 't.ghost'], actions: ['app/x/actions.ts#save'], calcs: [] }],
  actions: [{ ref: 'app/x/actions.ts#save', fields: ['a', 'tour'], readsAll: false, writes: ['t.a', 't.ghost'], saves: { a: ['t.a'] }, dropped: ['tour'] }],
  forms: [{ from: 'app/x/form.tsx', actions: ['app/x/actions.ts#save'], inputs: ['a', 'nick', 'tour'], notRead: ['nick'] }],
  writers: [{ from: 'app/x/actions.ts', homes: ['t.a', 't.ghost', 't.sql_only', 't.event_id'] }],
  stores: [],
};

test('dropped fields: the action side and the form side are both findings', () => {
  const keys = droppedFieldFindings(MAP).map((f) => f.key);
  assert.deepEqual(keys, ['app/x/actions.ts#save drops tour', 'app/x/form.tsx posts nick to save']);
  assert.ok(!keys.some((k) => k.includes(' a ')), 'a saved field is not a finding');
});

test('saved but never used: only a column nothing at all reads', () => {
  const root = fixture({
    'app/x/page.tsx': `export default async function P() { const { data } = await s.from('t').select('*'); return <p>{data.a}</p>; }\n`,
    'app/x/actions.ts': `'use server';\nexport async function save(fd: FormData) { await s.from('t').insert({ a: fd.get('a'), ghost: 1, sql_only: 2 }); }\n`,
  });
  const migrations = join(root, 'mig');
  mkdirSync(migrations);
  writeFileSync(join(migrations, '1.sql'), `create table t (\n  ghost text,\n  sql_only text\n);\ncreate view v as select sql_only from t;\n`);
  const readers = scanReaders(root, migrations);
  const keys = neverReadFindings(MAP, readers).map((f) => f.key);
  assert.deepEqual(keys, ['t.ghost'], 'a is read off the row, sql_only by a view, event_id is a key');
});

test('a sanitiser that drops unknown keys before a save is flagged; a value cleaner is not', () => {
  const root = fixture({
    'lib/clean.ts': `const ALLOWED = new Set(['a']);
export function sanitizeConfig(raw: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(raw).filter(([k]) => ALLOWED.has(k)));
}
export function sanitizeName(v: string) { return v.trim().slice(0, 80); }
`,
    'app/x/actions.ts': `import { sanitizeConfig, sanitizeName } from '@/lib/clean';\nexport async function save(c: any) { await s.from('t').update({ config: sanitizeConfig(c), name: sanitizeName(c.n) }); }\n`,
  });
  const f = scanSanitizers(root, new Set(['app/x/actions.ts']));
  assert.deepEqual(f.map((x) => x.key), ['lib/clean.ts#sanitizeConfig']);
});

test('a sanitiser that NAMES what it drops is not silent; the same one without the report still is', () => {
  const body = (report: string) => `const KNOWN = new Set(['a']);
export function sanitizeConfig(raw: Record<string, unknown>, dropped?: string[]) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN.has(k)) { ${report} continue; }
    out[k] = v;
  }
  return out;
}
`;
  const save = `import { sanitizeConfig } from '@/lib/clean';\nexport async function save(c: any) { await s.from('t').update({ config: sanitizeConfig(c) }); }\n`;
  const loud = fixture({ 'lib/clean.ts': body('dropped?.push(k);'), 'app/x/actions.ts': save });
  assert.deepEqual(scanSanitizers(loud, new Set(['app/x/actions.ts'])), [], 'a reported drop is a decision the caller can act on');
  const quiet = fixture({ 'lib/clean.ts': body(''), 'app/x/actions.ts': save });
  assert.deepEqual(scanSanitizers(quiet, new Set(['app/x/actions.ts'])).map((x) => x.key), ['lib/clean.ts#sanitizeConfig']);
});
