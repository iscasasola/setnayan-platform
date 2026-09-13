/**
 * return-path.test.ts — a reply that lands on Decisions must still refresh.
 *
 * `revalidatePath` tags the path VERBATIM (Next 15.5), so a query in it purges
 * nothing. These assertions pin the split: revalidate the route, redirect to
 * the whole URL. The last one pins the WIRING, because a correct helper that
 * nobody calls fixes nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { revalidationTarget } from '@/lib/return-path';
import { stripComments } from '@/lib/strip-comments';

test('a bare path is returned unchanged — every existing caller is unaffected', () => {
  assert.equal(revalidationTarget('/vendor-dashboard/messages/abc'), '/vendor-dashboard/messages/abc');
  assert.equal(revalidationTarget('/dashboard'), '/dashboard');
});

test('the query and the fragment are cut, and only they are', () => {
  assert.equal(
    revalidationTarget('/dashboard/e1/messages/t1?view=decisions'),
    '/dashboard/e1/messages/t1',
  );
  assert.equal(revalidationTarget('/x/y#decisions'), '/x/y');
  assert.equal(revalidationTarget('/x/y?view=files#top'), '/x/y');
  assert.equal(revalidationTarget('/x/y?'), '/x/y');
});

test('no chat reply action revalidates a raw return path any more', () => {
  const WEB = join(import.meta.dirname, '..');
  for (const [file, v] of [
    ['app/_components/appointments-actions.ts', 'returnPath'],
    ['app/_components/negotiation-actions.ts', 'back'],
  ] as const) {
    const src = stripComments(readFileSync(join(WEB, file), 'utf8'));
    const raw = src.match(new RegExp(`revalidatePath\\(\\s*${v}\\s*\\)`, 'g')) ?? [];
    const wrapped = src.match(new RegExp(`revalidatePath\\(\\s*revalidationTarget\\(\\s*${v}\\s*\\)\\s*\\)`, 'g')) ?? [];
    assert.equal(raw.length, 0, `${file} revalidates the raw ${v} ${raw.length}× — a ?view= in it purges nothing`);
    assert.ok(wrapped.length > 0, `${file} no longer routes ${v} through revalidationTarget (renamed? then update this)`);
  }
});
