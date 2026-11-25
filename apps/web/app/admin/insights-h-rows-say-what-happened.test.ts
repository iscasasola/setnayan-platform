/**
 * insights-h-rows-say-what-happened.test.ts — final check area 8, the plan's batch A8 H-rows taken by checker 8-1
 * on the owner's word (25 Nov 2026): H-3, H-6, H-10, H-15. H-1 rides #8337 (same Overview lines); H-7, H-8, H-9,
 * H-11 and H-16 are in #8337 too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:^|\\n)(?:export )?(?:async )?function ${name}\\(`));
  assert.ok(at >= 0, `${name} not found`);
  const rest = src.slice(at + 1);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
}

test('A8·H-3 · a failed count on the entity map reads "—" and "couldn’t read", never 0 / "live"', () => {
  const data = read('lib/ugat/data.ts');
  const head = body(data, 'headCount');
  assert.doesNotMatch(head, /return 0;/, 'a refused count is never 0');
  assert.equal((head.match(/return null;/g) ?? []).length, 2, 'both the refusal and the throw are null');
  assert.match(data, /logQueryError\('ugat wallets sum', error\);\s*return null;/);
  const iface = data.slice(data.indexOf('export interface UgatCounts {'), data.indexOf('export interface UgatCounts {') + 6000);
  assert.match(iface, /order: number \| null;/);
  assert.match(iface, /ordersPending: number \| null;/);
  assert.match(iface, /billingActiveSubs: number \| null;/);
  assert.match(data, /return \{ \.\.\.base, unread: true,/);
  const ui = read('app/admin/ugat/_components/ugat-console.tsx');
  assert.match(ui, /function fmtCount\(n: number \| null\): string \{\s*return n === null \? '—'/);
  assert.match(ui, /const count = counts\[t\.countKey\] \?\? null;/);
  assert.match(ui, /node\.count === null \? <span>couldn&rsquo;t read<\/span>/);
  assert.match(ui, /data\.unread \? 'Couldn’t read this table'/);
});

test('A8·H-6 · a refused Resolve, Ignore or Archive is said and the rows go back to Active', () => {
  const s = read('app/admin/connection-logs/connection-logs-client.tsx');
  const one = s.slice(s.indexOf('const resolveOne = useCallback('), s.indexOf('const archiveAll = useCallback('));
  assert.match(one, /const res = await setLogStatus\(row\.id, status\);\s*if \(!res\.ok\) throw new Error/);
  assert.match(one, /catch \{[\s\S]*?setActive\([\s\S]*?toast\.error\(/);
  const all = s.slice(s.indexOf('const archiveAll = useCallback('), s.indexOf('const archiveAll = useCallback(') + 2000);
  assert.match(all, /const res = await resolveAllActive\(scope\);\s*if \(!res\.ok\) throw new Error/);
  assert.match(all, /catch \{[\s\S]*?setResolved\([\s\S]*?setActive\([\s\S]*?toast\.error\(/);
});

test('A8·H-10 · the Sentry smoke test says it did not reach the server on a network failure', () => {
  const src = read('app/admin/operations-hiring/_components/smoke-test-panel.tsx');
  const at = src.indexOf('async function runSentryTest(');
  assert.ok(at > 0, 'runSentryTest not found');
  const b = src.slice(at, src.indexOf('\n  }\n', at));
  assert.doesNotMatch(b, /network-error-from-throw/);
  const caught = b.slice(b.indexOf('} catch'));
  assert.doesNotMatch(caught.slice(0, caught.indexOf('} finally')), /ok: true/);
  assert.match(caught, /setLastError\('The test did not reach the server/);
});

test('A8·H-15 · a refused menu edit returns its reason and writes no audit row', () => {
  const s = read('app/admin/menus/actions.ts');
  for (const fn of ['setSlotLabel', 'setSlotLucideIcon', 'setSlotNoIcon', 'setSlotHidden', 'resetSlot', 'uploadSlotIcon']) {
    const b = body(s, fn);
    assert.match(b, /Promise<MenuWriteResult>/, `${fn} returns its result`);
    assert.match(b, /const \{ error \} = await admin\.from\('nav_slot_override'\)/, `${fn} reads its write`);
    const refused = b.indexOf('if (error) return REFUSED;');
    assert.ok(refused > 0 && refused < b.indexOf('await audit('), `${fn} audits before checking the write`);
  }
  const ed = read('app/admin/menus/_components/menu-registry-editor.tsx');
  assert.match(ed, /const res = await write\(\);\s*if \(!res\.ok\) throw new Error\(res\.error\);/);
  assert.match(ed, /toast\.error\(/);
  for (const call of ['setSlotHidden(', 'resetSlot(', 'setSlotNoIcon(', 'uploadSlotIcon(', 'setSlotLabel(', 'setSlotLucideIcon(']) {
    const i = ed.indexOf(`() => ${call}`);
    assert.ok(i > 0, `${call} is not run through runWrite`);
  }
});
