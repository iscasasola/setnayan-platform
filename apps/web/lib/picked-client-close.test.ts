/**
 * ✕ ON A CUSTOMER CARD OPENED FROM TODAY RETURNS TO TODAY (walk 16 Nov 2026, EB-290).
 *
 * What would silently undo it:
 *   1. Today's door into a card stops saying it came from Today;
 *   2. the page stops turning `?from=today` into the shell's close target (or the shell ignores it);
 *   3. any other value starts sending ✕ somewhere new (it must keep the Clients list).
 *
 * Run: cd apps/web && npx tsx --test lib/picked-client-close.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLIENTS_LIST_HREF, TODAY_HREF, fromToday, pickedClientCloseHref } from './picked-client-close';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const read = (p: string) => strip(readFileSync(join(__dirname, '..', p), 'utf8'));

test('1 · a Today door into a card says it came from Today, and that closes to Today', async () => {
  const { nextHref } = await import('../app/vendor-dashboard/_components/supplier-today-first-screen');
  const href = nextHref({ to: 'card', eventId: 'e1', tab: 'details' });
  assert.equal(href, '/vendor-dashboard/clients/e1?tab=details&from=today');
  assert.equal(pickedClientCloseHref(new URL(href, 'https://x').searchParams.get('from')), TODAY_HREF);
});

test('2 · the page hands ?from to the shell, and the shell hands it to PickedShell', () => {
  const page = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.equal((page.match(/closeHref=\{pickedClientCloseHref\(search\.from\)\}/g) ?? []).length, 1, 'the page passes the close target');
  const shell = read('app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx');
  assert.equal((shell.match(/closeHref=\{closeHref\}/g) ?? []).length, 1, 'the shell passes its close target on');
});

test('3 · anything else keeps the Clients list', () => {
  for (const v of [undefined, null, '', 'clients', 'TODAY', 'https://evil.example', ['today']]) {
    assert.equal(pickedClientCloseHref(v), CLIENTS_LIST_HREF, String(v));
  }
  assert.equal(fromToday('/a'), '/a?from=today');
});
