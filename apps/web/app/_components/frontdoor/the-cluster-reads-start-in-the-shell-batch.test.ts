import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE CLUSTER'S READS START IN THE SHELL'S BATCH (speed audit A2, 27 Nov 2026).
 *
 * `<SignedInCluster />` is an async server component drawn by `AppRailShell` AFTER the shell's `Promise.all`
 * returns, so on its own it begins its bell and switcher reads only then: a second wait in a row on every signed-in
 * public page. The shell now starts them beside its own reads, and the cluster finds the same per-request `cache()`
 * promises in hand.
 *
 * The failure this guards is an absence with no symptom: drop the early start and every page still renders the same
 * bar, only one trip later. So it checks the source, anchored on what would go missing:
 *   1. the shell starts `getDashboardShell` and `getSwitcherData` (the cluster's two reads) BEFORE its awaited batch,
 *      keyed on the request's one `getCurrentUser`;
 *   2. the start is joined into that batch, and only for the case where the shell draws the cluster;
 *   3. the cluster still reads the same two `cache()`d loaders, so the early start and the cluster share one promise
 *      (if the cluster switched loaders, the early start would be a wasted second read);
 *   4. all three loaders really are `cache()`d at source.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (p: string) => readFileSync(p, 'utf8');
/** Strip comments so a sentence in a note can never satisfy an assertion. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const shell = code(read(join(HERE, 'app-rail-shell.tsx')));
const cluster = code(read(join(HERE, 'signed-in-cluster.tsx')));

test('1 · the shell starts the cluster reads before its awaited batch', () => {
  const batchAt = shell.indexOf('await Promise.all([');
  assert.ok(batchAt > 0, 'AppRailShell has no awaited Promise.all batch');
  const before = shell.slice(0, batchAt);
  assert.match(before, /getCurrentUser\(\)\.then\(/, 'the early start is not keyed on the one getCurrentUser');
  assert.match(before, /getDashboardShell\(user\.id\)/, 'the bell read is not started before the batch');
  assert.match(before, /getSwitcherData\(user\.id\)/, 'the switcher read is not started before the batch');
  // Started, not awaited: an `await` on either would put the wait straight back.
  assert.doesNotMatch(before, /await\s+getDashboardShell|await\s+getSwitcherData/, 'a cluster read is awaited in the shell');
});

test('2 · the start is joined into the batch, only when the shell draws the cluster', () => {
  assert.match(shell, /topBarSlot === undefined\s*\?\s*getCurrentUser\(\)/, 'the early start is not gated on the shell drawing the cluster');
  const batch = shell.slice(shell.indexOf('await Promise.all(['), shell.indexOf(']);', shell.indexOf('await Promise.all([')));
  assert.match(batch, /clusterReads\.catch\(/, 'the early start is not joined into the batch');
  assert.match(shell, /topBarSlot=\{topBarSlot \?\? \(account\.signedIn \? <SignedInCluster/, 'the cluster default moved');
});

test('3 · the cluster reads the same loaders the shell started', () => {
  assert.match(cluster, /getCurrentUser\(\)/);
  assert.match(cluster, /getDashboardShell\(user\.id\)/);
  assert.match(cluster, /getSwitcherData\(user\.id\)/);
});

test('4 · every loader shared between the shell and the cluster is cache()d per request', () => {
  assert.match(read(join(WEB, 'lib/auth.ts')), /export const getCurrentUser = cache\(/);
  assert.match(read(join(WEB, 'lib/dashboard-shell.ts')), /export const getDashboardShell = cache\(/);
  assert.match(
    read(join(WEB, 'app/_components/account-switcher/get-switcher-data.ts')),
    /export const getSwitcherData = cache\(/,
  );
});
